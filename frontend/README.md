# Roommate Matcher Frontend

React + TypeScript frontend for the Roommate Matcher project, built with Vite.

## Tech Stack
- **Framework:** React with TypeScript
- **Build Tool:** Vite
- **Routing:** React Router
- **Styling:** Tailwind CSS, shadcn/ui components
- **State Management/Data Fetching:** TanStack Query

## Directory Structure
- `src/pages/`: Route-level screen components.
- `src/components/`: Reusable UI components (buttons, dialogs, etc.).
- `src/lib/`: API clients, utilities, and shared functions.
- `e2e/`: Playwright end-to-end test specifications.

## Local Development

### Setup
1. Ensure Node.js 18+ is installed.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application
Create a `.env.local` file with the `VITE_API_BASE_URL` pointing to your backend (usually `http://127.0.0.1:8000`), then run:
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

### Running Tests

**Unit Tests (Vitest):**
```bash
npm run test
```

**End-to-End Tests (Playwright):**
```bash
npm run e2e:install  # Only needed the first time
npm run e2e
```

## Build for Production
```bash
npm run build
```
The output will be placed in the `dist/` directory.
