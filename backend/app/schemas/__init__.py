from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


# ─── Auth ────────────────────────────────────────────────────────────────────


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    is_active: bool
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None


# ─── Ingredient ───────────────────────────────────────────────────────────────


class IngredientCreate(BaseModel):
    amount: Optional[str] = None
    unit: Optional[str] = None
    name: str
    position: int = 0


class IngredientOut(IngredientCreate):
    id: str

    model_config = {"from_attributes": True}


# ─── Unit ────────────────────────────────────────────────────────────────────


class UnitCreate(BaseModel):
    name: str


class UnitUpdate(BaseModel):
    name: str


class UnitOut(BaseModel):
    id: str
    name: str
    position: int

    model_config = {"from_attributes": True}


# ─── Ingredient Group ─────────────────────────────────────────────────────────


class IngredientGroupCreate(BaseModel):
    name: str
    position: int = 0
    ingredients: list[IngredientCreate] = Field(default_factory=list)


class IngredientGroupOut(BaseModel):
    id: str
    name: str
    position: int = 0
    ingredients: list[IngredientOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ─── Step ────────────────────────────────────────────────────────────────────


class StepCreate(BaseModel):
    position: int
    instruction: str


class StepOut(StepCreate):
    id: str

    model_config = {"from_attributes": True}


# ─── Recipe ──────────────────────────────────────────────────────────────────


class RecipeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    servings: Optional[int] = 4
    source_url: Optional[str] = None
    ingredients: list[IngredientCreate] = Field(default_factory=list)
    ingredient_groups: list[IngredientGroupCreate] = Field(default_factory=list)
    steps: list[StepCreate] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class RecipeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    servings: Optional[int] = None
    ingredients: Optional[list[IngredientCreate]] = None
    ingredient_groups: Optional[list[IngredientGroupCreate]] = None
    steps: Optional[list[StepCreate]] = None
    tags: Optional[list[str]] = None


class RecipeOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    servings: Optional[int] = None
    source_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    owner_username: Optional[str] = None
    ingredients: list[IngredientOut] = Field(default_factory=list)
    ingredient_groups: list[IngredientGroupOut] = Field(default_factory=list)
    steps: list[StepOut] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        if hasattr(obj, "tags"):
            obj_dict = {
                "id": obj.id,
                "title": obj.title,
                "description": obj.description,
                "image_url": obj.image_url,
                "prep_time": obj.prep_time,
                "cook_time": obj.cook_time,
                "servings": obj.servings,
                "source_url": obj.source_url,
                "created_at": obj.created_at,
                "updated_at": obj.updated_at,
                "ingredients": obj.ingredients,
                "ingredient_groups": obj.ingredient_groups,
                "steps": obj.steps,
                "tags": [t.name for t in obj.tags],
            }
            return super().model_validate(obj_dict, **kwargs)
        return super().model_validate(obj, **kwargs)


# ─── Import ───────────────────────────────────────────────────────────────────


class ImportIngredientGroup(BaseModel):
    """A named group of ingredients extracted during import (e.g. 'Für den Teig')."""

    name: str
    ingredients: list[str] = []


class ImportResult(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    source_url: Optional[str] = None
    ingredients: list[str] = Field(default_factory=list)
    ingredient_groups: list[ImportIngredientGroup] = Field(default_factory=list)
    steps: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    servings: Optional[int] = None
    # Populated when a non-fatal issue occurred during import (e.g. external AI
    # failed and the result is a heuristic fallback).
    import_warning: Optional[str] = None


class ImageSearchItem(BaseModel):
    """A single food image search result returned by :func:`search_food_images`."""

    thumb_url: str
    url: str
    photographer: str = ""
    source_url: str = ""
    source: str = ""       # provider identifier, e.g. "pixabay"
    source_name: str = ""  # human-readable name, e.g. "Pixabay"
    source_home: str = ""  # provider home URL for attribution link


# ─── Site Settings ────────────────────────────────────────────────────────────


class SiteSettingsOut(BaseModel):
    site_mode: Literal["public", "private"]
    registration_mode: Literal["open", "admin_only"]
    ssrf_protection: bool
    logo_light_url: Optional[str] = None
    logo_dark_url: Optional[str] = None
    favicon_url: Optional[str] = None
    appicon_url: Optional[str] = None
    # External AI providers in priority order – API keys are never exposed,
    # only a flag that one is stored.
    ext_ai_providers: list["ExtAiProviderOut"] = []

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _inject_ext_ai(cls, data: object) -> object:
        """Build the output from the ORM row, replacing keys by flags."""
        if hasattr(data, "ext_ai_api_key"):
            from app.services.ext_ai_config import public_entries

            # ORM model instance – build a plain dict so Pydantic can map fields.
            return {
                "site_mode": data.site_mode,
                "registration_mode": data.registration_mode,
                "ssrf_protection": data.ssrf_protection,
                "logo_light_url": data.logo_light_url,
                "logo_dark_url": data.logo_dark_url,
                "favicon_url": data.favicon_url,
                "appicon_url": data.appicon_url,
                "ext_ai_providers": public_entries(data),
            }
        return data


class SiteSettingsUpdate(BaseModel):
    site_mode: Optional[Literal["public", "private"]] = None
    registration_mode: Optional[Literal["open", "admin_only"]] = None
    ssrf_protection: Optional[bool] = None


ExtAiProviderName = Literal["openai", "gemini", "anthropic"]


class ExtAiProviderOut(BaseModel):
    id: str
    provider: ExtAiProviderName
    model: Optional[str] = None  # None = automatic
    key_configured: bool = True


SiteSettingsOut.model_rebuild()


class ExtAiProviderIn(BaseModel):
    id: Optional[str] = None  # None for a new entry
    provider: ExtAiProviderName
    model: Optional[str] = Field(default=None, max_length=100)  # empty = automatic
    # Empty keeps the stored key of the entry with the same id.
    api_key: Optional[str] = Field(default=None, max_length=512)


class ExtAiProvidersUpdate(BaseModel):
    # Priority order: the first provider is tried first.
    providers: list[ExtAiProviderIn] = Field(default_factory=list, max_length=10)


class ExtAiModelsRequest(BaseModel):
    provider: ExtAiProviderName
    # Optional: test a key before saving it.  Otherwise the stored key of
    # entry *entry_id* is used.
    api_key: Optional[str] = None
    entry_id: Optional[str] = None


class ExtAiModelOption(BaseModel):
    id: str
    label: str


class ExtAiModelsOut(BaseModel):
    auto_model: str
    models: list[ExtAiModelOption]
    # Set when the model list could not be loaded (e.g. invalid key).
    error: Optional[str] = None


# ─── Recipe Share ─────────────────────────────────────────────────────────────


class RecipeShareCreate(BaseModel):
    password: Optional[str] = Field(default=None, max_length=128)
    expires_at: Optional[datetime] = None


class RecipeShareOut(BaseModel):
    id: str
    recipe_id: str
    token: str
    has_password: bool
    expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
