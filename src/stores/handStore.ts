/**
 * 手部状态 Store
 */

import { createStore, produce, reconcile } from 'solid-js/store';
import type { HandState, HandSide, Vector3D, Landmarks } from '@/core/types';

/**
 * 扩展的手部状态 - 包含拖拽偏移和手势
 */
export type ExtendedHandState = HandState & {
  dragOffset?: Vector3D;
  isDragging: boolean;
  currentGesture: string | null;
  fingersExtended?: {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
  };
  palmDirection?: 'up' | 'down' | 'left' | 'right' | 'camera' | 'away';
  pinchingFinger?: 'index' | 'middle' | 'ring' | 'pinky' | null;
  // 点击检测状态
  pinchStartObjectId: string | null;  // 捏合开始时手指下的对象 ID
  pinchStartTime: number;             // 捏合开始的时间戳（用于判断点击是否"干脆"）
  wasPinching: boolean;               // 上一帧的捏合状态（用于检测边沿）
};

function createInitialHandState(side: HandSide): ExtendedHandState {
  return {
    side,
    active: false,
    landmarks: null,
    isTouching: false,
    isSelected: false,
    isPinching: false,
    isDragging: false,
    pinchDistance: 0,
    currentGesture: null,
    fingersExtended: {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    },
    palmDirection: undefined,
    pinchingFinger: null,
    // 点击检测状态初始值
    pinchStartObjectId: null,
    pinchStartTime: 0,
    wasPinching: false,
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
    setHandStore(key, 'landmarks', landmarks ? reconcile(landmarks) : null);
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

  setDragging(side: HandSide, dragging: boolean) {
    const key = sideToKey(side);
    setHandStore(key, 'isDragging', dragging);
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

  setGesture(
    side: HandSide,
    gesture: string | null,
    fingers?: { thumb: boolean; index: boolean; middle: boolean; ring: boolean; pinky: boolean },
    palmDirection?: 'up' | 'down' | 'left' | 'right' | 'camera' | 'away',
    pinchingFinger?: 'index' | 'middle' | 'ring' | 'pinky' | null
  ) {
    const key = sideToKey(side);
    setHandStore(key, produce((hand) => {
      hand.currentGesture = gesture;
      if (fingers) {
        hand.fingersExtended = fingers;
      }
      if (palmDirection) {
        hand.palmDirection = palmDirection;
      }
      if (pinchingFinger !== undefined) {
        hand.pinchingFinger = pinchingFinger;
      }
    }));
  },

  // 点击检测相关动作
  setPinchStartObject(side: HandSide, objectId: string | null) {
    const key = sideToKey(side);
    setHandStore(key, 'pinchStartObjectId', objectId);
  },

  setPinchStartTime(side: HandSide, time: number) {
    const key = sideToKey(side);
    setHandStore(key, 'pinchStartTime', time);
  },

  setWasPinching(side: HandSide, wasPinching: boolean) {
    const key = sideToKey(side);
    setHandStore(key, 'wasPinching', wasPinching);
  },
};
