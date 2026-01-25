/**
 * SVG 资源注册表
 * 管理 SVG 对象的加载和纹理转换
 */

import type * as THREE from 'three';
import { THREE as THREE_GLOBAL } from '@/utils/three';

export interface SVGSize {
  width: number;
  height: number;
}

export interface SVGAsset {
  id: 'v' | 'b' | 'o' | 't' | 'flower' | 'bot';
  name: string;
  path: string;
  texture?: THREE.Texture;
  originalSize?: SVGSize;  // SVG 原始尺寸（从 viewBox 获取）
}

export interface SVGShapeData {
    shape: THREE.Shape;
    color: THREE.Color;
    opacity: number;
}

export const SVG_ASSETS: SVGAsset[] = [
  { id: 'v', name: 'Letter V', path: '/assets/v.svg' },
  { id: 'b', name: 'Letter B', path: '/assets/b.svg' },
  { id: 'o', name: 'Letter O', path: '/assets/o.svg' },
  { id: 't', name: 'Letter T', path: '/assets/t.svg' },
  { id: 'flower', name: 'Flower', path: '/assets/flower.svg' },
  { id: 'bot', name: 'Robot', path: '/assets/bot.svg' },
];

export const SVG_OBJECT_IDS = ['v', 'b', 'o', 't', 'flower', 'bot'] as const;

export class SVGRegistry {
  private static textures: Map<string, THREE.Texture> = new Map();
  private static sizes: Map<string, SVGSize> = new Map();
  private static shapeData: Map<string, SVGShapeData[]> = new Map();

  /**
   * 从 SVG 文本中解析原始尺寸
   * 优先使用 viewBox，否则使用 width/height 属性
   */
  private static parseSVGSize(svgText: string): SVGSize {
    // 尝试解析 viewBox
    const viewBoxMatch = svgText.match(/viewBox\s*=\s*["']([^"']+)["']/);
    if (viewBoxMatch) {
      const values = viewBoxMatch[1].trim().split(/\s+/).map(Number);
      if (values.length === 4 && !values.some(isNaN)) {
        return { width: values[2], height: values[3] };
      }
    }

    // 尝试解析 width/height 属性
    const widthMatch = svgText.match(/width\s*=\s*["']([^"']+)["']/);
    const heightMatch = svgText.match(/height\s*=\s*["']([^"']+)["']/);

    if (widthMatch && heightMatch) {
      const width = parseFloat(widthMatch[1]);
      const height = parseFloat(heightMatch[1]);
      if (!isNaN(width) && !isNaN(height)) {
        return { width, height };
      }
    }

    // 默认返回正方形
    return { width: 1, height: 1 };
  }

  /**
   * 解析 SVG 路径为 SVGShapeData 数组
   * 使用 SVGLoader 将 SVG 路径数据转换为可拉伸的 3D 形状 (包含颜色信息)
   */
  private static async parseSVGPaths(svgText: string): Promise<SVGShapeData[]> {
    // 使用 importmap 导入 SVGLoader
    try {
      console.log('[SVGRegistry] Attempting to import SVGLoader...');
      const module = await import('three/addons/loaders/SVGLoader.js');
      console.log('[SVGRegistry] SVGLoader module loaded:', Object.keys(module));
      const SVGLoader = (module as any).SVGLoader || (module as any).default;

      if (!SVGLoader) {
        console.warn('[SVGRegistry] SVGLoader not available in module');
        return [];
      }

      console.log('[SVGRegistry] Creating SVGLoader instance...');
      const loader = new SVGLoader();
      const data = loader.parse(svgText);

      console.log('[SVGRegistry] SVG parsed:', {
        pathCount: data.paths.length,
        paths: data.paths.map((p: any) => ({ subPaths: p.subPaths?.length, color: p.color }))
      });

      const shapeDataList: SVGShapeData[] = [];
      data.paths.forEach((path: any, pathIndex: number) => {
        // 对于evenodd填充规则的SVG，让SVGLoader自动检测方向
        const pathShapes = path.toShapes();
        const color = path.color;
        const opacity = path.userData?.style?.fillOpacity ?? 1.0;

        console.log(`[SVGRegistry] Path ${pathIndex}: extracted ${pathShapes.length} shapes`);

        pathShapes.forEach((shape: any, shapeIndex: number) => {
          console.log(`[SVGRegistry] Path ${pathIndex} Shape ${shapeIndex}:`, {
            holes: shape.holes ? shape.holes.length : 0
          });
          shapeDataList.push({
            shape: shape,
            color: color,
            opacity: opacity
          });
        });
      });

      console.log(`[SVGRegistry] Total shapes extracted: ${shapeDataList.length}`);
      return shapeDataList;
    } catch (error) {
      console.error('[SVGRegistry] Error parsing SVG paths:', error);
      console.error('[SVGRegistry] Error stack:', (error as Error).stack);
      return [];
    }
  }

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

      // 解析并存储 SVG 原始尺寸
      const size = this.parseSVGSize(svgText);
      this.sizes.set(asset.id, size);

      // 解析并存储 SVG 路径数据（用于 3D 拉伸对象）- 现在返回 Promise
      const shapeData = await this.parseSVGPaths(svgText);
      this.shapeData.set(asset.id, shapeData);

      const dataUrl = await this.svgToDataURL(svgText);

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const texture = new THREE_GLOBAL.Texture(img);
          texture.needsUpdate = true;
          texture.colorSpace = THREE_GLOBAL.SRGBColorSpace;
          texture.minFilter = THREE_GLOBAL.LinearFilter;
          texture.magFilter = THREE_GLOBAL.LinearFilter;
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
   * 获取 SVG 原始尺寸
   */
  static getSize(id: string): SVGSize | undefined {
    return this.sizes.get(id);
  }

  /**
   * 获取对象的 Shape 数据（用于 3D 拉伸对象）
   */
  static getShapeData(id: string): SVGShapeData[] {
    return this.shapeData.get(id) || [];
  }

  /**
   * 释放所有纹理资源
   */
  static dispose(): void {
    this.textures.forEach(texture => texture.dispose());
    this.textures.clear();
    this.sizes.clear();
    this.shapeData.clear();
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
    this.sizes.delete(id);
    this.shapeData.delete(id);
  }
}
