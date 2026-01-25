/**
 * 拖拽交互服务
 * 负责点击选中、拖拽和取消选择逻辑
 */

import { handStore } from '@/stores/handStore';
import { objectStore, objectActions } from '@/stores/objectStore';
import { GESTURE_CONFIG, INTERACTION_CONFIG } from '@/config';
import { normalizedToWorld, calculateDistance } from '@/utils/math';
import {
  findObjectUnderPoint,
  syncSVGObjectPosition,
  syncSVGObjectSelected,
  syncAllSVGObjectsSelected,
} from '@/utils/three-sync';
import { findObjectUnderFinger } from './TouchDetectionService';

export interface DragInteractionCallbacks {
  setWasPinching: (side: 'Left' | 'Right', wasPinching: boolean) => void;
  setPinching: (side: 'Left' | 'Right', isPinching: boolean, distance: number) => void;
  setPinchStartObject: (side: 'Left' | 'Right', objectId: string | null) => void;
  setPinchStartTime: (side: 'Left' | 'Right', time: number) => void;
  setDragOffset: (side: 'Left' | 'Right', offset: { x: number; y: number; z: number }) => void;
  setDragging: (side: 'Left' | 'Right', isDragging: boolean) => void;
}

/**
 * 选中对象
 */
function selectObject(id: string) {
  // 先隐藏所有对象的高亮
  syncAllSVGObjectsSelected(false);

  objectActions.selectObject(id);

  // 显示选中轮廓
  syncSVGObjectSelected(id, true);
}

/**
 * 开始拖拽
 */
function startDragging(
  id: string,
  indexTip: { x: number; y: number },
  callbacks: DragInteractionCallbacks
) {
  const sceneAPI = (window as any).svgSceneAPI;
  const camera = sceneAPI?.getCamera();
  const handWorldPos = normalizedToWorld(
    { x: indexTip.x, y: indexTip.y },
    camera,
    window.innerWidth,
    window.innerHeight
  );
  const objState = objectStore.objects[id];

  callbacks.setDragOffset('Right', {
    x: handWorldPos.x - objState.position.x,
    y: handWorldPos.y - objState.position.y,
    z: 0,
  });
  callbacks.setDragging('Right', true);
}

/**
 * 更新对象位置（拖拽中）
 */
function updateObjectPosition(id: string, indexTip: { x: number; y: number }) {
  const handState = handStore.right;
  const sceneAPI = (window as any).svgSceneAPI;
  const camera = sceneAPI?.getCamera();
  const handWorldPos = normalizedToWorld(
    { x: indexTip.x, y: indexTip.y },
    camera,
    window.innerWidth,
    window.innerHeight
  );
  const newPosition = {
    x: handWorldPos.x - (handState.dragOffset?.x || 0),
    y: handWorldPos.y - (handState.dragOffset?.y || 0),
  };

  objectActions.updateObjectPosition(id, newPosition);

  // 同步更新 Three.js 对象
  syncSVGObjectPosition(id, { x: newPosition.x, y: newPosition.y, z: 0 });
}

/**
 * 取消所有选中
 */
export function deselectAll() {
  // 取消对象高亮
  syncAllSVGObjectsSelected(false);
  objectActions.selectObject(null);
}

/**
 * 处理拖拽交互 - 点击选中 + 捏合拖拽
 *
 * 点击 = 捏合开始（手指合起）+ 捏合结束（手指分开）的完整动作
 * 点击必须在配置的时间限制内完成才算"干脆的点击"
 *
 * 左手：仅支持 click 选择，不支持拖拽
 * 左手的 pinch 状态由 RotationInteractionService 管理，此处只做读取
 * 右手：支持 click 选择 + 拖拽，并管理自己的 pinch 状态
 * 缩放模式：click 选择仍然工作，但拖拽被禁用
 */
export function processDragInteraction(
  landmarks: Array<{ x: number; y: number; z: number }>,
  side: 'Left' | 'Right',
  callbacks: DragInteractionCallbacks,
  skipPinchStateUpdate: boolean = false
) {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const pinchDistance = calculateDistance(
    { x: thumbTip.x, y: thumbTip.y, z: thumbTip.z },
    { x: indexTip.x, y: indexTip.y, z: indexTip.z }
  );
  const isPinching = pinchDistance < GESTURE_CONFIG.PINCH_THRESHOLD;

  const handState = side === 'Left' ? handStore.left : handStore.right;
  const currentSelectedId = objectStore.selectedObjectId;

  // === 检测捏合边沿 ===
  // 对于左手：wasPinching 已由 RotationInteractionService 更新，直接使用
  // 对于右手：此处读取当前帧的 wasPinching，稍后更新
  const pinchStart = !handState.wasPinching && isPinching;  // 上升沿：手指合起
  const pinchEnd = handState.wasPinching && !isPinching;    // 下降沿：手指分开

  // 更新上一帧状态（右手更新，左手跳过因为由旋转服务管理）
  if (!skipPinchStateUpdate) {
    callbacks.setWasPinching(side, isPinching);
    callbacks.setPinching(side, isPinching, pinchDistance);
  }

  const touchedId = findObjectUnderFinger(indexTip);

  // === 捏合开始：记录手指下的对象和时间 ===
  if (pinchStart) {
    callbacks.setPinchStartObject(side, touchedId);
    callbacks.setPinchStartTime(side, Date.now());
  }

  // === 捏合结束：检测是否完成点击 ===
  // click 选择在所有模式下都工作（包括缩放模式）
  if (pinchEnd) {
    const pinchStartId = handState.pinchStartObjectId;
    const pinchDuration = Date.now() - handState.pinchStartTime;
    const isQuickClick = pinchDuration < INTERACTION_CONFIG.CLICK_TIMEOUT_MS;

    if (pinchStartId && pinchStartId === touchedId && isQuickClick) {
      // 在同一对象上完成快速点击
      if (currentSelectedId !== pinchStartId) {
        // 点击新对象：切换选中
        selectObject(pinchStartId);
      }
      // 如果点击已选中的对象：无操作（保持选中）
    } else if (touchedId === null && pinchStartId === null && isQuickClick) {
      // 在空白处完成快速点击：取消选中
      deselectAll();
    }
    // 超时或不在同一对象上 → 不算点击，忽略

    // 清除捏合开始记录
    callbacks.setPinchStartObject(side, null);
    // 停止拖拽
    if (handState.isDragging) {
      callbacks.setDragging(side, false);
    }
    return;
  }

  // === 捏合中：处理拖拽 ===
  // 只有右手在非缩放模式下才能拖拽
  if (side === 'Right' && isPinching && currentSelectedId) {
    // 缩放模式下禁用拖拽
    if (handStore.zoomMode.active) return;

    if (touchedId === currentSelectedId) {
      // 捏合已选中的对象：开始/继续拖拽
      if (!handState.isDragging) {
        startDragging(currentSelectedId, indexTip, callbacks);
      }
      updateObjectPosition(currentSelectedId, indexTip);
    }
  }
}

export { selectObject };
