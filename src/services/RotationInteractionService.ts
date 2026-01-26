/**
 * 旋转交互服务
 * 负责左手捏合旋转 SVG 对象逻辑
 */

import { handStore } from '@/stores/handStore';
import { objectStore, objectActions } from '@/stores/objectStore';
import { GESTURE_CONFIG, ROTATION_CONFIG } from '@/config';
import { normalizedToWorld, calculateDistance } from '@/utils/math';
import { calculateDynamicPinchThreshold, calculatePalmSize } from '@/domain/GestureDetector';
import { syncSVGObjectRotation } from '@/utils/three-sync';

export interface RotationInteractionCallbacks {
  setWasPinching: (side: 'Left' | 'Right', wasPinching: boolean) => void;
  setPinching: (side: 'Left' | 'Right', isPinching: boolean, distance: number, dynamicThreshold?: number, palmSize?: number) => void;
  setRotating: (side: 'Left' | 'Right', isRotating: boolean) => void;
  setRotationBasePosition: (side: 'Left' | 'Right', position: { x: number; y: number; z: number }) => void;
  setBaseRotation: (side: 'Left' | 'Right', rotation: { x: number; y: number; z: number }) => void;
}

/**
 * 开始旋转
 */
function startRotating(
  id: string,
  palmCenter: { x: number; y: number },
  callbacks: RotationInteractionCallbacks
) {
  const sceneAPI = (window as any).svgSceneAPI;
  const camera = sceneAPI?.getCamera();
  const handWorldPos = normalizedToWorld(
    { x: palmCenter.x, y: palmCenter.y },
    camera,
    window.innerWidth,
    window.innerHeight
  );
  const objState = objectStore.objects[id];

  // 记录基准位置和基准旋转角度
  callbacks.setRotationBasePosition('Left', {
    x: handWorldPos.x,
    y: handWorldPos.y,
    z: handWorldPos.z || 0
  });
  callbacks.setBaseRotation('Left', {
    x: objState.rotation.x,
    y: objState.rotation.y,
    z: objState.rotation.z || 0
  });
  callbacks.setRotating('Left', true);
}

/**
 * 更新对象旋转（旋转中）
 */
function updateObjectRotation(id: string, palmCenter: { x: number; y: number }) {
  const handState = handStore.left;
  const sceneAPI = (window as any).svgSceneAPI;
  const camera = sceneAPI?.getCamera();
  const palmWorldPos = normalizedToWorld(
    { x: palmCenter.x, y: palmCenter.y },
    camera,
    window.innerWidth,
    window.innerHeight
  );

  const basePos = handState.rotationBasePosition;
  const baseRotation = handState.baseRotation;

  if (!basePos || !baseRotation) {
    return;
  }

  // 计算手掌位移
  const deltaX = palmWorldPos.x - basePos.x;
  const deltaY = palmWorldPos.y - basePos.y;

  // 应用死区阈值
  if (Math.abs(deltaX) < ROTATION_CONFIG.DEADZONE_THRESHOLD &&
      Math.abs(deltaY) < ROTATION_CONFIG.DEADZONE_THRESHOLD) {
    return;
  }

  // 映射位移到旋转角度（无极旋转，无角度限制）
  // X轴位移 → Y轴旋转（左右转）
  // Y轴位移 → X轴旋转（上下倾），取反以符合直觉
  const newRotation = {
    x: baseRotation.x - deltaY * ROTATION_CONFIG.POSITION_TO_ANGLE_RATIO,
    y: baseRotation.y + deltaX * ROTATION_CONFIG.POSITION_TO_ANGLE_RATIO,
    z: baseRotation.z,  // 保持 Z 轴旋转不变
  };

  // 更新 Store（渲染循环会自动同步到 Three.js）
  objectActions.updateObjectRotation(id, newRotation);
}

/**
 * 处理旋转交互 - 左手捏合旋转
 *
 * 新交互逻辑：
 * - 只要对象被选中，左手捏合即可旋转，不需要触摸到对象
 * - 旋转方式：手掌左右移动 → Y 轴旋转（左右转）
 * -           手掌上下移动 → X 轴旋转（上下倾）
 * -           支持 360° 无极旋转（无角度限制）
 *
 * 注意：
 * - 此服务必须在 processDragInteraction 之后调用（见 useGestureTracking.ts）
 * - 这样确保两个服务都使用相同的 wasPinching 状态进行边沿检测
 * - pinch 状态更新在此服务中进行（processDragInteraction 跳过更新）
 */
export function processRotationInteraction(
  landmarks: Array<{ x: number; y: number; z: number }>,
  side: 'Left' | 'Right',
  callbacks: RotationInteractionCallbacks
) {
  // 仅处理左手旋转
  if (side !== 'Left') return;

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const pinchDistance = calculateDistance(
    { x: thumbTip.x, y: thumbTip.y, z: thumbTip.z },
    { x: indexTip.x, y: indexTip.y, z: indexTip.z }
  );

  // 使用自适应捏合阈值
  const dynamicThreshold = calculateDynamicPinchThreshold(landmarks);
  const palmSize = calculatePalmSize(landmarks);
  const isPinching = pinchDistance < dynamicThreshold;

  const handState = handStore.left;
  const currentSelectedId = objectStore.selectedObjectId;

  // === 检测捏合边沿（使用更新前的 wasPinching 状态）===
  const pinchStart = !handState.wasPinching && isPinching;  // 上升沿：手指合起
  const pinchEnd = handState.wasPinching && !isPinching;    // 下降沿：手指分开

  // 更新 pinch 状态（在 processDragInteraction 读取之后执行）
  callbacks.setWasPinching(side, isPinching);
  callbacks.setPinching(side, isPinching, pinchDistance, dynamicThreshold, palmSize);

  // === 捏合开始：开始旋转 ===
  if (pinchStart) {
    // 只有当有对象被选中时才开始旋转
    if (currentSelectedId) {
      // 计算手掌中心（使用手掌中心点 index 9）
      const palmCenter = landmarks[9];
      startRotating(currentSelectedId, palmCenter, callbacks);
    }
    return;
  }

  // === 捏合结束：停止旋转 ===
  if (pinchEnd) {
    if (handState.isRotating) {
      callbacks.setRotating(side, false);
    }
    return;
  }

  // === 捏合中：处理旋转 ===
  if (isPinching && handState.isRotating && currentSelectedId) {
    // 计算手掌中心
    const palmCenter = landmarks[9];
    updateObjectRotation(currentSelectedId, palmCenter);
  }
}
