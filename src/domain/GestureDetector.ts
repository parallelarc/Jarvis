/**
 * GestureDetector - 手势检测原子技能库
 *
 * 基于 MediaPipe Hands 21 个关键点，提供各类手势状态的检测函数
 * 可作为独立模块被其他项目引用
 *
 * MediaPipe Hands 关键点索引:
 * - 0: 手腕
 * - 1-4: 拇指 (MCP→IP→TIP)
 * - 5-8: 食指 (MCP→PIP→DIP→TIP)
 * - 9-12: 中指 (MCP→PIP→DIP→TIP)
 * - 13-16: 无名指 (MCP→PIP→DIP→TIP)
 * - 17-20: 小指 (MCP→PIP→DIP→TIP)
 */

import type { Vector3D, Landmarks, HandSide } from '@/core/types';
import { GESTURE_DETECTION_CONFIG } from '@/config';

// ========== 类型定义 ==========

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

export interface FingersExtended {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
  extendedCount: number;
}

export interface PinchStates {
  thumbIndex: { isPinching: boolean; distance: number };
  thumbMiddle: { isPinching: boolean; distance: number };
  thumbRing: { isPinching: boolean; distance: number };
  thumbPinky: { isPinching: boolean; distance: number };
}

export interface PalmInfo {
  center: Vector3D;
  normal: Landmark3D;
  direction: 'up' | 'down' | 'left' | 'right' | 'camera' | 'away';
  facingUp: boolean;
  facingDown: boolean;
  facingCamera: boolean;
}

export interface DynamicGestures {
  waving: boolean;
  helloWaving: { isWaving: boolean; duration: number };
}

export interface HandGestures {
  fingers: FingersExtended;
  pinch: {
    isPinching: boolean;
    thumbIndex: boolean;
    thumbMiddle: boolean;
    thumbRing: boolean;
    thumbPinky: boolean;
    thumbIndexDistance: number;
    pinchingFinger: 'index' | 'middle' | 'ring' | 'pinky' | null;
  };
  gestures: {
    pointing: boolean;
    victory: boolean;
    thumbsUp: boolean;
    thumbsDown: boolean;
    ok: boolean;
    callMe: boolean;
    rockOn: boolean;
    openPalm: boolean;
    fist: boolean;
  };
  palm: PalmInfo;
  dynamic: DynamicGestures;
}

export interface TwoHandGestures {
  bothPresent: boolean;
  distance: number;
  zoom: {
    isZoom: boolean;
    direction: 'in' | 'out' | null;
    distance?: number;
  };
}

export interface AllGestures {
  left: HandGestures | null;
  right: HandGestures | null;
  twoHand: TwoHandGestures;
}

export interface PositionEntry {
  x: number;
  y: number;
  t: number;
}

export interface HandGestureHistory {
  positions: PositionEntry[];
  velocities: number[];
  lastWaveTime: number;
  isWaving: boolean;
  waveDirectionChanges: number;
  lastX: number | null;
  lastVelocityX: number;
  waveStartTime: number;
  helloDirectionChanges: number;
  lastHelloX: number | null;
  lastHelloDirection: number;
  consecutiveWaveFrames: number;
}

// ========== 内部状态 ==========

const gestureHistory: Record<'leftHand' | 'rightHand', HandGestureHistory> = {
  leftHand: {
    positions: [],
    velocities: [],
    lastWaveTime: 0,
    isWaving: false,
    waveDirectionChanges: 0,
    lastX: null,
    lastVelocityX: 0,
    waveStartTime: 0,
    helloDirectionChanges: 0,
    lastHelloX: null,
    lastHelloDirection: 0,
    consecutiveWaveFrames: 0,
  },
  rightHand: {
    positions: [],
    velocities: [],
    lastWaveTime: 0,
    isWaving: false,
    waveDirectionChanges: 0,
    lastX: null,
    lastVelocityX: 0,
    waveStartTime: 0,
    helloDirectionChanges: 0,
    lastHelloX: null,
    lastHelloDirection: 0,
    consecutiveWaveFrames: 0,
  },
};

// ========== 基础辅助函数 ==========

/**
 * 计算两点之间的欧几里得距离
 */
function calculateDistance(p1: Landmark3D | Vector3D, p2: Landmark3D | Vector3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z ?? 0) - (p2.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 计算点到参考点的距离
 */
function distanceFromWrist(landmarks: Landmarks, pointIndex: number, referenceIndex = 0): number {
  return calculateDistance(landmarks[pointIndex], landmarks[referenceIndex]);
}

/**
 * 判断手指是否伸直
 */
function isFingerExtended(landmarks: Landmarks, fingerIndices: [number, number, number, number]): boolean {
  const [mcp, pip, dip, tip] = fingerIndices;

  // 计算指尖到手腕的距离
  const tipDistance = distanceFromWrist(landmarks, tip);
  // 计算指根到手腕的距离
  const mcpDistance = distanceFromWrist(landmarks, mcp);

  // 手指伸直时，指尖距离应该显著大于指根距离
  return tipDistance > mcpDistance * GESTURE_DETECTION_CONFIG.FINGER_EXTENDED_RATIO;
}

/**
 * 判断手指是否弯曲
 */
function isFingerCurled(landmarks: Landmarks, fingerIndices: [number, number, number, number]): boolean {
  return !isFingerExtended(landmarks, fingerIndices);
}

// ========== 基础手指状态检测 ==========

/**
 * 检测拇指是否伸直
 */
export function isThumbExtended(landmarks: Landmarks): boolean {
  const thumbTip = landmarks[4];
  const indexMCP = landmarks[5];
  const wrist = landmarks[0];

  // 拇指尖到食指根部的距离
  const thumbToIndex = calculateDistance(thumbTip, indexMCP);
  // 手腕到食指根部的距离
  const wristToIndex = calculateDistance(wrist, indexMCP);

  // 拇指伸直时，距离应该更大
  return thumbToIndex > wristToIndex * 0.6;
}

/**
 * 检测食指是否伸直
 */
export function isIndexExtended(landmarks: Landmarks): boolean {
  return isFingerExtended(landmarks, [5, 6, 7, 8]);
}

/**
 * 检测中指是否伸直
 */
export function isMiddleExtended(landmarks: Landmarks): boolean {
  return isFingerExtended(landmarks, [9, 10, 11, 12]);
}

/**
 * 检测无名指是否伸直
 */
export function isRingExtended(landmarks: Landmarks): boolean {
  return isFingerExtended(landmarks, [13, 14, 15, 16]);
}

/**
 * 检测小指是否伸直
 */
export function isPinkyExtended(landmarks: Landmarks): boolean {
  return isFingerExtended(landmarks, [17, 18, 19, 20]);
}

/**
 * 获取所有手指的伸直状态
 */
export function getAllFingersExtended(landmarks: Landmarks): FingersExtended {
  const thumb = isThumbExtended(landmarks);
  const index = isIndexExtended(landmarks);
  const middle = isMiddleExtended(landmarks);
  const ring = isRingExtended(landmarks);
  const pinky = isPinkyExtended(landmarks);

  // 计算伸直的手指数量 (避免循环依赖)
  const extendedCount = [thumb, index, middle, ring, pinky].filter(v => v).length;

  return {
    thumb,
    index,
    middle,
    ring,
    pinky,
    extendedCount,
  };
}

/**
 * 计算伸直的手指数量
 */
export function countExtendedFingers(landmarks: Landmarks): number {
  return getAllFingersExtended(landmarks).extendedCount;
}

// ========== 捏合状态检测 ==========

/**
 * 检测拇指与食指是否捏合
 */
export function isThumbIndexPinching(landmarks: Landmarks): boolean {
  return calculateDistance(landmarks[4], landmarks[8]) < GESTURE_DETECTION_CONFIG.PINCH_THRESHOLD;
}

/**
 * 检测拇指与中指是否捏合
 */
export function isThumbMiddlePinching(landmarks: Landmarks): boolean {
  return calculateDistance(landmarks[4], landmarks[12]) < GESTURE_DETECTION_CONFIG.PINCH_THRESHOLD;
}

/**
 * 检测拇指与无名指是否捏合
 */
export function isThumbRingPinching(landmarks: Landmarks): boolean {
  return calculateDistance(landmarks[4], landmarks[16]) < GESTURE_DETECTION_CONFIG.PINCH_THRESHOLD;
}

/**
 * 检测拇指与小指是否捏合
 */
export function isThumbPinkyPinching(landmarks: Landmarks): boolean {
  return calculateDistance(landmarks[4], landmarks[20]) < GESTURE_DETECTION_CONFIG.PINCH_THRESHOLD;
}

/**
 * 获取所有捏合状态
 */
export function getAllPinchStates(landmarks: Landmarks): PinchStates {
  return {
    thumbIndex: {
      isPinching: isThumbIndexPinching(landmarks),
      distance: calculateDistance(landmarks[4], landmarks[8]),
    },
    thumbMiddle: {
      isPinching: isThumbMiddlePinching(landmarks),
      distance: calculateDistance(landmarks[4], landmarks[12]),
    },
    thumbRing: {
      isPinching: isThumbRingPinching(landmarks),
      distance: calculateDistance(landmarks[4], landmarks[16]),
    },
    thumbPinky: {
      isPinching: isThumbPinkyPinching(landmarks),
      distance: calculateDistance(landmarks[4], landmarks[20]),
    },
  };
}

/**
 * 获取当前正在捏合的手指
 */
export function getPinchingFinger(landmarks: Landmarks): 'index' | 'middle' | 'ring' | 'pinky' | null {
  if (isThumbIndexPinching(landmarks)) return 'index';
  if (isThumbMiddlePinching(landmarks)) return 'middle';
  if (isThumbRingPinching(landmarks)) return 'ring';
  if (isThumbPinkyPinching(landmarks)) return 'pinky';
  return null;
}

// ========== 常见手势检测 ==========

/**
 * 检测是否为"指点"手势 (仅食指伸直)
 */
export function isPointingGesture(landmarks: Landmarks): boolean {
  const fingers = getAllFingersExtended(landmarks);
  return fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;
}

/**
 * 检测是否为"胜利"手势 (食指+中指伸直，呈V形)
 */
export function isVictoryGesture(landmarks: Landmarks): boolean {
  const fingers = getAllFingersExtended(landmarks);
  return fingers.index && fingers.middle && !fingers.ring && !fingers.pinky && !fingers.thumb;
}

/**
 * 检测是否为"点赞"手势 (仅拇指伸直，向上)
 */
export function isThumbsUpGesture(landmarks: Landmarks): boolean {
  const fingers = getAllFingersExtended(landmarks);
  // 拇指伸直，其他手指弯曲
  if (!fingers.thumb || fingers.index || fingers.middle || fingers.ring || fingers.pinky) {
    return false;
  }
  // 拇指尖应该在手腕上方 (y坐标更小)
  const thumbTip = landmarks[4];
  const wrist = landmarks[0];
  return thumbTip.y < wrist.y - 0.1;
}

/**
 * 检测是否为"拇指向下"手势
 */
export function isThumbsDownGesture(landmarks: Landmarks): boolean {
  const fingers = getAllFingersExtended(landmarks);
  if (!fingers.thumb || fingers.index || fingers.middle || fingers.ring || fingers.pinky) {
    return false;
  }
  const thumbTip = landmarks[4];
  const wrist = landmarks[0];
  return thumbTip.y > wrist.y + 0.1;
}

/**
 * 检测是否为"OK"手势 (拇指与食指形成圆圈)
 */
export function isOKGesture(landmarks: Landmarks): boolean {
  const distance = calculateDistance(landmarks[4], landmarks[8]);
  if (distance > GESTURE_DETECTION_CONFIG.OK_THRESHOLD) return false;

  // 其他手指应该伸直
  const fingers = getAllFingersExtended(landmarks);
  return fingers.middle || fingers.ring || fingers.pinky;
}

/**
 * 检测是否为"打电话"手势 (拇指+小指伸直)
 */
export function isCallMeGesture(landmarks: Landmarks): boolean {
  const fingers = getAllFingersExtended(landmarks);
  return fingers.thumb && fingers.pinky && !fingers.index && !fingers.middle && !fingers.ring;
}

/**
 * 检测是否为"摇滚"手势 (食指+小指伸直)
 */
export function isRockOnGesture(landmarks: Landmarks): boolean {
  const fingers = getAllFingersExtended(landmarks);
  return fingers.index && fingers.pinky && !fingers.middle && !fingers.ring && !fingers.thumb;
}

/**
 * 检测是否为张开手掌
 */
export function isOpenPalm(landmarks: Landmarks): boolean {
  const count = countExtendedFingers(landmarks);
  return count >= 4;
}

/**
 * 检测是否为握拳
 */
export function isFist(landmarks: Landmarks): boolean {
  const fingers = getAllFingersExtended(landmarks);
  // 所有手指都不伸直（或最多拇指伸直）
  const count = countExtendedFingers(landmarks);
  return count <= 1 && !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;
}

// ========== 手掌方向检测 ==========

/**
 * 获取手掌中心点 (近似)
 */
export function getPalmCenter(landmarks: Landmarks): Vector3D {
  const wrist = landmarks[0];
  const middleMCP = landmarks[9];
  return {
    x: (wrist.x + middleMCP.x) / 2,
    y: (wrist.y + middleMCP.y) / 2,
    z: (wrist.z + middleMCP.z) / 2,
  };
}

/**
 * 获取手掌法向量 (用于判断朝向)
 */
export function getPalmNormal(landmarks: Landmarks, handedness: HandSide = 'Right'): Landmark3D {
  const p0 = landmarks[0];  // 手腕
  const p1 = handedness === 'Left' ? landmarks[17] : landmarks[9];
  const p2 = handedness === 'Left' ? landmarks[9] : landmarks[17];

  // 计算两个向量
  const v1 = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
  const v2 = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };

  // 叉积得到法向量
  return {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x,
  };
}

/**
 * 检测手掌是否朝上
 */
export function isPalmFacingUp(landmarks: Landmarks, handedness: HandSide = 'Right'): boolean {
  const normal = getPalmNormal(landmarks, handedness);
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);
  return absY > absX && absY > absZ && normal.y < 0;
}

/**
 * 检测手掌是否朝下
 */
export function isPalmFacingDown(landmarks: Landmarks, handedness: HandSide = 'Right'): boolean {
  const normal = getPalmNormal(landmarks, handedness);
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);
  return absY > absX && absY > absZ && normal.y > 0;
}

/**
 * 检测手掌是否朝向摄像头
 */
export function isPalmFacingCamera(landmarks: Landmarks, handedness: HandSide = 'Right'): boolean {
  const normal = getPalmNormal(landmarks, handedness);
  return Math.abs(normal.z) > Math.abs(normal.x) && Math.abs(normal.z) > Math.abs(normal.y);
}

/**
 * 获取手掌方向描述
 */
export function getPalmDirection(landmarks: Landmarks, handedness: HandSide = 'Right'): PalmInfo['direction'] {
  const normal = getPalmNormal(landmarks, handedness);

  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);

  if (absZ > absX && absZ > absY) {
    return normal.z > 0 ? 'camera' : 'away';
  }
  if (absX > absY && absX > absZ) {
    return normal.x > 0 ? 'right' : 'left';
  }
  return normal.y > 0 ? 'down' : 'up';
}

// ========== 动态手势检测 ==========

/**
 * 更新手势历史记录
 */
function updateGestureHistory(handKey: 'leftHand' | 'rightHand', position: Vector3D): void {
  const history = gestureHistory[handKey];
  const now = performance.now();
  const entry = { x: position.x, y: position.y, t: now };
  history.positions.push(entry);

  // 计算X轴速度
  let velocityX = 0;
  if (history.positions.length >= 2) {
    const prevPos = history.positions[history.positions.length - 2];
    const dt = entry.t - prevPos.t;
    if (dt > 0) {
      velocityX = (entry.x - prevPos.x) / (dt / 1000);
    }
  }
  history.velocities.push(velocityX);

  // 保持固定时间窗口的历史记录
  while (history.positions.length > 0 &&
         now - history.positions[0].t > GESTURE_DETECTION_CONFIG.WAVE_TIME_WINDOW) {
    history.positions.shift();
    history.velocities.shift();
  }
}

/**
 * 检测挥手手势
 */
export function isWaving(landmarks: Landmarks, handKey: 'leftHand' | 'rightHand' = 'rightHand', palmDirection: PalmInfo['direction'] | '' = ''): boolean {
  if (!isOpenPalm(landmarks) || palmDirection === 'away' || isOKGesture(landmarks)) {
    return false;
  }

  const palmCenter = getPalmCenter(landmarks);
  updateGestureHistory(handKey, palmCenter);

  const history = gestureHistory[handKey];

  if (history.positions.length < GESTURE_DETECTION_CONFIG.WAVE_COUNT_THRESHOLD) {
    return false;
  }

  // 1. 计算X轴位移范围
  const xPositions = history.positions.map(p => p.x);
  const minX = Math.min(...xPositions);
  const maxX = Math.max(...xPositions);
  const xRange = maxX - minX;

  if (xRange < GESTURE_DETECTION_CONFIG.WAVE_SPEED_THRESHOLD) {
    return false;
  }

  // 2. 计算Y轴位移
  const yPositions = history.positions.map(p => p.y);
  const minY = Math.min(...yPositions);
  const maxY = Math.max(...yPositions);
  const yRange = maxY - minY;

  if (yRange > xRange * 5.0) {
    return false;
  }

  // 3. 检测方向变化次数
  let directionChanges = 0;
  let lastDirection = 0;

  for (let i = 1; i < history.positions.length; i++) {
    const dx = history.positions[i].x - history.positions[i - 1].x;
    if (Math.abs(dx) < 0.002) {
      continue;
    }
    const direction = dx > 0 ? 1 : -1;
    if (lastDirection !== 0 && direction !== lastDirection) {
      directionChanges++;
    }
    lastDirection = direction;
  }

  return directionChanges >= 1;
}

/**
 * 重置挥手检测历史
 */
export function resetWaveHistory(handKey: 'leftHand' | 'rightHand' = 'rightHand'): void {
  const history = gestureHistory[handKey];
  if (history) {
    history.positions = [];
    history.velocities = [];
    history.waveDirectionChanges = 0;
    history.lastVelocityX = 0;
  }
}

/**
 * 更新Hello挥手状态
 */
function updateHelloWaveState(handKey: 'leftHand' | 'rightHand', palmCenter: Vector3D, canWave: boolean): void {
  const state = gestureHistory[handKey];

  // 手放下时重置
  if (!canWave) {
    state.waveStartTime = 0;
    state.helloDirectionChanges = 0;
    state.consecutiveWaveFrames = 0;
    state.lastHelloX = null;
    state.lastHelloDirection = 0;
    return;
  }

  // 追踪X方向变化
  if (state.lastHelloX !== null) {
    const deltaX = palmCenter.x - state.lastHelloX;
    const direction = deltaX > 0.01 ? 1 : (deltaX < -0.01 ? -1 : 0);

    if (direction !== 0 && direction !== state.lastHelloDirection && state.lastHelloDirection !== 0) {
      state.helloDirectionChanges++;
      state.lastHelloDirection = direction;
    } else if (direction !== 0 && state.lastHelloDirection === 0) {
      state.lastHelloDirection = direction;
    }

    if (state.helloDirectionChanges >= 2) {
      if (state.waveStartTime === 0) {
        state.waveStartTime = Date.now();
      }
      state.consecutiveWaveFrames++;
    }
  }

  state.lastHelloX = palmCenter.x;
}

/**
 * 检测Hello打招呼挥手手势
 */
export function isHelloWaving(
  landmarks: Landmarks,
  handKey: 'leftHand' | 'rightHand' = 'rightHand',
  gestureStates: Partial<Record<string, boolean>> = {},
  palmDirection: PalmInfo['direction'] | '' = ''
): { isWaving: boolean; duration: number } {
  const palmCenter = getPalmCenter(landmarks);

  const blockedByGesture = gestureStates.pointing || gestureStates.thumbsUp ||
                         gestureStates.ok || gestureStates.fist;
  const blockedByDirection = palmDirection === 'away';

  const canWave = isOpenPalm(landmarks) && !blockedByGesture && !blockedByDirection;

  updateHelloWaveState(handKey, palmCenter, canWave);

  const waveState = gestureHistory[handKey];

  if (waveState.waveStartTime > 0) {
    const duration = Date.now() - waveState.waveStartTime;
    if (duration > 800 && waveState.consecutiveWaveFrames > 5) {
      return { isWaving: true, duration };
    }
  }

  return { isWaving: false, duration: 0 };
}

/**
 * 重置Hello挥手状态
 */
export function resetHelloWave(handKey: 'leftHand' | 'rightHand' = 'rightHand'): void {
  const state = gestureHistory[handKey];
  if (state) {
    state.waveStartTime = 0;
    state.helloDirectionChanges = 0;
    state.consecutiveWaveFrames = 0;
    state.lastHelloX = null;
    state.lastHelloDirection = 0;
  }
}

// ========== 双手交互检测 ==========

/**
 * 计算双手之间的距离
 */
export function getHandsDistance(leftLandmarks: Landmarks, rightLandmarks: Landmarks): number {
  const leftCenter = getPalmCenter(leftLandmarks);
  const rightCenter = getPalmCenter(rightLandmarks);
  return calculateDistance(leftCenter, rightCenter);
}

/**
 * 检测双手缩放手势
 */
export function detectZoomGesture(
  leftLandmarks: Landmarks | null,
  rightLandmarks: Landmarks | null,
  previousDistance: number | null
): TwoHandGestures['zoom'] {
  if (!leftLandmarks || !rightLandmarks || !previousDistance) {
    return { isZoom: false, direction: null };
  }

  const currentDistance = getHandsDistance(leftLandmarks, rightLandmarks);
  const delta = currentDistance - previousDistance;
  const threshold = 0.02;

  if (Math.abs(delta) > threshold) {
    return {
      isZoom: true,
      direction: delta > 0 ? 'out' : 'in',
      distance: currentDistance,
    };
  }

  return {
    isZoom: false,
    direction: null,
    distance: currentDistance,
  };
}

// ========== 统一检测入口 ==========

/**
 * 检测单只手的全部手势状态
 */
export function detectHandGestures(landmarks: Landmarks, handedness: HandSide = 'Right'): HandGestures {
  const fingers = getAllFingersExtended(landmarks);
  const pinchStates = getAllPinchStates(landmarks);
  const palmCenter = getPalmCenter(landmarks);
  const handKey = handedness === 'Left' ? 'leftHand' : 'rightHand';

  const gestureStates = {
    pointing: isPointingGesture(landmarks),
    thumbsUp: isThumbsUpGesture(landmarks),
    ok: isOKGesture(landmarks),
    fist: isFist(landmarks),
  };
  const palmDirection = getPalmDirection(landmarks, handedness);

  const helloWaving = isHelloWaving(landmarks, handKey, gestureStates, palmDirection);

  return {
    fingers: {
      thumb: fingers.thumb,
      index: fingers.index,
      middle: fingers.middle,
      ring: fingers.ring,
      pinky: fingers.pinky,
      extendedCount: countExtendedFingers(landmarks),
    },
    pinch: {
      isPinching: pinchStates.thumbIndex.isPinching ||
                 pinchStates.thumbMiddle.isPinching ||
                 pinchStates.thumbRing.isPinching ||
                 pinchStates.thumbPinky.isPinching,
      thumbIndex: pinchStates.thumbIndex.isPinching,
      thumbMiddle: pinchStates.thumbMiddle.isPinching,
      thumbRing: pinchStates.thumbRing.isPinching,
      thumbPinky: pinchStates.thumbPinky.isPinching,
      thumbIndexDistance: pinchStates.thumbIndex.distance,
      pinchingFinger: getPinchingFinger(landmarks),
    },
    gestures: {
      pointing: gestureStates.pointing,
      victory: isVictoryGesture(landmarks),
      thumbsUp: gestureStates.thumbsUp,
      thumbsDown: isThumbsDownGesture(landmarks),
      ok: gestureStates.ok,
      callMe: isCallMeGesture(landmarks),
      rockOn: isRockOnGesture(landmarks),
      openPalm: isOpenPalm(landmarks),
      fist: gestureStates.fist,
    },
    palm: {
      center: palmCenter,
      normal: getPalmNormal(landmarks, handedness),
      direction: palmDirection,
      facingUp: isPalmFacingUp(landmarks, handedness),
      facingDown: isPalmFacingDown(landmarks, handedness),
      facingCamera: isPalmFacingCamera(landmarks, handedness),
    },
    dynamic: {
      waving: isWaving(landmarks, handKey, palmDirection),
      helloWaving,
    },
  };
}

/**
 * 检测双手交互状态
 */
export function detectTwoHandGestures(
  leftLandmarks: Landmarks | null,
  rightLandmarks: Landmarks | null,
  previousDistance: number | null = null
): TwoHandGestures {
  if (!leftLandmarks || !rightLandmarks) {
    return {
      bothPresent: false,
      distance: 0,
      zoom: { isZoom: false, direction: null },
    };
  }

  const distance = getHandsDistance(leftLandmarks, rightLandmarks);
  const zoom = detectZoomGesture(leftLandmarks, rightLandmarks, previousDistance);

  return {
    bothPresent: true,
    distance,
    zoom,
  };
}

/**
 * MediaPipe Results 类型
 */
export interface MediaPipeResults {
  multiHandLandmarks?: Landmarks[];
  multiHandedness?: Array<{ label: 'Left' | 'Right'; score: number }>;
}

/**
 * 检测所有手势状态 (包括双手)
 */
export function detectAllGestures(results: MediaPipeResults, previousDistance: number | null = null): AllGestures {
  let leftGestures: HandGestures | null = null;
  let rightGestures: HandGestures | null = null;
  let leftLandmarks: Landmarks | null = null;
  let rightLandmarks: Landmarks | null = null;

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      const handedness = results.multiHandedness?.[i]?.label;

      if (handedness === 'Left') {
        leftGestures = detectHandGestures(landmarks, 'Left');
        leftLandmarks = landmarks;
      } else {
        rightGestures = detectHandGestures(landmarks, 'Right');
        rightLandmarks = landmarks;
      }
    }
  }

  const twoHandGestures = detectTwoHandGestures(leftLandmarks, rightLandmarks, previousDistance);

  return {
    left: leftGestures,
    right: rightGestures,
    twoHand: twoHandGestures,
  };
}

// ========== 导出配置和历史（用于调试） ==========

export { gestureHistory };
