# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Javis** is a hand gesture-controlled interactive particle system built with SolidJS, Three.js, and MediaPipe Hands. Users manipulate 3D SVG objects and particle effects through intuitive hand gestures in real-time.

## Common Commands

```bash
# Development
npm run dev              # Start dev server on http://localhost:3000
npm run build            # Production build
npm run preview          # Preview production build
npm run type-check       # TypeScript type checking
```

## Architecture

### Tech Stack
- **SolidJS** 1.8.11 - Reactive UI framework (fine-grained reactivity, not React)
- **Three.js** 0.160.0 - 3D rendering (loaded via CDN, exposed on `window.THREE`)
- **MediaPipe Hands** - Hand tracking (local models in `/public/models/hands/`)
- **Vite** 5.0.12 - Build tool and dev server
- **TypeScript** 5.3.3

### Entry Point Flow
`index.html` → `src/main.tsx` → `src/App.tsx`

The app initializes in this order:
1. MediaPipe loads asynchronously via CDN
2. `useGestureTracking` hook initializes hand tracking
3. `SVGScene` creates Three.js scene and loads SVG objects
4. Gesture loop begins with `onResults` callback every frame

### Key Directories
```
src/
├── components/          # UI components (DebugPanel, HandOverlay, SVGScene)
├── hooks/              # Custom SolidJS hooks (useGestureTracking)
├── stores/             # SolidJS reactive state (handStore, objectStore, animationStore)
├── domain/             # Business logic (GestureDetector)
├── plugins/            # Modular plugins (svg/, effects/, animations/)
├── core/types.ts       # TypeScript type definitions
├── config/index.ts     # Centralized configuration (single source of truth)
└── utils/              # Math helpers, texture utilities, three-sync helpers
```

## State Management Pattern

Uses SolidJS's `createStore` for reactive state. Stores follow this pattern:

```typescript
export const [handStore, setHandStore] = createStore(initialState);
export const handActions = {
  setHandActive(side, active) { /* ... */ },
  setGesture(side, gesture) { /* ... */ },
};
```

**Important stores:**
- `handStore` - Hand tracking data, gestures, pinch state, touch detection
- `objectStore` - SVG object positions, scales, selection state
- `animationStore` - Particle animation states

## Global API Pattern

Critical APIs are exposed to `window` to bridge SolidJS components with imperative Three.js:

```typescript
// In SVGScene.tsx
(window as any).svgSceneAPI = {
  getScene,
  getCamera,
  getSVGObjects,
};
```

## Coordinate System

```
MediaPipe (normalized):  (0,0) = top-left, (1,1) = bottom-right
Three.js World:          X: -5 to +5, Y: -5 to +5, Z: 0 (flat plane)

Transformation: worldX = (0.5 - normalizedX) * 10
```

**Note:** X-axis is flipped due to CSS mirroring (`transform: scaleX(-1)`).

## Gesture Detection Pipeline

```
MediaPipe Hands (C++)
  → onResults callback
  → detectHandGestures() [GestureDetector.ts]
  → handActions.setGesture()
  → handStore (reactive update)
  → UI re-renders
```

## Configuration

All configuration is centralized in `src/config/index.ts`. Edit this file for:
- Particle settings (`PARTICLE_CONFIG`)
- Gesture thresholds (`GESTURE_CONFIG`, `GESTURE_DETECTION_CONFIG`)
- Interaction settings (`INTERACTION_CONFIG`) - click timeout, scale limits, outline multiplier
- Camera settings (`CAMERA_CONFIG`)
- Hand landmark connections (`HAND_CONNECTIONS`)

## Plugin Architecture

SVG objects use a Registry + Factory pattern:
- `src/plugins/svg/SVGRegistry.ts` - Asset management (singleton), loads and caches textures, exports `SVG_OBJECT_IDS` constant
- `src/plugins/svg/SVGObject.ts` - Object wrapper class, manages position/scale/interaction

## Utility Modules

- `src/utils/math.ts` - `calculateDistance()`, `lerp()`, `normalizedToWorld()`, `isPointNearParticlesWithPos()`
- `src/utils/texture.ts` - `createOutlineTexture()` for selected object highlighting
- `src/utils/three-sync.ts` - Sync helpers for Three.js ↔ Store synchronization:
  - `withSVGObject()` - Generic helper that encapsulates API/objects/operation pattern
  - `syncSVGObjectPosition()` - Update object position in Three.js
  - `syncSVGObjectScale()` - Update object scale in Three.js
  - `syncSVGObjectSelected()` - Update object selection state
  - `syncAllSVGObjectsSelected()` - Update all objects' selection state
  - `findObjectUnderPoint()` - Find SVG object at a given point
- `src/utils/color.ts` - Color utilities

## Gesture Interactions

| Gesture | Trigger | Effect |
|---------|---------|--------|
| Pointing | Only index extended | Touch selection |
| Pinch | Thumb + finger close | Click/drag (right hand only) |
| Both hands pinch | Two hands pinching | Zoom mode |
| D key | Keyboard | Toggle debug panel |

**Click detection:** Pinch + release within `INTERACTION_CONFIG.CLICK_TIMEOUT_MS` (1000ms) on an object (based on AABB collision)

## Debugging

Press `D` to toggle the debug panel showing:
- FPS counter
- Hand detection status
- Gesture recognition results
- SVG object positions/scales
- BBox visualization toggle

## Important Patterns

1. **Untrack in render loops:** Use `untrack(() => ...)` in `requestAnimationFrame` to avoid reactive tracking overhead
2. **Pixel ratio cap:** Max 2x to prevent high-DPI slowdown
3. **Cleanup:** Proper disposal in `onCleanup` for Three.js resources
4. **BBox collision:** `SVGObject.containsPoint()` and `SVGObject.getBounds()` for touch detection
5. **Centralized configuration:** All constants in `src/config/index.ts` - never duplicate definitions
6. **Shared utilities:** Use `src/utils/math.ts` for common math functions, avoid reimplementing

## Code Simplification Patterns

The codebase uses several patterns to reduce duplication:

### 1. Generic Helper Pattern (three-sync.ts)
```typescript
// Instead of repeating the API → objects → operation pattern:
function withSVGObject<T>(id: string, operation: (obj: SVGObject) => T, fallback: T): T {
  const sceneAPI = getSceneAPI();
  if (!sceneAPI) return fallback;
  const svgObjects = sceneAPI.getSVGObjects();
  if (!svgObjects) return fallback;
  const svgObj = svgObjects.get(id) as SVGObject | undefined;
  return svgObj ? operation(svgObj) : fallback;
}
```

### 2. Data-Driven Functions (GestureDetector.ts)
```typescript
// Instead of 4 identical functions for each finger:
const FINGER_PINCH_INDICES = { index: 8, middle: 12, ring: 16, pinky: 20 } as const;
export function isThumbPinching(landmarks: Landmarks, finger: PinchingFinger): boolean {
  return calculateDistance(landmarks[4], landmarks[FINGER_PINCH_INDICES[finger]])
    < GESTURE_DETECTION_CONFIG.PINCH_THRESHOLD;
}
```

### 3. Bulk State Reset (handStore.ts)
```typescript
// Use reconcile() to reset entire hand state in one operation:
resetHandState(side: HandSide) {
  const key = sideToKey(side);
  setHandStore(key, reconcile(createInitialHandState(side)));
}
```

## Type Definitions

Core types in `src/core/types.ts`:
- `Landmark` - MediaPipe landmark (normalized 0-1)
- `HandState` - Hand tracking state
- `AnimationState` - Particle animation states ('ball' | 'exploding' | 'forming' | 'text' | 'recovering')

Additional types in `src/domain/GestureDetector.ts`:
- `PinchingFinger` - Union type for pinchable fingers: 'index' | 'middle' | 'ring' | 'pinky'
- `FingersExtended`, `PinchStates`, `PalmInfo`, `HandGestures` - Gesture detection result types

## Bilingual Codebase

- Comments and documentation are in Chinese
- Code (identifiers, strings) is in English
- Don't be surprised by Chinese comments - this is intentional
