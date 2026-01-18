/**
 * SVG 对象封装类
 * 封装单个 SVG 的 Three.js 对象，管理位置、缩放和交互
 */

import type * as THREE from 'three';
import type { SVGSize } from './SVGRegistry';
import { createOutlineTexture } from '@/utils/texture';
import { INTERACTION_CONFIG } from '@/config';

export interface SVGObjectConfig {
  id: string;
  texture: THREE.Texture;
  position: THREE.Vector3;
  baseScale?: number;
  originalSize?: SVGSize;  // SVG 原始尺寸（用于精确的包围盒计算）
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
  public outlineMesh: THREE.Sprite;  // 改为 public，供 SVGScene 访问
  private bboxHelper: THREE.Box3Helper | null = null;  // 调试模式下的 bbox 可视化

  constructor(config: SVGObjectConfig) {
    this.id = config.id;
    this.texture = config.texture;
    this.baseScale = config.baseScale ?? 1.0;
    // 存储 SVG 原始尺寸，默认为正方形
    this.originalSize = config.originalSize ?? { width: 1, height: 1 };

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

    // 创建蓝色轮廓 Sprite（初始隐藏）
    const outlineMaterial = new THREE.SpriteMaterial({
      map: createOutlineTexture(),
      transparent: true,
      opacity: 0.0,
      depthTest: true,
      depthWrite: false,
    });

    this.outlineMesh = new THREE.Sprite(outlineMaterial);
    this.outlineMesh.position.copy(config.position);
    this.outlineMesh.scale.set(
      this.baseScale * this.aspectX * INTERACTION_CONFIG.OUTLINE_SCALE_MULTIPLIER,
      this.baseScale * this.aspectY * INTERACTION_CONFIG.OUTLINE_SCALE_MULTIPLIER,
      1
    );
    this.outlineMesh.renderOrder = -1; // 在主 sprite 之前渲染
  }

  /**
   * 更新位置
   */
  updatePosition(position: THREE.Vector3): void {
    this.mesh.position.copy(position);
    this.hitPlane.position.copy(position);
    this.outlineMesh.position.copy(position);
    // 同步更新 bbox helper（如果存在）
    if (this.bboxHelper) {
      const bounds = this.getBounds();
      this.bboxHelper.box = bounds;
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
    this.outlineMesh.scale.set(
      scale * this.aspectX * INTERACTION_CONFIG.OUTLINE_SCALE_MULTIPLIER,
      scale * this.aspectY * INTERACTION_CONFIG.OUTLINE_SCALE_MULTIPLIER,
      1
    );
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
   * 基于实际的 SVG 宽高比计算精确的包围盒
   */
  getBounds(): THREE.Box3 {
    const THREE = window.THREE as any;
    const box = new THREE.Box3();
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
   * 设置高亮状态（选中效果）- 使用蓝色轮廓
   */
  setSelected(selected: boolean): void {
    const outlineMaterial = this.outlineMesh.material as any;
    outlineMaterial.opacity = selected ? 0.9 : 0.0;
  }

  /**
   * 显示/隐藏调试模式的 bbox
   */
  showDebugBounds(show: boolean, scene: THREE.Scene): void {
    const THREE = window.THREE as any;

    if (show && !this.bboxHelper) {
      const bounds = this.getBounds();
      this.bboxHelper = new THREE.Box3Helper(
        bounds,
        new THREE.Color(0x00ff00)  // 绿色
      );
      scene.add(this.bboxHelper);
    } else if (!show && this.bboxHelper) {
      scene.remove(this.bboxHelper);
      this.bboxHelper = null;
    } else if (show && this.bboxHelper) {
      // 更新 bbox 位置（对象移动后）
      const bounds = this.getBounds();
      this.bboxHelper.box = bounds;
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
    this.outlineMesh.material.dispose();
    (this.outlineMesh.material.map as any)?.dispose();
    // 清理 bbox helper
    if (this.bboxHelper) {
      this.bboxHelper.dispose();
    }
  }
}
