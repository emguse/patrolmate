# PatrolMate (Flask edition)

This repository now contains a minimal Flask application backed by a SQLite
database. It exposes a small JSON API that lets you create and list simple
patrol log entries.

## Getting started

1. Create and activate a virtual environment (optional but recommended):

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

2. Install the dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Run the development server:

   ```bash
   flask --app patrolmate run --debug
   ```

   The API will be available at `http://127.0.0.1:5000/`.

## API overview

- `GET /` – healthcheck endpoint returning the application status.
- `GET /api/logs` – retrieve all patrol logs ordered from newest to oldest.
- `POST /api/logs` – create a new patrol log. Send JSON with a required
  `title` field and an optional `notes` field.

The application stores its data in `patrolmate.sqlite3` in the project root.
