/**
 * 手部状态 Store
 */

import { createStore, produce, reconcile } from 'solid-js/store';
import type { HandState, HandSide, Vector3D, Landmarks } from '@/core/types';

/**
 * 扩展的手部状态 - 包含拖拽偏移
 */
export type ExtendedHandState = HandState & {
  dragOffset?: Vector3D;
};

function createInitialHandState(side: HandSide): ExtendedHandState {
  return {
    side,
    active: false,
    landmarks: null,
    isTouching: false,
    isSelected: false,
    isPinching: false,
    pinchDistance: 0,
  };
}

/**
 * 将 HandSide 转换为 store 键名
 */
function sideToKey(side: HandSide): 'left' | 'right' {
  return side === 'Left' ? 'left' : 'right';
}

export type HandStoreState = {
  left: ExtendedHandState;
  right: ExtendedHandState;
  zoomMode: {
    active: boolean;
    initialSpread: number;
    leftInitialDist: number;
    rightInitialDist: number;
  };
  previousHandsDistance: number | null;
};

const initialState: HandStoreState = {
  left: createInitialHandState('Left'),
  right: createInitialHandState('Right'),
  zoomMode: {
    active: false,
    initialSpread: 1.0,
    leftInitialDist: 0,
    rightInitialDist: 0,
  },
  previousHandsDistance: null,
};

export const [handStore, setHandStore] = createStore(initialState);

/**
 * Actions - 状态更新函数
 */
export const handActions = {
  setHandActive(side: HandSide, active: boolean) {
    const key = sideToKey(side);
    setHandStore(key, 'active', active);
  },

  setHandLandmarks(side: HandSide, landmarks: Landmarks | null) {
    const key = sideToKey(side);
    setHandStore(key, 'landmarks', landmarks);
  },

  setTouching(side: HandSide, touching: boolean) {
    const key = sideToKey(side);
    setHandStore(key, 'isTouching', touching);
  },

  setSelected(side: HandSide, selected: boolean) {
    const key = sideToKey(side);
    setHandStore(key, 'isSelected', selected);
  },

  setPinching(side: HandSide, pinching: boolean, distance: number) {
    const key = sideToKey(side);
    setHandStore(key, 'isPinching', pinching);
    setHandStore(key, 'pinchDistance', distance);
  },

  setDragOffset(side: HandSide, offset: Vector3D) {
    const key = sideToKey(side);
    setHandStore(key, 'dragOffset', offset);
  },

  resetHands() {
    setHandStore(reconcile({
      left: createInitialHandState('Left'),
      right: createInitialHandState('Right'),
      zoomMode: initialState.zoomMode,
      previousHandsDistance: null,
    }));
  },

  setZoomMode(active: boolean) {
    setHandStore('zoomMode', 'active', active);
  },

  setZoomInitials(spread: number, leftDist: number, rightDist: number) {
    setHandStore('zoomMode', produce((zoom) => {
      zoom.initialSpread = spread;
      zoom.leftInitialDist = leftDist;
      zoom.rightInitialDist = rightDist;
    }));
  },

  setPreviousHandsDistance(distance: number | null) {
    setHandStore('previousHandsDistance', distance);
  },
};
