/**
 * HandOverlay 组件
 * 显示手势追踪的 Canvas 叠加层
 */

import { onMount, onCleanup } from 'solid-js';
import { handStore } from '@/stores/handStore';
import { HAND_CONNECTIONS } from '@/config';

export function HandOverlay() {
  let canvasRef: HTMLCanvasElement | undefined;
  let ctx: CanvasRenderingContext2D | null = null;

  /**
   * 绘制手部关键点和连接线
   */
  function drawHands() {
    if (!ctx || !canvasRef) return;

    // 清空画布
    ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);

    // 绘制左手
    if (handStore.left.active && handStore.left.landmarks) {
      drawHandLandmarks(handStore.left.landmarks, '#a855f7');
    }

    // 绘制右手
    if (handStore.right.active && handStore.right.landmarks) {
      drawHandLandmarks(handStore.right.landmarks, '#f97316');
    }

    // 继续动画循环
    requestAnimationFrame(drawHands);
  }

  /**
   * 绘制单只手的关键点
   */
  function drawHandLandmarks(landmarks: { x: number; y: number; z: number }[], color: string) {
    if (!ctx || !canvasRef) return;

    const width = canvasRef.width;
    const height = canvasRef.height;

    // 绘制连接线
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (const connection of HAND_CONNECTIONS) {
      const [start, end] = connection;
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

  /**
   * 处理窗口大小变化
   */
  function handleResize() {
    if (!canvasRef) return;
    canvasRef.width = window.innerWidth;
    canvasRef.height = window.innerHeight;
  }

  /**
   * 组件挂载
   */
  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);

    // 获取 Canvas 上下文
    if (canvasRef) {
      ctx = canvasRef.getContext('2d');
      drawHands();
    }
  });

  /**
   * 组件清理
   */
  onCleanup(() => {
    window.removeEventListener('resize', handleResize);
  });

  return (
    <canvas
      ref={canvasRef}
      class="hand-overlay"
      style={{
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        'pointer-events': 'none',
        'z-index': '10',
        transform: 'scaleX(-1)',
      }}
    />
  );
}
