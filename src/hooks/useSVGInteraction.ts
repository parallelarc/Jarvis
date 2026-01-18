/**
 * SVG 手势交互 Hook
 * 管理射线检测、拖拽和缩放交互
 */

import { createSignal, onMount, onCleanup } from 'solid-js';
import { handStore, handActions } from '@/stores/handStore';
import { objectActions, objectStore } from '@/stores/objectStore';
import { GESTURE_CONFIG } from '@/config';
import { normalizedToWorld, calculateDistance } from '@/utils/math';

// Three.js 类型声明
declare global {
  interface Window {
    THREE?: any;
  }
}

export interface SVGInteractionConfig {
  scene: any;
  camera: any;
  svgObjects: Map<string, any>;
}

export function useSVGInteraction() {
  const [raycaster, setRaycaster] = createSignal<any>(null);
  const [config, setConfig] = createSignal<SVGInteractionConfig | null>(null);

  /**
   * 初始化交互系统
   */
  function init(config: SVGInteractionConfig) {
    const THREE = window.THREE;
    if (!THREE) return;

    setRaycaster(new THREE.Raycaster());
    setConfig(config);
  }

  /**
   * 射线检测：获取触摸到的 SVG 对象
   */
  function getTouchedSVGObject(screenPoint: { x: number; y: number }): string | null {
    const rc = raycaster();
    const cfg = config();
    if (!rc || !cfg) return null;

    const THREE = window.THREE;

    // 转换屏幕坐标到归一化设备坐标
    const mouse = new THREE.Vector2();
    mouse.x = (screenPoint.x / window.innerWidth) * 2 - 1;
    mouse.y = -(screenPoint.y / window.innerHeight) * 2 + 1;

    rc.setFromCamera(mouse, cfg.camera);

    // 检测与 hitPlane 的交点
    const hitPlanes = Array.from(cfg.svgObjects.values()).map(obj => obj.hitPlane);
    const intersects = rc.intersectObjects(hitPlanes);

    if (intersects.length > 0) {
      const touchedObject = intersects[0].object.userData.svgObject;
      return touchedObject ? touchedObject.id : null;
    }

    return null;
  }

  /**
   * 检查点是否接近对象（基于位置距离）
   * @param point - 归一化坐标点
   * @param objectPosition - 对象的世界坐标位置
   * @param objectScale - 对象的缩放比例（用于计算动态阈值）
   * @param thresholdMultiplier - 阈值倍数，默认 0.6（检测半径约为对象大小的 60%）
   */
  function isPointNearObject(
    point: { x: number; y: number },
    objectPosition: { x: number; y: number; z?: number },
    objectScale: number = 1.0,
    thresholdMultiplier: number = 0.6
  ): boolean {
    const worldPos = normalizedToWorld({ x: point.x, y: point.y });
    const dx = worldPos.x - objectPosition.x;
    const dy = worldPos.y - objectPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 基于对象大小计算动态阈值
    const threshold = (objectScale * 0.5) * thresholdMultiplier;
    return distance < threshold;
  }

  /**
   * 处理单手拖拽交互
   */
  function handleDragInteraction(
    landmarks: Array<{ x: number; y: number; z: number }>,
    side: 'Left' | 'Right'
  ) {
    const cfg = config();
    if (!cfg) return;

    const handState = side === 'Left' ? handStore.left : handStore.right;
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    const selectedId = objectStore.selectedObjectId;

    // 计算捏合距离
    const pinchDistance = calculateDistance(
      { x: thumbTip.x, y: thumbTip.y, z: thumbTip.z },
      { x: indexTip.x, y: indexTip.y, z: indexTip.z }
    );

    // 更新捏合状态
    handActions.setPinching(side, pinchDistance < GESTURE_CONFIG.PINCH_THRESHOLD, pinchDistance);

    if (selectedId) {
      // 已选中对象，继续拖拽
      const objState = objectStore.objects[selectedId];
      const svgObj = cfg.svgObjects.get(selectedId);

      if (handState.isSelected && pinchDistance < GESTURE_CONFIG.PINCH_THRESHOLD) {
        const handWorldPos = normalizedToWorld({ x: indexTip.x, y: indexTip.y });
        objectActions.updateObjectPosition(selectedId, {
          x: handWorldPos.x - (handState.dragOffset?.x || 0),
          y: handWorldPos.y - (handState.dragOffset?.y || 0),
        });

        // 同步更新 SVGObject
        if (svgObj) {
          svgObj.updatePosition({
            x: handWorldPos.x - (handState.dragOffset?.x || 0),
            y: handWorldPos.y - (handState.dragOffset?.y || 0),
            z: 0,
          });
        }
      } else {
        // 释放选中
        handActions.setSelected(side, false);
        objectActions.selectObject(null);

        // 取消对象高亮
        if (svgObj) {
          svgObj.setSelected(false);
        }
      }
    } else {
      // 尝试选中对象
      if (pinchDistance < GESTURE_CONFIG.PINCH_THRESHOLD) {
        // 查找最近的对象
        let closestId: string | null = null;
        let closestDist = Infinity;

        for (const [id, objState] of Object.entries(objectStore.objects)) {
          const svgObj = cfg.svgObjects.get(id);
          if (svgObj && isPointNearObject(indexTip, objState.position, objState.scale)) {
            const handWorldPos = normalizedToWorld({ x: indexTip.x, y: indexTip.y });
            const dist = Math.sqrt(
              Math.pow(handWorldPos.x - objState.position.x, 2) +
              Math.pow(handWorldPos.y - objState.position.y, 2)
            );
            if (dist < closestDist) {
              closestDist = dist;
              closestId = id;
            }
          }
        }

        // 使用动态阈值验证选中的对象
        if (closestId) {
          const objState = objectStore.objects[closestId];
          const threshold = (objState.scale * 0.5) * 0.6;
          if (closestDist < threshold) {
            handActions.setSelected(side, true);
            objectActions.selectObject(closestId);

            // 计算拖拽偏移
            const handWorldPos = normalizedToWorld({ x: indexTip.x, y: indexTip.y });
            handActions.setDragOffset(side, {
              x: handWorldPos.x - objState.position.x,
              y: handWorldPos.y - objState.position.y,
              z: 0,
            });

            // 高亮选中对象
            const svgObj = cfg.svgObjects.get(closestId);
            if (svgObj) {
              svgObj.setSelected(true);
            }
          }
        }
      }
    }
  }

  /**
   * 处理双手缩放交互
   */
  function handleScaleInteraction(
    leftLandmarks: Array<{ x: number; y: number; z: number }> | null,
    rightLandmarks: Array<{ x: number; y: number; z: number }> | null
  ) {
    if (!leftLandmarks || !rightLandmarks) {
      // 重置缩放模式
      if (handStore.zoomMode.active) {
        handActions.setZoomMode(false);
        handActions.setPreviousHandsDistance(null);
      }
      return;
    }

    const selectedId = objectStore.selectedObjectId;
    if (!selectedId) return;

    const cfg = config();
    if (!cfg) return;

    // 检查双手是否都在捏合
    const leftPinching = handStore.left.isPinching;
    const rightPinching = handStore.right.isPinching;

    if (!leftPinching || !rightPinching) {
      if (handStore.zoomMode.active) {
        handActions.setZoomMode(false);
        handActions.setPreviousHandsDistance(null);
      }
      return;
    }

    // 计算当前双手距离
    const currentDistance = calculateDistance(
      { x: leftLandmarks[9].x, y: leftLandmarks[9].y, z: 0 },
      { x: rightLandmarks[9].x, y: rightLandmarks[9].y, z: 0 }
    );

    if (!handStore.zoomMode.active) {
      // 开始缩放：记录初始状态
      const objState = objectStore.objects[selectedId];
      handActions.setZoomMode(true);
      handActions.setZoomInitials(
        objState.scale,
        currentDistance,
        currentDistance
      );
      handActions.setPreviousHandsDistance(currentDistance);
      return;
    }

    // 计算新的缩放值
    const initialScale = handStore.zoomMode.initialSpread;
    const initialDistance = handStore.zoomMode.leftInitialDist;
    const scaleFactor = currentDistance / initialDistance;
    const newScale = Math.max(0.2, Math.min(5.0, initialScale * scaleFactor));

    // 更新缩放
    objectActions.updateObjectScale(selectedId, newScale);

    // 同步更新 SVGObject
    const svgObj = cfg.svgObjects.get(selectedId);
    if (svgObj) {
      svgObj.setScale(newScale);
    }

    handActions.setPreviousHandsDistance(currentDistance);
  }

  /**
   * 处理触摸检测
   */
  function updateTouchingState(
    landmarks: Array<{ x: number; y: number; z: number }>,
    side: 'Left' | 'Right'
  ) {
    const cfg = config();
    if (!cfg) return;

    const indexTip = landmarks[8];
    let isTouching = false;

    for (const [id, objState] of Object.entries(objectStore.objects)) {
      if (isPointNearObject(indexTip, objState.position, objState.scale)) {
        isTouching = true;
        break;
      }
    }

    handActions.setTouching(side, isTouching);
  }

  /**
   * 重置所有交互状态
   */
  function reset() {
    objectActions.selectObject(null);

    const cfg = config();
    if (cfg) {
      cfg.svgObjects.forEach(obj => obj.setSelected(false));
    }
  }

  return {
    init,
    getTouchedSVGObject,
    isPointNearObject,
    handleDragInteraction,
    handleScaleInteraction,
    updateTouchingState,
    reset,
    config,
  };
}
