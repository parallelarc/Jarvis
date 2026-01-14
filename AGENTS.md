# Repository Guidelines

## Project Structure & Module Organization
- `index.html` is the root entry point for the hand-tracking demo.
- `js/` holds ES module source files (`main.js`, `appState.js`, `particles.js`, `gestureDetector.js`, `handRenderer.js`, `debugPanel.js`).
- `css/` contains component-level styles such as `debugPanel.css`.
- `models/` stores MediaPipe assets and runtime libraries (`hands/`, `face_mesh/`, `libs/`, `*.glb`).
- `off-axis-sneaker/` is a separate Vite + React + TypeScript app with its own `src/`, `public/`, and config files.

## Build, Test, and Development Commands
- Root demo (static):
  - `python -m http.server` (or `npx http-server`, `php -S localhost:8000`) to serve `index.html` locally.
  - Open `http://localhost:8000` and allow camera access.
- Off-axis app:
  - `cd off-axis-sneaker && npm install` to install dependencies.
  - `npm run dev` for local development, `npm run build` for production build.
  - `npm run preview` to serve the production build, `npm run lint` for ESLint checks.

## Coding Style & Naming Conventions
- JavaScript uses ES modules, semicolons, and 4-space indentation.
- Prefer single quotes for strings and descriptive, lowerCamelCase filenames (e.g., `gestureDetector.js`).
- Constants use UPPER_SNAKE_CASE (see `CONFIG` in `js/appState.js`).
- In `off-axis-sneaker/`, follow React + TypeScript conventions and keep components in PascalCase.

## Testing Guidelines
- No automated tests in the root demo; rely on manual smoke testing:
  - Verify webcam permission, gesture tracking, and the debug panel toggle (`D`).
- For `off-axis-sneaker/`, run `npm run lint` and do a quick UI pass via `npm run dev`.

## Commit & Pull Request Guidelines
- Recent commits are short and descriptive; some use Conventional Commits (e.g., `feat:`), others are plain sentences. Keep messages concise and action-oriented.
- PRs should include a brief summary, testing steps, and screenshots/GIFs for UI changes. Link related issues when available.

## Runtime Requirements & Configuration
- Requires a modern browser with WebGL and ES module support.
- Camera access is required; use `localhost` or HTTPS to avoid permission issues.
