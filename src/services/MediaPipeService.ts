/**
 * MediaPipe 服务
 * 负责 MediaPipe Hands 初始化和摄像头处理
 */

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
  onFaceResults?: (position: { x: number; y: number }) => void;
  setStatus: (status: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

export interface MediaPipeState {
  hands: any;
  faceMesh: any;
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
    faceMesh: null,
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
          width: { ideal: 640 },   // 降低分辨率以提升性能：640x480 (原1920x1080)
          height: { ideal: 480 },  // 页面显示分辨率通过CSS保持不变
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

      // 性能优化：禁用 FaceMesh（视差效果）以降低CPU占用
      // FaceMesh 需要检测 478 个面部关键点，CPU消耗极高
      // 如需重新启用，取消下方注释即可
      /*
      // Initialize FaceMesh
      if (typeof window.FaceMesh !== 'undefined') {
        state.faceMesh = new window.FaceMesh({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          },
        });

        state.faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        state.faceMesh.onResults((results: any) => {
            if (callbacks.onFaceResults && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                const landmarks = results.multiFaceLandmarks[0];
                const nose = landmarks[1];
                if (nose && typeof nose.x === 'number' && typeof nose.y === 'number') {
                    callbacks.onFaceResults({
                        x: (nose.x - 0.5) * 2,
                        y: (nose.y - 0.5) * 2
                    });
                }
            }
        });
      }
      */

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
              const promises = [];
              if (state.hands) promises.push(state.hands.send({ image: state.videoElement! }));
              // FaceMesh 已禁用以提升性能
              // if (state.faceMesh) promises.push(state.faceMesh.send({ image: state.videoElement! }));
              await Promise.all(promises);
            },
            width: 640,   // 降低分辨率以提升性能：640x480 (原1920x1080)
            height: 480,  // 页面显示分辨率通过CSS保持不变
          });

          await state.camera.start();
        }
      }

      callbacks.setStatus('Tracking ready (Hands only)!');
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
    if (state.hands) {
      state.hands.close();
    }
    if (state.faceMesh) {
      state.faceMesh.close();
    }
  }

  return {
    init: initMediaPipe,
    getCanvas: () => state.canvasElement,
    updateCanvasSize: updateCanvasToMatchVideo,
    destroy,
  };
}
