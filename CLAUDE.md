# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Javis** is a hand gesture-controlled interactive particle system built with SolidJS, Three.js, and MediaPipe Hands.

## Common Commands

```bash
npm run dev              # Start dev server on http://localhost:3000
npm run build            # Production build
npm run preview          # Preview production build
npm run type-check       # TypeScript type checking
```

## Tech Stack

- **SolidJS** 1.8.11 - Reactive UI (NOT React, fine-grained reactivity)
- **Three.js** 0.160.0 - 3D rendering (via CDN on `window.THREE`)
- **MediaPipe Hands** - Hand tracking (local models in `/public/models/hands/`)
- **Vite** 5.0.12 - Build tool
- **TypeScript** 5.3.3

## Entry Point Flow

`index.html` → `src/main.tsx` → `src/App.tsx` → gesture loop

## Directory Structure

```
src/
├── components/          # App, DebugPanel, HandOverlay, SVGScene
├── hooks/              # useAnimationFrame, useGestureTracking
├── stores/             # animationStore, handStore, objectStore (SolidJS createStore)
├── domain/             # GestureDetector
├── plugins/            # svg/ (SVGRegistry, SVGObject), effects/ (ParticleEffect, RippleEffect)
├── core/types.ts       # Type definitions
├── config/index.ts     # Centralized configuration (single source of truth)
└── utils/              # math, color, easing, texture, three-sync
```

## State Management

```typescript
export const [store, setStore] = createStore(initialState);
```

**Stores:** `handStore` (hand tracking), `objectStore` (SVG objects), `animationStore` (particle states)

## Global API

```typescript
(window as any).svgSceneAPI = { getScene, getCamera, getSVGObjects };
```

## Coordinate System

- MediaPipe: (0,0) = top-left, normalized 0-1
- Three.js: X/Y -5 to +5, Z = 0
- X-axis flipped (CSS `scaleX(-1)`), Y-axis flipped (screen vs WebGL)

## Configuration

All in `src/config/index.ts`: `PARTICLE_CONFIG`, `GESTURE_CONFIG`, `INTERACTION_CONFIG`, `CAMERA_CONFIG`, etc.

## Gesture Interactions

| Gesture | Effect |
|---------|--------|
| Pointing (index only) | Touch selection |
| Pinch | Click/drag (right hand) |
| Both hands pinch | Zoom mode |
| D key | Toggle debug panel |

**Click detection:** Pinch + release within 1000ms on same object (AABB collision)

## Detected Gestures (GestureDetector)

Static: Pointing, Victory, Thumbs Up/Down, OK, Call Me, Rock On, Open Palm, Fist
Palm directions: Up, Down, Left, Right, Toward/Away Camera
Dynamic: Wave, Hello Wave
Two-hand: Zoom

## Engineering Principles

- **DRY** (Don't Repeat Yourself) - Extract repeated logic into functions/constants. Centralize config in `src/config/index.ts`
- **KISS** (Keep It Simple) - Favor native APIs, avoid over-abstraction
- **YAGNI** (You Aren't Gonna Need It) - Don't build features for hypothetical future needs
- **SRP** (Single Responsibility Principle) - Each module/component has one single purpose

## Key Patterns

1. **Untrack in render loops** - `untrack(() => ...)` to avoid reactive tracking overhead
2. **Pixel ratio cap** - Max 2x for performance
3. **Centralized config** - All constants in `src/config/index.ts`
4. **Generic helper pattern** - `withSVGObject<T>()` in three-sync.ts
5. **Data-driven functions** - `FINGER_PINCH_INDICES` constant in GestureDetector

## Type Definitions

`src/core/types.ts`: `Vector3D`, `Color`, `Landmark`, `Landmarks`, `HandSide`, `HandState`, `AnimationState`

`src/domain/GestureDetector.ts`: `PinchingFinger`, `FingersExtended`, `PinchStates`, `PalmInfo`, `HandGestures`

## SVG Objects

`SVG_OBJECT_IDS = ['v', 'b', 'o', 't', 'flower', 'bot']` (6 total)

Registry singleton loads assets, creates THREE.Sprite with invisible hit plane for AABB collision.

## Debugging

Press **D** to toggle debug panel (FPS, hand status, gestures, object positions, BBox viz).

## Bilingual Codebase

Comments in Chinese, code in English. This is intentional.
