/**
 * 动画状态 Store
 */

import { createStore, produce } from 'solid-js/store';
import type { AnimationState, Vector3D } from '@/core/types';

/**
 * 动画状态枚举
 */
export const AnimationStateVal = {
  BALL: 'ball',
  EXPLODING: 'exploding',
  FORMING: 'forming',
  TEXT: 'text',
  RECOVERING: 'recovering',
} as const;

export type AnimationStateType = AnimationState;

export type AnimationStoreState = {
  current: AnimationStateType;
  startTime: number;
  explosionCenter: Vector3D;
  helloWavingActive: boolean;
  lastWavingTime: number;
  text: string;
};

const initialState: AnimationStoreState = {
  current: AnimationStateVal.BALL,
  startTime: 0,
  explosionCenter: { x: 0, y: 0, z: 0 },
  helloWavingActive: false,
  lastWavingTime: 0,
  text: 'hello',
};

export const [animationStore, setAnimationStore] = createStore(initialState);

/**
 * 获取当前状态（用于 actions 内部访问）
 */
function getState(): AnimationStoreState {
  return animationStore;
}

/**
 * Actions - 状态更新函数
 */
export const animationActions = {
  setState(state: AnimationStateType) {
    setAnimationStore('current', state);
    setAnimationStore('startTime', Date.now());
  },

  triggerExplosion(center: Vector3D) {
    setAnimationStore('current', AnimationStateVal.EXPLODING);
    setAnimationStore('startTime', Date.now());
    setAnimationStore('explosionCenter', { ...center });
  },

  triggerRecovery() {
    setAnimationStore('current', AnimationStateVal.RECOVERING);
    setAnimationStore('startTime', Date.now());
  },

  setHelloWaving(active: boolean) {
    setAnimationStore('helloWavingActive', active);
    if (active) {
      setAnimationStore('lastWavingTime', Date.now());
    }
  },

  setText(text: string) {
    setAnimationStore('text', text);
  },

  getElapsed(): number {
    return Date.now() - getState().startTime;
  },
};

/**
 * Selectors - 派生状态
 */
export const animationSelectors = {
  isTextState: () => animationStore.current === AnimationStateVal.TEXT,
  isBallState: () => animationStore.current === AnimationStateVal.BALL,
  getProgress: (duration: number) => {
    const elapsed = Date.now() - animationStore.startTime;
    return Math.min(elapsed / duration, 1);
  },
};
