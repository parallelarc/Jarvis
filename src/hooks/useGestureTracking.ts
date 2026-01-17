/**
 * 手势追踪 Hook
 * 管理 MediaPipe Hands 和相机输入，以及 SVG 对象交互
 */

import { createSignal, onMount, onCleanup } from 'solid-js';
import { handStore, handActions } from '@/stores/handStore';
import { animationActions } from '@/stores/animationStore';
import { objectStore, objectActions } from '@/stores/objectStore';
import { GESTURE_CONFIG } from '@/config';
import { detectHandGestures } from '@/domain/GestureDetector';
import { normalizedToWorld, calculateDistance } from '@/utils/math';
import type { Landmarks } from '@/core/types';

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
   * 获取显示区域
   * 当使用静态背景时，直接返回窗口尺寸
   */
  function getVideoDisplayArea() {
    return {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  /**
   * 根据优先级获取主手势名称
   */
  function getPrimaryGesture(gestures: {
    pointing: boolean;
    victory: boolean;
    thumbsUp: boolean;
    thumbsDown: boolean;
    ok: boolean;
    callMe: boolean;
    rockOn: boolean;
    openPalm: boolean;
    fist: boolean;
  }): string | null {
    if (gestures.pointing) return 'Pointing';
    if (gestures.victory) return 'Victory';
    if (gestures.ok) return 'OK';
    if (gestures.thumbsUp) return 'Thumbs Up';
    if (gestures.thumbsDown) return 'Thumbs Down';
    if (gestures.callMe) return 'Call Me';
    if (gestures.rockOn) return 'Rock On';
    if (gestures.openPalm) return 'Open Palm';
    if (gestures.fist) return 'Fist';
    return null;
  }

  /**
   * 检查点是否接近对象（基于位置距离）
   */
  function isPointNearObject(
    point: { x: number; y: number },
    objectPosition: { x: number; y: number; z?: number },
    threshold: number = 1.5
  ): boolean {
    const worldPos = normalizedToWorld({ x: point.x, y: point.y });
    const dx = worldPos.x - objectPosition.x;
    const dy = worldPos.y - objectPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < threshold;
  }

  /**
   * 更新 canvas 以匹配视频显示区域
   */
  function updateCanvasToMatchVideo() {
    if (!canvasElement) return;

    const area = getVideoDisplayArea();

    canvasElement.width = area.width;
    canvasElement.height = area.height;

    canvasElement.style.left = `${area.left}px`;
    canvasElement.style.top = `${area.top}px`;
    canvasElement.style.width = `${area.width}px`;
    canvasElement.style.height = `${area.height}px`;
  }

  /**
   * 处理 MediaPipe 结果
   */
  function onResults(results: any) {
    updateCanvasToMatchVideo();

    const ctx = canvasElement?.getContext('2d');
    if (ctx && canvasElement) {
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      setStatus(`${results.multiHandLandmarks.length} hand(s) detected`);

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

        // 检测手势状态
        try {
          if (landmarks && landmarks.length > 0) {
            const gestureResult = detectHandGestures(landmarks as Landmarks, side);
            const primaryGesture = getPrimaryGesture(gestureResult.gestures);
            handActions.setGesture(
              side,
              primaryGesture,
              gestureResult.fingers,
              gestureResult.palm.direction,
              gestureResult.pinch.pinchingFinger
            );
          }
        } catch (error) {
          console.warn('[Gesture Detection] Error:', error);
        }

        // 收集手部 landmarks 用于交互
        if (side === 'Left') {
          leftLandmarks = landmarks as Landmarks;
        } else {
          rightLandmarks = landmarks as Landmarks;
        }

        // 处理触摸检测
        processTouchDetection(landmarks, side);

        // 处理拖拽交互（仅右手）
        if (side === 'Right') {
          processDragInteraction(landmarks, side);
        }
      }

      // 处理双手缩放交互
      processScaleInteraction(leftLandmarks, rightLandmarks);

      // 清理未检测到的手部状态
      ['Left', 'Right'].forEach((side) => {
        if (!detectedSides.has(side as 'Left' | 'Right')) {
          handActions.setHandActive(side as 'Left' | 'Right', false);
          handActions.setTouching(side as 'Left' | 'Right', false);
          handActions.setPinching(side as 'Left' | 'Right', false, 0);
          handActions.setGesture(side as 'Left' | 'Right', null);
        }
      });

      // 绘制手部
      if (ctx) {
        drawHands(ctx, results);
      }
    } else {
      setStatus('No hands detected');
      handActions.resetHands();
      // 重置选中状态
      objectActions.selectObject(null);
    }
  }

  /**
   * 处理触摸检测
   */
  function processTouchDetection(
    landmarks: Array<{ x: number; y: number; z: number }>,
    side: 'Left' | 'Right'
  ) {
    const indexTip = landmarks[8];
    let isTouching = false;

    for (const [id, objState] of Object.entries(objectStore.objects)) {
      if (isPointNearObject(indexTip, objState.position)) {
        isTouching = true;
        break;
      }
    }

    handActions.setTouching(side, isTouching);
  }

  /**
   * 处理拖拽交互
   */
  function processDragInteraction(
    landmarks: Array<{ x: number; y: number; z: number }>,
    side: 'Left' | 'Right'
  ) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const pinchDistance = calculateDistance(
      { x: thumbTip.x, y: thumbTip.y, z: thumbTip.z },
      { x: indexTip.x, y: indexTip.y, z: indexTip.z }
    );

    handActions.setPinching(side, pinchDistance < GESTURE_CONFIG.PINCH_THRESHOLD, pinchDistance);

    const handState = side === 'Left' ? handStore.left : handStore.right;
    const selectedId = objectStore.selectedObjectId;

    // 缩放模式下禁用拖拽
    if (handStore.zoomMode.active) return;

    if (selectedId) {
      // 已选中对象，继续拖拽
      if (handState.isSelected && pinchDistance < GESTURE_CONFIG.PINCH_THRESHOLD) {
        const handWorldPos = normalizedToWorld({ x: indexTip.x, y: indexTip.y });
        const newPosition = {
          x: handWorldPos.x - (handState.dragOffset?.x || 0),
          y: handWorldPos.y - (handState.dragOffset?.y || 0),
        };
        objectActions.updateObjectPosition(selectedId, newPosition);

        // 同步更新 Three.js 对象
        const sceneAPI = (window as any).svgSceneAPI;
        if (sceneAPI) {
          const svgObjects = sceneAPI.getSVGObjects();
          const svgObj = svgObjects?.get(selectedId);
          if (svgObj) {
            svgObj.updatePosition({ x: newPosition.x, y: newPosition.y, z: 0 });
          }
        }
      } else {
        // 释放选中
        handActions.setSelected(side, false);
        objectActions.selectObject(null);

        // 取消对象高亮
        const sceneAPI = (window as any).svgSceneAPI;
        if (sceneAPI) {
          const svgObjects = sceneAPI.getSVGObjects();
          svgObjects?.forEach(obj => obj.setSelected(false));
        }
      }
    } else {
      // 尝试选中对象
      if (pinchDistance < GESTURE_CONFIG.PINCH_THRESHOLD) {
        let closestId: string | null = null;
        let closestDist = Infinity;

        for (const [id, objState] of Object.entries(objectStore.objects)) {
          if (isPointNearObject(indexTip, objState.position)) {
            const handWorldPos = normalizedToWorld({ x: indexTip.x, y: indexTip.y });
            const dist = Math.sqrt(
              Math.pow(handWorldPos.x - objState.position.x, 2) +
              Math.pow(handWorldPos.y - objState.position.y, 2)
            );
            if (dist < closestDist) {
              closestDist = dist;
              closestId = id;
            }
          }
        }

        if (closestId && closestDist < 1.5) {
          handActions.setSelected(side, true);
          objectActions.selectObject(closestId);

          const handWorldPos = normalizedToWorld({ x: indexTip.x, y: indexTip.y });
          const objState = objectStore.objects[closestId];
          handActions.setDragOffset(side, {
            x: handWorldPos.x - objState.position.x,
            y: handWorldPos.y - objState.position.y,
            z: 0,
          });

          // 高亮选中对象
          const sceneAPI = (window as any).svgSceneAPI;
          if (sceneAPI) {
            const svgObjects = sceneAPI.getSVGObjects();
            const svgObj = svgObjects?.get(closestId);
            if (svgObj) {
              svgObj.setSelected(true);
            }
          }
        }
      }
    }
  }

  /**
   * 处理双手缩放交互
   */
  function processScaleInteraction(
    leftLandmarks: Landmarks | null,
    rightLandmarks: Landmarks | null
  ) {
    if (!leftLandmarks || !rightLandmarks) {
      if (handStore.zoomMode.active) {
        handActions.setZoomMode(false);
        handActions.setPreviousHandsDistance(null);
      }
      return;
    }

    const selectedId = objectStore.selectedObjectId;
    if (!selectedId) return;

    const leftPinching = handStore.left.isPinching;
    const rightPinching = handStore.right.isPinching;

    if (!leftPinching || !rightPinching) {
      if (handStore.zoomMode.active) {
        handActions.setZoomMode(false);
        handActions.setPreviousHandsDistance(null);
      }
      return;
    }

    const currentDistance = calculateDistance(
      { x: leftLandmarks[9].x, y: leftLandmarks[9].y, z: 0 },
      { x: rightLandmarks[9].x, y: rightLandmarks[9].y, z: 0 }
    );

    if (!handStore.zoomMode.active) {
      const objState = objectStore.objects[selectedId];
      handActions.setZoomMode(true);
      handActions.setZoomInitials(
        objState.scale,
        currentDistance,
        currentDistance
      );
      handActions.setPreviousHandsDistance(currentDistance);
      return;
    }

    const initialScale = handStore.zoomMode.initialSpread;
    const initialDistance = handStore.zoomMode.leftInitialDist;
    const scaleFactor = currentDistance / initialDistance;
    const newScale = Math.max(0.2, Math.min(5.0, initialScale * scaleFactor));

    objectActions.updateObjectScale(selectedId, newScale);

    // 同步更新 Three.js 对象
    const sceneAPI = (window as any).svgSceneAPI;
    if (sceneAPI) {
      const svgObjects = sceneAPI.getSVGObjects();
      const svgObj = svgObjects?.get(selectedId);
      if (svgObj) {
        svgObj.setScale(newScale);
      }
    }

    handActions.setPreviousHandsDistance(currentDistance);
  }

  /**
   * 绘制手部
   */
  function drawHands(ctx: CanvasRenderingContext2D, results: any) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      return;
    }

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

    for (const landmarks of results.multiHandLandmarks) {
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
      videoElement = document.getElementById('webcam') as HTMLVideoElement;

      const existingCanvas = document.querySelector('.hand-overlay');
      if (existingCanvas) {
        canvasElement = existingCanvas as HTMLCanvasElement;
      } else {
        canvasElement = document.createElement('canvas');
        document.body.appendChild(canvasElement);
        canvasElement.className = 'hand-overlay';
      }

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
        updateCanvasToMatchVideo();
      }

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
    const checkLibs = () => {
      if (typeof window.Hands !== 'undefined' && typeof window.Camera !== 'undefined') {
        initMediaPipe();
      } else {
        setTimeout(checkLibs, 100);
      }
    };
    checkLibs();

    window.addEventListener('resize', handleResize);

    return () => {
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
