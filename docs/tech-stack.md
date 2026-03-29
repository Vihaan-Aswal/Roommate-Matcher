# Tech stack

## Project approach

This project will be built as a **full local-first web application**.

The goal is to build the **complete app end-to-end** without deploying it to the cloud. The app should be good enough to showcase in a GitHub repository, run locally, and be easy for recruiters or other users to try without a heavy setup process.

Because of that, the stack is being chosen with these priorities in mind:

- build the full app without deployment
- avoid cloud services unless absolutely necessary
- keep setup simple
- avoid too many required `.env` variables
- make the repo look polished and practical
- choose tools that fit both the UI and the matching/logic-heavy backend

---

## Final stack choice

### Frontend

- **React**
- **TypeScript**
- **Vite**
- **React Router**
- **Tailwind CSS**
- **shadcn/ui**
- **TanStack Query**

### Backend

- **FastAPI**
- **Python**
- **Pydantic**
- **SQLAlchemy**
- **Alembic**

### Database

- **SQLite**

### Matching and data logic

- **pandas**
- **NumPy**
- **NetworkX**
- **OR-Tools** _(only if needed later for more advanced optimization)_

### Testing

- **pytest** for backend and algorithm testing
- **Vitest** for frontend unit testing
- **Playwright** for end-to-end testing

---

## Why this stack

## 1. React + TypeScript for the frontend

The app needs a real interface, not just forms and static pages.

It will likely include:

- admin dashboard
- upload flows
- student lists
- room assignment views
- filters and search
- matching summaries
- fairness/explainability views
- manual compatibility checker

React is a strong choice for this because it makes it easier to build dynamic UI and reusable components.

TypeScript is being used so the frontend is cleaner, safer, and easier to maintain.

---

## 2. Vite for the frontend tooling

Vite is being used because it gives a fast developer experience and keeps the frontend setup lightweight.

It is a good fit for a portfolio project because:

- fast local development
- simple configuration
- clean build output
- works well with React and TypeScript

---

## 3. Tailwind + shadcn/ui for UI

Tailwind will help build the UI quickly without writing too much custom CSS.

shadcn/ui is being chosen to make the app look more polished without depending on a rigid component library. It gives good-looking components while still letting the UI feel custom and recruiter-friendly.

This combination is useful because the project needs to look like a serious product, not just a functional prototype.

---

## 4. FastAPI + Python for the backend

The backend is not only handling CRUD or forms. It also needs to support:

- CSV ingestion
- validation
- student data processing
- scoring logic
- compatibility calculations
- roommate matching
- room assignment logic
- fairness checks
- explainability output
- exports

Because of that, **Python** is a better fit than trying to force everything into a JavaScript backend.

FastAPI is being used because:

- it is modern and clean
- it is fast to build with
- it has excellent request/response validation
- it works very well for API-based apps
- it is a good fit for a React frontend

---

## 5. SQLite for the database

SQLite is the best choice for this version of the project because:

- no separate database server is required
- setup is very easy
- everything stays local
- the whole database can live in a single file
- it keeps the project simple for GitHub users

This project does not need PostgreSQL or any cloud database at this stage.

Since the app is not being deployed and is mainly being built for demonstration, portfolio value, and local usage, SQLite is enough.

---

## 6. pandas / NumPy / NetworkX for the core logic

This project has a logic-heavy backend, especially around:

- reading CSVs
- cleaning input data
- scoring compatibility
- building pair/group relationships
- running matching logic
- generating explanations

These are exactly the kinds of tasks where Python is strong.

- **pandas** will be used for CSV and table-like data handling
- **NumPy** will help with numerical operations
- **NetworkX** can help model compatibility and matching relationships
- **OR-Tools** can be added later only if the matching logic needs more advanced optimization

The important point is that the app can still be fully built even without OR-Tools in the first version.

---

## 7. SQLAlchemy + Alembic

SQLAlchemy will be used for database models and queries.

Alembic will be used for migrations so the schema stays manageable as the project grows.

Even though SQLite is simple, using proper migrations still makes the project look more professional and helps keep the codebase organized.

---

## Cloud services decision

This project is intentionally being designed to **avoid cloud services**.

### Cloud services that will not be used in the initial version

- Firebase
- Supabase
- Auth0
- managed PostgreSQL
- AWS/GCP/Azure storage
- hosted queues or caching services

### Why they are being avoided

- they add setup overhead
- they usually require environment variables
- they create unnecessary project complexity
- they are not needed for a fully local version
- they make the repo harder for recruiters or users to run quickly

Cloud services should only be added in the future if there is a genuinely strong reason, such as:

- multi-user production usage
- real authentication requirements
- remote database hosting
- public deployment

For the current goal, they are not necessary.

---

## Environment variable strategy

This project should avoid a heavy `.env` setup.

### Preferred approach

Use sensible local defaults for most settings, such as:

- local SQLite database path
- local uploads folder
- local exports folder
- demo mode enabled by default
- local development ports

### `.env` should be optional

A `.env` file can still exist for overrides, but the app should ideally run without requiring users to create one manually.

That will make the repository much easier to try.

---

## Development mode vs final showcase mode

This project will use **two modes**, but only **one stack**.

The technologies stay the same in both modes.  
Only the way the app is run changes.

---

## Option 1: development mode

During development, the app will run as two local servers:

- frontend on Vite
- backend on FastAPI

### Example

- frontend: `localhost:5173`
- backend: `localhost:8000`

### Why this is the build mode

This is the easiest setup while actively building the app because:

- frontend hot reload is fast
- backend reload is separate
- debugging is easier
- frontend and backend remain cleanly separated

### This will be the primary build workflow

The app will be developed in this mode first.

---

## Option 2: final local showcase mode

After the app is fully built, the frontend will be compiled into static files and served by FastAPI.

That means:

- the React app is built
- FastAPI serves the built frontend
- FastAPI also serves the backend API
- the user runs one local server instead of two

### Why this is the final form

This makes the project easier to show in GitHub and easier for others to run.

Instead of asking users to start both frontend and backend separately, the final local experience becomes much cleaner.

---

## Important implementation note

### The app will be built in Option 1 first

The full application will be developed in **Option 1 (separate frontend + backend servers)**.

### The app will be switched to Option 2 after everything is done

Once the full app is complete, it will be presented in **Option 2 (FastAPI serving the built frontend)**.

This is not a change of stack.  
It is only a change in how the finished app is served locally.

So the plan is:

1. build the complete app in **Option 1**
2. finish all features
3. build the frontend
4. switch the final local presentation to **Option 2**
5. keep the project fully local with **no deployment**

---

## Why this approach is being chosen

This gives the best of both worlds.

### While building

- faster development
- easier debugging
- better frontend/backend separation

### In the final repo

- cleaner user experience
- easier for recruiters to run
- more polished presentation
- still no deployment required

---

## Suggested project structure

```text
project-root/
  frontend/
  backend/
    app/
      api/
      models/
      schemas/
      services/
        scoring/
        matching/
        explainability/
        fairness/
      db/
      tests/
  data/
    app.db
    uploads/
    exports/
  demo-data/
  docs/
  README.md
```

---

## What this stack allows the project to achieve

With this stack, the project can support the complete app, including:

- full UI
- local backend API
- local database
- CSV upload and parsing
- matching engine
- room assignment workflow
- admin review flow
- compatibility checker
- fairness/explainability logic
- exports
- demo-ready GitHub presentation

All of this can be done **without deployment**.

---

## Final decision

The final chosen stack for this project is:

- **React + TypeScript + Vite** for frontend
- **FastAPI + Python** for backend
- **SQLite** for local storage
- **SQLAlchemy + Alembic** for persistence and migrations
- **pandas / NumPy / NetworkX** for matching and data logic
- **Tailwind + shadcn/ui** for polished UI
- **pytest / Vitest / Playwright** for testing

### Development plan

- build the full application in **Option 1**
- switch to **Option 2** after the app is fully complete
- keep the project **local-first**
- do **not deploy**
- keep setup as simple as possible for GitHub viewers and recruiters
