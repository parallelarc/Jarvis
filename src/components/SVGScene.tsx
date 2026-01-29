/**
 * SVG 场景组件
 * 管理 Three.js 渲染和 SVG 对象显示
 */

import type * as THREE_TYPE from 'three';
import { onMount, onCleanup, untrack, createEffect } from 'solid-js';
import { objectStore, objectActions } from '@/stores/objectStore';
import { SVGRegistry, SVG_OBJECT_IDS } from '@/plugins/svg/SVGRegistry';
import { SVGObject } from '@/plugins/svg/SVGObject';
import { CAMERA_CONFIG, SVG_LAYOUT_CONFIG, SVG_POSITION_CONFIG, DESIGN_CONFIG, HOLOGRAM_CONFIG } from '@/config';
import { DynamicBackground } from '@/plugins/background/DynamicBackground';
import { THREE } from '@/utils/three';

export function SVGScene() {
  let sceneRef: HTMLDivElement | undefined;
  let scene: THREE_TYPE.Scene | null = null;
  let camera: THREE_TYPE.PerspectiveCamera | null = null;
  let renderer: THREE_TYPE.WebGLRenderer | null = null;
  let animationFrameId: number | null = null;

  // SVG 对象集合
  const svgObjects = new Map<string, SVGObject>();

  // 全息板父容器 - 所有 SVG 对象的统一旋转容器
  let hologramGroup: THREE_TYPE.Group | null = null;

  // 全息板边缘框 - 显示厚度视觉效果
  let hologramEdges: THREE_TYPE.LineSegments | null = null;

  // 动态背景
  let dynamicBackground: DynamicBackground | null = null;

  // 性能优化：缓存旋转值，避免每帧读取响应式 Store
  const cachedRotations = new Map<string, { x: number; y: number; z: number }>();

  // 使用配置文件中的设计画布尺寸（用于尺寸换算）
  const { DESIGN_CANVAS_WIDTH, WORLD_WIDTH } = DESIGN_CONFIG;

  /**
   * 根据设计宽度计算 baseScale
   * worldWidth = baseScale * aspectX
   * baseScale = worldWidth / aspectX
   */
  function calculateBaseScale(designWidth: number, aspectX: number): number {
    const worldWidth = designWidth / DESIGN_CANVAS_WIDTH * WORLD_WIDTH;
    return worldWidth / aspectX;
  }

  /**
   * 初始化 Three.js 场景
   */
  function initScene() {
    if (!sceneRef || !window.THREE) return;

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
    camera!.position.z = CAMERA_CONFIG.CAMERA_Z;

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer!.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer!.setSize(window.innerWidth, window.innerHeight);
    renderer!.setClearColor(0x000000, 0);
    sceneRef!.appendChild(renderer!.domElement);

    // 创建动态背景
    dynamicBackground = new DynamicBackground(scene!);

    // 添加三点光照系统
    // 1. 环境光 (Ambient Light) - 基础照明，增强至白色表面可见
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene!.add(ambientLight);

    // 2. 主光 (Key Light) - 定义明暗
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 5, 10);
    scene!.add(mainLight);

    // 3. 补光 (Fill Light) - 柔化阴影
    const fillLight = new THREE.PointLight(0xccccff, 0.6);
    fillLight.position.set(-5, 0, 5);
    scene!.add(fillLight);

    // 4. 轮廓光 (Rim Light) - 勾勒边缘
    const rimLight = new THREE.SpotLight(0xffffff, 0.8);
    rimLight.position.set(0, 5, -2);
    rimLight.lookAt(0, 0, 0);
    scene!.add(rimLight);

    // 创建全息板父容器 - 所有 SVG 对象都将添加到这个 Group
    // 这样可以实现整体旋转效果，而不是每个对象单独旋转
    hologramGroup = new THREE.Group();
    scene!.add(hologramGroup!);

    // 初始化 SVG 对象
    initSVGObjects();

    // 初始化旋转缓存
    initRotationCache();

    // 开始渲染循环
    startRenderLoop();
  }

  /**
   * 初始化 SVG 对象
   */
  async function initSVGObjects() {
    try {
      const textures = await SVGRegistry.loadAllTextures();

      // 收集初始位置和旋转
      const initialPositions: Record<string, { x: number; y: number; z: number }> = {};
      const initialRotations: Record<string, { x: number; y: number; z: number }> = {};
      const initialScales: Record<string, number> = {};

      textures.forEach((texture: any, index: number) => {
        const id = SVG_OBJECT_IDS[index];
        const layout = SVG_LAYOUT_CONFIG[id];
        const posConfig = SVG_POSITION_CONFIG[id];

        // 使用配置文件中的位置，如果没有配置则使用默认值
        const x = posConfig?.x ?? (index - 2.5) * 1.5;
        const y = posConfig?.y ?? -1.5;
        const position = new THREE.Vector3(x, y, 0);

        // 获取原始尺寸用于计算宽高比
        const originalSize = SVGRegistry.getSize(id) ?? { width: 1, height: 1 };
        const maxDim = Math.max(originalSize.width, originalSize.height);
        const aspectX = originalSize.width / maxDim;

        // 根据 size_rule.md 中的设计宽度计算 baseScale
        const baseScale = layout
          ? calculateBaseScale(layout.width, aspectX)
          : 1.0;

        const shapeData = SVGRegistry.getShapeData(id);

        if (import.meta.env.DEV) {
          console.log(`[SVGScene] Creating SVGObject ${id}:`, {
            hasShapeData: shapeData && shapeData.length > 0,
            shapeDataLength: shapeData ? shapeData.length : 0,
            baseScale,
            originalSize,
            position
          });
        }

        const svgObj = new SVGObject({
          id,
          texture,
          position,
          baseScale,
          originalSize,
          shapeData,
        });

        svgObjects.set(id, svgObj);
        hologramGroup!.add(svgObj.mesh);
        scene!.add(svgObj.hitPlane);  // hitPlane 仍需添加到 scene，因为它需要独立进行射线检测

        if (import.meta.env.DEV) {
          console.log(`[SVGScene] ${id}: pos=(${x.toFixed(2)}, ${y.toFixed(2)}) baseScale=${baseScale.toFixed(2)}`);
        }

        // 收集初始位置用于 store 更新（使用 Three.js mesh 的实际位置）
        initialPositions[id] = {
          x: svgObj.mesh.position.x,
          y: svgObj.mesh.position.y,
          z: svgObj.mesh.position.z
        };

        // 收集初始旋转（使用 Three.js mesh 的实际旋转）
        initialRotations[id] = {
          x: svgObj.mesh.rotation.x,
          y: svgObj.mesh.rotation.y,
          z: svgObj.mesh.rotation.z
        };

        // 收集初始缩放（使用 Three.js mesh 的实际 scale）
        // 注意：mesh.scale.y 是负数，但我们在 store 中使用正数的世界坐标尺寸
        // 读取 mesh.scale.x 作为基准（x 和 z 的绝对值应该相同）
        initialScales[id] = 1.0; // 初始缩放始终为 1.0
      });

      // 批量更新 store 中的初始位置和旋转
      objectActions.setInitialPositions(initialPositions);
      objectActions.setInitialRotations(initialRotations);
      objectActions.setInitialScales(initialScales);

      if (import.meta.env.DEV) {
        console.log(`[SVGScene] Initial positions set:`, initialPositions);
        console.log(`[SVGScene] Expected positions from config:`, Object.fromEntries(
          SVG_OBJECT_IDS.map(id => [id, SVG_POSITION_CONFIG[id]])
        ));
        console.log(`[SVGScene] Initialized ${svgObjects.size} SVG objects with custom sizes`);
      }

      // 创建全息板边缘框
      createHologramEdges();
    } catch (error) {
      console.error('[SVGScene] Error initializing SVG objects:', error);
      if (import.meta.env.DEV) {
        console.error('[SVGScene] Error details:', {
          message: (error as Error).message,
          stack: (error as Error).stack,
          name: (error as Error).name
        });
      }
    }
  }

  /**
   * 创建全息板边缘框 - 显示厚度视觉效果
   * 计算所有元素的整体边界，创建一个带厚度的边缘框
   */
  function createHologramEdges() {
    if (!hologramGroup) return;

    // 计算所有元素的整体边界
    const overallBox = new THREE.Box3();
    svgObjects.forEach((obj) => {
      const bounds = obj.getBounds();
      overallBox.union(bounds);
    });

    // 添加边距
    overallBox.min.x -= HOLOGRAM_CONFIG.EDGE_MARGIN;
    overallBox.min.y -= HOLOGRAM_CONFIG.EDGE_MARGIN;
    overallBox.max.x += HOLOGRAM_CONFIG.EDGE_MARGIN;
    overallBox.max.y += HOLOGRAM_CONFIG.EDGE_MARGIN;

    // 定义厚度（Z轴方向）
    const thickness = HOLOGRAM_CONFIG.EDGE_THICKNESS;
    overallBox.min.z = -thickness / 2;
    overallBox.max.z = thickness / 2;

    // 创建边缘几何体 - 使用 LineSegments 显示边框
    const edgesGeometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(
        overallBox.max.x - overallBox.min.x,
        overallBox.max.y - overallBox.min.y,
        thickness
      )
    );

    // 计算中心点
    const centerX = (overallBox.min.x + overallBox.max.x) / 2;
    const centerY = (overallBox.min.y + overallBox.max.y) / 2;

    // 创建边缘材质 - 半透明发光效果
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: HOLOGRAM_CONFIG.EDGE_COLOR,
      transparent: true,
      opacity: HOLOGRAM_CONFIG.EDGE_OPACITY,
    });

    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    edges.position.set(centerX, centerY, 0);
    hologramEdges = edges;

    // 添加到全息板容器
    hologramGroup.add(edges);

    // 创建侧面 - 显示厚度
    createHologramSides(overallBox, thickness);

    if (import.meta.env.DEV) {
      console.log('[SVGScene] Hologram edges created with bounds:', overallBox);
    }
  }

  /**
   * 创建全息板侧面 - 显示厚度视觉效果
   */
  function createHologramSides(bounds: THREE_TYPE.Box3, thickness: number) {
    if (!hologramGroup) return;

    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerY = (bounds.min.y + bounds.max.y) / 2;

    // 创建侧面材质 - 半透明深色
    const sideMaterial = new THREE.MeshBasicMaterial({
      color: HOLOGRAM_CONFIG.SIDE_COLOR,
      transparent: true,
      opacity: HOLOGRAM_CONFIG.SIDE_OPACITY,
      side: THREE.DoubleSide,
    });

    // 创建四个侧面（左、右、上、下）
    const sideThickness = HOLOGRAM_CONFIG.SIDE_THICKNESS;

    // 左侧框
    const leftGeo = new THREE.BoxGeometry(sideThickness, height, thickness);
    const leftSide = new THREE.Mesh(leftGeo, sideMaterial);
    leftSide.position.set(bounds.min.x, centerY, 0);
    hologramGroup.add(leftSide);

    // 右侧框
    const rightGeo = new THREE.BoxGeometry(sideThickness, height, thickness);
    const rightSide = new THREE.Mesh(rightGeo, sideMaterial);
    rightSide.position.set(bounds.max.x, centerY, 0);
    hologramGroup.add(rightSide);

    // 上侧框
    const topGeo = new THREE.BoxGeometry(width + sideThickness * 2, sideThickness, thickness);
    const topSide = new THREE.Mesh(topGeo, sideMaterial);
    topSide.position.set(centerX, bounds.max.y, 0);
    hologramGroup.add(topSide);

    // 下侧框
    const bottomGeo = new THREE.BoxGeometry(width + sideThickness * 2, sideThickness, thickness);
    const bottomSide = new THREE.Mesh(bottomGeo, sideMaterial);
    bottomSide.position.set(centerX, bounds.min.y, 0);
    hologramGroup.add(bottomSide);
  }

  /**
   * 初始化旋转缓存并监听变化
   * 性能优化：使用响应式 effect 同步旋转值到缓存，避免渲染循环中频繁读取 Store
   */
  function initRotationCache() {
    // 初始化缓存：从 Store 中读取当前旋转值
    SVG_OBJECT_IDS.forEach(id => {
      const rotation = objectStore.objects[id]?.rotation;
      if (rotation) {
        cachedRotations.set(id, { x: rotation.x, y: rotation.y, z: rotation.z || 0 });
      }
    });

    // 创建响应式 effects：分别监听每个对象的旋转变化
    // 这样可以避免 untrack() 并且减少不必要的追踪
    SVG_OBJECT_IDS.forEach(id => {
      createEffect(() => {
        const rotation = objectStore.objects[id]?.rotation;
        if (rotation) {
          const cached = cachedRotations.get(id);
          const isChanged =
            !cached ||
            cached.x !== rotation.x ||
            cached.y !== rotation.y ||
            cached.z !== rotation.z;

          if (isChanged) {
            cachedRotations.set(id, { x: rotation.x, y: rotation.y, z: rotation.z || 0 });
          }
        }
      });
    });
  }

  /**
   * 渲染循环
   */
  function startRenderLoop() {
    let lastTime = Date.now();

    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      const time = now * 0.001;

      // 使用 untrack 避免在渲染循环中触发响应式追踪
      untrack(() => {
        // 更新动态背景
        if (dynamicBackground) {
          dynamicBackground.update(deltaTime);
        }

        // 添加轻微的悬浮动画
        svgObjects.forEach((obj, id) => {
          const storePos = objectStore.objects[id]?.position;
          if (storePos) {
            // 添加轻微的悬浮效果
            const floatOffset = Math.sin(time * 2 + getPositionIndex(id) * 0.5) * 0.05;

            // 更新 mesh 位置
            obj.mesh.position.z = floatOffset;

            // 更新 hitPlane 位置
            obj.hitPlane.position.z = floatOffset;

            // 性能优化：直接使用缓存的旋转值（通过 effect 保持同步）
            // 这样渲染循环完全不读取响应式 Store
            const cachedRotation = cachedRotations.get(id);
            if (cachedRotation) {
              // 只在旋转值真正改变时才调用 setRotation（避免不必要的性能开销）
              const currentMeshRotation = obj.mesh.rotation;
              if (currentMeshRotation.x !== cachedRotation.x ||
                  currentMeshRotation.y !== cachedRotation.y ||
                  currentMeshRotation.z !== cachedRotation.z) {
                obj.setRotation(cachedRotation);
              }
            }
          }
        });
      });

      renderer!.render(scene!, camera!);
    };

    render();
  }

  /**
   * 获取对象索引（用于动画相位偏移）
   */
  function getPositionIndex(id: string): number {
    return SVG_OBJECT_IDS.indexOf(id as any);
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
   * 获取全息板容器（供外部使用）
   * 面部视差效果通过旋转这个容器实现整体旋转
   */
  function getHologramGroup() {
    return hologramGroup;
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
          getHologramGroup,
          setSelectedWithScene: (id: string, selected: boolean) => {
            const obj = svgObjects.get(id);
            if (obj && scene) {
              obj.setSelected(selected, scene);
            }
          },
        };
      } else {
        console.error('[SVGScene] THREE.js not loaded. Please check your network connection.');
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

    // 释放动态背景资源
    if (dynamicBackground) {
      dynamicBackground.dispose();
    }

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
