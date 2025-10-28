"""API routes for PatrolMate."""
from __future__ import annotations

from http import HTTPStatus

from flask import Blueprint, jsonify, render_template, request

from .extensions import db
from .models import PatrolLog


api_bp = Blueprint("api", __name__, url_prefix="/api")
pages_bp = Blueprint("pages", __name__)


@pages_bp.get("/")
def dashboard():
    """Render the patrol log dashboard."""
    return render_template("index.html")


@api_bp.get("/logs")
def list_logs():
    """Return all patrol logs ordered from newest to oldest."""
    logs = PatrolLog.query.order_by(PatrolLog.created_at.desc()).all()
    return jsonify([log.to_dict() for log in logs])


@api_bp.post("/logs")
def create_log():
    """Create a new patrol log entry."""
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    notes = payload.get("notes")

    if not title:
        return (
            jsonify({"error": "'title' is required"}),
            HTTPStatus.BAD_REQUEST,
        )

    log = PatrolLog(title=title, notes=notes)
    db.session.add(log)
    db.session.commit()

    response = jsonify(log.to_dict())
    response.status_code = HTTPStatus.CREATED
    return response
