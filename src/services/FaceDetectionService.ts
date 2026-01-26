/**
 * 面部检测服务
 * 使用 MediaPipe FaceDetection 检测人脸位置
 * FaceDetection 从 CDN 加载，通过全局变量访问
 */

import { faceStore, faceActions } from '@/stores/faceStore';
import { objectActions } from '@/stores/objectStore';
import { FACE_PARALLAX_CONFIG } from '@/config';
import { getRotationMode } from '@/components/DebugPanel';

// 类型声明
declare global {
  interface Window {
    FaceDetection?: any;
  }
}

let faceDetection: any = null;

/**
 * 初始化 FaceDetection
 */
export async function initFaceDetection(): Promise<void> {
  if (faceDetection) return;

  faceDetection = new window.FaceDetection({
    locateFile: (file: string) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
    },
  });

  faceDetection.setOptions({
    model: 'short',           // 'short' 更快，适合近距离
    minDetectionConfidence: 0.5,
  });

  await faceDetection.initialize();
  console.log('[FaceDetection] 初始化完成');
}

/**
 * 处理面部检测结果
 */
export function onFaceResults(results: any): void {
  // 检查旋转模式：只有在 face 模式下才启用面部视差
  if (getRotationMode() !== 'face') {
    return;
  }

  if (results.detections && results.detections.length > 0) {
    const detection = results.detections[0];

    // 获取边界框中心点（归一化坐标 0-1）
    const bbox = detection.boundingBox;
    const centerX = bbox.xCenter;
    const centerY = bbox.yCenter;

    // 更新 store
    faceActions.setFacePosition(centerX, centerY);

    // 应用3D视差效果（每个对象独立计算）
    applyParallaxToObjects({ x: 0, y: 0 }); // 参数不再使用，直接从 faceStore 读取

  } else {
    // 未检测到人脸，检查是否超时复位
    const timeSinceLastDetected = Date.now() - faceStore.lastDetectedTime;
    if (timeSinceLastDetected > FACE_PARALLAX_CONFIG.FACE_TIMEOUT_MS && faceStore.detected) {
      resetParallax();
      faceActions.reset();
    }
  }
}

/**
 * 线性插值
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 应用视差旋转到所有 SVG 对象
 * 统一旋转模式：整个场景随视角一起转动，营造全息台效果
 */
function applyParallaxToObjects(faceRotation: { x: number; y: number }) {
  const sceneAPI = (window as any).svgSceneAPI;
  if (!sceneAPI) return;

  const svgObjects = sceneAPI.getSVGObjects();
  if (!svgObjects) return;

  // 人脸位置（归一化 0-1）- 相对于画面中心的偏移
  // 画面中心是 (0.5, 0.5)，计算偏移量
  const faceX = faceStore.x - 0.5;  // -0.5 到 +0.5，左负右正
  const faceY = faceStore.y - 0.5;  // -0.5 到 +0.5，上负下正

  // 统一旋转角度（所有元素相同）
  const parallaxStrength = 1.2;  // 旋转强度
  const targetRotX = -faceY * parallaxStrength * FACE_PARALLAX_CONFIG.MAX_ROTATION_X;
  const targetRotY = -faceX * parallaxStrength * FACE_PARALLAX_CONFIG.MAX_ROTATION_Y;

  // 获取当前缓存的旋转值（用于平滑插值）
  const currentRot = objectRotationCache.get('all') || { x: 0, y: 0 };

  // 平滑插值
  const smoothedRot = {
    x: lerp(currentRot.x, targetRotX, 0.15),
    y: lerp(currentRot.y, targetRotY, 0.15)
  };
  objectRotationCache.set('all', smoothedRot);

  const finalRotation = {
    x: smoothedRot.x,
    y: smoothedRot.y,
    z: 0
  };

  // 应用统一旋转到所有对象
  svgObjects.forEach((obj: any, id: string) => {
    if (obj && obj.setRotation) {
      objectActions.updateObjectRotation(id, finalRotation);
      obj.setRotation(finalRotation);
    }
  });
}

// 每个对象的旋转缓存（用于平滑插值）
const objectRotationCache = new Map<string, { x: number; y: number }>();

/**
 * 复位视差效果
 */
function resetParallax() {
  const sceneAPI = (window as any).svgSceneAPI;
  if (!sceneAPI) return;

  const svgObjects = sceneAPI.getSVGObjects();
  if (!svgObjects) return;

  const zeroRotation = { x: 0, y: 0, z: 0 };

  // 复位所有对象旋转到 0
  svgObjects.forEach((obj: any, id: string) => {
    if (obj && obj.setRotation) {
      // 更新 Store 和 mesh
      objectActions.updateObjectRotation(id, zeroRotation);
      obj.setRotation(zeroRotation);
    }
  });
  // 清理缓存
  objectRotationCache.set('all', { x: 0, y: 0 });
}

/**
 * 获取 FaceDetection 实例
 */
export function getFaceDetection(): any {
  return faceDetection;
}
