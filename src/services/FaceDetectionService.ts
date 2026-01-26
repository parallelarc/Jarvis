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
      return `./models/face_detection/${file}`;
    },
  });

  faceDetection.setOptions({
    model: 'short',           // 'short' 更快，适合近距离
    minDetectionConfidence: 0.5,
  });

  await faceDetection.initialize();
  console.log('[FaceDetection] 初始化完成');
}

// 人脸检测 FPS 计数
let faceFrameCount = 0;
let faceLastFpsTime = performance.now();
let faceFps = 0;

/**
 * 处理面部检测结果
 */
export function onFaceResults(results: any): void {
  // 计算 FaceDetection 独立 FPS
  faceFrameCount++;
  const now = performance.now();
  if (now - faceLastFpsTime >= 500) {
    faceFps = Math.round(faceFrameCount * 1000 / (now - faceLastFpsTime));
    faceFrameCount = 0;
    faceLastFpsTime = now;
  }

  // 检查旋转模式：只有在 face 模式下才启用面部视差
  const rotationMode = getRotationMode();
  if (rotationMode !== 'face') {
    return;
  }

  // DEBUG: 每60帧输出一次检测结果
  if (!faceStore.detected || Math.random() < 0.02) {
    console.log('[FaceDetection] rotationMode:', rotationMode, 'detections:', results.detections?.length);
  }

  if (results.detections && results.detections.length > 0) {
    const detection = results.detections[0];

    // 获取边界框中心点（归一化坐标 0-1）
    const bbox = detection.boundingBox;
    const centerX = bbox.xCenter;
    const centerY = bbox.yCenter;

    // DEBUG: 输出面部位置
    if (Math.random() < 0.05) {  // 偶尔输出
      console.log('[FaceDetection] Face position:', { x: centerX.toFixed(3), y: centerY.toFixed(3) });
    }

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
 * 所有对象沿各自中轴旋转相同的角度
 */
function applyParallaxToObjects(faceRotation: { x: number; y: number }) {
  const sceneAPI = (window as any).svgSceneAPI;
  if (!sceneAPI) return;

  const svgObjects = sceneAPI.getSVGObjects();
  if (!svgObjects) return;

  // 人脸位置（归一化 0-1）- 相对于画面中心的偏移
  const faceX = faceStore.x - 0.5;
  const faceY = faceStore.y - 0.5;

  const parallaxStrength = 1.2;
  const targetRotX = -faceY * parallaxStrength * FACE_PARALLAX_CONFIG.MAX_ROTATION_X;
  const targetRotY = -faceX * parallaxStrength * FACE_PARALLAX_CONFIG.MAX_ROTATION_Y;

  // DEBUG: 输出旋转目标值
  if (Math.abs(faceX) > 0.05 || Math.abs(faceY) > 0.05) {
    console.log('[Parallax] Target rotation:', { faceX: faceX.toFixed(3), faceY: faceY.toFixed(3), targetRotX: targetRotX.toFixed(3), targetRotY: targetRotY.toFixed(3) });
  }

  // 所有对象旋转相同的角度
  svgObjects.forEach((obj: any, id: string) => {
    if (!obj || !obj.setRotation) return;

    // 获取当前旋转缓存
    const currentRot = objectRotationCache.get(id) || { x: 0, y: 0 };

    // 平滑插值
    const smoothedRot = {
      x: lerp(currentRot.x, targetRotX, 0.15),
      y: lerp(currentRot.y, targetRotY, 0.15)
    };
    objectRotationCache.set(id, smoothedRot);

    const finalRotation = {
      x: smoothedRot.x,
      y: smoothedRot.y,
      z: 0
    };

    // DEBUG: 输出最终旋转值
    if (id === 'v' && Math.abs(targetRotY) > 0.05) {
      console.log('[Parallax] Applying rotation to', id, ':', finalRotation);
    }

    objectActions.updateObjectRotation(id, finalRotation);
    obj.setRotation(finalRotation);
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
  // 清理所有对象的缓存
  svgObjects.forEach((_obj: any, id: string) => {
    objectRotationCache.set(id, { x: 0, y: 0 });
  });
}

/**
 * 获取 FaceDetection 实例
 */
export function getFaceDetection(): any {
  return faceDetection;
}

/**
 * 获取 FaceDetection FPS
 */
export function getFaceDetectionFps(): number {
  return faceFps;
}
