import io
import logging
import re
import uuid
from pathlib import Path
from typing import Optional

from PIL import Image

from app.schemas import ImportIngredientGroup, ImportResult

logger = logging.getLogger(__name__)

try:
    import pytesseract

    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

try:
    import fitz  # PyMuPDF

    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

_IMPORT_UPLOAD_DIR = Path("/app/uploads/imported")


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _split_step_sentences(text: str) -> list[str]:
    """Split a combined step string into individual sentences.

    Only splits where a non-whitespace token ending with ``.!?`` is longer
    than 5 characters (i.e. not an abbreviation such as "ca.", "z.B.",
    "bzw.", "etc.", "evtl.", "inkl.") **and** is immediately followed by
    whitespace and an uppercase letter (start of a new German/English sentence).
    The uppercase check uses ``[A-ZÄÖÜ]`` which covers German umlauts; this is
    intentional as KochSchmiede is a German-language application.

    Examples that ARE split:
    - "…verteilen. Bei 180 °C…"   ("verteilen." = 10 chars)
    - "…geben. Das …"             ("geben." = 6 chars)
    Examples that are NOT split:
    - "…ca. 20 Minuten…"          ("ca." = 3 chars – abbreviation)
    - "…evtl. Tomaten…"           ("evtl." = 5 chars – abbreviation)
    """
    sentences: list[str] = []
    start = 0
    for m in re.finditer(r"(\S+[.!?])\s+(?=[A-ZÄÖÜ])", text):
        token = m.group(1)
        if len(token) > 5:
            sentences.append(text[start : m.start() + len(token)].strip())
            start = m.end()
    tail = text[start:].strip()
    if tail:
        sentences.append(tail)
    return [s for s in sentences if s]


def _parse_ocr_text(text: str) -> ImportResult:
    """Parse raw OCR / PDF text into structured recipe data using heuristics."""
    # Preserve blank lines so they can serve as paragraph separators in the
    # steps section; only strip leading/trailing whitespace per line.
    raw_lines = [l.strip() for l in text.splitlines()]

    title: Optional[str] = None
    description: Optional[str] = None
    ingredients: list[str] = []
    ingredient_groups: list[ImportIngredientGroup] = []
    steps: list[str] = []
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    servings: Optional[int] = None

    amount_re = re.compile(
        r"(\d+[\.,]?\d*\s*(g|kg|ml|l|cl|tl|el|tbsp|tsp|cup|oz|lb|prise|stk|stück)?)",
        re.IGNORECASE,
    )
    step_re = re.compile(r"^(\d{1,3}[\.\):]\s+|schritt\s+\d+|step\s+\d+)", re.IGNORECASE)

    # Ingredient sub-group headers.
    # Matches both short forms ("Für den Teig:", "Füllung:") and the longer
    # Chefkoch single-page form ("Zutaten für den Teig:", "Zutaten für die Sauce:").
    # \w[^.!?]{1,34} requires at least 2 chars after the article, preventing
    # bare "Für den" from matching; also prevents matching full sentences that
    # end with .!? because [^.!?] won't consume those characters.
    group_header_re = re.compile(
        r"^(?:"
        r"zutaten\s+für\s+(?:den|die|das)\s+\w[^.!?]{1,34}"  # "Zutaten für den Teig"
        r"|für\s+\w[^.!?]{1,34}"                              # "Für den Teig"
        r"|for\s+the\s+\w[^.!?]{1,24}"                        # "For the dough"
        r"|teig|soße|sauce|füllung|topping|dressing|marinade"
        r"|glasur|belag|kruste|suppe|brühe|fond|garnierung|creme|sirup"
        r")[\s:]*$",
        re.IGNORECASE,
    )

    # Boilerplate lines common in printed/exported recipe PDFs.
    # "gesamtzeit" has no trailing \b so it also matches "Gesamtzeitca." (PDF
    # formatting where no space appears between the keyword and "ca.").
    noise_re = re.compile(
        r"^(?:chefkoch|rezept\s+online\b|aufrufen\b|rezept\s+von\b|schwierigkeitsgrad\b"
        r"|gesamtzeit|portionsgröße\b|kalorien\b|nährwert|foto[:\s]).*$",
        re.IGNORECASE,
    )

    # Timing patterns.
    # Use [\s:]* (zero-or-more) instead of [\s:]+ so that PDFs where the
    # keyword is immediately followed by "ca." without a space are also
    # matched, e.g. "Arbeitszeitca. 35 Minuten" or "Koch-/Backzeitca. 20 Min".
    arbeitszeit_re = re.compile(
        r"\barbeitszeit[\s:]*(?:ca\.?\s*)?(\d+)\s*min", re.IGNORECASE
    )
    kochzeit_re = re.compile(
        r"\b(?:koch|back)[-/\w]*zeit[\s:]*(?:ca\.?\s*)?(\d+)\s*min", re.IGNORECASE
    )

    # Patterns for standalone timing-keyword lines whose value appears on the
    # *next* line, e.g. "Arbeitszeit\nca. 35 Minuten".
    arbeitszeit_keyword_re = re.compile(r"^arbeitszeit\s*$", re.IGNORECASE)
    kochzeit_keyword_re = re.compile(r"^(?:koch|back)[-/\w]*zeit\s*$", re.IGNORECASE)
    # "Gesamtzeit" standalone keyword – its value on the next line is discarded.
    gesamtzeit_keyword_re = re.compile(r"^gesamtzeit\s*$", re.IGNORECASE)
    # "Schwierigkeitsgrad" standalone keyword – its value line ("normal", …) is
    # discarded too so it never becomes the recipe description.
    schwierigkeitsgrad_keyword_re = re.compile(r"^schwierigkeitsgrad\s*$", re.IGNORECASE)
    time_value_re = re.compile(r"(?:ca\.?\s*)?(\d+)\s*min", re.IGNORECASE)

    # Patterns for column-based PDF ingredient tables where amounts, units and
    # names may appear on separate lines or in reversed order.
    # The unit group is shared across all three patterns to ensure consistency.
    _UNITS = r"(?:g|kg|ml|l|cl|tl|el|tbsp|tsp|cup|oz|lb|prise|stk|stück|scheibe[\w/]*)"
    # Matches a whole line that is only an amount (with optional unit).
    pure_amount_re = re.compile(
        r"^\d+[\.,]?\d*\s*" + _UNITS + r"?$",
        re.IGNORECASE,
    )
    # Matches a whole line that is only a unit abbreviation (no number).
    pure_unit_re = re.compile(
        r"^" + _UNITS + r"$",
        re.IGNORECASE,
    )
    # Matches a line with unit *before* the amount, e.g. "g 250" (reversed columns).
    unit_then_amount_re = re.compile(
        r"^" + _UNITS + r"\s+\d+[\.,]?\d*$",
        re.IGNORECASE,
    )

    in_ingredients = False
    in_steps = False
    current_group: Optional[dict] = None  # {"name": str, "ingredients": list[str]}
    # Lines within the current step paragraph; flushed as one step on blank line.
    step_buffer: list[str] = []
    # Flags set when a timing keyword appears alone; the value is expected on
    # the very next non-blank line.
    pending_prep_time = False
    pending_cook_time = False
    # Set after a standalone "Gesamtzeit" keyword; causes the next time-value
    # line to be discarded (KochSchmiede only uses prep_time and cook_time).
    pending_total_time = False
    # Set after a standalone "Schwierigkeitsgrad" keyword so that the value
    # line ("normal", "leicht", …) is unconditionally discarded and never
    # mistakenly captured as the recipe description.
    pending_discard = False
    # Amount/unit prefix buffered from the previous line when the ingredient
    # table spreads over multiple lines (e.g. "250 g" then "Magerquark").
    pending_ingredient_prefix: Optional[str] = None

    ingredients_headers = {"zutaten", "ingredients", "zutat", "ingredient"}
    steps_headers = {"zubereitung", "anleitung", "instructions", "steps", "preparation", "method"}

    def _flush_step_buffer() -> None:
        nonlocal step_buffer
        if not step_buffer:
            return
        cleaned_parts = []
        for buf_line in step_buffer:
            # Skip lines that are just standalone step-number markers ("1", "2", …)
            if re.match(r"^\d+$", buf_line):
                continue
            # Strip standard numbered-step prefix ("1.", "1)", "1:", "1 ")
            cleaned = re.sub(r"^\d+[\.\):\s]+", "", buf_line).strip()
            if cleaned:
                cleaned_parts.append(cleaned)
        combined = " ".join(cleaned_parts).strip()
        if combined:
            # Split the combined text into individual sentences at real sentence
            # boundaries: a word ending with .!? that is longer than 5 chars (so
            # not an abbreviation like "ca.", "z.B.", "evtl.") followed by
            # whitespace and then an uppercase letter (start of new sentence).
            # This turns multi-sentence step blocks into individual step entries.
            sentences = _split_step_sentences(combined)
            steps.extend(sentences)
        step_buffer = []

    def _is_sentence_end(s: str) -> bool:
        """Return True only when *s* ends at a real sentence boundary.

        Avoids flushing the step buffer mid-sentence when a line ends with a
        common German abbreviation that carries a period (e.g. "ca.", "z.B.",
        "bzw.", "evtl.", "inkl.").  The heuristic: if the last token (word
        ending in '.') is 5 characters or shorter, treat it as an abbreviation
        and do NOT flush.  Real sentence-ending words ("lassen.", "backen.",
        "verteilen.") are typically longer (≥ 6 characters).
        """
        if not s:
            return False
        if s[-1] in "!?":
            return True
        if s[-1] != ".":
            return False
        # Split off the last whitespace-separated token.
        last_token = s.rsplit(None, 1)[-1] if s.strip() else ""
        # Abbreviations are short (≤ 5 chars incl. the dot): ca., z.B., bzw.,
        # evtl., inkl., etc.  Real sentence-ending words are longer.
        return len(last_token) > 5

    def _flush_current_group() -> None:
        nonlocal current_group
        if current_group is not None:
            ingredient_groups.append(
                ImportIngredientGroup(
                    name=current_group["name"],
                    ingredients=current_group["ingredients"][:30],
                )
            )
            current_group = None

    for line in raw_lines:
        # ── Blank line: paragraph separator ──────────────────────────────────
        if not line:
            pending_total_time = False
            pending_discard = False
            if in_steps:
                _flush_step_buffer()
            pending_prep_time = False
            pending_cook_time = False
            # pending_ingredient_prefix is intentionally preserved across blank
            # lines within the ingredient section: "250 g\n\nMagerquark" must
            # still be combined into one ingredient string.
            continue

        lower = line.lower().rstrip(":").strip()

        # ── Consume the value line that follows a standalone timing keyword ───
        if pending_prep_time:
            pending_prep_time = False
            m = time_value_re.search(line)
            if m and prep_time is None:
                prep_time = int(m.group(1))
                continue
        if pending_cook_time:
            pending_cook_time = False
            m = time_value_re.search(line)
            if m and cook_time is None:
                cook_time = int(m.group(1))
                continue

        # ── Discard value line that follows a standalone "Gesamtzeit" keyword ──
        if pending_total_time:
            pending_total_time = False
            if time_value_re.search(line):
                continue  # discard total-time value (e.g. "ca. 55 Minuten")

        # ── Discard value line that follows "Schwierigkeitsgrad" (e.g. "normal") ──
        if pending_discard:
            pending_discard = False
            continue

        # ── Metadata-only standalone keywords checked BEFORE noise_re ─────────
        # noise_re matches "Gesamtzeit" and "Schwierigkeitsgrad" (filtering those
        # keyword lines correctly), but their *value* lines ("ca. 55 Minuten",
        # "normal") must also be discarded.  By detecting standalone occurrences
        # here we set the pending flags before noise_re can consume the keyword
        # line without side-effects.
        if gesamtzeit_keyword_re.match(line):
            pending_total_time = True
            continue
        if schwierigkeitsgrad_keyword_re.match(line):
            pending_discard = True
            continue

        # ── Skip known noise / boilerplate ───────────────────────────────────
        if noise_re.match(line):
            continue

        # ── Extract timing metadata (valid anywhere in the document) ─────────
        if prep_time is None:
            m = arbeitszeit_re.search(line)
            if m:
                prep_time = int(m.group(1))
                continue
        if cook_time is None:
            m = kochzeit_re.search(line)
            if m:
                cook_time = int(m.group(1))
                continue

        # ── Standalone timing keyword (value on the next line) ────────────────
        if prep_time is None and arbeitszeit_keyword_re.match(line):
            pending_prep_time = True
            continue
        if cook_time is None and kochzeit_keyword_re.match(line):
            pending_cook_time = True
            continue

        # ── Ingredient group headers (checked BEFORE the generic section header
        #    so "Zutaten für den Teig:" is treated as a named group, not merely
        #    as a second "Zutaten" section restart) ────────────────────────────
        if group_header_re.match(line):
            _flush_step_buffer()
            in_ingredients = True
            in_steps = False
            _flush_current_group()
            group_name = line.rstrip(":").strip()
            # Normalise Chefkoch-style long form "Zutaten für den Teig" →
            # short form "Für den Teig" so group labels are clean in the UI.
            group_name = re.sub(r"^Zutaten\s+", "", group_name, flags=re.IGNORECASE)
            if group_name:
                group_name = group_name[0].upper() + group_name[1:]
            current_group = {"name": group_name, "ingredients": []}
            pending_ingredient_prefix = None
            continue

        # ── Section: Ingredients ─────────────────────────────────────────────
        # "Zutaten für N Portionen" starts the section AND carries servings.
        # Plain "Zutaten" (and exact English equivalents) also starts the section.
        if lower in ingredients_headers or lower.startswith("zutaten"):
            if servings is None:
                m = re.search(
                    r"zutaten\s+für\s+(\d+)\s*(?:portion|person|stück|serving)",
                    line,
                    re.IGNORECASE,
                )
                if m:
                    servings = int(m.group(1))
            _flush_step_buffer()
            in_ingredients = True
            in_steps = False
            pending_ingredient_prefix = None
            continue

        # ── Section: Steps / Preparation ─────────────────────────────────────
        if lower in steps_headers:
            _flush_current_group()
            _flush_step_buffer()
            in_steps = True
            in_ingredients = False
            pending_ingredient_prefix = None
            continue

        # ── Title / Description: first two meaningful pre-section lines ─────────
        # Only extract title and description from lines that appear before we
        # enter the ingredient or step sections.  This prevents ingredient names
        # (e.g. "Magerquark") from being mistaken for the recipe title when the
        # PDF content stream places the ingredient table before the title text.
        if not in_ingredients and not in_steps:
            is_title_candidate = (
                len(line) > 3 and not amount_re.search(line) and not line.isupper()
            )
            if not title and is_title_candidate:
                title = line
                continue
            if title and description is None and is_title_candidate:
                # Reject long instruction-style paragraphs ending with sentence-
                # final punctuation (e.g. step text that ends with ".").  A real
                # recipe subtitle/tagline is always a short phrase without a
                # trailing period – instruction text always ends with one.
                if not _is_sentence_end(line):
                    description = line
                    continue

        # ── Ingredient section content ────────────────────────────────────────
        if in_ingredients:
            stripped = line.strip()

            # Handle pure unit abbreviations (e.g. "g", "ml") that appear as
            # separate column entries in column-based PDF ingredient tables.
            if pure_unit_re.match(stripped):
                if pending_ingredient_prefix is None:
                    pending_ingredient_prefix = stripped
                else:
                    pending_ingredient_prefix += " " + stripped
                continue

            # Handle "unit amount" reversed lines (e.g. "g 250") that arise
            # when a PDF places the unit column to the left of the amount column.
            if unit_then_amount_re.match(stripped):
                parts = stripped.split(None, 1)
                reordered = f"{parts[1]} {parts[0]}" if len(parts) == 2 else stripped
                pending_ingredient_prefix = reordered
                continue

            # Short lines starting with a lowercase letter are recipe taglines
            # or descriptions that slipped into the ingredient section (common
            # in single-page PDFs with multi-column layouts) – discard them.
            # German ingredient names always start with an uppercase letter.
            if line and line[0].islower() and len(line) <= 50:
                continue

            # If the recipe title reappears inside the ingredient section (a
            # common PDF layout artefact) skip it rather than adding it as an
            # ingredient.
            if title and line.lower() == title.lower():
                continue

            # Handle pure amount/unit lines (e.g. "250", "250 g", "3 Scheibe/n")
            # that represent the amount column of a column-based PDF table.
            if pure_amount_re.match(stripped):
                if pending_ingredient_prefix is not None and pure_unit_re.match(
                    pending_ingredient_prefix.strip()
                ):
                    # Pending is a bare unit → combine as "amount unit" (e.g. "250 g")
                    pending_ingredient_prefix = f"{stripped} {pending_ingredient_prefix.strip()}"
                else:
                    pending_ingredient_prefix = stripped
                continue

            # Combine any buffered amount/unit prefix with this ingredient name.
            if pending_ingredient_prefix is not None:
                line = f"{pending_ingredient_prefix.strip()} {line}".strip()
                pending_ingredient_prefix = None

            # Transition to steps when:
            # - A numbered step line (e.g. "1. Mix flour")
            # - A longer prose line (> 50 chars) typical of step instructions
            # - A sentence-continuation line that starts with a lowercase letter
            #   (len > 50; shorter lowercase lines are already discarded above)
            is_step_transition = (
                step_re.match(line)
                or len(line) > 50
                or (line and line[0].islower())
            )
            if is_step_transition:
                # Transition to steps; fall through to the steps block below.
                _flush_current_group()
                in_steps = True
                in_ingredients = False
                pending_ingredient_prefix = None
            else:
                if current_group is not None:
                    current_group["ingredients"].append(line)
                else:
                    ingredients.append(line)
                continue

        # ── Steps content ─────────────────────────────────────────────────────
        if in_steps:
            step_buffer.append(line)
            # Auto-flush after sentence-terminal lines so that recipes where
            # paragraphs are not separated by blank lines still produce multiple
            # steps (each paragraph/sentence group becomes its own step).
            # Uses _is_sentence_end to avoid splitting on mid-sentence
            # abbreviations like "ca.", "z.B.", "bzw.".
            if _is_sentence_end(line):
                _flush_step_buffer()
            continue

        # ── Fallback heuristics (unclassified lines) ──────────────────────────
        if amount_re.search(line) and len(line) < 80:
            ingredients.append(line)
        elif step_re.match(line) or len(line) > 50:
            # Enter step mode so subsequent short step lines are captured too.
            in_steps = True
            cleaned = re.sub(r"^\d+[\.\):\s]+", "", line).strip()
            step_buffer.append(cleaned)
            if _is_sentence_end(cleaned):
                _flush_step_buffer()

    # Flush any remaining step paragraph and last open ingredient group.
    _flush_step_buffer()
    _flush_current_group()

    # Deduplication: when ingredient items were accumulated in the flat
    # `ingredients` list *before* the first group sub-header was encountered
    # (a common Chefkoch / multi-column PDF artefact where the PDF text stream
    # places items between the section header "Zutaten für N Portionen:" and
    # the first group heading "Für den Teig:"), those same items also end up
    # inside the named group, causing visible duplication in the UI.
    # Remove any item from `ingredients` that is already covered by a named
    # group – the grouped representation is more informative.
    # Any items that remain in the flat list after deduplication (i.e. items
    # that appeared in the general overview section but not in any named
    # sub-group text block) are appended to the last named group.  This
    # handles the common Chefkoch PDF pattern where the final group's items
    # (e.g. "Salat", "Tomate(n)") appear in the general flat list but are
    # omitted from the last sub-group's text block due to PDF layout quirks.
    if ingredient_groups:
        grouped_items = {item for g in ingredient_groups for item in g.ingredients}
        remaining = [item for item in ingredients if item not in grouped_items]
        if remaining:
            ingredient_groups[-1].ingredients.extend(remaining)
        ingredients = []

    # Remove the recipe title from ingredient lists: in flat-text PDFs the
    # title sometimes appears after the ingredient section in the text stream
    # and can accidentally be captured as an ingredient before it is recognised
    # as the title.  Purge it now that we know the final title.
    resolved_title = title or "Importiertes Rezept"
    if title:
        title_lower = title.lower()
        for grp in ingredient_groups:
            grp.ingredients = [i for i in grp.ingredients if i.lower() != title_lower]
        ingredients = [i for i in ingredients if i.lower() != title_lower]

    return ImportResult(
        title=resolved_title,
        description=description,
        ingredients=ingredients[:30],
        ingredient_groups=ingredient_groups,
        steps=steps[:20],
        prep_time=prep_time,
        cook_time=cook_time,
        servings=servings,
    )


def _extract_best_pdf_image(doc: "fitz.Document") -> Optional[bytes]:  # type: ignore[name-defined]
    """Return raw bytes of the largest embedded image in the PDF document.

    Tiny images (icons, decorations) are skipped.  Returns ``None`` when no
    suitable image is found.
    """
    best_area = 0
    best_bytes: Optional[bytes] = None

    for page in doc:
        for img_info in page.get_images(full=True):
            xref = img_info[0]
            width = img_info[2]
            height = img_info[3]
            area = width * height
            if area < 100 * 100:  # skip very small images (icons, separators)
                continue
            try:
                base = doc.extract_image(xref)
                raw = base["image"]
                if area > best_area:
                    best_area = area
                    best_bytes = raw
            except Exception:
                logger.debug("Could not extract image xref=%d from PDF", xref, exc_info=True)
                continue

    return best_bytes


def _save_imported_image(img_bytes: bytes) -> Optional[str]:
    """Save raw image bytes as a JPEG in the uploads directory.

    Returns the URL path (``/api/uploads/imported/<name>.jpg``) or ``None``
    if saving fails.
    """
    try:
        _IMPORT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        img = Image.open(io.BytesIO(img_bytes))
        img = img.convert("RGB")
        filename = f"{uuid.uuid4().hex}.jpg"
        dest = _IMPORT_UPLOAD_DIR / filename
        img.save(dest, "JPEG", quality=85)
        return f"/api/uploads/imported/{filename}"
    except Exception:
        logger.warning("Failed to save imported PDF image", exc_info=True)
        return None


def extract_image_text(image_bytes: bytes, handwriting: bool = False) -> str:
    """Extract raw text from an image using Tesseract OCR.

    Returns an empty string when OCR is not available.
    """
    if not OCR_AVAILABLE:
        return ""

    from PIL import ImageEnhance, ImageFilter

    image = Image.open(io.BytesIO(image_bytes))
    image = image.convert("L")

    if handwriting:
        image = ImageEnhance.Contrast(image).enhance(2.0)
        image = image.filter(ImageFilter.SHARPEN)
        tesseract_config = "--oem 1 --psm 6"
    else:
        tesseract_config = "--oem 3 --psm 3"

    return pytesseract.image_to_string(image, lang="deu+eng", config=tesseract_config)


def _extract_text_via_pdf2image(pdf_bytes: bytes, handwriting: bool = False) -> str:
    """Fallback text extraction using pdf2image + Tesseract when PyMuPDF is unavailable."""
    if not OCR_AVAILABLE:
        return ""
    try:
        from pdf2image import convert_from_bytes

        pages = convert_from_bytes(pdf_bytes, dpi=150)
        parts: list[str] = []
        for page_img in pages:
            img = page_img.convert("L")
            if handwriting:
                from PIL import ImageEnhance, ImageFilter

                img = ImageEnhance.Contrast(img).enhance(2.0)
                img = img.filter(ImageFilter.SHARPEN)
                cfg = "--oem 1 --psm 6"
            else:
                cfg = "--oem 3 --psm 3"
            parts.append(pytesseract.image_to_string(img, lang="deu+eng", config=cfg))
        return "\n".join(parts)
    except ImportError:
        return ""


def extract_pdf_text_and_image(
    pdf_bytes: bytes, handwriting: bool = False
) -> tuple[str, Optional[str]]:
    """Extract raw text and the largest embedded image from a PDF.

    Returns ``(raw_text, image_url_or_None)``.  This is the low-level
    extraction step; *parsing* is handled separately so callers can choose
    between AI and heuristic parsers.

    Falls back to pdf2image + Tesseract when PyMuPDF is unavailable.
    """
    if not PDF_AVAILABLE:
        return _extract_text_via_pdf2image(pdf_bytes, handwriting), None

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    full_text = ""
    # Threshold: a text block is considered "full-width" (e.g. the recipe title
    # or a divider line) when it spans more than this fraction of the page width.
    # Chosen so that typical two-column recipe layouts (≈45 % each) are split
    # correctly while a wide title block (≈60–100 %) is kept together.
    _FULL_WIDTH_THRESHOLD = 0.55
    for page in doc:
        # Use column-aware block extraction sorted by visual reading order.
        # For two-column recipe PDFs (title + instructions on the left,
        # ingredients on the right) we read full-width blocks first, then the
        # left column, then the right column.  This ensures the recipe title
        # and instructions appear before the ingredient list in the extracted
        # text, giving the heuristic parser the correct context to identify
        # the title and split steps properly.
        #
        # PyMuPDF block tuple layout (get_text("blocks")):
        #   (x0, y0, x1, y1, text, block_no, block_type)
        # block_type: 0 = text, 1 = image
        rect = page.rect
        page_mid_x = (rect.x0 + rect.x1) / 2
        full_blocks: list[tuple[float, str]] = []
        left_blocks: list[tuple[float, str]] = []
        right_blocks: list[tuple[float, str]] = []

        for block in page.get_text("blocks"):
            bx0, by0, bx1, _by1, block_text, _block_no, block_type = block
            if block_type != 0:  # skip non-text (image) blocks
                continue
            text = block_text.strip()
            if not text:
                continue
            bw = bx1 - bx0
            pw = rect.x1 - rect.x0
            if pw > 0 and bw / pw > _FULL_WIDTH_THRESHOLD:
                # Spans more than 55 % of page width → full-width element
                # (e.g. the recipe title or a horizontal separator).
                full_blocks.append((by0, text))
            elif bx0 < page_mid_x:
                left_blocks.append((by0, text))   # instructions column
            else:
                right_blocks.append((by0, text))  # ingredients column

        # Each group is sorted by vertical position; groups are concatenated
        # in the order: full-width → left column → right column.
        ordered_parts = (
            [t for _, t in sorted(full_blocks)]
            + [t for _, t in sorted(left_blocks)]
            + [t for _, t in sorted(right_blocks)]
        )
        if ordered_parts:
            # Separate blocks with a blank line so paragraph boundaries are
            # preserved for the step-splitting logic in the heuristic parser.
            full_text += "\n\n".join(ordered_parts) + "\n\n"
        else:
            full_text += page.get_text()

    if not full_text.strip():
        # Image-based PDF – render each page and OCR
        if OCR_AVAILABLE:
            parts: list[str] = []
            for page in doc:
                pix = page.get_pixmap(dpi=150)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                img = img.convert("L")
                if handwriting:
                    from PIL import ImageEnhance, ImageFilter

                    img = ImageEnhance.Contrast(img).enhance(2.0)
                    img = img.filter(ImageFilter.SHARPEN)
                    cfg = "--oem 1 --psm 6"
                else:
                    cfg = "--oem 3 --psm 3"
                parts.append(pytesseract.image_to_string(img, lang="deu+eng", config=cfg))
            full_text = "\n".join(parts)
        else:
            full_text = _extract_text_via_pdf2image(pdf_bytes, handwriting)

    # Extract the best embedded food photo from the PDF
    image_url: Optional[str] = None
    img_bytes = _extract_best_pdf_image(doc)
    if img_bytes:
        image_url = _save_imported_image(img_bytes)

    return full_text, image_url


def render_pdf_first_page(pdf_bytes: bytes, dpi: int = 150) -> Optional[bytes]:
    """Render the first page of a PDF to a JPEG image for vision AI.

    Returns raw JPEG bytes or ``None`` when PyMuPDF is unavailable or fails.
    This allows vision AI to parse PDFs with complex layouts (tables,
    multi-column, etc.) directly from the image instead of extracted text.
    """
    if not PDF_AVAILABLE:
        return None
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if not doc.page_count:
            return None
        pix = doc[0].get_pixmap(dpi=dpi)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=90)
        return buf.getvalue()
    except Exception:
        logger.debug("render_pdf_first_page failed", exc_info=True)
        return None


# Public alias so callers outside this module can use the heuristic parser
# directly (e.g. imports.py fallback path).
parse_ocr_text = _parse_ocr_text


def ocr_image(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    handwriting: bool = False,
) -> ImportResult:
    """Run OCR on an image and parse with the heuristic parser.

    Kept for backward compatibility.  New callers should prefer
    ``extract_image_text`` + ``parse_ocr_text`` so they can inject AI
    parsing between the two steps.
    """
    if not OCR_AVAILABLE:
        return ImportResult(title="OCR nicht verfügbar", ingredients=[], steps=[])
    raw_text = extract_image_text(image_bytes, handwriting)
    return _parse_ocr_text(raw_text)


def ocr_pdf(pdf_bytes: bytes, handwriting: bool = False) -> ImportResult:
    """Extract text from a PDF and parse with the heuristic parser.

    Kept for backward compatibility.  New callers should prefer
    ``extract_pdf_text_and_image`` + ``parse_ocr_text`` so they can inject
    AI parsing between the two steps.
    """
    raw_text, image_url = extract_pdf_text_and_image(pdf_bytes, handwriting)
    if not raw_text.strip():
        return ImportResult(
            title="PDF Import nicht vollständig verfügbar", ingredients=[], steps=[]
        )
    result = _parse_ocr_text(raw_text)
    if image_url and not result.image_url:
        result.image_url = image_url
    return result


def merge_import_results(results: list[ImportResult]) -> ImportResult:
    """Merge multiple ImportResult objects for multi-page / multi-file recipes."""
    if not results:
        return ImportResult(title="Importiertes Rezept")
    if len(results) == 1:
        return results[0]

    # Use the first non-placeholder title
    title = next(
        (r.title for r in results if r.title and r.title != "Importiertes Rezept"),
        None,
    ) or "Importiertes Rezept"

    # Use the first non-None value found across all pages for metadata
    image_url = next((r.image_url for r in results if r.image_url), None)
    prep_time = next((r.prep_time for r in results if r.prep_time is not None), None)
    cook_time = next((r.cook_time for r in results if r.cook_time is not None), None)
    servings = next((r.servings for r in results if r.servings is not None), None)

    # Combine ingredients (deduplicate)
    seen: set[str] = set()
    ingredients: list[str] = []
    for r in results:
        for ing in r.ingredients:
            if ing not in seen:
                seen.add(ing)
                ingredients.append(ing)

    # Combine ingredient groups (all groups from all pages)
    ingredient_groups: list[ImportIngredientGroup] = []
    for r in results:
        ingredient_groups.extend(r.ingredient_groups)

    # Combine steps in order
    steps: list[str] = []
    for r in results:
        steps.extend(r.steps)

    tags = list({tag for r in results for tag in r.tags})

    return ImportResult(
        title=title,
        image_url=image_url,
        ingredients=ingredients[:50],
        ingredient_groups=ingredient_groups,
        steps=steps[:30],
        tags=tags,
        prep_time=prep_time,
        cook_time=cook_time,
        servings=servings,
    )

