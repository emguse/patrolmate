# PatrolMate (Flask edition)

This repository contains a minimal Flask application backed by a SQLite
database. It now serves a simple dashboard that lets you record patrol log
entries and review them without leaving the browser. The same data is exposed
through a JSON API for programmatic access.

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

   The dashboard will be available at `http://127.0.0.1:5000/`.

## API overview

- `GET /health` – healthcheck endpoint returning the application status.
- `GET /api/logs` – retrieve all patrol logs ordered from newest to oldest.
- `POST /api/logs` – create a new patrol log. Send JSON with a required
  `title` field and an optional `notes` field.

The application stores its data in `patrolmate.sqlite3` in the project root.
