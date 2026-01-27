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
import { onFaceResults } from '@/services/FaceDetectionService';
import { processTouchDetection } from '@/services/TouchDetectionService';
import {
  processDragInteraction,
  deselectAll,
} from '@/services/DragInteractionService';
import { processScaleInteraction } from '@/services/ZoomInteractionService';
import { processRotationInteraction } from '@/services/RotationInteractionService';
import { autoResetService } from '@/services/AutoResetService';
import type { Landmarks } from '@/core/types';

// 全局 MediaPipe FPS 信号（供 DebugPanel 读取）
const [mediaPipeFps, setMediaPipeFps] = createSignal(0);

export function getMediaPipeFps() {
  return mediaPipeFps();
}

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
    // 注意：手部骨架绘制由 HandOverlay 组件统一管理
    // 不需要在此处获取 Canvas 上下文
    mediaPipeService?.updateCanvasSize();

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

        // 处理拖拽/旋转交互
        if (side === 'Left') {
          // 左手：先处理 click 选择（读取旧状态），再处理旋转（更新 pinch 状态）
          // 这样确保两个服务都使用相同的 wasPinching 状态进行边沿检测
          processDragInteraction(landmarks, side, handActions, true);
          processRotationInteraction(landmarks, side, handActions);
        } else {
          // 右手：处理 click 选择 + 拖拽（管理 pinch 状态）
          processDragInteraction(landmarks, side, handActions, false);
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

      // 注意：手部骨架绘制由 HandOverlay 组件统一管理
      // 不在此处调用 drawHands，避免与 HandOverlay 的 Canvas 冲突
      // HandOverlay 使用独立的 requestAnimationFrame 循环，支持左右手不同颜色

      // 检查自动复位
      autoResetService.checkHandsState();
    } else {
      setStatus('No hands detected');
      handActions.resetHands();
      // 重置选中状态并隐藏所有轮廓
      deselectAll();

      // 检查自动复位（无手情况）
      autoResetService.checkHandsState();
    }
  }

  /**
   * 初始化 MediaPipe 服务
   */
  async function initMediaPipe() {
    const callbacks: MediaPipeCallbacks = {
      onResults,
      onFaceResults,
      setStatus,
      onLoadingChange: setIsLoading,
      onMediaPipeFpsUpdate: setMediaPipeFps,
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
      // 只需要检查 Hands，Camera API 已被 CustomFrameSender 替代
      if (typeof window.Hands !== 'undefined') {
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
