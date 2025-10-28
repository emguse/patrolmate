"""Flask application factory for the PatrolMate API."""
from __future__ import annotations

from flask import Flask

from .extensions import db
from .routes import api_bp, pages_bp


def create_app(test_config: dict | None = None) -> Flask:
    """Create and configure the Flask application.

    Parameters
    ----------
    test_config:
        Optional dictionary with overrides that should be applied to the
        application's configuration. This is useful in unit tests.
    """
    app = Flask(__name__)

    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI="sqlite:///patrolmate.sqlite3",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )

    if test_config:
        app.config.update(test_config)

    db.init_app(app)

    with app.app_context():
        db.create_all()

    app.register_blueprint(pages_bp)
    app.register_blueprint(api_bp)

    @app.get("/health")
    def healthcheck() -> dict[str, str]:
        """Simple healthcheck endpoint."""
        return {"status": "ok"}

    return app


app = create_app()
