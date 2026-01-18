/**
 * 手势追踪 Hook
 * 管理 MediaPipe Hands 和相机输入，以及 SVG 对象交互
 */

import { createSignal, onMount, onCleanup } from 'solid-js';
import { handStore, handActions } from '@/stores/handStore';
import { animationActions } from '@/stores/animationStore';
import { objectStore, objectActions } from '@/stores/objectStore';
import { GESTURE_CONFIG, HAND_CONNECTIONS, INTERACTION_CONFIG } from '@/config';
import { detectHandGestures } from '@/domain/GestureDetector';
import { normalizedToWorld, calculateDistance } from '@/utils/math';
import {
  findObjectUnderPoint,
  syncSVGObjectPosition,
  syncSVGObjectScale,
  syncSVGObjectSelected,
  syncAllSVGObjectsSelected,
} from '@/utils/three-sync';
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
          handActions.resetHandState(side as 'Left' | 'Right');
        }
      });

      // 绘制手部
      if (ctx) {
        drawHands(ctx, results);
      }
    } else {
      setStatus('No hands detected');
      handActions.resetHands();
      // 重置选中状态并隐藏所有轮廓
      deselectAll();
    }
  }

  /**
   * 处理触摸检测（基于 bbox）
   */
  function processTouchDetection(
    landmarks: Array<{ x: number; y: number; z: number }>,
    side: 'Left' | 'Right'
  ) {
    const indexTip = landmarks[8];
    const touchedId = findObjectUnderFinger(indexTip);

    handActions.setTouching(side, touchedId !== null);
    handActions.setTouchedObjectId(side, touchedId);
  }

  /**
   * 查找手指下的对象（基于 bbox）
   * 使用 three-sync 工具函数进行精确的碰撞检测
   */
  function findObjectUnderFinger(
    indexTip: { x: number; y: number }
  ): string | null {
    const handWorldPos = normalizedToWorld({ x: indexTip.x, y: indexTip.y });
    return findObjectUnderPoint(handWorldPos);
  }

  /**
   * 处理拖拽交互 - 点击选中 + 捏合拖拽
   *
   * 点击 = 捏合开始（手指合起）+ 捏合结束（手指分开）的完整动作
   * 点击必须在配置的时间限制内完成才算"干脆的点击"
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
    const isPinching = pinchDistance < GESTURE_CONFIG.PINCH_THRESHOLD;

    const handState = side === 'Left' ? handStore.left : handStore.right;
    const currentSelectedId = objectStore.selectedObjectId;

    // 缩放模式下禁用拖拽
    if (handStore.zoomMode.active) return;

    // === 检测捏合边沿 ===
    const pinchStart = !handState.wasPinching && isPinching;  // 上升沿：手指合起
    const pinchEnd = handState.wasPinching && !isPinching;    // 下降沿：手指分开

    // 更新上一帧状态
    handActions.setWasPinching(side, isPinching);
    handActions.setPinching(side, isPinching, pinchDistance);

    const touchedId = findObjectUnderFinger(indexTip);

    // === 捏合开始：记录手指下的对象和时间 ===
    if (pinchStart) {
      handActions.setPinchStartObject(side, touchedId);
      handActions.setPinchStartTime(side, Date.now());
    }

    // === 捏合结束：检测是否完成点击 ===
    if (pinchEnd) {
      const pinchStartId = handState.pinchStartObjectId;
      const pinchDuration = Date.now() - handState.pinchStartTime;
      const isQuickClick = pinchDuration < INTERACTION_CONFIG.CLICK_TIMEOUT_MS;

      if (pinchStartId && pinchStartId === touchedId && isQuickClick) {
        // 在同一对象上完成快速点击
        if (currentSelectedId !== pinchStartId) {
          // 点击新对象：切换选中
          selectObject(pinchStartId);
        }
        // 如果点击已选中的对象：无操作（保持选中）
      } else if (touchedId === null && pinchStartId === null && isQuickClick) {
        // 在空白处完成快速点击：取消选中
        deselectAll();
      }
      // 超时或不在同一对象上 → 不算点击，忽略

      // 清除捏合开始记录
      handActions.setPinchStartObject(side, null);
      // 停止拖拽
      if (handState.isDragging) {
        handActions.setDragging(side, false);
      }
      return;
    }

    // === 捏合中：处理拖拽 ===
    if (isPinching && currentSelectedId) {
      if (touchedId === currentSelectedId) {
        // 捏合已选中的对象：开始/继续拖拽
        if (!handState.isDragging) {
          startDragging(currentSelectedId, indexTip);
        }
        updateObjectPosition(currentSelectedId, indexTip);
      }
    }
  }

  /**
   * 选中对象
   */
  function selectObject(id: string) {
    // 先隐藏所有对象的高亮
    syncAllSVGObjectsSelected(false);

    objectActions.selectObject(id);

    // 显示选中轮廓
    syncSVGObjectSelected(id, true);
  }

  /**
   * 开始拖拽
   */
  function startDragging(id: string, indexTip: { x: number; y: number }) {
    const handWorldPos = normalizedToWorld({ x: indexTip.x, y: indexTip.y });
    const objState = objectStore.objects[id];

    handActions.setDragOffset('Right', {
      x: handWorldPos.x - objState.position.x,
      y: handWorldPos.y - objState.position.y,
      z: 0,
    });
    handActions.setDragging('Right', true);
  }

  /**
   * 更新对象位置（拖拽中）
   */
  function updateObjectPosition(id: string, indexTip: { x: number; y: number }) {
    const handState = handStore.right;
    const handWorldPos = normalizedToWorld({ x: indexTip.x, y: indexTip.y });
    const newPosition = {
      x: handWorldPos.x - (handState.dragOffset?.x || 0),
      y: handWorldPos.y - (handState.dragOffset?.y || 0),
    };

    objectActions.updateObjectPosition(id, newPosition);

    // 同步更新 Three.js 对象
    syncSVGObjectPosition(id, { x: newPosition.x, y: newPosition.y, z: 0 });
  }

  /**
   * 取消所有选中
   */
  function deselectAll() {
    // 取消对象高亮
    syncAllSVGObjectsSelected(false);
    objectActions.selectObject(null);
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
        currentDistance
      );
      handActions.setPreviousHandsDistance(currentDistance);
      return;
    }

    const initialScale = handStore.zoomMode.initialSpread;
    const initialDistance = handStore.zoomMode.leftInitialDist;
    const scaleFactor = currentDistance / initialDistance;
    const newScale = Math.max(
      INTERACTION_CONFIG.SCALE_MIN,
      Math.min(INTERACTION_CONFIG.SCALE_MAX, initialScale * scaleFactor)
    );

    objectActions.updateObjectScale(selectedId, newScale);

    // 同步更新 Three.js 对象
    syncSVGObjectScale(selectedId, newScale);

    handActions.setPreviousHandsDistance(currentDistance);
  }

  /**
   * 绘制手部
   */
  function drawHands(ctx: CanvasRenderingContext2D, results: any) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      return;
    }

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
