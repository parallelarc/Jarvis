/**
 * 自动复位服务
 * 当手离开画面一段时间后，自动将所有 SVG 对象复位到初始位置和角度
 */

import { handStore } from '@/stores/handStore';
import { objectStore, objectActions } from '@/stores/objectStore';
import { animationActions } from '@/stores/animationStore';
import { AUTO_RESET_CONFIG } from '@/config';
import { animationManager } from '@/managers/AnimationManager';
import { syncSVGObjectPosition, syncSVGObjectScale, syncSVGObjectRotation } from '@/utils/three-sync';
import type { Vector3D } from '@/core/types';

class AutoResetService {
  private timeoutId: number | null = null;
  private tweenIds: string[] = [];

  /**
   * 启动自动复位计时器
   */
  startTimer() {
    // 清除之前的计时器
    this.stopTimer();

    this.timeoutId = window.setTimeout(() => {
      this.triggerAutoReset();
    }, AUTO_RESET_CONFIG.TIMEOUT_MS);
  }

  /**
   * 停止自动复位计时器
   */
  stopTimer() {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * 取消正在进行的复位动画
   */
  private cancelAnimation() {
    this.tweenIds.forEach(id => animationManager.cancelTween(id));
    this.tweenIds = [];
    animationActions.setAnimating(false, 'idle');
  }

  /**
   * 中断自动复位（手重新出现时调用）
   */
  interrupt() {
    this.stopTimer();
    this.cancelAnimation();
  }

  /**
   * 触发自动复位动画
   */
  private triggerAutoReset() {
    const sceneAPI = (window as any).svgSceneAPI;
    if (!sceneAPI) return;

    const svgObjects = sceneAPI.getSVGObjects();
    if (!svgObjects) return;

    const objectIds = Object.keys(objectStore.objects);
    const initialPositions = objectStore.initialPositions;
    const initialRotations = objectStore.initialRotations;
    const initialScales = objectStore.initialScales;

    // 标记动画开始
    animationActions.setAnimating(true, 'auto-reset');

    objectIds.forEach(id => {
      const svgObj = svgObjects.get(id);
      if (!svgObj) return;

      const targetPos = initialPositions[id] || { x: 0, y: 0, z: 0 };
      const targetRotation = initialRotations[id] || { x: 0, y: 0, z: 0 };
      const targetScale = initialScales[id] ?? 1.0;

      // 从 Three.js mesh 读取当前实际状态作为起点
      const currentMeshPos = svgObj.mesh.position;
      const startPos = { x: currentMeshPos.x, y: currentMeshPos.y, z: currentMeshPos.z };

      // 从 store 读取当前旋转和缩放作为起点
      const currentRotation = objectStore.objects[id]?.rotation || { x: 0, y: 0, z: 0 };
      const currentScale = objectStore.objects[id]?.scale ?? 1.0;

      // 创建位置补间动画
      const posTweenId = animationManager.createVectorTween(
        `auto-reset-pos-${id}`,
        AUTO_RESET_CONFIG.ANIMATION_DURATION_MS,
        AUTO_RESET_CONFIG.EASING_TYPE,
        startPos,
        targetPos,
        (currentPos) => {
          // 更新 store
          objectActions.setObjectPosition(id, currentPos);
          // 同步到 Three.js
          syncSVGObjectPosition(id, currentPos);
        }
      );

      // 创建旋转补间动画（使用更长的时长，让旋转复位更平滑）
      const rotTweenId = animationManager.createVectorTween(
        `auto-reset-rot-${id}`,
        AUTO_RESET_CONFIG.ANIMATION_DURATION_MS * 1.5,
        AUTO_RESET_CONFIG.EASING_TYPE,
        currentRotation,
        targetRotation,
        (currentRot) => {
          // 更新 store
          objectActions.updateObjectRotation(id, currentRot);
          // 同步到 Three.js
          syncSVGObjectRotation(id, currentRot);
        }
      );

      // 创建缩放补间动画
      const scaleTweenId = animationManager.createNumberTween(
        `auto-reset-scale-${id}`,
        AUTO_RESET_CONFIG.ANIMATION_DURATION_MS,
        AUTO_RESET_CONFIG.EASING_TYPE,
        currentScale,
        targetScale,
        (currentScale) => {
          // 更新 store
          objectActions.updateObjectScale(id, currentScale);
          // 同步到 Three.js
          syncSVGObjectScale(id, currentScale);
        }
      );

      this.tweenIds.push(posTweenId, rotTweenId, scaleTweenId);
    });

    // 动画完成回调（在所有动画完成后）
    animationManager.createTween(
      'auto-reset-complete',
      AUTO_RESET_CONFIG.ANIMATION_DURATION_MS,
      AUTO_RESET_CONFIG.EASING_TYPE,
      () => {},
      () => {
        animationActions.setAnimating(false, 'idle');
      }
    );
    this.tweenIds.push('auto-reset-complete');
  }

  /**
   * 检查手部状态并管理计时器
   * 在手势循环中调用
   */
  checkHandsState() {
    const leftActive = handStore.left.active;
    const rightActive = handStore.right.active;
    const hasHands = leftActive || rightActive;

    if (hasHands) {
      // 有手在画面中，取消计时和动画
      this.interrupt();
    } else {
      // 无手在画面中，启动计时器
      if (this.timeoutId === null && this.tweenIds.length === 0) {
        this.startTimer();
      }
    }
  }
}

// 导出单例
export const autoResetService = new AutoResetService();
