/**
 * 面部检测服务
 * 使用 MediaPipe FaceDetection 检测人脸位置
 * FaceDetection 从 CDN 加载，通过全局变量访问
 */

import { faceStore, faceActions } from '@/stores/faceStore';
import { objectActions } from '@/stores/objectStore';
import { FACE_PARALLAX_CONFIG, CAMERA_CONFIG } from '@/config';
import { getRotationMode } from '@/components/DebugPanel';
import { lerp } from '@/utils/math';

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
  const targetOffsetY = faceY * FACE_PARALLAX_CONFIG.PARALLAX_STRENGTH * FACE_PARALLAX_CONFIG.Y_AXIS_MULTIPLIER;

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
 * 复位视差效果
 */
function resetParallax() {
  const sceneAPI = (window as any).svgSceneAPI;
  if (!sceneAPI) return;

  const camera = sceneAPI.getCamera();
  if (!camera) return;

  // 复位相机位置到中心
  camera.position.set(0, 0, CAMERA_CONFIG.CAMERA_Z);
  camera.lookAt(0, 0, 0);

  // 复位偏移缓存
  cameraOffsetCache.x = 0;
  cameraOffsetCache.y = 0;

  // 复位每个对象的 rotation store
  const svgObjects = sceneAPI.getSVGObjects();
  if (svgObjects) {
    svgObjects.forEach((obj: any) => {
      if (obj.hitPlane) {
        obj.hitPlane.rotation.set(0, 0, 0);
      }
      objectActions.updateObjectRotation(obj.id, { x: 0, y: 0, z: 0 });
    });
  }
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
