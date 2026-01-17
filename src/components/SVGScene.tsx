/**
 * SVG 场景组件
 * 管理 Three.js 渲染和 SVG 对象显示
 */

import { onMount, onCleanup, untrack } from 'solid-js';
import { objectStore, objectActions } from '@/stores/objectStore';
import { SVGRegistry } from '@/plugins/svg/SVGRegistry';
import { SVGObject } from '@/plugins/svg/SVGObject';
import { CAMERA_CONFIG } from '@/config';

export function SVGScene() {
  let sceneRef: HTMLDivElement | undefined;
  let scene: any = null;
  let camera: any = null;
  let renderer: any = null;
  let animationFrameId: number | null = null;

  // SVG 对象集合
  const svgObjects = new Map<string, SVGObject>();

  // 布局配置
  const LAYOUT_CONFIG = {
    initialY: -1.5,      // 距底部 1/3 位置
    spacing: 1.5,        // 对象间距
    baseScale: 1.0,      // 基础缩放
  };

  /**
   * 初始化 Three.js 场景
   */
  function initScene() {
    if (!sceneRef || !window.THREE) return;

    const THREE = window.THREE;

    // 场景
    scene = new THREE.Scene();

    // 相机
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.CAMERA_FOV,
      aspect,
      CAMERA_CONFIG.CAMERA_NEAR,
      CAMERA_CONFIG.CAMERA_FAR
    );
    camera.position.z = CAMERA_CONFIG.CAMERA_Z;

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    sceneRef.appendChild(renderer.domElement);

    // 初始化 SVG 对象
    initSVGObjects();

    // 开始渲染循环
    startRenderLoop();
  }

  /**
   * 初始化 SVG 对象
   */
  async function initSVGObjects() {
    try {
      const textures = await SVGRegistry.loadAllTextures();
      const THREE = window.THREE;

      // 计算起始位置（居中排列）
      const startX = -((textures.length - 1) * LAYOUT_CONFIG.spacing) / 2;

      // 收集初始位置
      const initialPositions: Record<string, { x: number; y: number; z: number }> = {};

      textures.forEach((texture: any, index: number) => {
        const id = ['v', 'b', 'o', 't', 'flower', 'bot'][index];
        const position = new THREE.Vector3(
          startX + index * LAYOUT_CONFIG.spacing,
          LAYOUT_CONFIG.initialY,
          0
        );

        const svgObj = new SVGObject({
          id,
          texture,
          position,
          baseScale: LAYOUT_CONFIG.baseScale,
        });

        svgObjects.set(id, svgObj);
        scene.add(svgObj.mesh);
        scene.add(svgObj.hitPlane);

        // 收集初始位置用于 store 更新
        initialPositions[id] = { x: position.x, y: position.y, z: position.z };
      });

      // 批量更新 store 中的初始位置
      objectActions.setInitialPositions(initialPositions);

      console.log('[SVGScene] Initialized', svgObjects.size, 'SVG objects');
    } catch (error) {
      console.error('[SVGScene] Error initializing SVG objects:', error);
    }
  }

  /**
   * 渲染循环
   */
  function startRenderLoop() {
    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      const time = Date.now() * 0.001;

      // 使用 untrack 避免在渲染循环中触发响应式追踪
      untrack(() => {
        // 可以在这里添加动画效果
        // 例如：轻微的悬浮动画
        svgObjects.forEach((obj, id) => {
          const storePos = objectStore.objects[id]?.position;
          if (storePos) {
            // 添加轻微的悬浮效果
            const floatOffset = Math.sin(time * 2 + getPositionIndex(id) * 0.5) * 0.05;
            obj.mesh.position.z = floatOffset;
            obj.hitPlane.position.z = floatOffset;
          }
        });
      });

      renderer.render(scene, camera);
    };

    render();
  }

  /**
   * 获取对象索引（用于动画相位偏移）
   */
  function getPositionIndex(id: string): number {
    const order = ['v', 'b', 'o', 't', 'flower', 'bot'];
    return order.indexOf(id);
  }

  /**
   * 获取场景对象（供外部使用）
   */
  function getScene() {
    return scene;
  }

  /**
   * 获取相机对象（供外部使用）
   */
  function getCamera() {
    return camera;
  }

  /**
   * 获取 SVG 对象映射（供外部使用）
   */
  function getSVGObjects() {
    return svgObjects;
  }

  /**
   * 窗口大小调整
   */
  function handleResize() {
    if (!camera || !renderer) return;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * 组件挂载
   */
  onMount(() => {
    // 延迟初始化，确保 THREE 已加载
    setTimeout(() => {
      if (typeof window.THREE !== 'undefined') {
        initScene();
        window.addEventListener('resize', handleResize);

        // 将方法暴露到全局，供交互 hook 使用
        (window as any).svgSceneAPI = {
          getScene,
          getCamera,
          getSVGObjects,
        };
      } else {
        console.error('[SVGScene] THREE.js not loaded');
      }
    }, 100);
  });

  /**
   * 组件清理
   */
  onCleanup(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    window.removeEventListener('resize', handleResize);

    // 释放 SVG 对象资源
    svgObjects.forEach(obj => obj.dispose());
    svgObjects.clear();

    // 释放纹理资源
    SVGRegistry.dispose();

    if (renderer && sceneRef) {
      sceneRef.removeChild(renderer.domElement);
      renderer.dispose();
    }

    // 清理全局 API
    delete (window as any).svgSceneAPI;
  });

  return <div ref={sceneRef} class="particle-scene" />;
}

/**
 * 获取场景 API（供其他组件使用）
 */
export function getSVGSceneAPI() {
  return (window as any).svgSceneAPI;
}
