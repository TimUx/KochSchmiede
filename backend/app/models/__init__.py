import secrets
import uuid
from datetime import datetime, timezone

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
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    owner = relationship("User", back_populates="recipes")

    ingredients = relationship(
        "Ingredient", back_populates="recipe", cascade="all, delete-orphan", order_by="Ingredient.position"
    )
    steps = relationship(
        "Step", back_populates="recipe", cascade="all, delete-orphan", order_by="Step.position"
    )
    ingredient_groups = relationship(
        "IngredientGroup",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="IngredientGroup.position",
    )
    tags = relationship("Tag", secondary=recipe_tags, back_populates="recipes")
    images = relationship("RecipeImage", back_populates="recipe", cascade="all, delete-orphan")
    shares = relationship("RecipeShare", back_populates="recipe", cascade="all, delete-orphan")


class Unit(Base):
    __tablename__ = "units"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False)
    position = Column(Integer, default=0)


class IngredientGroup(Base):
    __tablename__ = "ingredient_groups"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id = Column(String, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    position = Column(Integer, default=0)

    recipe = relationship("Recipe", back_populates="ingredient_groups")
    ingredients = relationship(
        "Ingredient",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="Ingredient.position",
    )


class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id = Column(String, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(String, ForeignKey("ingredient_groups.id", ondelete="SET NULL"), nullable=True)
    amount = Column(String(100))
    unit = Column(String(50))
    name = Column(String(255), nullable=False)
    position = Column(Integer, default=0)

    recipe = relationship("Recipe", back_populates="ingredients")
    group = relationship("IngredientGroup", back_populates="ingredients")


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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    recipe = relationship("Recipe", back_populates="images")


class RecipeShare(Base):
    """A shareable link for a recipe, optionally password-protected."""

    __tablename__ = "recipe_shares"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id = Column(String, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(64), unique=True, nullable=False, index=True,
                   default=lambda: secrets.token_urlsafe(32))
    password_hash = Column(String(255))  # None = no password required
    expires_at = Column(DateTime)        # None = never expires
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    recipe = relationship("Recipe", back_populates="shares")


class SiteSettings(Base):
    """Singleton settings row (always id=1)."""

    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True, default=1)
    # "public"  → anyone can browse all recipes without login
    # "private" → login required (or a valid share token)
    site_mode = Column(String(20), nullable=False, default="private")
    # "open"       → anyone can register themselves
    # "admin_only" → only admins can create new accounts
    registration_mode = Column(String(20), nullable=False, default="open")
    # When True, URL imports block private/loopback IPs (safe default for internet-facing installs).
    # Set to False when running on a home server that imports from LAN addresses.
    ssrf_protection = Column(Boolean, nullable=False, default=True)
    # Custom logo/icon URLs – None means use the bundled default asset.
    logo_light_url = Column(String(512), nullable=True)
    logo_dark_url = Column(String(512), nullable=True)
    favicon_url = Column(String(512), nullable=True)
    appicon_url = Column(String(512), nullable=True)
    # Optional external AI provider for import (e.g. "openai", "gemini").
    # When configured, users can choose to use the external AI during import
    # instead of the locally hosted model.
    ext_ai_provider = Column(String(20), nullable=True)
    ext_ai_api_key = Column(String(512), nullable=True)
    ext_ai_model = Column(String(100), nullable=True)
