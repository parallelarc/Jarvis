/**
 * 触摸检测服务
 * 负责检测手指与 SVG 对象的碰撞/触摸
 *
 * 注意：新交互模式下，触摸检测仅用于点击选择
 * 选中后的操作（移动/旋转/缩放）不需要触摸到对象
 */

import { normalizedToWorld } from '@/utils/math';
import { findObjectUnderPoint } from '@/utils/three-sync';
import { objectStore } from '@/stores/objectStore';

export interface TouchDetectionCallbacks {
  setTouching: (side: 'Left' | 'Right', touching: boolean) => void;
  setTouchedObjectId: (side: 'Left' | 'Right', objectId: string | null) => void;
}

/**
 * 查找手指下的对象（基于 bbox）
 * 使用 three-sync 工具函数进行精确的碰撞检测
 * @param indexTip 食指位置
 * @param thumbTip 拇指位置（可选，提供时使用中点）
 * @param preferredId 优先检查的对象ID（例如当前拖拽的对象）
 */
function findObjectUnderFinger(
  indexTip: { x: number; y: number },
  thumbTip: { x: number; y: number } | null = null,
  preferredId: string | null = null
): string | null {
  const sceneAPI = (window as any).svgSceneAPI;
  const camera = sceneAPI?.getCamera();

  // 使用食指和拇指的中点位置（与视觉指示器一致）
  const checkPoint = thumbTip
    ? { x: (indexTip.x + thumbTip.x) / 2, y: (indexTip.y + thumbTip.y) / 2 }
    : indexTip;

  const handWorldPos = normalizedToWorld(
    checkPoint,
    camera,
    window.innerWidth,
    window.innerHeight
  );
  return findObjectUnderPoint(handWorldPos, preferredId);
}

/**
 * 处理触摸检测（基于 bbox）
 */
export function processTouchDetection(
  landmarks: Array<{ x: number; y: number; z: number }>,
  side: 'Left' | 'Right',
  callbacks: TouchDetectionCallbacks
) {
  const indexTip = landmarks[8];  // 食指尖端
  const thumbTip = landmarks[4];  // 拇指尖端

  // 优先检测当前选中的对象（用于拖拽场景）
  const currentSelectedId = objectStore.selectedObjectId;
  // 使用食指和拇指的中点（与视觉指示器 L/R 一致）
  const touchedId = findObjectUnderFinger(indexTip, thumbTip, currentSelectedId);

  callbacks.setTouching(side, touchedId !== null);
  callbacks.setTouchedObjectId(side, touchedId);
}

export { findObjectUnderFinger };
