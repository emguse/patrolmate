"""Application entrypoint for running PatrolMate locally."""
from patrolmate import app


if __name__ == "__main__":
    app.run(debug=True)
