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
 * 新逻辑：只要双手都捏合，且有一个对象被选中，就可以缩放
 * 不需要触摸到对象，无论手在屏幕任何位置都可以缩放
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

  // 新逻辑：移除触摸检查，只要双手捏合且有选中对象就可以缩放
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
