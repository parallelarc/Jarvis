/**
 * 粒子状态 Store
 */

import { createStore, produce } from 'solid-js/store';
import type { Vector3D, Color, Ripple } from '@/core/types';
import { SPREAD_CONFIG } from '@/config';

export type ParticleStoreState = {
  spherePosition: Vector3D;
  targetSpread: number;
  currentSpread: number;
  baseColor: Color;
  ripples: Ripple[];
};

const initialState: ParticleStoreState = {
  spherePosition: { x: 0, y: 0, z: 0 },
  targetSpread: 1.0,
  currentSpread: 1.0,
  baseColor: { r: 1.0, g: 0.0, b: 1.0 },
  ripples: [],
};

export const [particleStore, setParticleStore] = createStore(initialState);

/**
 * 获取当前状态（用于 actions 内部访问）
 */
function getState(): ParticleStoreState {
  return particleStore;
}

/**
 * Actions - 状态更新函数
 */
export const particleActions = {
  updateSpherePosition(position: Partial<Vector3D>) {
    setParticleStore('spherePosition', produce((pos) => {
      if (position.x !== undefined) pos.x = position.x;
      if (position.y !== undefined) pos.y = position.y;
      if (position.z !== undefined) pos.z = position.z;
    }));
  },

  setSpherePosition(position: Vector3D) {
    setParticleStore('spherePosition', { ...position });
  },

  setTargetSpread(spread: number) {
    const clamped = Math.max(SPREAD_CONFIG.SPREAD_MIN,
      Math.min(SPREAD_CONFIG.SPREAD_MAX, spread));
    setParticleStore('targetSpread', clamped);
  },

  smoothUpdateSpread() {
    const state = getState();
    const newSpread = state.currentSpread +
      (state.targetSpread - state.currentSpread) * SPREAD_CONFIG.SPREAD_SMOOTHING;
    setParticleStore('currentSpread', newSpread);
  },

  setBaseColor(color: Color) {
    setParticleStore('baseColor', color);
  },

  addRipple(contactPoint: Vector3D, color: Color) {
    setParticleStore('ripples', produce((ripples) => {
      ripples.push({
        contactPoint: { ...contactPoint },
        color: { ...color },
        startTime: Date.now(),
      });
    }));
  },

  cleanupRipples(duration: number) {
    const now = Date.now();
    setParticleStore('ripples', produce((ripples) => {
      const next = ripples.filter(r => now - r.startTime < duration);
      ripples.length = 0;
      ripples.push(...next);
    }));
  },
};
