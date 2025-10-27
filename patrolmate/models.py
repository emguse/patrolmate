"""Database models for PatrolMate."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column

from .extensions import db


class PatrolLog(db.Model):
    """Simple log entry captured during a patrol."""

    __tablename__ = "patrol_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(db.String(120), nullable=False)
    notes: Mapped[str | None] = mapped_column(db.Text())
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )

    def to_dict(self) -> dict[str, str | int]:
        """Serialize the model into a JSON-friendly representation."""
        return {
            "id": self.id,
            "title": self.title,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() + "Z",
        }
