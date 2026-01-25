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
  PINCH_THRESHOLD: 0.08,  // 捏合阈值（统一值）
  BOUNDARY_Y: 4.5,
} as const;

// ============================================================================
// 扩展控制配置
// ============================================================================

export const SPREAD_CONFIG = {
  SPREAD_MIN: 0.3,
  SPREAD_MAX: 5.0,
  SPREAD_SMOOTHING: 0.1,
} as const;

// ============================================================================
// 颜色配置
// ============================================================================

export const COLOR_CONFIG = {
  DEFAULT_COLOR: { r: 1.0, g: 0.0, b: 1.0 },  // 洋红色
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
  // 显示镜像设置
  MIRROR_X: true,  // 显示通过CSS镜像，保留原始坐标用于交互

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
export const SVG_LAYOUT_CONFIG: Record<string, SVGLayoutItem> = {
  v: { x: 53.7, y: 783.6, width: 291.8, height: 238.5 },
  b: { x: 358.6, y: 697.8, width: 261, height: 327.9 },
  o: { x: 634.7, y: 783.6, width: 249.1, height: 242.2 },
  t: { x: 889.7, y: 697.8, width: 152.7, height: 327.7 },
  flower: { x: 1094.7, y: 659.7, width: 376.8, height: 365.8 },
  bot: { x: 1511.1, y: 665.1, width: 352.3, height: 360.4 },
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

// ============================================================================
// 动态背景配置
// ============================================================================

export const DYNAMIC_BACKGROUND_CONFIG = {
  // 主色调（保持原有橙色）
  PRIMARY_COLOR: { r: 250/255, g: 104/255, b: 55/255 },
  // 辅助暖黄色（高光部分）- 增强亮度，接近米白色
  SECONDARY_COLOR: { r: 255/255, g: 240/255, b: 200/255 },
  // 暗部颜色（边缘阴影）- 加深，接近深红褐色
  SHADOW_COLOR: { r: 120/255, g: 40/255, b: 20/255 },

  // 动画速度（越小越慢）
  TIME_SCALE: 5,

  // 几何配置
  PLANE_Z: -1,  // 背景平面在 SVG 对象后面
  PLANE_SIZE: 25,  // 覆盖整个视野
} as const;
