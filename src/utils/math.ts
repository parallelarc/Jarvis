/**
 * 数学工具函数
 */

import type { Vector3D } from '@/core/types';
import { VIEW_CONFIG, PARTICLE_CONFIG } from '@/config';
import { THREE } from './three';

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
 *
 * 坐标系统说明：
 * - MediaPipe 归一化坐标: (0, 0) = 左上角, (1, 1) = 右下角
 * - Three.js 世界坐标: 取决于相机位置和投影
 * - 支持透视相机和正交相机的正确转换
 *
 * @param point - MediaPipe 归一化坐标点 (0-1)
 * @param camera - Three.js 相机实例（可选，不提供则使用线性近似）
 * @param width - 屏幕宽度（透视相机时需要）
 * @param height - 屏幕高度（透视相机时需要）
 * @returns Three.js 世界坐标点
 */
export function normalizedToWorld(
  point: { x: number; y: number },
  camera?: any,
  width?: number,
  height?: number
): Vector3D {
  // 如果没有相机，使用线性公式（正交相机或后备方案）
  if (!camera) {
    const { NORMALIZED_CENTER, WORLD_SCALE, INVERT_X, INVERT_Y } = VIEW_CONFIG;
    const rawX = (point.x - NORMALIZED_CENTER) * WORLD_SCALE;
    const rawY = (point.y - NORMALIZED_CENTER) * WORLD_SCALE;
    return {
      x: INVERT_X ? -rawX : rawX,
      y: INVERT_Y ? -rawY : rawY,
      z: 0,
    };
  }

  // 使用透视投影的正确转换
  const { INVERT_X, INVERT_Y } = VIEW_CONFIG;

  // 创建归一化设备坐标 (NDC) -1 到 +1
  const ndc = new THREE.Vector3(
    (point.x * 2) - 1,
    (point.y * 2) - 1,
    0.5  // 在相机前方
  );

  // Y 轴翻转（屏幕坐标向下，3D 坐标向上）
  ndc.y = -ndc.y;

  // 应用镜像
  if (INVERT_X) ndc.x = -ndc.x;

  // Unproject 到世界坐标
  ndc.unproject(camera);

  // 投影到 z=0 平面
  const cameraPos = camera.position;
  const distance = ndc.z - cameraPos.z;
  const scale = -cameraPos.z / distance;

  ndc.x = cameraPos.x + (ndc.x - cameraPos.x) * scale;
  ndc.y = cameraPos.y + (ndc.y - cameraPos.y) * scale;
  ndc.z = 0;

  return { x: ndc.x, y: ndc.y, z: 0 };
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
  return distance < PARTICLE_CONFIG.BASE_RADIUS * spread;
}
