/**
 * SVG 资源注册表
 * 管理 SVG 对象的加载和纹理转换
 */

import type * as THREE from 'three';

export interface SVGAsset {
  id: 'v' | 'b' | 'o' | 't' | 'flower' | 'bot';
  name: string;
  path: string;
  texture?: THREE.Texture;
}

export const SVG_ASSETS: SVGAsset[] = [
  { id: 'v', name: 'Letter V', path: '/assets/v.svg' },
  { id: 'b', name: 'Letter B', path: '/assets/b.svg' },
  { id: 'o', name: 'Letter O', path: '/assets/o.svg' },
  { id: 't', name: 'Letter T', path: '/assets/t.svg' },
  { id: 'flower', name: 'Flower', path: '/assets/flower.svg' },
  { id: 'bot', name: 'Robot', path: '/assets/bot.svg' },
];

export class SVGRegistry {
  private static textures: Map<string, THREE.Texture> = new Map();

  /**
   * 将 SVG 转换为 DataURL
   */
  private static async svgToDataURL(svgText: string): Promise<string> {
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }

  /**
   * 加载单个 SVG 文件并转换为纹理
   */
  static async loadTexture(asset: SVGAsset): Promise<THREE.Texture> {
    // 检查缓存
    if (this.textures.has(asset.id)) {
      return this.textures.get(asset.id)!;
    }

    try {
      const response = await fetch(asset.path);
      if (!response.ok) {
        throw new Error(`Failed to fetch SVG: ${asset.path}`);
      }

      const svgText = await response.text();
      const dataUrl = await this.svgToDataURL(svgText);

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const texture = new (window.THREE as any).Texture(img);
          texture.needsUpdate = true;
          texture.colorSpace = (window.THREE as any).SRGBColorSpace;
          this.textures.set(asset.id, texture);
          resolve(texture);
        };
        img.onerror = () => reject(new Error(`Failed to load image: ${asset.path}`));
        img.src = dataUrl;
      });
    } catch (error) {
      console.error(`[SVGRegistry] Error loading ${asset.id}:`, error);
      throw error;
    }
  }

  /**
   * 加载所有 SVG 纹理
   */
  static async loadAllTextures(): Promise<THREE.Texture[]> {
    const promises = SVG_ASSETS.map(asset => this.loadTexture(asset));
    return Promise.all(promises);
  }

  /**
   * 获取已加载的纹理
   */
  static getTexture(id: string): THREE.Texture | undefined {
    return this.textures.get(id);
  }

  /**
   * 释放所有纹理资源
   */
  static dispose(): void {
    this.textures.forEach(texture => texture.dispose());
    this.textures.clear();
  }

  /**
   * 释放指定纹理
   */
  static disposeTexture(id: string): void {
    const texture = this.textures.get(id);
    if (texture) {
      texture.dispose();
      this.textures.delete(id);
    }
  }
}
