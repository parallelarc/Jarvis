/**
 * 动画管理器
 * 通用的补间动画系统，支持平滑插值
 */

import type { Vector3D } from '@/core/types';
import { getEasingFunction } from '@/utils/easing';
import type { EasingType } from '@/config';

/**
 * 补间动画接口
 */
interface Tween {
  id: string;
  startTime: number;
  duration: number;
  easing: EasingType;
  onUpdate: (progress: number, easedProgress: number) => void;
  onComplete?: () => void;
}

class AnimationManager {
  private tweens: Map<string, Tween> = new Map();
  private animationFrameId: number | null = null;
  private isRunning = false;

  /**
   * 启动动画循环
   */
  private start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tick();
  }

  /**
   * 停止动画循环
   */
  private stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isRunning = false;
  }

  /**
   * 动画循环
   */
  private tick = () => {
    const now = performance.now();
    const completedIds: string[] = [];

    // 更新所有动画
    this.tweens.forEach((tween, id) => {
      const elapsed = now - tween.startTime;
      let progress = Math.min(elapsed / tween.duration, 1);

      // 应用缓动函数
      const easingFn = getEasingFunction(tween.easing);
      const easedProgress = easingFn(progress);

      // 调用更新回调
      tween.onUpdate(progress, easedProgress);

      // 检查是否完成
      if (progress >= 1) {
        completedIds.push(id);
        tween.onComplete?.();
      }
    });

    // 移除已完成的动画
    completedIds.forEach(id => this.tweens.delete(id));

    // 如果还有动画，继续循环
    if (this.tweens.size > 0) {
      this.animationFrameId = requestAnimationFrame(this.tick);
    } else {
      this.stop();
    }
  };

  /**
   * 创建补间动画
   */
  createTween(
    id: string,
    duration: number,
    easing: EasingType,
    onUpdate: (progress: number, easedProgress: number) => void,
    onComplete?: () => void
  ) {
    // 如果存在相同 ID 的动画，先取消
    if (this.tweens.has(id)) {
      this.cancelTween(id);
    }

    const tween: Tween = {
      id,
      startTime: performance.now(),
      duration,
      easing,
      onUpdate,
      onComplete,
    };

    this.tweens.set(id, tween);
    this.start();

    return id;
  }

  /**
   * 取消指定动画
   */
  cancelTween(id: string) {
    this.tweens.delete(id);

    // 如果没有动画了，停止循环
    if (this.tweens.size === 0) {
      this.stop();
    }
  }

  /**
   * 取消所有动画
   */
  cancelAll() {
    this.tweens.clear();
    this.stop();
  }

  /**
   * 检查是否有正在运行的动画
   */
  isAnimating(): boolean {
    return this.tweens.size > 0;
  }

  /**
   * 创建向量补间动画（辅助方法）
   */
  createVectorTween(
    id: string,
    duration: number,
    easing: EasingType,
    startVec: Vector3D,
    endVec: Vector3D,
    onUpdate: (current: Vector3D) => void,
    onComplete?: () => void
  ) {
    return this.createTween(
      id,
      duration,
      easing,
      (_progress, easedProgress) => {
        const current: Vector3D = {
          x: startVec.x + (endVec.x - startVec.x) * easedProgress,
          y: startVec.y + (endVec.y - startVec.y) * easedProgress,
          z: (startVec.z ?? 0) + ((endVec.z ?? 0) - (startVec.z ?? 0)) * easedProgress,
        };
        onUpdate(current);
      },
      onComplete
    );
  }

  /**
   * 创建数字补间动画（辅助方法）
   * 用于插值单个数值，如 scale、opacity 等
   */
  createNumberTween(
    id: string,
    duration: number,
    easing: EasingType,
    startValue: number,
    endValue: number,
    onUpdate: (current: number) => void,
    onComplete?: () => void
  ) {
    return this.createTween(
      id,
      duration,
      easing,
      (_progress, easedProgress) => {
        const current = startValue + (endValue - startValue) * easedProgress;
        onUpdate(current);
      },
      onComplete
    );
  }
}

// 导出单例
export const animationManager = new AnimationManager();
