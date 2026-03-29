from datetime import datetime
from typing import Optional

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
                "steps": obj.steps,
                "tags": [t.name for t in obj.tags],
            }
            return super().model_validate(obj_dict, **kwargs)
        return super().model_validate(obj, **kwargs)


# ─── Import ───────────────────────────────────────────────────────────────────


class ImportResult(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    source_url: Optional[str] = None
    ingredients: list[str] = []
    steps: list[str] = []
    tags: list[str] = []
