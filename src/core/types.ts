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
// 配置相关类型
// ============================================================================

export type GestureConfig = {
  PINCH_THRESHOLD: number;
  BOUNDARY_Y: number;
};

export type SpreadConfig = {
  SPREAD_MIN: number;
  SPREAD_MAX: number;
  SPREAD_SMOOTHING: number;
};

export type CameraConfig = {
  CAMERA_FOV: number;
  CAMERA_NEAR: number;
  CAMERA_FAR: number;
  CAMERA_Z: number;
};

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
