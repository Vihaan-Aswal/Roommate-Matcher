# Roommate Matcher Backend

FastAPI and service-layer backend for the Roommate Matcher project.

## Tech Stack
- **Framework:** FastAPI
- **Language:** Python 3.11+
- **Database:** Supabase Postgres (Production), SQLite (Local Dev)
- **ORM:** SQLAlchemy with Alembic for migrations
- **Data Validation:** Pydantic v2

## Directory Structure
- `app/api/`: FastAPI route handlers and endpoints.
- `app/services/`: Core business logic (matching algorithms, DB interactions).
- `app/models/`: SQLAlchemy database models.
- `app/schemas/`: Pydantic models for request/response validation.
- `alembic/`: Database migration scripts.
- `tests/`: Pytest suite.

## Local Development

### Setup
1. Create a virtual environment: `python -m venv .venv`
2. Activate it:
   - macOS/Linux: `source .venv/bin/activate`
   - Windows: `.\.venv\Scripts\activate`
3. Install dependencies: `pip install -e ".[dev]"`

### Running the Server
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
API Documentation will be available at `http://127.0.0.1:8000/docs`.

### Database Migrations
To apply the latest schema:
```bash
alembic upgrade head
```

### Running Tests
```bash
python -m pytest
```

## Environment Variables
Copy `.env.example` to `.env` and fill in the required values. Refer to the root `README.md` for a full list of required variables for production.
