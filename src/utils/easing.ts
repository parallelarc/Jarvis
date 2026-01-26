/**
 * 缓动函数集合
 * @see https://easings.net/
 */

import type { EasingType } from '@/config';

/**
 * easeOutCubic - 快速开始，缓慢结束
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * easeInOutCubic - 两端缓慢，中间快速
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 线性缓动 - 匀速运动
 */
export function linear(t: number): number {
  return t;
}

/**
 * 缓出 (Ease Out) - 快速开始，缓慢结束
 * 使用二次方缓出
 */
export function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * 根据类型获取缓动函数
 */
export function getEasingFunction(type: EasingType): (t: number) => number {
  switch (type) {
    case 'linear':
      return linear;
    case 'easeInOut':
      return easeInOutCubic;
    case 'easeOut':
      return easeOut;
    default:
      return easeInOutCubic;
  }
}
