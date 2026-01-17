/**
 * SVG 对象封装类
 * 封装单个 SVG 的 Three.js 对象，管理位置、缩放和交互
 */

import type * as THREE from 'three';

export interface SVGObjectConfig {
  id: string;
  texture: THREE.Texture;
  position: THREE.Vector3;
  baseScale?: number;
}

export class SVGObject {
  public readonly id: string;
  public mesh: THREE.Sprite;
  public hitPlane: THREE.Mesh;
  private texture: THREE.Texture;
  private baseScale: number;

  constructor(config: SVGObjectConfig) {
    this.id = config.id;
    this.texture = config.texture;
    this.baseScale = config.baseScale ?? 1.0;

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
    this.mesh.scale.set(this.baseScale, this.baseScale, 1);
    this.mesh.userData = { svgObject: this, id: this.id };

    // 创建不可见的射线检测平面
    const hitPlaneGeometry = new THREE.PlaneGeometry(this.baseScale, this.baseScale);
    const hitPlaneMaterial = new THREE.MeshBasicMaterial({
      visible: false,
      side: THREE.DoubleSide,
    });

    this.hitPlane = new THREE.Mesh(hitPlaneGeometry, hitPlaneMaterial);
    this.hitPlane.position.copy(config.position);
    this.hitPlane.userData = { svgObject: this, id: this.id };
  }

  /**
   * 更新位置
   */
  updatePosition(position: THREE.Vector3): void {
    this.mesh.position.copy(position);
    this.hitPlane.position.copy(position);
  }

  /**
   * 更新缩放
   */
  updateScale(scale: number): void {
    const clampedScale = Math.max(0.2, Math.min(5.0, scale));
    this.mesh.scale.set(clampedScale, clampedScale, 1);
    this.hitPlane.scale.set(clampedScale, clampedScale, 1);
  }

  /**
   * 设置缩放（直接设置）
   */
  setScale(scale: number): void {
    this.mesh.scale.set(scale, scale, 1);
    this.hitPlane.scale.set(scale, scale, 1);
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
   */
  getBounds(): THREE.Box3 {
    const THREE = window.THREE as any;
    const box = new THREE.Box3();
    const halfSize = this.getScale() * 0.5;

    box.min.set(
      this.mesh.position.x - halfSize,
      this.mesh.position.y - halfSize,
      this.mesh.position.z - 0.1
    );
    box.max.set(
      this.mesh.position.x + halfSize,
      this.mesh.position.y + halfSize,
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
   * 设置高亮状态（选中效果）
   */
  setSelected(selected: boolean): void {
    const material = this.mesh.material as any;
    if (selected) {
      material.opacity = 0.8;
      material.color = new (window.THREE as any).Color(1.0, 1.0, 0.5);
    } else {
      material.opacity = 1.0;
      material.color = new (window.THREE as any).Color(1.0, 1.0, 1.0);
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
  }
}
