/**
 * 触摸检测服务
 * 负责检测手指与 SVG 对象的碰撞/触摸
 */

import { normalizedToWorld } from '@/utils/math';
import { findObjectUnderPoint } from '@/utils/three-sync';

export interface TouchDetectionCallbacks {
  setTouching: (side: 'Left' | 'Right', touching: boolean) => void;
  setTouchedObjectId: (side: 'Left' | 'Right', objectId: string | null) => void;
}

/**
 * 查找手指下的对象（基于 bbox）
 * 使用 three-sync 工具函数进行精确的碰撞检测
 */
function findObjectUnderFinger(indexTip: { x: number; y: number }): string | null {
  const sceneAPI = (window as any).svgSceneAPI;
  const camera = sceneAPI?.getCamera();
  const handWorldPos = normalizedToWorld(
    { x: indexTip.x, y: indexTip.y },
    camera,
    window.innerWidth,
    window.innerHeight
  );
  return findObjectUnderPoint(handWorldPos);
}

/**
 * 处理触摸检测（基于 bbox）
 */
export function processTouchDetection(
  landmarks: Array<{ x: number; y: number; z: number }>,
  side: 'Left' | 'Right',
  callbacks: TouchDetectionCallbacks
) {
  const indexTip = landmarks[8];
  const touchedId = findObjectUnderFinger(indexTip);

  callbacks.setTouching(side, touchedId !== null);
  callbacks.setTouchedObjectId(side, touchedId);
}

export { findObjectUnderFinger };
