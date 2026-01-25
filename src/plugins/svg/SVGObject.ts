/**
 * SVG 对象封装类
 * 封装单个 SVG 的 Three.js 对象，管理位置、缩放和交互
 */

import type * as THREE from 'three';
import type { SVGSize, SVGShapeData } from './SVGRegistry';
import { INTERACTION_CONFIG } from '@/config';

export interface SVGObjectConfig {
  id: string;
  texture?: THREE.Texture; // Keep for fallback or unused
  position: THREE.Vector3;
  baseScale?: number;
  originalSize?: SVGSize;  // SVG 原始尺寸（用于精确的包围盒计算）
  shapeData?: SVGShapeData[];  // SVG 路径形状数据（用于 3D 构建）
}

export class SVGObject {
  public readonly id: string;
  public mesh: THREE.Group; // Main container
  public hitPlane: THREE.Mesh;
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
  private shapeData: SVGShapeData[] = [];
  private contentBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;

  constructor(config: SVGObjectConfig) {
    this.id = config.id;
    this.baseScale = config.baseScale ?? 1.0;
    // 存储 SVG 原始尺寸，默认为正方形
    this.originalSize = config.originalSize ?? { width: 1, height: 1 };

    // 存储形状并计算内容边界
    this.shapeData = config.shapeData ?? [];
    if (this.shapeData.length > 0) {
      try {
        this.computeContentBounds();
      } catch (error) {
        console.error(`[SVGObject] Error computing bounds for ${this.id}:`, error);
      }
    }

    // 计算宽高比（归一化，使较大边为 1）
    const maxDim = Math.max(this.originalSize.width, this.originalSize.height);
    this.aspectX = this.originalSize.width / maxDim;
    this.aspectY = this.originalSize.height / maxDim;

    const THREE = window.THREE as any;

    // 创建 3D Group
    this.mesh = new THREE.Group();
    this.mesh.position.copy(config.position);
    this.mesh.userData = { svgObject: this, id: this.id };

    // 构建 3D 几何体
    if (this.shapeData.length > 0) {
      try {
        this.build3DGeometry();
      } catch (error) {
        console.error(`[SVGObject] Error building 3D geometry for ${this.id}:`, error);
        console.error(`[SVGObject] Error stack:`, (error as Error).stack);
      }
    } else {
        // Fallback or empty?
        console.warn(`[SVGObject] No shape data for ${this.id}`);
    }

    // 创建不可见的射线检测平面 - 保持原有逻辑
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
   * 构建 3D 几何体
   */
  private build3DGeometry() {
    const THREE = window.THREE as any;

    // Extrude Settings - 禁用倒角以保持低多边形数
    const extrudeSettings = {
      depth: 200, // 大深度，但不增加多边形
      bevelEnabled: false  // 禁用倒角，避免多边形爆炸
    };

    // 计算中心偏移
    let centerX = 0, centerY = 0;
    if (this.contentBounds) {
        centerX = -(this.contentBounds.minX + this.contentBounds.maxX) / 2;
        centerY = -(this.contentBounds.minY + this.contentBounds.maxY) / 2;
    }

    this.shapeData.forEach(data => {
        const geometry = new THREE.ExtrudeGeometry(data.shape, extrudeSettings);

        // 居中几何体
        geometry.translate(centerX, centerY, -extrudeSettings.depth / 2);

        // 材质：白色哑光表面
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,  // 纯白色
            roughness: 1.0,  // 完全粗糙，哑光
            metalness: 0.0,  // 完全无金属感
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        this.mesh.add(mesh);
    });

    // 计算实际几何体的边界框，基于边界框缩放到合理大小
    const tempBox = new THREE.Box3();
    tempBox.setFromObject(this.mesh);

    const actualSize = {
      width: tempBox.max.x - tempBox.min.x,
      height: tempBox.max.y - tempBox.min.y,
      depth: tempBox.max.z - tempBox.min.z
    };

    const maxDimension = Math.max(actualSize.width, actualSize.height, actualSize.depth);
    const targetSize = this.baseScale; // 目标大小
    const scaleFactor = targetSize / maxDimension;

    // 应用缩放和翻转Y轴
    this.mesh.scale.set(scaleFactor, -scaleFactor, scaleFactor);

    // 添加旋转让3D效果更明显（从右侧面看）
    this.mesh.rotation.y = -Math.PI / 6; // 绕Y轴旋转-30度
    this.mesh.rotation.x = Math.PI / 12; // 绕X轴轻微旋转15度
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

    for (const data of this.shapeData) {
      // 获取形状的所有点来计算边界
      const points = data.shape.getPoints();
      for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    if (isFinite(minX)) {
      this.contentBounds = { minX, minY, maxX, maxY };
      // console.log(`[SVGObject] ${this.id} content bounds:`, this.contentBounds);
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
    // 设置 3D Group 的缩放
    // 直接使用scale作为缩放值
    this.mesh.scale.set(scale, -scale, scale);

    // 设置 hitPlane 的缩放
    // hitPlaneGeometry 尺寸为 baseScale * aspectX
    // 我们想让它变为 scale * aspectX
    if (this.baseScale > 0) {
        const ratio = scale / this.baseScale;
        this.hitPlane.scale.set(ratio, ratio, 1);
    }

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
   * 设置旋转 (弧度)
   */
  setRotation(rotation: { x: number; y: number; z: number }): void {
    // 性能优化：检查旋转值是否真正变化，避免不必要的边界框计算
    const currentRotation = this.mesh.rotation;
    const isChanged =
      currentRotation.x !== rotation.x ||
      currentRotation.y !== rotation.y ||
      currentRotation.z !== rotation.z;

    if (!isChanged) {
      return; // 旋转值未变化，直接返回
    }

    this.mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    this.hitPlane.rotation.set(rotation.x, rotation.y, rotation.z);

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
    // 这里的 scale 概念是 "最大边的世界尺寸"
    const maxDim = Math.max(this.originalSize.width, this.originalSize.height);
    return Math.abs(this.mesh.scale.x) * maxDim;
  }

  /**
   * 获取边界框（用于点击检测）
   */
  getBounds(): THREE.Box3 {
    const THREE = window.THREE as any;
    const box = new THREE.Box3();
    box.setFromObject(this.mesh);
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
