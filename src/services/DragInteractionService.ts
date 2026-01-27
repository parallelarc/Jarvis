/**
 * 拖拽交互服务
 * 负责点击选中、拖拽和取消选择逻辑
 */

import { handStore } from '@/stores/handStore';
import { objectStore, objectActions } from '@/stores/objectStore';
import { INTERACTION_CONFIG } from '@/config';
import { normalizedToWorld, calculateDistance } from '@/utils/math';
import { calculateDynamicPinchThreshold, calculatePalmSize } from '@/domain/GestureDetector';
import {
  syncSVGObjectPosition,
  syncSVGObjectSelected,
  syncAllSVGObjectsSelected,
} from '@/utils/three-sync';
import { findObjectUnderFinger } from './TouchDetectionService';
import { getRotationMode } from '@/components/DebugPanel';

export interface DragInteractionCallbacks {
  setWasPinching: (side: 'Left' | 'Right', wasPinching: boolean) => void;
  setPinching: (side: 'Left' | 'Right', isPinching: boolean, distance: number, dynamicThreshold?: number, palmSize?: number) => void;
  setPinchStartObject: (side: 'Left' | 'Right', objectId: string | null) => void;
  setPinchStartTime: (side: 'Left' | 'Right', time: number) => void;
  setDragOffset: (side: 'Left' | 'Right', offset: { x: number; y: number; z: number } | null) => void;
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
 * 新交互逻辑：
 * - 点击选择：需要触摸到对象并完成快速点击（捏合开始+结束）
 * - 拖拽：只要对象被选中，右手捏合即可拖拽，不需要触摸到对象
 * - 左手：仅支持 click 选择，不支持拖拽
 * - 左手的 pinch 状态由 RotationInteractionService 管理，此处只做读取
 * - 右手：支持 click 选择 + 拖拽，并管理自己的 pinch 状态
 * - 缩放模式：click 选择仍然工作，但拖拽被禁用
 *
 * 点击 = 捏合开始（手指合起）+ 捏合结束（手指分开）的完整动作
 * 点击必须在配置的时间限制内完成才算"干脆的点击"
 */
export function processDragInteraction(
  landmarks: Array<{ x: number; y: number; z: number }>,
  side: 'Left' | 'Right',
  callbacks: DragInteractionCallbacks,
  skipPinchStateUpdate: boolean = false
) {
  // 检查旋转模式：在 Face 模式下禁用所有手势交互（拖拽、点击等）
  if (getRotationMode() === 'face') return;

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
    callbacks.setPinching(side, isPinching, pinchDistance, dynamicThreshold, palmSize);
  }

  // 使用食指和拇指的中点（与视觉指示器 L/R 一致）
  const touchedId = findObjectUnderFinger(indexTip, thumbTip);

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

    // 关键修复：停止拖拽时清除 dragOffset，避免下次捏合时使用旧值
    if (handState.isDragging) {
      callbacks.setDragging(side, false);
      callbacks.setDragOffset(side, null);  // 清除偏移量
    }
    return;
  }

  // === 捏合中：处理拖拽 ===
  // 新逻辑：只要右手有选中对象，且不在缩放模式，就可以拖拽
  // 不需要触摸到对象，无论手在屏幕任何位置都可以拖拽
  if (side === 'Right' && isPinching && currentSelectedId) {
    // 缩放模式下禁用拖拽
    if (handStore.zoomMode.active) return;

    const sceneAPI = (window as any).svgSceneAPI;
    const camera = sceneAPI?.getCamera();
    const handWorldPos = normalizedToWorld(
      { x: indexTip.x, y: indexTip.y },
      camera,
      window.innerWidth,
      window.innerHeight
    );

    // 关键改进：使用 dragOffset 的存在与否来判断拖拽状态
    // 而不是依赖 isDragging 标志（可能是异步的）
    const dragOffset = handState.dragOffset;

    if (dragOffset) {
      // 已经有偏移量：继续拖拽，使用 store 中的 dragOffset
      const newPosition = {
        x: handWorldPos.x - dragOffset.x,
        y: handWorldPos.y - dragOffset.y,
      };
      objectActions.updateObjectPosition(currentSelectedId, newPosition);
      syncSVGObjectPosition(currentSelectedId, { x: newPosition.x, y: newPosition.y, z: 0 });
    } else {
      // 没有偏移量：这是捏合的第一帧，需要计算偏移量
      // 从 Three.js 对象读取实际位置（最准确）
      const svgObjects = sceneAPI?.getSVGObjects();
      const svgObj = svgObjects?.get(currentSelectedId);
      if (!svgObj) return;

      const actualPosition = svgObj.mesh.position;
      const newDragOffset = {
        x: handWorldPos.x - actualPosition.x,
        y: handWorldPos.y - actualPosition.y,
        z: 0,
      };

      // 先更新 store（异步）
      callbacks.setDragOffset('Right', newDragOffset);
      callbacks.setDragging('Right', true);

      // 立即使用局部变量更新位置（避免等待异步 store）
      const newPosition = {
        x: handWorldPos.x - newDragOffset.x,
        y: handWorldPos.y - newDragOffset.y,
      };
      objectActions.updateObjectPosition(currentSelectedId, newPosition);
      syncSVGObjectPosition(currentSelectedId, { x: newPosition.x, y: newPosition.y, z: 0 });
    }
  }
}

export { selectObject };
