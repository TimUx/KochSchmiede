from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


# ─── Auth ────────────────────────────────────────────────────────────────────


class UserCreate(BaseModel):
    username: str
    email: str
    password: str


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
    ingredients: list[IngredientCreate] = []


class IngredientGroupOut(BaseModel):
    id: str
    name: str
    position: int = 0
    ingredients: list[IngredientOut] = []

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
    ingredients: list[IngredientCreate] = []
    ingredient_groups: list[IngredientGroupCreate] = []
    steps: list[StepCreate] = []
    tags: list[str] = []


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
    ingredients: list[IngredientOut] = []
    ingredient_groups: list[IngredientGroupOut] = []
    steps: list[StepOut] = []
    tags: list[str] = []

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
    ingredients: list[str] = []
    ingredient_groups: list[ImportIngredientGroup] = []
    steps: list[str] = []
    tags: list[str] = []
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    servings: Optional[int] = None


# ─── Site Settings ────────────────────────────────────────────────────────────


class SiteSettingsOut(BaseModel):
    site_mode: Literal["public", "private"]
    registration_mode: Literal["open", "admin_only"]
    ssrf_protection: bool
    logo_light_url: Optional[str] = None
    logo_dark_url: Optional[str] = None
    favicon_url: Optional[str] = None
    appicon_url: Optional[str] = None

    model_config = {"from_attributes": True}


class SiteSettingsUpdate(BaseModel):
    site_mode: Optional[Literal["public", "private"]] = None
    registration_mode: Optional[Literal["open", "admin_only"]] = None
    ssrf_protection: Optional[bool] = None


# ─── Recipe Share ─────────────────────────────────────────────────────────────


class RecipeShareCreate(BaseModel):
    password: Optional[str] = None   # plain text; will be hashed server-side


class RecipeShareOut(BaseModel):
    id: str
    recipe_id: str
    token: str
    has_password: bool
    expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
