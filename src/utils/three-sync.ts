/**
 * Three.js 同步工具函数
 * 提供与 SVG 场景 API 交互的辅助函数
 */

import type { Vector3D } from '@/core/types';

/**
 * SVG 场景 API 接口
 */
interface SVGSceneAPI {
  getScene(): any;
  getCamera(): any;
  getSVGObjects(): Map<string, SVGObject> | undefined;
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
 * 通用 SVG 对象操作辅助函数
 * 封装了获取 API、获取对象、执行操作的三步模式
 *
 * @param id - SVG 对象 ID
 * @param operation - 要对对象执行的操作函数
 * @param fallback - 操作失败时的返回值
 * @returns 操作结果或 fallback 值
 */
function withSVGObject<T>(
  id: string,
  operation: (obj: SVGObject) => T,
  fallback: T
): T {
  const sceneAPI = getSceneAPI();
  if (!sceneAPI) return fallback;

  const svgObjects = sceneAPI.getSVGObjects();
  if (!svgObjects) return fallback;

  const svgObj = svgObjects.get(id) as SVGObject | undefined;
  return svgObj ? operation(svgObj) : fallback;
}

/**
 * 同步更新 SVG 对象位置
 */
export function syncSVGObjectPosition(id: string, position: Vector3D): boolean {
  return withSVGObject(id, obj => { obj.updatePosition(position); return true; }, false);
}

/**
 * 同步更新 SVG 对象缩放
 */
export function syncSVGObjectScale(id: string, scale: number): boolean {
  return withSVGObject(id, obj => { obj.setScale(scale); return true; }, false);
}

/**
 * 同步设置 SVG 对象选中状态
 */
export function syncSVGObjectSelected(id: string, selected: boolean): boolean {
  return withSVGObject(id, obj => { obj.setSelected(selected); return true; }, false);
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
  const THREE = window.THREE as any;
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

  const THREE = window.THREE as any;
  const point3D = new THREE.Vector3(point.x, point.y, 0);

  for (const [id, svgObj] of svgObjects) {
    if ((svgObj as any).containsPoint(point3D)) {
      return id;
    }
  }

  return null;
}
