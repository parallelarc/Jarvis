/**
 * MediaPipe 服务
 * 负责 MediaPipe Hands 初始化和摄像头处理
 */

import { MEDIAPIPE_CONFIG } from '@/config/index';

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

/**
 * 自定义帧采集器
 * 解耦 MediaPipe 帧率与页面渲染帧率
 */
class CustomFrameSender {
  private running = false;
  private lastFrameTime = 0;
  private animationFrameId: number | null = null;
  private frameCount = 0;
  private lastFpsUpdateTime = 0;
  private currentFps = 0;
  private onFpsUpdate?: (fps: number) => void;

  /**
   * 启动自定义帧采集循环
   */
  async start(
    videoElement: HTMLVideoElement,
    hands: any,
    targetFps: number,
    onFpsUpdate?: (fps: number) => void
  ) {
    this.running = true;
    this.lastFrameTime = performance.now();
    this.lastFpsUpdateTime = performance.now();
    this.frameCount = 0;
    this.onFpsUpdate = onFpsUpdate;
    this.sendLoop(videoElement, hands, targetFps);
  }

  /**
   * 帧采集循环 - 使用 requestAnimationFrame + 时间节流
   */
  private async sendLoop(
    videoElement: HTMLVideoElement,
    hands: any,
    targetFps: number
  ) {
    if (!this.running) return;

    const frameInterval = 1000 / targetFps;
    const now = performance.now();
    const elapsed = now - this.lastFrameTime;

    // 时间节流：只在达到目标帧间隔时发送帧
    if (elapsed >= frameInterval) {
      this.lastFrameTime = now - (elapsed % frameInterval);

      // 发送帧到 MediaPipe
      await hands.send({ image: videoElement });

      // 计算 FPS
      this.frameCount++;
      const fpsElapsed = now - this.lastFpsUpdateTime;
      if (fpsElapsed >= 500) {  // 每 500ms 更新一次 FPS
        this.currentFps = Math.round(this.frameCount * 1000 / fpsElapsed);
        this.frameCount = 0;
        this.lastFpsUpdateTime = now;
        if (this.onFpsUpdate) {
          this.onFpsUpdate(this.currentFps);
        }
      }
    }

    if (this.running) {
      this.animationFrameId = requestAnimationFrame(() =>
        this.sendLoop(videoElement, hands, targetFps)
      );
    }
  }

  /**
   * 停止帧采集循环
   */
  stop() {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 获取当前 FPS
   */
  getCurrentFps(): number {
    return this.currentFps;
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
  onMediaPipeFpsUpdate?: (fps: number) => void;
}

export interface MediaPipeState {
  hands: any;
  faceMesh: any;
  camera: any;
  customFrameSender: CustomFrameSender | null;
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
    customFrameSender: null,
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

      // Canvas 绘制现在由 HandOverlay 组件处理，不再在此创建
      // 保留 canvasElement 引用以兼容 updateCanvasSize 调用
      state.canvasElement = document.querySelector('.hand-overlay-canvas') as HTMLCanvasElement || null;

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
        // CustomFrameSender 需要视频播放，Camera API 之前自动处理了这个
        // 等待视频真正开始播放
        await state.videoElement.play();
        // 确保 video.currentTime > 0，说明视频已经开始播放
        await new Promise<void>(resolve => {
          const checkTime = () => {
            if (state.videoElement && state.videoElement.currentTime > 0) {
              resolve();
            } else {
              requestAnimationFrame(checkTime);
            }
          };
          checkTime();
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

        // 使用 CustomFrameSender 替代 window.Camera
        // 解耦 MediaPipe 帧率与页面渲染帧率
        if (MEDIAPIPE_CONFIG.ENABLE_THROTTLING) {
          state.customFrameSender = new CustomFrameSender();
          await state.customFrameSender.start(
            state.videoElement,
            state.hands,
            MEDIAPIPE_CONFIG.TARGET_FPS,
            callbacks.onMediaPipeFpsUpdate
          );
        } else {
          // 降级到原始 Camera API（如果需要）
          if (typeof window.Camera !== 'undefined') {
            state.camera = new window.Camera(state.videoElement, {
              onFrame: async () => {
                const promises = [];
                if (state.hands) promises.push(state.hands.send({ image: state.videoElement! }));
                await Promise.all(promises);
              },
              width: 640,
              height: 480,
            });
            await state.camera.start();
          }
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
    if (state.customFrameSender) {
      state.customFrameSender.stop();
      state.customFrameSender = null;
    }
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
