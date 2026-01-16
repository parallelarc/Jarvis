/**
 * 数学工具函数
 */

import type { Vector3D } from '@/core/types';

/**
 * 计算两点间距离（3D）
 */
export function calculateDistance(p1: Vector3D, p2: Vector3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z ?? 0) - (p2.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 线性插值
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 归一化坐标转世界坐标
 * 注意：视频使用了 scaleX(-1) 镜像，所以 X 轴需要反转
 */
export function normalizedToWorld(point: { x: number; y: number }): Vector3D {
  return {
    x: (0.5 - point.x) * 10,  // 反转 X 轴以匹配镜像后的坐标系
    y: (0.5 - point.y) * 10,
    z: 0,
  };
}

/**
 * 检查点是否接近粒子球
 */
export function isPointNearParticlesWithPos(
  point: Vector3D,
  spherePos: Vector3D,
  spread: number
): boolean {
  const worldPos = normalizedToWorld({ x: point.x, y: point.y });
  const dx = worldPos.x - spherePos.x;
  const dy = worldPos.y - spherePos.y;
  const dz = -(spherePos.z ?? 0);
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return distance < 2.0 * spread;  // BASE_RADIUS = 2.0
}
