/**
 * 动画状态 Store
 * 管理全局动画状态
 */

import { createStore } from 'solid-js/store';

export type AnimationStoreState = {
  isAnimating: boolean;
  animationType: 'idle' | 'auto-reset' | 'custom';
};

const initialState: AnimationStoreState = {
  isAnimating: false,
  animationType: 'idle',
};

export const [animationStore, setAnimationStore] = createStore(initialState);

/**
 * Actions - 状态更新函数
 */
export const animationActions = {
  /**
   * 设置动画状态
   */
  setAnimating(isAnimating: boolean, type: 'idle' | 'auto-reset' | 'custom' = 'idle') {
    setAnimationStore({
      isAnimating,
      animationType: isAnimating ? type : 'idle',
    });
  },
};
