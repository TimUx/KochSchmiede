from sqlalchemy.orm import Session

from app.models import SiteSettings

# Sentinel used to distinguish "not provided" from "explicitly set to None".
_UNSET = object()


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
    """Update the singleton settings row.

    Pass keyword arguments matching column names.  A value of ``None`` is
    treated as "not provided" and the field is left unchanged – *unless* the
    key is in ``force_null_keys``, which allows explicitly clearing nullable
    columns (e.g. removing a custom logo URL).
    """
    force_null_keys: set[str] = kwargs.pop("_force_null_keys", set())  # type: ignore[assignment]
    row = get_settings(db)
    for key, value in kwargs.items():
        if not hasattr(row, key):
            continue
        if value is None and key not in force_null_keys:
            continue
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row
