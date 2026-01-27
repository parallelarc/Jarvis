/**
 * 统一配置管理 - 单一数据源
 * 所有配置参数在此定义，其他模块从此导入
 */

// ============================================================================
// 粒子系统配置
// ============================================================================

export const PARTICLE_CONFIG = {
  PARTICLE_COUNT: 2000,
  BASE_RADIUS: 2.0,
  PARTICLE_SIZE: 0.05,
} as const;

// ============================================================================
// 手势交互配置
// ============================================================================

export const GESTURE_CONFIG = {
  PINCH_THRESHOLD: 0.05,  // 固定阈值（已弃用，保留作为后备）
  PINCH_THRESHOLD_RATIO: 0.35,  // 自适应阈值系数（手掌尺寸 × 系数）
  PINCH_THRESHOLD_MIN: 0.02,    // 最小阈值（防止手太近时过于敏感）
  PINCH_THRESHOLD_MAX: 0.12,    // 最大阈值（防止手太远时无法触发）
  BOUNDARY_Y: 4.5,
} as const;

// ============================================================================
// 相机配置
// ============================================================================

export const CAMERA_CONFIG = {
  CAMERA_FOV: 75,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 1000,
  CAMERA_Z: 5,
} as const;

// ============================================================================
// 手部关键点连接配置
// ============================================================================

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // 拇指
  [0, 5], [5, 6], [6, 7], [7, 8],       // 食指
  [0, 9], [9, 10], [10, 11], [11, 12],  // 中指
  [0, 13], [13, 14], [14, 15], [15, 16], // 无名指
  [0, 17], [17, 18], [18, 19], [19, 20], // 小指
  [5, 9], [9, 13], [13, 17],             // 手掌
] as const;

// ============================================================================
// 视图配置
// ============================================================================

export const VIEW_CONFIG = {
  // 坐标转换配置
  // MediaPipe 归一化坐标: (0, 0) = 左上角, (1, 1) = 右下角
  // Three.js 世界坐标: X/Y 从 -5 到 +5, Z = 0
  NORMALIZED_CENTER: 0.5,  // 归一化坐标中心点
  WORLD_SCALE: 10,         // 世界坐标范围（-WORLD_SCALE/2 到 +WORLD_SCALE/2）
  INVERT_X: true,          // X 轴是否反转（与 CSS 镜像保持一致）
  INVERT_Y: true,          // Y 轴是否反转（true = MediaPipe 坐标系向下，WebGL 向上）
} as const;

// ============================================================================
// 设计画布配置
// ============================================================================

export const DESIGN_CONFIG = {
  DESIGN_CANVAS_WIDTH: 1920,
  DESIGN_CANVAS_HEIGHT: 1080,
  WORLD_WIDTH: 10,  // Three.js 世界坐标宽度范围 (-5 到 +5)
} as const;

// ============================================================================
// 手势检测内部配置
// ============================================================================

export const GESTURE_DETECTION_CONFIG = {
  FINGER_EXTENDED_RATIO: 1.2,
  OK_THRESHOLD: 0.06,
  WAVE_SPEED_THRESHOLD: 0.03,
  WAVE_COUNT_THRESHOLD: 3,
  WAVE_TIME_WINDOW: 1000,
  HELLO_WAVE_THRESHOLD: 3,
  HELLO_WAVE_TIME_WINDOW: 1500,
  POINTING_NO_CURL_THRESHOLD: 0.3,
  VICTORY_EXTENDED_ANGLE: 160,
  THUMB_UP_ANGLE_THRESHOLD: 160,
  PALM_DIRECTION_THRESHOLD: 0.5,
  FIST_CURLED_THRESHOLD: 0.6,
} as const;

// ============================================================================
// 交互配置
// ============================================================================

export const INTERACTION_CONFIG = {
  CLICK_TIMEOUT_MS: 1000,
  SCALE_MIN: 0.2,
  SCALE_MAX: 5.0,
  OUTLINE_SCALE_MULTIPLIER: 1.15,
} as const;

// ============================================================================
// 旋转交互配置
// ============================================================================

export const ROTATION_CONFIG = {
  POSITION_TO_ANGLE_RATIO: 0.5,     // 位置到角度映射比例（无极旋转）
  DEADZONE_THRESHOLD: 0.05,         // 死区阈值（避免噪点）
} as const;

// ============================================================================
// SVG 对象布局配置
// 来源: size_rule.md - 基于 1920x1080 背景的设计尺寸
// 世界坐标范围: -5 到 +5 (总宽 10 单位)
// 比例换算: width / 1920 * 10 = 世界坐标宽度
// ============================================================================

export interface SVGLayoutItem {
  x: number;     // 在 1920x1080 画布中的 x 坐标
  y: number;     // 在 1920x1080 画布中的 y 坐标
  width: number;  // SVG 宽度
  height: number; // SVG 高度
}

// 尺寸配置：基于 1920x1080 画布的设计尺寸
// 缩小并居中显示在屏幕中央（更紧凑的布局）
// 所有元素作为一个整体，上下左右居中于屏幕中心(960, 540)
export const SVG_LAYOUT_CONFIG: Record<string, SVGLayoutItem> = {
  v: { x: 412, y: 506, width: 175, height: 143 },
  b: { x: 605, y: 454, width: 157, height: 197 },
  o: { x: 771, y: 506, width: 149, height: 145 },
  t: { x: 924, y: 454, width: 92, height: 197 },
  flower: { x: 1047, y: 431, width: 226, height: 219 },
  bot: { x: 1297, y: 435, width: 211, height: 216 },
} as const;

/**
 * 将设计坐标 (1920x1080) 转换为世界坐标 (-5 到 +5)
 * 设计坐标: 原点在左上角，X 向右，Y 向下
 * 世界坐标: 原点在中心，X 向右，Y 向上
 *
 * 注意：size_rule.md 中的 (x, y) 是 SVG 的左上角，需要转换为 SVG 中心点
 */
function designToWorld(designX: number, designY: number, width: number, height: number): { x: number; y: number } {
  const { DESIGN_CANVAS_WIDTH, DESIGN_CANVAS_HEIGHT, WORLD_WIDTH } = DESIGN_CONFIG;
  const WORLD_HEIGHT = WORLD_WIDTH * (DESIGN_CANVAS_HEIGHT / DESIGN_CANVAS_WIDTH);  // 5.625

  // 将 SVG 左上角坐标转换为中心点坐标
  const centerX = designX + width / 2;
  const centerY = designY + height / 2;

  // X: (centerX - canvasCenter) / canvasWidth * worldWidth
  const worldX = (centerX - DESIGN_CANVAS_WIDTH / 2) / DESIGN_CANVAS_WIDTH * WORLD_WIDTH;
  // Y: 反转 Y 轴 (canvasCenterY - centerY) / canvasHeight * worldHeight
  const worldY = (DESIGN_CANVAS_HEIGHT / 2 - centerY) / DESIGN_CANVAS_HEIGHT * WORLD_HEIGHT;

  return { x: Math.round(worldX * 100) / 100, y: Math.round(worldY * 100) / 100 };
}

/**
 * 自动生成位置配置：从设计坐标转换为世界坐标
 * 只需修改 SVG_LAYOUT_CONFIG，这里会自动计算
 */
export const SVG_POSITION_CONFIG: Record<string, { x: number; y: number }> = Object.fromEntries(
  Object.entries(SVG_LAYOUT_CONFIG).map(([id, layout]) => [
    id,
    designToWorld(layout.x, layout.y, layout.width, layout.height),
  ])
);

// 调试日志：输出计算出的位置
console.log('[CONFIG] SVG_POSITION_CONFIG calculated:', SVG_POSITION_CONFIG);

// ============================================================================
// 动态背景配置
// ============================================================================

export const DYNAMIC_BACKGROUND_CONFIG = {
  // 主色调（橙棕色背景）
  PRIMARY_COLOR: { r: 210/255, g: 70/255, b: 30/255 },       // 中深橙色
  // 中间色调
  SECONDARY_COLOR: { r: 240/255, g: 120/255, b: 60/255 },    // 亮橙色
  // 高光色（更亮的高光，增强对比）
  HIGHLIGHT_COLOR: { r: 255/255, g: 230/255, b: 180/255 },   // 亮金/浅杏色

  // 动画速度（流动效果 - 适中的速度）
  TIME_SCALE: 1.5,

  // 光照方向（左上到右下）
  LIGHT_DIRECTION: { x: -0.707, y: 0.707 },  // 归一化的左上方向向量

  // 几何配置
  PLANE_Z: -1,  // 背景平面在 SVG 对象后面
  PLANE_SIZE: 25,  // 覆盖整个视野
} as const;

// ============================================================================
// SVG 对象初始状态配置
// 统一管理所有 SVG 对象的初始位置、旋转、缩放
// ============================================================================

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface SVGObjectInitialState {
  position: Vector3D;
  scale: number;
  rotation: Vector3D;
  selected: boolean;
}

export const SVG_OBJECT_CONFIG = {
  // 初始旋转角度（弧度）- 正对镜头
  DEFAULT_ROTATION: { x: 0, y: 0, z: 0 } as Vector3D,

  // 初始缩放
  DEFAULT_SCALE: 1.0,

  // 初始位置（默认为原点）
  DEFAULT_POSITION: { x: 0, y: 0, z: 0 } as Vector3D,
} as const;

/**
 * 获取 SVG 对象的初始状态
 * @param override 可选的覆盖配置
 * @returns SVG 对象的初始状态
 */
export function getSVGObjectInitialState(override?: Partial<SVGObjectInitialState>): SVGObjectInitialState {
  return {
    position: { ...SVG_OBJECT_CONFIG.DEFAULT_POSITION },
    scale: SVG_OBJECT_CONFIG.DEFAULT_SCALE,
    rotation: { ...SVG_OBJECT_CONFIG.DEFAULT_ROTATION },
    selected: false,
    ...override,
  };
}

// ============================================================================
// 自动复位配置
// ============================================================================

export type EasingType = 'linear' | 'easeInOut' | 'easeOut';

export const AUTO_RESET_CONFIG = {
  TIMEOUT_MS: 3000,              // 手离开画面后多久触发复位（3秒）
  ANIMATION_DURATION_MS: 2000,   // 复位动画时长（2秒）
  EASING_TYPE: 'easeInOut' as EasingType,  // 缓动曲线类型
} as const;

// ============================================================================
// MediaPipe 帧率控制配置
// ============================================================================

export const MEDIAPIPE_CONFIG = {
  TARGET_FPS: 120,              // MediaPipe 目标帧率 (120Hz 显示器)
  FRAME_INTERVAL_MS: 1000 / 120, // ~8.3ms
  ENABLE_THROTTLING: true,       // 是否启用帧率节流
} as const;

// ============================================================================
// 面部视差配置
// ============================================================================

export const FACE_PARALLAX_CONFIG = {
  // SVG 元素旋转角度范围（弧度）
  MAX_ROTATION_Y: 0.52,     // 约 30°，人脸左/右移时的最大旋转角度（增大）
  MAX_ROTATION_X: 0.2,      // 约 11.5°，人脸上/下移时的最大旋转角度（增大）

  // 平滑插值参数
  SMOOTHING_FACTOR: 0.08,   // LERP 系数（0.01-1.0），越小越平滑

  // 性能优化
  DEADZONE_THRESHOLD: 0.02, // 死区阈值，过滤微小抖动
  FACE_TIMEOUT_MS: 2000,    // 面部丢失超时（2秒后复位）

  // 视差参数
  PARALLAX_STRENGTH: 3.0,   // 视差强度，控制相机移动范围
  Y_AXIS_MULTIPLIER: 0.5,   // Y轴视差强度系数（上下移动幅度稍小）
  CENTER_OFFSET: 0.5,       // 归一化坐标中心点

  // 自动模式切换
  AUTO_SWITCH_ENABLED: true,        // 是否启用自动模式切换
  CENTER_THRESHOLD: 0.15,           // 正前方检测阈值（±0.15 即 0.35-0.65 范围为正前方）
  MODE_SWITCH_COOLDOWN: 500,        // 模式切换冷却时间（毫秒），避免频繁切换
} as const;

// ============================================================================
// 手部覆盖层配置
// ============================================================================

export const HAND_OVERLAY_CONFIG = {
  // 左手样式
  LEFT_HAND: {
    PRIMARY: '#a855f7',           // 紫色
    GLOW: 'rgba(168, 85, 247, 0.4)',
    LABEL: 'L',
  },
  // 右手样式
  RIGHT_HAND: {
    PRIMARY: '#f97316',           // 橙色
    GLOW: 'rgba(249, 115, 22, 0.4)',
    LABEL: 'R',
  },
  // 圆点半径
  OUTER_RADIUS: 20,
  INNER_RADIUS: 10,
  // 字体
  FONT: 'bold 12px sans-serif',
} as const;

// ============================================================================
// 全息板配置
// ============================================================================

export const HOLOGRAM_CONFIG = {
  // 边缘框
  EDGE_MARGIN: 0.2,               // 边缘边距
  EDGE_THICKNESS: 0.3,            // 边缘厚度（Z轴）
  EDGE_OPACITY: 0,                // 边缘透明度（隐藏）
  EDGE_COLOR: 0x00D9FF,           // 边缘颜色（科技蓝）
  // 侧面框
  SIDE_THICKNESS: 0.02,           // 侧框本身的厚度
  SIDE_COLOR: 0x001a33,           // 侧面颜色（深蓝）
  SIDE_OPACITY: 0,                // 侧面透明度（隐藏）
} as const;
