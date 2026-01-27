/**
 * HandOverlay 组件
 * 显示手势追踪的 Canvas 叠加层
 * 用圆点表示左右手位置
 */

import { onMount, onCleanup } from 'solid-js';
import { handStore } from '@/stores/handStore';
import { HAND_OVERLAY_CONFIG } from '@/config';
import { isFaceInCenter } from '@/services/FaceDetectionService';

export function HandOverlay() {
  let canvasRef: HTMLCanvasElement | undefined;
  let ctx: CanvasRenderingContext2D | null = null;
  let animationId: number | null = null;

  /**
   * 绘制手部圆点
   */
  function drawHands() {
    if (!canvasRef || !ctx) return;

    // 只有在面部正前方时才显示手部指示点
    if (!isFaceInCenter()) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      animationId = requestAnimationFrame(drawHands);
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 绘制左手圆点（紫色）- 食指和拇指的中点位置
    if (handStore.left.active && handStore.left.landmarks) {
      const indexTip = handStore.left.landmarks[8]; // 食指尖端
      const thumbTip = handStore.left.landmarks[4]; // 拇指尖端
      const x = width - ((indexTip.x + thumbTip.x) / 2) * width; // 镜像 x 坐标
      const y = ((indexTip.y + thumbTip.y) / 2) * height;

      // 外圈光晕
      ctx.beginPath();
      ctx.arc(x, y, HAND_OVERLAY_CONFIG.OUTER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = HAND_OVERLAY_CONFIG.LEFT_HAND.GLOW;
      ctx.fill();

      // 内圈
      ctx.beginPath();
      ctx.arc(x, y, HAND_OVERLAY_CONFIG.INNER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = HAND_OVERLAY_CONFIG.LEFT_HAND.PRIMARY;
      ctx.fill();

      // 标签
      ctx.fillStyle = '#ffffff';
      ctx.font = HAND_OVERLAY_CONFIG.FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(HAND_OVERLAY_CONFIG.LEFT_HAND.LABEL, x, y);
    }

    // 绘制右手圆点（橙色）- 食指和拇指的中点位置
    if (handStore.right.active && handStore.right.landmarks) {
      const indexTip = handStore.right.landmarks[8]; // 食指尖端
      const thumbTip = handStore.right.landmarks[4]; // 拇指尖端
      const x = width - ((indexTip.x + thumbTip.x) / 2) * width; // 镜像 x 坐标
      const y = ((indexTip.y + thumbTip.y) / 2) * height;

      // 外圈光晕
      ctx.beginPath();
      ctx.arc(x, y, HAND_OVERLAY_CONFIG.OUTER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = HAND_OVERLAY_CONFIG.RIGHT_HAND.GLOW;
      ctx.fill();

      // 内圈
      ctx.beginPath();
      ctx.arc(x, y, HAND_OVERLAY_CONFIG.INNER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = HAND_OVERLAY_CONFIG.RIGHT_HAND.PRIMARY;
      ctx.fill();

      // 标签
      ctx.fillStyle = '#ffffff';
      ctx.font = HAND_OVERLAY_CONFIG.FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(HAND_OVERLAY_CONFIG.RIGHT_HAND.LABEL, x, y);
    }

    animationId = requestAnimationFrame(drawHands);
  }

  /**
   * 设置 canvas 尺寸
   */
  function setupCanvas() {
    if (!canvasRef) return;
    canvasRef.width = window.innerWidth;
    canvasRef.height = window.innerHeight;
    ctx = canvasRef.getContext('2d');
  }

  onMount(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    drawHands();
  });

  onCleanup(() => {
    window.removeEventListener('resize', setupCanvas);
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }
  });

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        'pointer-events': 'none',
        'z-index': '100',
      }}
    />
  );
}
