/**
 * SVG 对象封装类
 * 封装单个 SVG 的 Three.js 对象，管理位置、缩放和交互
 */

import type * as THREE from 'three';

/**
 * 创建蓝色轮廓纹理（Affinity 风格）
 */
function createOutlineTexture(): THREE.Texture {
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
  private outlineMesh: THREE.Sprite;

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
    this.outlineMesh.scale.set(this.baseScale * 1.15, this.baseScale * 1.15, 1);
    this.outlineMesh.renderOrder = -1; // 在主 sprite 之前渲染
  }

  /**
   * 更新位置
   */
  updatePosition(position: THREE.Vector3): void {
    this.mesh.position.copy(position);
    this.hitPlane.position.copy(position);
    this.outlineMesh.position.copy(position);
  }

  /**
   * 更新缩放
   */
  updateScale(scale: number): void {
    const clampedScale = Math.max(0.2, Math.min(5.0, scale));
    this.mesh.scale.set(clampedScale, clampedScale, 1);
    this.hitPlane.scale.set(clampedScale, clampedScale, 1);
    this.outlineMesh.scale.set(clampedScale * 1.15, clampedScale * 1.15, 1);
  }

  /**
   * 设置缩放（直接设置）
   */
  setScale(scale: number): void {
    this.mesh.scale.set(scale, scale, 1);
    this.hitPlane.scale.set(scale, scale, 1);
    this.outlineMesh.scale.set(scale * 1.15, scale * 1.15, 1);
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
   * 设置高亮状态（选中效果）- 使用蓝色轮廓
   */
  setSelected(selected: boolean): void {
    const outlineMaterial = this.outlineMesh.material as any;
    outlineMaterial.opacity = selected ? 0.9 : 0.0;
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
  }
}
