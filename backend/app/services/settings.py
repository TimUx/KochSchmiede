from sqlalchemy.orm import Session

from app.models import SiteSettings


def get_settings(db: Session) -> SiteSettings:
    """Return the singleton settings row, creating it with defaults on first call."""
    row = db.query(SiteSettings).filter(SiteSettings.id == 1).first()
    if not row:
        row = SiteSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def update_settings(db: Session, **kwargs) -> SiteSettings:
    row = get_settings(db)
    for key, value in kwargs.items():
        if value is not None and hasattr(row, key):
            setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row
