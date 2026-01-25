/**
 * 缩放交互服务
 * 负责双手缩放逻辑
 */

import { handStore, handActions } from '@/stores/handStore';
import { objectStore, objectActions } from '@/stores/objectStore';
import { INTERACTION_CONFIG } from '@/config';
import { calculateDistance } from '@/utils/math';
import { syncSVGObjectScale } from '@/utils/three-sync';
import type { Landmarks } from '@/core/types';

/**
 * 处理双手缩放交互
 *
 * 注意：触发条件已调整为双手触摸同一对象（为未来拉伸功能预留）
 * 当前版本暂不实现实际拉伸逻辑，仅保留缩放功能
 */
export function processScaleInteraction(
  leftLandmarks: Landmarks | null,
  rightLandmarks: Landmarks | null
) {
  if (!leftLandmarks || !rightLandmarks) {
    if (handStore.zoomMode.active) {
      handActions.setZoomMode(false);
      handActions.setPreviousHandsDistance(null);
    }
    return;
  }

  const selectedId = objectStore.selectedObjectId;
  if (!selectedId) return;

  // 检查双手是否触摸同一对象（未来拉伸功能的触发条件）
  const leftTouchedId = handStore.left.touchedObjectId;
  const rightTouchedId = handStore.right.touchedObjectId;
  const bothTouchingSameObject = leftTouchedId &&
                                 rightTouchedId &&
                                 leftTouchedId === rightTouchedId;

  // 如果双手触摸同一对象，预留拉伸功能（暂不实现）
  if (bothTouchingSameObject) {
    // future: trigger stretch mode here
    // 目前不实现拉伸，返回避免干扰缩放
    return;
  }

  // 原有的缩放逻辑：使用捏合手势
  const leftPinching = handStore.left.isPinching;
  const rightPinching = handStore.right.isPinching;

  if (!leftPinching || !rightPinching) {
    if (handStore.zoomMode.active) {
      handActions.setZoomMode(false);
      handActions.setPreviousHandsDistance(null);
    }
    return;
  }

  const currentDistance = calculateDistance(
    { x: leftLandmarks[9].x, y: leftLandmarks[9].y, z: 0 },
    { x: rightLandmarks[9].x, y: rightLandmarks[9].y, z: 0 }
  );

  if (!handStore.zoomMode.active) {
    const objState = objectStore.objects[selectedId];
    handActions.setZoomMode(true);
    handActions.setZoomInitials(
      objState.scale,
      currentDistance
    );
    handActions.setPreviousHandsDistance(currentDistance);
    return;
  }

  const initialScale = handStore.zoomMode.initialSpread;
  const initialDistance = handStore.zoomMode.leftInitialDist;
  const scaleFactor = currentDistance / initialDistance;
  const newScale = Math.max(
    INTERACTION_CONFIG.SCALE_MIN,
    Math.min(INTERACTION_CONFIG.SCALE_MAX, initialScale * scaleFactor)
  );

  objectActions.updateObjectScale(selectedId, newScale);

  // 同步更新 Three.js 对象
  syncSVGObjectScale(selectedId, newScale);

  handActions.setPreviousHandsDistance(currentDistance);
}
