# Repository Guidelines

## Project Structure & Module Organization
- `index.html` is the root entry point for the hand-tracking demo.
- `src/` holds TypeScript/SolidJS source files:
  - `components/` - UI components (App, DebugPanel, HandOverlay, SVGScene)
  - `stores/` - SolidJS state management (handStore, objectStore, animationStore, faceStore)
  - `services/` - Business logic (MediaPipe, drag, zoom, rotation, face detection)
  - `domain/` - Core gesture detection (GestureDetector)
  - `hooks/` - Custom hooks (useAnimationFrame, useGestureTracking)
  - `config/` - Centralized configuration
  - `utils/` - Helper functions
  - `core/types.ts` - TypeScript type definitions
- `public/models/` stores MediaPipe assets and runtime libraries (`hands/`, `face_detection/`, `face_mesh/`, `libs/`, `*.glb`).

## Build, Test, and Development Commands
- `npm run dev` - Start dev server on http://localhost:3000
- `npm run build` - Production build
- `npm run preview` - Preview production build
- `npm run type-check` - TypeScript type checking

## Coding Style & Naming Conventions
- TypeScript uses ES modules, semicolons, and 4-space indentation.
- Prefer single quotes for strings and descriptive, lowerCamelCase filenames (e.g., `gestureDetector.ts`).
- React/Solid components use PascalCase (e.g., `DebugPanel.tsx`).
- Constants use UPPER_SNAKE_CASE (see `src/config/index.ts`).

## Testing Guidelines
- No automated tests; rely on manual smoke testing:
  - Verify webcam permission, gesture tracking, and the debug panel toggle (`D`).
  - Run `npm run type-check` for type validation.

## Commit & Pull Request Guidelines
- Recent commits are short and descriptive; some use Conventional Commits (e.g., `feat:`), others are plain sentences. Keep messages concise and action-oriented.
- PRs should include a brief summary, testing steps, and screenshots/GIFs for UI changes. Link related issues when available.

## Runtime Requirements & Configuration
- Requires a modern browser with WebGL and ES module support.
- Camera access is required; use `localhost` or HTTPS to avoid permission issues.
