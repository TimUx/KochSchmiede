from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.database import get_db
from app.models import Ingredient, Recipe, RecipeImage, Step, Tag
from app.schemas import RecipeCreate, RecipeOut, RecipeUpdate

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _get_or_create_tag(db: Session, name: str) -> Tag:
    tag = db.query(Tag).filter(Tag.name == name).first()
    if not tag:
        tag = Tag(name=name)
        db.add(tag)
    return tag


def _recipe_to_out(recipe: Recipe) -> RecipeOut:
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
        ingredients=[
            {"id": i.id, "amount": i.amount, "unit": i.unit, "name": i.name, "position": i.position}
            for i in recipe.ingredients
        ],
        steps=[{"id": s.id, "position": s.position, "instruction": s.instruction} for s in recipe.steps],
        tags=[t.name for t in recipe.tags],
    )


@router.get("/", response_model=list[RecipeOut])
def list_recipes(
    q: Optional[str] = Query(None, description="Search query"),
    tag: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Recipe).filter(Recipe.owner_id == current_user.id)
    if q:
        query = query.filter(Recipe.title.ilike(f"%{q}%"))
    if tag:
        query = query.join(Recipe.tags).filter(Tag.name == tag)
    recipes = query.order_by(Recipe.created_at.desc()).offset(skip).limit(limit).all()
    return [_recipe_to_out(r) for r in recipes]


@router.post("/", response_model=RecipeOut, status_code=201)
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
    for step in recipe_in.steps:
        recipe.steps.append(Step(position=step.position, instruction=step.instruction))
    for tag_name in recipe_in.tags:
        recipe.tags.append(_get_or_create_tag(db, tag_name))

    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return _recipe_to_out(recipe)


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.owner_id == current_user.id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return _recipe_to_out(recipe)


@router.put("/{recipe_id}", response_model=RecipeOut)
def update_recipe(
    recipe_id: str,
    recipe_in: RecipeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.owner_id == current_user.id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    for field in ("title", "description", "image_url", "prep_time", "cook_time", "servings"):
        val = getattr(recipe_in, field, None)
        if val is not None:
            setattr(recipe, field, val)

    if recipe_in.ingredients is not None:
        for i in recipe.ingredients:
            db.delete(i)
        recipe.ingredients = [
            Ingredient(amount=ing.amount, unit=ing.unit, name=ing.name, position=idx)
            for idx, ing in enumerate(recipe_in.ingredients)
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
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.owner_id == current_user.id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.delete(recipe)
    db.commit()
