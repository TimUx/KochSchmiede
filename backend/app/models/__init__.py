import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base

# Many-to-many: recipes <-> tags
recipe_tags = Table(
    "recipe_tags",
    Base.metadata,
    Column("recipe_id", String, ForeignKey("recipes.id", ondelete="CASCADE")),
    Column("tag_id", String, ForeignKey("tags.id", ondelete="CASCADE")),
)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    recipes = relationship("Recipe", back_populates="owner", cascade="all, delete-orphan")


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    image_url = Column(String(512))
    prep_time = Column(Integer)  # minutes
    cook_time = Column(Integer)  # minutes
    servings = Column(Integer, default=4)
    source_url = Column(String(512))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    owner = relationship("User", back_populates="recipes")

    ingredients = relationship(
        "Ingredient", back_populates="recipe", cascade="all, delete-orphan", order_by="Ingredient.position"
    )
    steps = relationship(
        "Step", back_populates="recipe", cascade="all, delete-orphan", order_by="Step.position"
    )
    tags = relationship("Tag", secondary=recipe_tags, back_populates="recipes")
    images = relationship("RecipeImage", back_populates="recipe", cascade="all, delete-orphan")


class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id = Column(String, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    amount = Column(String(100))
    unit = Column(String(50))
    name = Column(String(255), nullable=False)
    position = Column(Integer, default=0)

    recipe = relationship("Recipe", back_populates="ingredients")


class Step(Base):
    __tablename__ = "steps"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id = Column(String, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False)
    instruction = Column(Text, nullable=False)

    recipe = relationship("Recipe", back_populates="steps")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False, index=True)

    recipes = relationship("Recipe", secondary=recipe_tags, back_populates="tags")


class RecipeImage(Base):
    __tablename__ = "images"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id = Column(String, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    url = Column(String(512), nullable=False)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    recipe = relationship("Recipe", back_populates="images")
