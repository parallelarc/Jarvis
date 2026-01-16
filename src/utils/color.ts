/**
 * 颜色工具函数
 */

import type { Color } from '@/core/types';

/**
 * 混合两种颜色
 */
export function blendColors(color1: Color, color2: Color, ratio: number): Color {
  return {
    r: color1.r * (1 - ratio) + color2.r * ratio,
    g: color1.g * (1 - ratio) + color2.g * ratio,
    b: color1.b * (1 - ratio) + color2.b * ratio,
  };
}

/**
 * 将十六进制颜色转换为RGB对象
 */
export function hexToRgb(hex: number): Color {
  return {
    r: ((hex >> 16) & 255) / 255,
    g: ((hex >> 8) & 255) / 255,
    b: (hex & 255) / 255,
  };
}

/**
 * RGB对象转十六进制
 */
export function rgbToHex(rgb: Color): number {
  return (
    ((Math.round(rgb.r * 255) & 0xff) << 16) |
    ((Math.round(rgb.g * 255) & 0xff) << 8) |
    (Math.round(rgb.b * 255) & 0xff)
  );
}
