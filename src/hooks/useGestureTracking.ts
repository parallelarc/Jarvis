/**
 * 手势追踪 Hook
 * 管理 MediaPipe Hands 和相机输入
 */

import { createSignal, onMount, onCleanup } from 'solid-js';
import { handStore, handActions } from '@/stores/handStore';
import { animationActions, animationSelectors } from '@/stores/animationStore';
import { particleActions, particleStore } from '@/stores/particleStore';
import { GESTURE_CONFIG } from '@/config';
import { normalizedToWorld, calculateDistance } from '@/utils/math';
import type { Landmarks } from '@/core/types';
import { detectZoomGesture } from '@/domain/GestureDetector';

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

export function useGestureTracking() {
  const [status, setStatus] = createSignal('Initializing MediaPipe...');
  const [isLoading, setIsLoading] = createSignal(true);

  let hands: any = null;
  let camera: any = null;
  let canvasElement: HTMLCanvasElement | null = null;
  let videoElement: HTMLVideoElement | null = null;

  /**
   * 计算 object-fit: contain 下的实际视频显示区域
   */
  function getVideoDisplayArea() {
    if (!videoElement || !videoElement.videoWidth) {
      return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
    const windowRatio = vw / vh;

    let width: number, height: number, left: number, top: number;

    if (videoRatio > windowRatio) {
      // 视频更宽，以宽度为准
      width = vw;
      height = vw / videoRatio;
      left = 0;
      top = (vh - height) / 2;
    } else {
      // 视频更高，以高度为准
      height = vh;
      width = vh * videoRatio;
      left = (vw - width) / 2;
      top = 0;
    }

    return { left, top, width, height };
  }

  /**
   * 更新 canvas 以匹配视频显示区域
   */
  function updateCanvasToMatchVideo() {
    if (!canvasElement) return;

    const area = getVideoDisplayArea();

    // 设置 canvas 内部尺寸
    canvasElement.width = area.width;
    canvasElement.height = area.height;

    // 设置 canvas 显示位置和尺寸
    canvasElement.style.left = `${area.left}px`;
    canvasElement.style.top = `${area.top}px`;
    canvasElement.style.width = `${area.width}px`;
    canvasElement.style.height = `${area.height}px`;
  }

  /**
   * 处理 MediaPipe 结果
   */
  function onResults(results: any) {
    // 确保画布与视频区域匹配
    updateCanvasToMatchVideo();

    // 清除画布
    const ctx = canvasElement?.getContext('2d');
    if (ctx && canvasElement) {
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      setStatus(`${results.multiHandLandmarks.length} hand(s) detected`);

      // 获取当前检测到的手部
      const detectedSides = new Set<'Left' | 'Right'>();
      let leftLandmarks: Landmarks | null = null;
      let rightLandmarks: Landmarks | null = null;

      // 处理每只手
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const side = results.multiHandedness[i].label as 'Left' | 'Right';
        detectedSides.add(side);

        handActions.setHandActive(side, true);
        handActions.setHandLandmarks(side, landmarks);

        // 收集手部 landmarks 用于双手交互
        if (side === 'Left') {
          leftLandmarks = landmarks as Landmarks;
        } else {
          rightLandmarks = landmarks as Landmarks;
        }

        // 处理交互（拖拽、缩放）
        processHandInteractions(landmarks, side, results);
      }

      // 处理双手拉伸交互
      processTwoHandInteraction(leftLandmarks, rightLandmarks);

      // 清理未检测到的手部状态（但保留拖拽/选中状态，因为它们可能暂时丢失）
      ['Left', 'Right'].forEach((side) => {
        if (!detectedSides.has(side as 'Left' | 'Right')) {
          handActions.setHandActive(side as 'Left' | 'Right', false);
          handActions.setTouching(side as 'Left' | 'Right', false);
          handActions.setPinching(side as 'Left' | 'Right', false, 0);
        }
      });

      // 绘制手部
      if (ctx) {
        drawHands(ctx, results);
      }
    } else {
      setStatus('No hands detected');
      // 没有手部时才重置所有状态
      handActions.resetHands();
    }
  }

  /**
   * 处理手部交互
   */
  function processHandInteractions(landmarks: Array<{ x: number; y: number; z: number }>, side: 'Left' | 'Right', results: any) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const spherePos = particleStore.spherePosition;
    const currentSpread = particleStore.currentSpread;

    // 检查是否接近粒子
    const thumbNear = isPointNearParticlesFromObject(thumbTip, spherePos, currentSpread);
    const indexNear = isPointNearParticlesFromObject(indexTip, spherePos, currentSpread);
    const bothTouching = thumbNear && indexNear;

    const pinchDistance = calculateDistance(
      { x: thumbTip.x, y: thumbTip.y, z: thumbTip.z },
      { x: indexTip.x, y: indexTip.y, z: indexTip.z }
    );

    handActions.setTouching(side, bothTouching);
    handActions.setPinching(side, pinchDistance < GESTURE_CONFIG.PINCH_THRESHOLD, pinchDistance);

    // 拖拽逻辑
    if (side === 'Right') {
      handleDragInteraction(landmarks, bothTouching, pinchDistance, spherePos, currentSpread);
    }
  }

  /**
   * 检查点是否接近粒子 (对象版本)
   */
  function isPointNearParticlesFromObject(point: { x: number; y: number }, spherePos: { x: number; y: number; z?: number }, spread: number): boolean {
    const worldPos = normalizedToWorld({ x: point.x, y: point.y });
    const dx = worldPos.x - spherePos.x;
    const dy = worldPos.y - spherePos.y;
    const dz = -(spherePos.z ?? 0);
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance < 2.0 * spread;
  }

  /**
   * 检查点是否接近粒子
   */
  function isPointNearParticles(point: number[], spherePos: { x: number; y: number; z?: number }, spread: number): boolean {
    const worldPos = normalizedToWorld({ x: point[0], y: point[1] });
    const dx = worldPos.x - spherePos.x;
    const dy = worldPos.y - spherePos.y;
    const dz = -(spherePos.z ?? 0);
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance < 2.0 * spread;
  }

  /**
   * 处理拖拽交互
   */
  function handleDragInteraction(
    landmarks: Array<{ x: number; y: number; z: number }>,
    bothTouching: boolean,
    pinchDistance: number,
    spherePos: { x: number; y: number; z?: number },
    currentSpread: number
  ) {
    const handState = handStore.right;

    if (handState.isSelected) {
      if (pinchDistance < GESTURE_CONFIG.PINCH_THRESHOLD) {
        const handWorldPos = normalizedToWorld({ x: landmarks[8].x, y: landmarks[8].y });
        particleActions.updateSpherePosition({
          x: handWorldPos.x - (handState.dragOffset?.x || 0),
          y: handWorldPos.y - (handState.dragOffset?.y || 0),
        });
      } else {
        handActions.setSelected('Right', false);
      }
    } else if (bothTouching && pinchDistance < GESTURE_CONFIG.PINCH_THRESHOLD) {
      handActions.setSelected('Right', true);
      const handWorldPos = normalizedToWorld({ x: landmarks[8].x, y: landmarks[8].y });
      handActions.setDragOffset('Right', {
        x: handWorldPos.x - spherePos.x,
        y: handWorldPos.y - spherePos.y,
        z: 0,
      });
    }
  }

  /**
   * 处理双手拉伸交互
   */
  function processTwoHandInteraction(
    leftLandmarks: Landmarks | null,
    rightLandmarks: Landmarks | null
  ) {
    if (!leftLandmarks || !rightLandmarks) {
      // 重置缩放模式
      if (handStore.zoomMode.active) {
        handActions.setZoomMode(false);
      }
      return;
    }

    // 检测双手缩放手势
    const previousDistance = handStore.previousHandsDistance;
    const zoomGesture = detectZoomGesture(leftLandmarks, rightLandmarks, previousDistance);

    // 更新手部距离记录
    if (zoomGesture.distance !== undefined) {
      handActions.setPreviousHandsDistance(zoomGesture.distance);
    }

    // 如果检测到缩放手势
    if (zoomGesture.isZoom && zoomGesture.direction) {
      if (!handStore.zoomMode.active) {
        // 开始缩放模式
        handActions.setZoomMode(true);
        handActions.setZoomInitials(
          particleStore.currentSpread,
          calculateDistance(
            { x: leftLandmarks[9].x, y: leftLandmarks[9].y, z: 0 },
            { x: rightLandmarks[9].x, y: rightLandmarks[9].y, z: 0 }
          ),
          calculateDistance(
            { x: leftLandmarks[9].x, y: leftLandmarks[9].y, z: 0 },
            { x: rightLandmarks[9].x, y: rightLandmarks[9].y, z: 0 }
          )
        );
      }

      // 计算缩放比例
      const initialSpread = handStore.zoomMode.initialSpread;
      const currentDistance = zoomGesture.distance || 1;
      const initialDistance = handStore.zoomMode.leftInitialDist || currentDistance;

      // 根据双手距离变化调整 spread
      const scaleFactor = currentDistance / initialDistance;
      const newSpread = Math.max(0.3, Math.min(5.0, initialSpread * scaleFactor));

      particleActions.setTargetSpread(newSpread);
    } else {
      // 没有缩放手势时，退出缩放模式
      if (handStore.zoomMode.active) {
        handActions.setZoomMode(false);
      }
    }
  }

  /**
   * 绘制手部
   */
  function drawHands(ctx: CanvasRenderingContext2D, results: any) {
    const HAND_CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17],
    ];

    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;

    // MediaPipe landmarks 是对象数组 {x, y, z}
    for (const landmarks of results.multiHandLandmarks) {
      // 为每只手单独绘制，避免连接线串联
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;

      // 绘制连接线
      ctx.beginPath();
      for (const [start, end] of HAND_CONNECTIONS) {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];

        ctx.moveTo(startPoint.x * width, startPoint.y * height);
        ctx.lineTo(endPoint.x * width, endPoint.y * height);
      }
      ctx.stroke();

      // 绘制关键点
      ctx.fillStyle = '#ffffff';
      for (const landmark of landmarks) {
        ctx.beginPath();
        ctx.arc(landmark.x * width, landmark.y * height, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * 处理窗口大小变化
   */
  function handleResize() {
    updateCanvasToMatchVideo();
  }

  /**
   * 初始化 MediaPipe
   */
  async function initMediaPipe() {
    try {
      // 创建视频和画布元素
      videoElement = document.getElementById('webcam') as HTMLVideoElement;
      canvasElement = document.createElement('canvas');
      document.body.appendChild(canvasElement);
      canvasElement.className = 'hand-overlay';

      // 初始化摄像头
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user',
        },
      });
      if (videoElement) {
        videoElement.srcObject = stream;
        await new Promise(resolve => {
          videoElement!.onloadedmetadata = resolve;
        });
        // 视频元数据加载完成后，更新 canvas 以匹配视频显示区域
        updateCanvasToMatchVideo();
      }

      // 初始化 MediaPipe Hands
      if (typeof window.Hands !== 'undefined') {
        hands = new window.Hands({
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

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        await hands.initialize();
        hands.onResults(onResults);

        // 启动相机
        if (typeof window.Camera !== 'undefined') {
          camera = new window.Camera(videoElement, {
            onFrame: async () => {
              await hands.send({ image: videoElement! });
            },
            width: 1920,
            height: 1080,
          });

          await camera.start();
        }
      }

      setStatus('Hand tracking ready!');
      setIsLoading(false);
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`);
      console.error('Error initializing MediaPipe:', error);
    }
  }

  /**
   * 挂载时初始化
   */
  onMount(() => {
    // 等待外部脚本加载
    const checkLibs = () => {
      if (typeof window.Hands !== 'undefined' && typeof window.Camera !== 'undefined') {
        initMediaPipe();
      } else {
        setTimeout(checkLibs, 100);
      }
    };
    checkLibs();

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);

    return () => {
      // 清理
      window.removeEventListener('resize', handleResize);
      if (camera) {
        camera.stop();
      }
      if (canvasElement && canvasElement.parentNode) {
        canvasElement.parentNode.removeChild(canvasElement);
      }
    };
  });

  return { status, isLoading };
}
