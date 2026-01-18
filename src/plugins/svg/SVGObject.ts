/**
 * SVG 对象封装类
 * 封装单个 SVG 的 Three.js 对象，管理位置、缩放和交互
 */

import type * as THREE from 'three';
import type { SVGSize } from './SVGRegistry';
import { INTERACTION_CONFIG } from '@/config';

export interface SVGObjectConfig {
  id: string;
  texture: THREE.Texture;
  position: THREE.Vector3;
  baseScale?: number;
  originalSize?: SVGSize;  // SVG 原始尺寸（用于精确的包围盒计算）
  shapes?: THREE.Shape[];  // SVG 路径形状（用于计算实际内容边界）
}

export class SVGObject {
  public readonly id: string;
  public mesh: THREE.Sprite;
  public hitPlane: THREE.Mesh;
  private texture: THREE.Texture;
  private baseScale: number;
  private originalSize: SVGSize;  // 存储原始尺寸
  private aspectX: number;  // 宽高比（已归一化）
  private aspectY: number;  // 宽高比（已归一化）

  // Affinity 风格选中效果
  private cornerDots: THREE.Sprite[] = [];                      // 4个角点
  private cornerDotTexture: THREE.Texture | null = null;        // 角点纹理（复用）
  private selectionScene: THREE.Scene | null = null;            // 创建选中效果时保存 scene 引用
  private isSelected: boolean = false;                          // 选中状态
  private isDebugMode: boolean = false;                         // 调试模式状态

  private bboxHelper: THREE.Box3Helper | null = null;  // 复用：调试模式/选中状态的 bbox 可视化
  private shapes: THREE.Shape[] = [];
  private contentBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;

  constructor(config: SVGObjectConfig) {
    this.id = config.id;
    this.texture = config.texture;
    this.baseScale = config.baseScale ?? 1.0;
    // 存储 SVG 原始尺寸，默认为正方形
    this.originalSize = config.originalSize ?? { width: 1, height: 1 };

    // 存储形状并计算内容边界
    this.shapes = config.shapes ?? [];
    if (this.shapes.length > 0) {
      this.computeContentBounds();
    }

    // 计算宽高比（归一化，使较大边为 1）
    const maxDim = Math.max(this.originalSize.width, this.originalSize.height);
    this.aspectX = this.originalSize.width / maxDim;
    this.aspectY = this.originalSize.height / maxDim;

    const THREE = window.THREE as any;

    // 创建可见的 Sprite
    const spriteMaterial = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      opacity: 1.0,
      depthTest: true,
      depthWrite: false,
    });

    this.mesh = new THREE.Sprite(spriteMaterial);
    this.mesh.position.copy(config.position);
    // 使用实际宽高比设置 scale
    this.mesh.scale.set(this.baseScale * this.aspectX, this.baseScale * this.aspectY, 1);
    this.mesh.userData = { svgObject: this, id: this.id };

    // 创建不可见的射线检测平面 - 使用实际宽高比
    const hitPlaneGeometry = new THREE.PlaneGeometry(
      this.baseScale * this.aspectX,
      this.baseScale * this.aspectY
    );
    const hitPlaneMaterial = new THREE.MeshBasicMaterial({
      visible: false,
      side: THREE.DoubleSide,
    });

    this.hitPlane = new THREE.Mesh(hitPlaneGeometry, hitPlaneMaterial);
    this.hitPlane.position.copy(config.position);
    this.hitPlane.userData = { svgObject: this, id: this.id };
  }

  /**
   * 创建白色圆点纹理（用于选中框的角点装饰）
   */
  private static createCornerDotTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // 白色圆点，带轻微阴影
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 外圈发光效果
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 4;
    ctx.stroke();

    const texture = new (window as any).THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * 计算 SVG 实际内容的边界（基于所有 Shape 的边界）
   */
  private computeContentBounds(): void {
    const THREE = window.THREE as any;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const shape of this.shapes) {
      const box = new THREE.Box2();
      // Shape.getBoundingBox() 返回实际路径的边界
      shape.getBoundingBox(box);
      minX = Math.min(minX, box.min.x);
      minY = Math.min(minY, box.min.y);
      maxX = Math.max(maxX, box.max.x);
      maxY = Math.max(maxY, box.max.y);
    }

    if (isFinite(minX)) {
      this.contentBounds = { minX, minY, maxX, maxY };
      console.log(`[SVGObject] ${this.id} content bounds:`, this.contentBounds);
    }
  }

  /**
   * 更新位置
   */
  updatePosition(position: THREE.Vector3): void {
    this.mesh.position.copy(position);
    this.hitPlane.position.copy(position);
    // 同步更新 bbox helper（如果存在）
    if (this.bboxHelper) {
      const bounds = this.getBounds();
      this.bboxHelper.box = bounds;
    }
    // 同步更新角点位置（如果可见）
    if (this.isSelected) {
      this.updateCornerDots();
    }
  }

  /**
   * 更新缩放（带 clamp 限制）
   */
  updateScale(scale: number): void {
    this.setScale(Math.max(
      INTERACTION_CONFIG.SCALE_MIN,
      Math.min(INTERACTION_CONFIG.SCALE_MAX, scale)
    ));
  }

  /**
   * 设置缩放（直接设置）
   */
  setScale(scale: number): void {
    this.mesh.scale.set(scale * this.aspectX, scale * this.aspectY, 1);
    this.hitPlane.scale.set(scale * this.aspectX, scale * this.aspectY, 1);
    // 同步更新 bbox helper（如果存在）
    if (this.bboxHelper) {
      const bounds = this.getBounds();
      this.bboxHelper.box = bounds;
    }
    // 同步更新角点位置（如果可见）
    if (this.isSelected) {
      this.updateCornerDots();
    }
  }

  /**
   * 获取位置
   */
  getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  /**
   * 获取缩放
   */
  getScale(): number {
    return this.mesh.scale.x;
  }

  /**
   * 获取边界框（用于点击检测）
   * 如果有实际内容边界，使用基于 Shape 的精确边界；否则使用 Sprite 的 scale
   */
  getBounds(): THREE.Box3 {
    const THREE = window.THREE as any;
    const box = new THREE.Box3();

    if (this.contentBounds) {
      // 使用实际内容边界计算包围盒
      const maxDim = Math.max(this.originalSize.width, this.originalSize.height);

      // 将 SVG 坐标转换为 Sprite 局部坐标（归一化到 -0.5 到 0.5）
      const contentWidth = this.contentBounds.maxX - this.contentBounds.minX;
      const contentHeight = this.contentBounds.maxY - this.contentBounds.minY;
      const contentCenterX = (this.contentBounds.minX + this.contentBounds.maxX) / 2;
      const contentCenterY = (this.contentBounds.minY + this.contentBounds.maxY) / 2;

      // 归一化尺寸（相对于 maxDim）
      const normWidth = contentWidth / maxDim * this.baseScale;
      const normHeight = contentHeight / maxDim * this.baseScale;

      // 内容中心相对于 Sprite 中心的偏移
      const offsetX = (contentCenterX / maxDim - 0.5) * this.baseScale * this.aspectX;
      const offsetY = (0.5 - contentCenterY / maxDim) * this.baseScale * this.aspectY;

      box.min.set(
        this.mesh.position.x + offsetX - normWidth / 2,
        this.mesh.position.y + offsetY - normHeight / 2,
        this.mesh.position.z - 0.1
      );
      box.max.set(
        this.mesh.position.x + offsetX + normWidth / 2,
        this.mesh.position.y + offsetY + normHeight / 2,
        this.mesh.position.z + 0.1
      );
    } else {
      // 回退到原始方法（使用 Sprite scale）
      const scaleX = this.mesh.scale.x;
      const scaleY = this.mesh.scale.y;
      box.min.set(
        this.mesh.position.x - scaleX / 2,
        this.mesh.position.y - scaleY / 2,
        this.mesh.position.z - 0.1
      );
      box.max.set(
        this.mesh.position.x + scaleX / 2,
        this.mesh.position.y + scaleY / 2,
        this.mesh.position.z + 0.1
      );
    }

    return box;
  }

  /**
   * 检查点是否在对象内
   */
  containsPoint(point: THREE.Vector3): boolean {
    const bounds = this.getBounds();
    return bounds.containsPoint(point);
  }

  /**
   * 设置高亮状态（选中效果）- Affinity 风格
   * 复用 bboxHelper 作为蓝色线框
   */
  setSelected(selected: boolean, scene?: THREE.Scene): void {
    this.isSelected = selected;

    if (selected) {
      // 保存 scene 引用
      if (scene) {
        this.selectionScene = scene;
      }
      // 创建/更新 bboxHelper（蓝色）和角点
      this.ensureBBoxHelper(0x00D9FF);  // 科技感蓝色
      this.createCornerDotsIfNeeded();
      this.setSelectionVisible(true);
    } else {
      // 只隐藏，不销毁（调试模式可能还在使用）
      this.setSelectionVisible(false);
      // 如果不在调试模式，可以销毁 bboxHelper
      if (!this.isDebugMode) {
        this.disposeBBoxHelper();
      }
    }
  }

  /**
   * 确保 bboxHelper 存在并设置为指定颜色
   */
  private ensureBBoxHelper(color: number): void {
    const THREE = window.THREE as any;
    const scene = this.selectionScene;
    if (!scene) return;

    const bounds = this.getBounds();

    if (!this.bboxHelper) {
      this.bboxHelper = new THREE.Box3Helper(bounds, new THREE.Color(color));
      scene.add(this.bboxHelper);
    } else {
      // 更新 box 和颜色
      this.bboxHelper.box = bounds;
      (this.bboxHelper as any).color.setHex(color);
    }
  }

  /**
   * 创建角点（如果尚未创建）
   */
  private createCornerDotsIfNeeded(): void {
    if (this.cornerDots.length > 0) return;  // 已创建

    const scene = this.selectionScene;
    if (!scene) return;

    const THREE = window.THREE as any;

    if (!this.cornerDotTexture) {
      this.cornerDotTexture = SVGObject.createCornerDotTexture();
    }

    const bounds = this.getBounds();
    const corners = [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
    ];

    corners.forEach(corner => {
      const material = new THREE.SpriteMaterial({
        map: this.cornerDotTexture,
        transparent: true,
        opacity: 1.0,
        depthTest: false
      });
      const dot = new THREE.Sprite(material);
      dot.position.copy(corner);
      dot.scale.set(0.08, 0.08, 1);
      dot.visible = this.isSelected;
      scene.add(dot);
      this.cornerDots.push(dot);
    });
  }

  /**
   * 更新角点位置
   */
  private updateCornerDots(): void {
    if (this.cornerDots.length === 0) return;

    const THREE = window.THREE as any;
    const bounds = this.getBounds();

    const corners = [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
    ];

    this.cornerDots.forEach((dot, i) => {
      dot.position.copy(corners[i]);
    });
  }

  /**
   * 设置选中效果可见性
   */
  private setSelectionVisible(visible: boolean): void {
    if (this.bboxHelper && !this.isDebugMode) {
      this.bboxHelper.visible = visible;
    }
    this.cornerDots.forEach(dot => {
      dot.visible = visible;
    });
  }

  /**
   * 销毁 bboxHelper
   */
  private disposeBBoxHelper(): void {
    if (this.bboxHelper && this.selectionScene) {
      this.selectionScene.remove(this.bboxHelper);
      this.bboxHelper.dispose();
      this.bboxHelper = null;
    }
  }

  /**
   * 显示/隐藏调试模式的 bbox
   * 调试模式使用绿色，优先于选中状态的蓝色
   */
  showDebugBounds(show: boolean, scene: THREE.Scene): void {
    this.isDebugMode = show;

    // 保存 scene 引用
    if (show) {
      this.selectionScene = scene;
    }

    if (show) {
      // 调试模式：显示绿色 bbox
      this.ensureBBoxHelper(0x00ff00);  // 绿色
      this.bboxHelper!.visible = true;
    } else {
      // 退出调试模式
      if (this.bboxHelper) {
        if (this.isSelected) {
          // 如果仍在选中状态，改回蓝色
          (this.bboxHelper as any).color.setHex(0x00D9FF);
        } else {
          // 如果未选中，隐藏/销毁
          this.disposeBBoxHelper();
        }
      }
    }
  }

  /**
   * 重置到初始位置
   */
  reset(): void {
    this.mesh.position.set(0, 0, 0);
    this.hitPlane.position.set(0, 0, 0);
    this.setScale(this.baseScale);
    this.setSelected(false);
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this.mesh.material.dispose();
    this.hitPlane.geometry.dispose();
    this.hitPlane.material.dispose();

    // 清理 bbox helper
    this.disposeBBoxHelper();

    // 清理角点
    this.cornerDots.forEach(dot => {
      dot.material.dispose();
      if (this.selectionScene) {
        this.selectionScene.remove(dot);
      }
    });
    this.cornerDots = [];

    // 清理角点纹理
    if (this.cornerDotTexture) {
      this.cornerDotTexture.dispose();
      this.cornerDotTexture = null;
    }
  }
}
