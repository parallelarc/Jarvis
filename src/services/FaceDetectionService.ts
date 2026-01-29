/**
 * 面部检测服务
 * 使用 MediaPipe FaceDetection 检测人脸位置
 * FaceDetection 从 CDN 加载，通过全局变量访问
 */

import { faceStore, faceActions } from '@/stores/faceStore';
import { handStore } from '@/stores/handStore';
import { FACE_PARALLAX_CONFIG, CAMERA_CONFIG } from '@/config';
import { lerp } from '@/utils/math';

// 类型声明
declare global {
  interface Window {
    FaceDetection?: any;
  }
}

let faceDetection: any = null;



/**
 * 等待 FaceDetection 脚本加载完成
 */
function waitForFaceDetection(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.FaceDetection !== 'undefined') {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('FaceDetection script failed to load after 10 seconds'));
    }, 10000);

    const checkInterval = setInterval(() => {
      if (typeof window.FaceDetection !== 'undefined') {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });
}

/**
 * 初始化 FaceDetection
 */
export async function initFaceDetection(): Promise<void> {
  if (faceDetection) return;

  // 等待脚本加载完成
  await waitForFaceDetection();

  faceDetection = new window.FaceDetection({
    locateFile: (file: string) => {
      return `./models/face_detection/${file}`;
    },
  });

  faceDetection.setOptions({
    model: 'short',           // 'short' 更快，适合近距离
    minDetectionConfidence: 0.3,  // 降低阈值以支持3-4米远距离检测（原0.5）
  });

  await faceDetection.initialize();
  if (import.meta.env.DEV) {
    console.log('[FaceDetection] Initialized');
  }
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

  if (results.detections && results.detections.length > 0) {
    // 选择距离摄像头最近的人脸（边界框面积最大的）
    let closestDetection = results.detections[0];
    let maxArea = 0;

    for (const detection of results.detections) {
      const bbox = detection.boundingBox;
      const area = bbox.width * bbox.height;
      if (area > maxArea) {
        maxArea = area;
        closestDetection = detection;
      }
    }

    const detection = closestDetection;
    const bbox = detection.boundingBox;
    const centerX = bbox.xCenter;
    const centerY = bbox.yCenter;

    // 更新 store
    faceActions.setFacePosition(centerX, centerY);

    // 简化：只要有手部动作就禁用视差，避免任何干扰
    const hasHandAction = handStore.left.active || handStore.right.active;
    
    if (!hasHandAction) {
      // 无手部动作时才应用视差
      applyParallaxToObjects({ x: centerX, y: centerY });
    }

  } else {
    // 未检测到人脸，检查是否超时复位
    const timeSinceLastDetected = Date.now() - faceStore.lastDetectedTime;
    if (timeSinceLastDetected > FACE_PARALLAX_CONFIG.FACE_TIMEOUT_MS && faceStore.detected) {
      resetParallax();
      faceActions.reset();
    }
  }
}

// 旋转缓存（用于平滑插值）- 现在用于相机位置
const cameraOffsetCache = { x: 0, y: 0 };

/**
 * 应用视差效果 - 通过移动相机位置模拟真实视角变化
 * 全息板保持静止，相机围绕场景中心移动
 */
function applyParallaxToObjects(faceRotation: { x: number; y: number }) {
  const sceneAPI = (window as any).svgSceneAPI;
  if (!sceneAPI) return;

  const camera = sceneAPI.getCamera();
  if (!camera) return;

  // 人脸位置（归一化 0-1）- 相对于画面中心的偏移
  const faceX = faceStore.x - FACE_PARALLAX_CONFIG.CENTER_OFFSET;
  const faceY = faceStore.y - FACE_PARALLAX_CONFIG.CENTER_OFFSET;

  // 视差强度 - 控制相机移动范围
  const targetOffsetX = -faceX * FACE_PARALLAX_CONFIG.PARALLAX_STRENGTH;  // 人往右，相机往左，看到右侧
  const targetOffsetY = -faceY * FACE_PARALLAX_CONFIG.PARALLAX_STRENGTH * FACE_PARALLAX_CONFIG.Y_AXIS_MULTIPLIER;  // 人往上，相机往下，看到上侧

  // 平滑插值
  const smoothedOffset = {
    x: lerp(cameraOffsetCache.x, targetOffsetX, FACE_PARALLAX_CONFIG.SMOOTHING_FACTOR),
    y: lerp(cameraOffsetCache.y, targetOffsetY, FACE_PARALLAX_CONFIG.SMOOTHING_FACTOR)
  };

  // 更新缓存
  cameraOffsetCache.x = smoothedOffset.x;
  cameraOffsetCache.y = smoothedOffset.y;

  // 移动相机位置（保持 Z 轴距离不变）
  // 相机围绕场景中心移动，始终看向中心
  camera.position.x = smoothedOffset.x;
  camera.position.y = smoothedOffset.y;
  camera.lookAt(0, 0, 0);

  // 同步更新 hitPlane 的位置（hitPlane 不在 hologramGroup 中，需要手动同步）
  // 由于相机移动，hitPlane 的世界坐标不变，但射线检测的投影会变化
  // Three.js 的 raycaster 会自动处理相机变换，所以不需要额外处理
}

/**
 * 复位视差效果（平滑过渡到中心）
 * 注意：只复位相机位置，不复位对象的 rotation（避免与手部旋转冲突）
 */
function resetParallax() {
  const sceneAPI = (window as any).svgSceneAPI;
  if (!sceneAPI) return;

  const camera = sceneAPI.getCamera();
  if (!camera) return;

  // 平滑复位：使用与 applyParallaxToObjects 相同的 lerp 逻辑，目标为0
  const smoothedOffset = {
    x: lerp(cameraOffsetCache.x, 0, FACE_PARALLAX_CONFIG.SMOOTHING_FACTOR),
    y: lerp(cameraOffsetCache.y, 0, FACE_PARALLAX_CONFIG.SMOOTHING_FACTOR)
  };

  // 更新缓存
  cameraOffsetCache.x = smoothedOffset.x;
  cameraOffsetCache.y = smoothedOffset.y;

  // 移动相机位置（保持 Z 轴距离不变）
  camera.position.x = smoothedOffset.x;
  camera.position.y = smoothedOffset.y;
  camera.lookAt(0, 0, 0);

  // 当接近中心时，精确复位相机
  if (Math.abs(smoothedOffset.x) < 0.01 && Math.abs(smoothedOffset.y) < 0.01) {
    cameraOffsetCache.x = 0;
    cameraOffsetCache.y = 0;
    camera.position.set(0, 0, CAMERA_CONFIG.CAMERA_Z);
  }
  
  // 重要：不复位对象的 rotation，因为手部旋转交互会使用这个
  // 面部视差和手部旋转是两个独立的变换，不应该互相覆盖
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
