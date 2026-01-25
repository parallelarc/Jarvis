/**
 * Three.js 同步工具函数
 * 提供与 SVG 场景 API 交互的辅助函数
 */

import type { Vector3D } from '@/core/types';
import { THREE } from './three';

/**
 * SVG 场景 API 接口
 */
interface SVGSceneAPI {
  getScene(): any;
  getCamera(): any;
  getSVGObjects(): Map<string, SVGObject> | undefined;
  setSelectedWithScene?(id: string, selected: boolean): void;  // 新增 Affinity 风格选中 API
}

/**
 * SVG 对象接口
 */
interface SVGObject {
  updatePosition(position: Vector3D): void;
  setScale(scale: number): void;
  setSelected(selected: boolean): void;
}

/**
 * 获取 SVG 场景 API
 */
function getSceneAPI(): SVGSceneAPI | undefined {
  return (window as any).svgSceneAPI;
}

/**
 * 同步更新 SVG 对象位置
 */
export function syncSVGObjectPosition(id: string, position: Vector3D): boolean {
  const sceneAPI = getSceneAPI();
  if (!sceneAPI) return false;

  const svgObjects = sceneAPI.getSVGObjects();
  if (!svgObjects) return false;

  const svgObj = svgObjects.get(id) as SVGObject | undefined;
  if (!svgObj) return false;

  svgObj.updatePosition(position);
  return true;
}

/**
 * 同步更新 SVG 对象缩放
 */
export function syncSVGObjectScale(id: string, scale: number): boolean {
  const sceneAPI = getSceneAPI();
  if (!sceneAPI) return false;

  const svgObjects = sceneAPI.getSVGObjects();
  if (!svgObjects) return false;

  const svgObj = svgObjects.get(id) as SVGObject | undefined;
  if (!svgObj) return false;

  svgObj.setScale(scale);
  return true;
}

/**
 * 同步设置 SVG 对象选中状态
 */
export function syncSVGObjectSelected(id: string, selected: boolean): boolean {
  const sceneAPI = getSceneAPI();
  if (!sceneAPI) return false;

  // 使用新的 setSelectedWithScene API（需要 scene 参数用于创建选中效果）
  if (typeof sceneAPI.setSelectedWithScene === 'function') {
    sceneAPI.setSelectedWithScene(id, selected);
    return true;
  }

  // 回退到旧 API（兼容性）
  const svgObjects = sceneAPI.getSVGObjects();
  if (!svgObjects) return false;

  const svgObj = svgObjects.get(id) as SVGObject | undefined;
  if (!svgObj) return false;

  svgObj.setSelected(selected);
  return true;
}

/**
 * 同步设置所有 SVG 对象的选中状态
 */
export function syncAllSVGObjectsSelected(selected: boolean): void {
  const sceneAPI = getSceneAPI();
  if (!sceneAPI) return;

  const svgObjects = sceneAPI.getSVGObjects();
  if (!svgObjects) return;

  svgObjects.forEach((obj: any) => obj.setSelected(selected));
}

/**
 * 检查点是否在 SVG 对象的包围盒内
 */
export function isPointInSVGObject(
  point: { x: number; y: number },
  svgObject: { containsPoint: (point: any) => boolean }
): boolean {
  const point3D = new THREE.Vector3(point.x, point.y, 0);
  return svgObject.containsPoint(point3D);
}

/**
 * 查找手指下的 SVG 对象 ID
 */
export function findObjectUnderPoint(point: { x: number; y: number }): string | null {
  const sceneAPI = getSceneAPI();
  if (!sceneAPI) return null;

  const svgObjects = sceneAPI.getSVGObjects();
  if (!svgObjects) return null;

  const point3D = new THREE.Vector3(point.x, point.y, 0);

  for (const [id, svgObj] of svgObjects) {
    if ((svgObj as any).containsPoint(point3D)) {
      return id;
    }
  }

  return null;
}
