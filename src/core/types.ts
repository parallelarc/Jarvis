/**
 * 核心类型定义
 */

// ============================================================================
// 基础类型
// ============================================================================

export type Vector3D = {
  x: number;
  y: number;
  z?: number;
};

export type Color = {
  r: number;  // 0-1
  g: number;  // 0-1
  b: number;  // 0-1
};

export type HexColor = number;  // 0xRRGGBB

// ============================================================================
// 手势相关类型
// ============================================================================

export type Landmark = {
  x: number;  // 0-1, normalized
  y: number;  // 0-1, normalized
  z: number;  // relative to wrist
};

export type Landmarks = Landmark[];  // 21 points per hand

export type HandSide = 'Left' | 'Right';

export type HandState = {
  side: HandSide;
  active: boolean;
  landmarks: Landmarks | null;
  isTouching: boolean;
  isSelected: boolean;
  isPinching: boolean;
  pinchDistance: number;
};

// ============================================================================
// 粒子相关类型
// ============================================================================

export const PARTICLE_COUNT = 2000;

export type ParticlePosition = Float32Array;  // [x, y, z, x, y, z, ...]
export type ParticleColor = Float32Array;     // [r, g, b, r, g, b, ...]

export type AnimationState =
  | 'ball'
  | 'exploding'
  | 'forming'
  | 'text'
  | 'recovering';

export type Ripple = {
  contactPoint: Vector3D;
  color: Color;
  startTime: number;
};

// ============================================================================
// 插件相关类型
// ============================================================================

export type ShapeGenerator = (count: number, time: number, ...args: unknown[]) => ParticlePosition;

export type EffectApplicator = (
  positions: ParticlePosition,
  colors: ParticleColor
) => boolean;  // returns isActive

// ============================================================================
// 配置相关类型
// ============================================================================

export type ParticleConfig = {
  PARTICLE_COUNT: number;
  BASE_RADIUS: number;
  PARTICLE_SIZE: number;
};

export type GestureConfig = {
  PINCH_THRESHOLD: number;
  BOUNDARY_Y: number;
};

export type SpreadConfig = {
  SPREAD_MIN: number;
  SPREAD_MAX: number;
  SPREAD_SMOOTHING: number;
};

export type RippleConfig = {
  RIPPLE_DURATION: number;
  RIPPLE_EXPANSION_SPEED: number;
  RIPPLE_WIDTH: number;
};

export type ColorConfig = {
  DEFAULT_COLOR: Color;
};

export type CameraConfig = {
  CAMERA_FOV: number;
  CAMERA_NEAR: number;
  CAMERA_FAR: number;
  CAMERA_Z: number;
};

// ============================================================================
// 事件相关类型
// ============================================================================

export type EventType =
  | 'hand:detected'
  | 'hand:lost'
  | 'gesture:pointing'
  | 'gesture:waving'
  | 'particle:exploded'
  | 'animation:changed'
  | 'interaction:drag-start'
  | 'interaction:drag-end'
  | 'interaction:zoom-start'
  | 'interaction:zoom-end';

export type EventCallback<T = unknown> = (data: T) => void;

// ============================================================================
// Three.js 类型声明
// ============================================================================

declare global {
  interface Window {
    THREE?: {
        Scene: new () => any;
        PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => any;
        WebGLRenderer: new (options?: { antialias?: boolean; alpha?: boolean }) => any;
        BufferGeometry: new () => any;
        BufferAttribute: new (array: any, itemSize: number) => any;
        PointsMaterial: new (options: {
            size?: number;
            vertexColors?: boolean;
            transparent?: boolean;
            opacity?: number;
            blending?: number;
            sizeAttenuation?: boolean;
        }) => any;
        Points: new (geometry: any, material: any) => any;
        AmbientLight: new (color?: number, intensity?: number) => any;
        AdditiveBlending: number;
    };
    Hands?: any;
    Camera?: any;
    drawConnectors?: (ctx: CanvasRenderingContext2D, landmarks: Landmarks, connections: number[][], options?: { color: string; lineWidth: number }) => void;
    drawLandmarks?: (ctx: CanvasRenderingContext2D, landmarks: Landmarks, options?: { color: string; lineWidth: number; radius: number }) => void;
    HAND_CONNECTIONS?: number[][];
  }
}
