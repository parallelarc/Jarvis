/**
 * 手势追踪 Hook
 * 编排各个服务模块，管理生命周期
 */

import { createSignal, onMount, onCleanup } from 'solid-js';
import { handStore, handActions } from '@/stores/handStore';
import { detectHandGestures } from '@/domain/GestureDetector';
import {
  createMediaPipeService,
  type MediaPipeCallbacks,
  type MediaPipeResult,
} from '@/services/MediaPipeService';
import { processTouchDetection } from '@/services/TouchDetectionService';
import {
  processDragInteraction,
  deselectAll,
} from '@/services/DragInteractionService';
import { processScaleInteraction } from '@/services/ZoomInteractionService';
import { drawHands } from '@/services/HandDrawingService';
import type { Landmarks } from '@/core/types';

export function useGestureTracking() {
  const [status, setStatus] = createSignal('Initializing MediaPipe...');
  const [isLoading, setIsLoading] = createSignal(true);

  let mediaPipeService: ReturnType<typeof createMediaPipeService> | null = null;

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
   * 处理 MediaPipe 结果
   */
  function onResults(results: MediaPipeResult) {
    const canvas = mediaPipeService?.getCanvas();
    mediaPipeService?.updateCanvasSize();

    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      setStatus(`${results.multiHandLandmarks.length} hand(s) detected`);

      const detectedSides = new Set<'Left' | 'Right'>();
      let leftLandmarks: Landmarks | null = null;
      let rightLandmarks: Landmarks | null = null;

      // 处理每只手
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const side = results.multiHandedness![i].label as 'Left' | 'Right';
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
        processTouchDetection(landmarks, side, handActions);

        // 处理拖拽交互（仅右手）
        if (side === 'Right') {
          processDragInteraction(landmarks, side, handActions);
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
   * 初始化 MediaPipe 服务
   */
  async function initMediaPipe() {
    const callbacks: MediaPipeCallbacks = {
      onResults,
      setStatus,
      onLoadingChange: setIsLoading,
    };

    mediaPipeService = createMediaPipeService(callbacks);
    await mediaPipeService.init();
  }

  /**
   * 处理窗口大小变化
   */
  function handleResize() {
    mediaPipeService?.updateCanvasSize();
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
      mediaPipeService?.destroy();
    };
  });

  return { status, isLoading };
}
