/**
 * 纹理工具函数
 */

/**
 * 创建蓝色轮廓纹理（Affinity 风格）
 * 用于 SVG 对象的选中高亮效果
 */
export function createOutlineTexture(): any {
  const canvas = document.createElement('canvas');
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 清空画布
  ctx.clearRect(0, 0, size, size);

  // 绘制蓝色边框轮廓
  const borderWidth = 16;
  const cornerRadius = 32;
  const padding = borderWidth / 2;

  ctx.strokeStyle = '#4A90E2';
  ctx.lineWidth = borderWidth;
  ctx.lineJoin = 'round';

  // 绘制圆角矩形边框
  ctx.beginPath();
  ctx.moveTo(padding + cornerRadius, padding);
  ctx.lineTo(size - padding - cornerRadius, padding);
  ctx.quadraticCurveTo(size - padding, padding, size - padding, padding + cornerRadius);
  ctx.lineTo(size - padding, size - padding - cornerRadius);
  ctx.quadraticCurveTo(size - padding, size - padding, size - padding - cornerRadius, size - padding);
  ctx.lineTo(padding + cornerRadius, size - padding);
  ctx.quadraticCurveTo(padding, size - padding, padding, size - padding - cornerRadius);
  ctx.lineTo(padding, padding + cornerRadius);
  ctx.quadraticCurveTo(padding, padding, padding + cornerRadius, padding);
  ctx.closePath();
  ctx.stroke();

  const texture = new (window.THREE as any).CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
