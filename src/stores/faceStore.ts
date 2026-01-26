/**
 * 面部检测 Store
 * 管理面部检测状态和位置信息
 */

import { createStore } from 'solid-js/store';

export interface FaceState {
  enabled: boolean;        // 是否启用面部检测（调试开关）
  detected: boolean;       // 是否检测到人脸
  x: number;              // 人脸中心 X 坐标（归一化 0-1）
  y: number;              // 人脸中心 Y 坐标（归一化 0-1）
  lastDetectedTime: number; // 最后检测到的时间戳
}

const initialState: FaceState = {
  enabled: true,          // 默认启用面部检测
  detected: false,
  x: 0.5,                // 画面中心
  y: 0.5,
  lastDetectedTime: 0,
};

export const [faceStore, setFaceStore] = createStore(initialState);

/**
 * Actions - 状态更新函数
 */
export const faceActions = {
  setEnabled(enabled: boolean) {
    setFaceStore('enabled', enabled);
  },

  setDetected(detected: boolean) {
    setFaceStore('detected', detected);
    if (detected) {
      setFaceStore('lastDetectedTime', Date.now());
    }
  },

  setFacePosition(x: number, y: number) {
    setFaceStore('x', x);
    setFaceStore('y', y);
    setFaceStore('detected', true);
    setFaceStore('lastDetectedTime', Date.now());
  },

  reset() {
    setFaceStore('detected', false);
    setFaceStore('x', 0.5);
    setFaceStore('y', 0.5);
  },
};
