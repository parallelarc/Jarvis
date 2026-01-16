/**
 * 球体形状
 */

import { ParticleShape } from './ParticleShape';
import type { ParticlePosition } from '@/core/types';

export class SphereShape extends ParticleShape {
  constructor(config?: { baseRadius?: number }) {
    super(config);
    this._name = 'sphere';
  }

  private _name: string;

  generateTargets(count: number, _time: number): ParticlePosition {
    return this.generateSphereTargets(count);
  }

  getName(): string {
    return this._name;
  }
}
