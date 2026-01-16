/**
 * 涟漪效果
 * 从接触点向外扩散的彩色波纹
 */

import { ParticleEffect } from './ParticleEffect';
import type { Vector3D, Color } from '@/core/types';
import { calculateDistance } from '@/utils/math';
import { blendColors } from '@/utils/color';
import { RIPPLE_CONFIG } from '@/config';

export interface RippleEffectConfig {
  duration?: number;
  expansionSpeed?: number;
  width?: number;
}

export class RippleEffect extends ParticleEffect {
  private contactPoint: Vector3D;
  private color: Color;
  private config: Required<RippleEffectConfig>;

  constructor(contactPoint: Vector3D, color: Color, config: RippleEffectConfig = {}) {
    super();
    this.contactPoint = { ...contactPoint };
    this.color = { ...color };
    this.config = {
      duration: config.duration ?? RIPPLE_CONFIG.RIPPLE_DURATION,
      expansionSpeed: config.expansionSpeed ?? RIPPLE_CONFIG.RIPPLE_EXPANSION_SPEED,
      width: config.width ?? RIPPLE_CONFIG.RIPPLE_WIDTH,
    };
  }

  apply(positions: Float32Array, colors: Float32Array): boolean {
    const age = this.getAge();

    if (age > this.config.duration) {
      this.active = false;
      return false;
    }

    const rippleRadius = age * this.config.expansionSpeed;

    for (let i = 0; i < positions.length / 3; i++) {
      const i3 = i * 3;
      const particlePos: Vector3D = {
        x: positions[i3],
        y: positions[i3 + 1],
        z: positions[i3 + 2],
      };

      const distance = calculateDistance(particlePos, this.contactPoint);

      if (Math.abs(distance - rippleRadius) < this.config.width) {
        const intensity =
          (1 - age / this.config.duration) *
          (1 - Math.abs(distance - rippleRadius) / this.config.width);

        const baseColor: Color = {
          r: colors[i3],
          g: colors[i3 + 1],
          b: colors[i3 + 2],
        };

        const blended = blendColors(baseColor, this.color, intensity * 0.8);

        colors[i3] = blended.r;
        colors[i3 + 1] = blended.g;
        colors[i3 + 2] = blended.b;
      }
    }

    return true;
  }
}
