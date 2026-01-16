/**
 * 粒子形状基类
 * 所有形状插件必须继承此类
 */

import type { ParticlePosition, Vector3D } from '@/core/types';
import { PARTICLE_CONFIG } from '@/config';

export abstract class ParticleShape {
  protected config: {
    baseRadius: number;
  };

  constructor(config: { baseRadius?: number } = {}) {
    this.config = {
      baseRadius: config.baseRadius ?? PARTICLE_CONFIG.BASE_RADIUS,
    };
  }

  /**
   * 生成球体位置（Fibonacci sphere 算法）
   */
  protected generateSphereTargets(count: number): ParticlePosition {
    const positions = new Float32Array(count * 3);
    const phi = Math.PI * (3 - Math.sqrt(5));  // 黄金角

    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = phi * i;

      positions[i * 3] = Math.cos(theta) * radius * this.config.baseRadius;
      positions[i * 3 + 1] = y * this.config.baseRadius;
      positions[i * 3 + 2] = Math.sin(theta) * radius * this.config.baseRadius;
    }

    return positions;
  }

  /**
   * 生成形状目标位置 - 子类必须实现
   */
  abstract generateTargets(count: number, time: number, ...args: unknown[]): ParticlePosition;

  /**
   * 获取形状名称
   */
  abstract getName(): string;
}
