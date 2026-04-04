import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.database import get_db
from app.models import Ingredient, IngredientGroup, Recipe, RecipeShare, Step, Tag
from app.schemas import (
    IngredientGroupOut,
    IngredientOut,
    RecipeCreate,
    RecipeOut,
    RecipeShareCreate,
    RecipeShareOut,
    RecipeUpdate,
)
from app.services.auth import hash_password, verify_password
from app.services.settings import get_settings

router = APIRouter(prefix="/recipes", tags=["recipes"])

_RECIPE_IMAGE_UPLOAD_DIR = Path("/app/uploads/recipes")
_RECIPE_IMAGE_ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
_RECIPE_IMAGE_MAX_SIZE = 10 * 1024 * 1024  # 10 MB
_RECIPE_IMAGE_EXT_MAP = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}

# Optional auth: returns user or None (no 401 when token is absent)
_oauth2_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _get_optional_user(token: Optional[str] = Depends(_oauth2_optional), db: Session = Depends(get_db)):
    if not token:
        return None
    from app.services.auth import decode_token, get_user_by_id

    token_data = decode_token(token)
    if not token_data:
        return None
    user = get_user_by_id(db, token_data.user_id)
    return user if (user and user.is_active) else None


def _get_or_create_tag(db: Session, name: str) -> Tag:
    tag = db.query(Tag).filter(Tag.name == name).first()
    if not tag:
        tag = Tag(name=name)
        db.add(tag)
    return tag


def _recipe_to_out(recipe: Recipe) -> RecipeOut:
    # Ungrouped ingredients (no group assigned)
    ungrouped = [i for i in recipe.ingredients if i.group_id is None]
    groups = [
        IngredientGroupOut(
            id=g.id,
            name=g.name,
            position=g.position,
            ingredients=[
                IngredientOut(id=i.id, amount=i.amount, unit=i.unit, name=i.name, position=i.position)
                for i in g.ingredients
            ],
        )
        for g in recipe.ingredient_groups
    ]
    return RecipeOut(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        image_url=recipe.image_url,
        prep_time=recipe.prep_time,
        cook_time=recipe.cook_time,
        servings=recipe.servings,
        source_url=recipe.source_url,
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
        owner_username=recipe.owner.username if recipe.owner else None,
        ingredients=[
            IngredientOut(id=i.id, amount=i.amount, unit=i.unit, name=i.name, position=i.position)
            for i in ungrouped
        ],
        ingredient_groups=groups,
        steps=[{"id": s.id, "position": s.position, "instruction": s.instruction} for s in recipe.steps],
        tags=[t.name for t in recipe.tags],
    )


# ─── Recipe CRUD ──────────────────────────────────────────────────────────────


@router.get("/tags", response_model=list[str])
def list_tags(
    db: Session = Depends(get_db),
    current_user=Depends(_get_optional_user),
):
    site_settings = get_settings(db)
    if site_settings.site_mode != "public" and not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    tags = db.query(Tag).order_by(Tag.name).all()
    return [t.name for t in tags]


@router.get("", response_model=list[RecipeOut])
def list_recipes(
    q: Optional[str] = Query(None, description="Search query"),
    tag: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user=Depends(_get_optional_user),
):
    site_settings = get_settings(db)
    query = db.query(Recipe)

    if site_settings.site_mode == "public":
        pass  # show all recipes without owner filter
    elif current_user:
        pass  # authenticated users see all recipes
    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    if q:
        query = query.filter(Recipe.title.ilike(f"%{q}%"))
    if tag:
        query = query.join(Recipe.tags).filter(Tag.name == tag)
    recipes = query.order_by(Recipe.created_at.desc()).offset(skip).limit(limit).all()
    return [_recipe_to_out(r) for r in recipes]


@router.post("", response_model=RecipeOut, status_code=201)
def create_recipe(
    recipe_in: RecipeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recipe = Recipe(
        title=recipe_in.title,
        description=recipe_in.description,
        image_url=recipe_in.image_url,
        prep_time=recipe_in.prep_time,
        cook_time=recipe_in.cook_time,
        servings=recipe_in.servings,
        source_url=recipe_in.source_url,
        owner_id=current_user.id,
    )
    for idx, ing in enumerate(recipe_in.ingredients):
        recipe.ingredients.append(
            Ingredient(amount=ing.amount, unit=ing.unit, name=ing.name, position=idx)
        )
    for grp_idx, grp in enumerate(recipe_in.ingredient_groups):
        group = IngredientGroup(name=grp.name, position=grp_idx)
        for idx, ing in enumerate(grp.ingredients):
            group.ingredients.append(
                Ingredient(recipe=recipe, amount=ing.amount, unit=ing.unit, name=ing.name, position=idx)
            )
        recipe.ingredient_groups.append(group)
    for step in recipe_in.steps:
        recipe.steps.append(Step(position=step.position, instruction=step.instruction))
    for tag_name in recipe_in.tags:
        recipe.tags.append(_get_or_create_tag(db, tag_name))

    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return _recipe_to_out(recipe)


@router.post("/upload-image")
async def upload_recipe_image(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """Upload an image for a recipe and return its URL."""
    if file.content_type not in _RECIPE_IMAGE_ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Ungültiges Dateiformat. Erlaubt: PNG, JPEG, WEBP, GIF")
    data = await file.read()
    if len(data) > _RECIPE_IMAGE_MAX_SIZE:
        raise HTTPException(status_code=413, detail="Datei zu groß (max. 10 MB)")
    _RECIPE_IMAGE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = _RECIPE_IMAGE_EXT_MAP[file.content_type]
    filename = f"recipe_{uuid.uuid4().hex}{ext}"
    (_RECIPE_IMAGE_UPLOAD_DIR / filename).write_bytes(data)
    return {"url": f"/api/uploads/recipes/{filename}"}


@router.get("/share/{token}", response_model=RecipeOut)
def get_shared_recipe(
    token: str,
    password: Optional[str] = Query(None, description="Share password if required"),
    db: Session = Depends(get_db),
):
    """Access a recipe via its share token (no login required)."""
    share = db.query(RecipeShare).filter(RecipeShare.token == token).first()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    if share.password_hash:
        if not password:
            raise HTTPException(status_code=401, detail="Password required for this share link")
        if not verify_password(password, share.password_hash):
            raise HTTPException(status_code=403, detail="Incorrect password")

    recipe = db.query(Recipe).filter(Recipe.id == share.recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return _recipe_to_out(recipe)


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(_get_optional_user),
):
    site_settings = get_settings(db)
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    if site_settings.site_mode == "public":
        return _recipe_to_out(recipe)
    if current_user:
        return _recipe_to_out(recipe)
    raise HTTPException(status_code=401, detail="Authentication required")


@router.put("/{recipe_id}", response_model=RecipeOut)
def update_recipe(
    recipe_id: str,
    recipe_in: RecipeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    site_settings = get_settings(db)
    query = db.query(Recipe).filter(Recipe.id == recipe_id)
    if site_settings.site_mode != "private":
        query = query.filter(Recipe.owner_id == current_user.id)
    recipe = query.first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    for field in ("title", "description", "prep_time", "cook_time", "servings"):
        val = getattr(recipe_in, field, None)
        if val is not None:
            setattr(recipe, field, val)

    # image_url: always update when explicitly provided (supports clearing to null)
    if "image_url" in recipe_in.model_fields_set:
        recipe.image_url = recipe_in.image_url

    if recipe_in.ingredients is not None:
        for i in recipe.ingredients:
            db.delete(i)
        recipe.ingredients = [
            Ingredient(amount=ing.amount, unit=ing.unit, name=ing.name, position=idx)
            for idx, ing in enumerate(recipe_in.ingredients)
        ]

    if recipe_in.ingredient_groups is not None:
        recipe.ingredient_groups = [
            IngredientGroup(
                recipe_id=recipe.id,
                name=grp.name,
                position=grp_idx,
                ingredients=[
                    Ingredient(recipe=recipe, amount=ing.amount, unit=ing.unit, name=ing.name, position=idx)
                    for idx, ing in enumerate(grp.ingredients)
                ],
            )
            for grp_idx, grp in enumerate(recipe_in.ingredient_groups)
        ]

    if recipe_in.steps is not None:
        for s in recipe.steps:
            db.delete(s)
        recipe.steps = [
            Step(position=s.position, instruction=s.instruction) for s in recipe_in.steps
        ]

    if recipe_in.tags is not None:
        recipe.tags = [_get_or_create_tag(db, t) for t in recipe_in.tags]

    db.commit()
    db.refresh(recipe)
    return _recipe_to_out(recipe)


@router.delete("/{recipe_id}", status_code=204)
def delete_recipe(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    site_settings = get_settings(db)
    query = db.query(Recipe).filter(Recipe.id == recipe_id)
    if site_settings.site_mode != "private":
        query = query.filter(Recipe.owner_id == current_user.id)
    recipe = query.first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.delete(recipe)
    db.commit()


# ─── Share Management (owner) ─────────────────────────────────────────────────


@router.get("/{recipe_id}/share", response_model=Optional[RecipeShareOut])
def get_share_info(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.owner_id == current_user.id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    share = db.query(RecipeShare).filter(RecipeShare.recipe_id == recipe_id).first()
    if not share:
        return None
    return RecipeShareOut(
        id=share.id,
        recipe_id=share.recipe_id,
        token=share.token,
        has_password=share.password_hash is not None,
        expires_at=share.expires_at,
        created_at=share.created_at,
    )


@router.post("/{recipe_id}/share", response_model=RecipeShareOut, status_code=201)
def create_share(
    recipe_id: str,
    payload: RecipeShareCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.owner_id == current_user.id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Replace any existing share for this recipe
    db.query(RecipeShare).filter(RecipeShare.recipe_id == recipe_id).delete()

    share = RecipeShare(
        recipe_id=recipe_id,
        password_hash=hash_password(payload.password) if payload.password else None,
    )
    db.add(share)
    db.commit()
    db.refresh(share)

    return RecipeShareOut(
        id=share.id,
        recipe_id=share.recipe_id,
        token=share.token,
        has_password=share.password_hash is not None,
        expires_at=share.expires_at,
        created_at=share.created_at,
    )


@router.delete("/{recipe_id}/share", status_code=204)
def delete_share(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.owner_id == current_user.id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.query(RecipeShare).filter(RecipeShare.recipe_id == recipe_id).delete()
    db.commit()
