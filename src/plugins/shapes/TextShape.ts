/**
 * 文字形状
 * 通过 Canvas 采样生成文字粒子位置
 */

import { ParticleShape } from './ParticleShape';
import type { ParticlePosition } from '@/core/types';

export class TextShape extends ParticleShape {
  private cache = new Map<string, ParticlePosition>();

  constructor(config?: { baseRadius?: number }) {
    super(config);
    this._name = 'text';
  }

  private _name: string;

  generateTargets(count: number, _time: number, text: string = 'hello'): ParticlePosition {
    const cacheKey = `${text}_${count}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const targets = this.generateTextTargets(text, count);
    this.cache.set(cacheKey, targets);
    return targets;
  }

  private generateTextTargets(text: string, count: number): ParticlePosition {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const textSize = 150;
    const width = 500;
    const height = 200;

    canvas.width = width;
    canvas.height = height;

    // 绘制
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${textSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels: { x: number; y: number; z: number }[] = [];

    const sampleStep = 3;
    const mirrorX = -1;

    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const i = (y * width + x) * 4;
        if (imageData.data[i] > 128) {
          pixels.push({
            x: (x - width / 2) * 0.015 * mirrorX,
            y: -(y - height / 2) * 0.015,
            z: 0,
          });
        }
      }
    }

    const targets = new Float32Array(count * 3);
    const textPixelCount = Math.min(pixels.length, count);

    for (let i = 0; i < textPixelCount; i++) {
      targets[i * 3] = pixels[i].x;
      targets[i * 3 + 1] = pixels[i].y;
      targets[i * 3 + 2] = pixels[i].z;
    }

    // 多余粒子形成星云
    for (let i = textPixelCount; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.5 + Math.random() * 0.8;
      targets[i * 3] = Math.cos(angle) * radius;
      targets[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
      targets[i * 3 + 2] = Math.sin(angle) * radius;
    }

    return targets;
  }

  getName(): string {
    return this._name;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
