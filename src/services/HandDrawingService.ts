/**
 * 手部绘制服务
 * 负责 Canvas 覆盖层绘制
 */

import { HAND_CONNECTIONS } from '@/config';

/**
 * 绘制手部
 */
export function drawHands(
  ctx: CanvasRenderingContext2D,
  results: { multiHandLandmarks: Array<Array<{ x: number; y: number; z: number }>> | null }
) {
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
