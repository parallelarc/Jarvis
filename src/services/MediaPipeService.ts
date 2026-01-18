/**
 * MediaPipe 服务
 * 负责 MediaPipe Hands 初始化和摄像头处理
 */

import { GESTURE_DETECTION_CONFIG } from '@/config';
import type { Landmarks, HandSide } from '@/core/types';

// MediaPipe 类型声明
declare global {
  interface Window {
    Hands?: any;
    Camera?: any;
    drawConnectors?: (
      ctx: CanvasRenderingContext2D,
      landmarks: { x: number; y: number; z: number }[],
      connections: number[][],
      options?: { color: string; lineWidth: number }
    ) => void;
    drawLandmarks?: (
      ctx: CanvasRenderingContext2D,
      landmarks: { x: number; y: number; z: number }[],
      options?: { color: string; lineWidth: number; radius: number }
    ) => void;
  }
}

export interface MediaPipeResult {
  multiHandLandmarks: Array<Array<{ x: number; y: number; z: number }>> | null;
  multiHandedness: Array<{ label: 'Left' | 'Right' }> | null;
}

export interface MediaPipeCallbacks {
  onResults: (results: MediaPipeResult) => void;
  setStatus: (status: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

export interface MediaPipeState {
  hands: any;
  camera: any;
  canvasElement: HTMLCanvasElement | null;
  videoElement: HTMLVideoElement | null;
}

export interface MediaPipeService {
  init: () => Promise<void>;
  getCanvas: () => HTMLCanvasElement | null;
  updateCanvasSize: () => void;
  destroy: () => void;
}

/**
 * 获取视频显示区域
 */
function getVideoDisplayArea() {
  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * 创建 MediaPipe 服务
 */
export function createMediaPipeService(callbacks: MediaPipeCallbacks): MediaPipeService {
  const state: MediaPipeState = {
    hands: null,
    camera: null,
    canvasElement: null,
    videoElement: null,
  };

  /**
   * 更新 canvas 以匹配视频显示区域
   */
  function updateCanvasToMatchVideo() {
    if (!state.canvasElement) return;

    const area = getVideoDisplayArea();

    state.canvasElement.width = area.width;
    state.canvasElement.height = area.height;

    state.canvasElement.style.left = `${area.left}px`;
    state.canvasElement.style.top = `${area.top}px`;
    state.canvasElement.style.width = `${area.width}px`;
    state.canvasElement.style.height = `${area.height}px`;
  }

  /**
   * 初始化 MediaPipe
   */
  async function initMediaPipe() {
    try {
      state.videoElement = document.getElementById('webcam') as HTMLVideoElement;

      const existingCanvas = document.querySelector('.hand-overlay');
      if (existingCanvas) {
        state.canvasElement = existingCanvas as HTMLCanvasElement;
      } else {
        state.canvasElement = document.createElement('canvas');
        document.body.appendChild(state.canvasElement);
        state.canvasElement.className = 'hand-overlay';
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user',
        },
      });

      if (state.videoElement) {
        state.videoElement.srcObject = stream;
        await new Promise(resolve => {
          state.videoElement!.onloadedmetadata = resolve;
        });
        updateCanvasToMatchVideo();
      }

      if (typeof window.Hands !== 'undefined') {
        state.hands = new window.Hands({
          locateFile: (file: string) => {
            const localFiles = [
              'hands_solution_packed_assets.data',
              'hands_solution_packed_assets.fileset',
              'hands_solution_packed_assets_loader.js',
              'hands_solution_simd_wasm_bin.js',
              'hands_solution_simd_wasm_bin.wasm',
              'hands_solution_similarity_calculator.data',
              'hands.binarypb',
              'hand_landmark_full.tflite',
            ];
            if (localFiles.includes(file)) {
              return `./models/hands/${file}`;
            }
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          },
        });

        state.hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        await state.hands.initialize();
        state.hands.onResults(callbacks.onResults);

        if (typeof window.Camera !== 'undefined') {
          state.camera = new window.Camera(state.videoElement, {
            onFrame: async () => {
              await state.hands.send({ image: state.videoElement! });
            },
            width: 1920,
            height: 1080,
          });

          await state.camera.start();
        }
      }

      callbacks.setStatus('Hand tracking ready!');
      callbacks.onLoadingChange(false);
    } catch (error) {
      callbacks.setStatus(`Error: ${(error as Error).message}`);
      console.error('Error initializing MediaPipe:', error);
    }
  }

  /**
   * 销毁服务
   */
  function destroy() {
    if (state.camera) {
      state.camera.stop();
    }
    if (state.canvasElement && state.canvasElement.parentNode) {
      state.canvasElement.parentNode.removeChild(state.canvasElement);
    }
  }

  return {
    init: initMediaPipe,
    getCanvas: () => state.canvasElement,
    updateCanvasSize: updateCanvasToMatchVideo,
    destroy,
  };
}
