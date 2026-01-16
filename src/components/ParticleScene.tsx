/**
 * 粒子场景组件
 * 管理 Three.js 渲染和粒子动画
 */

import { onMount, onCleanup } from 'solid-js';
import { particleStore, particleActions } from '@/stores/particleStore';
import { PARTICLE_CONFIG, CAMERA_CONFIG, RIPPLE_CONFIG } from '@/config';
import { SphereShape } from '@/plugins/shapes/SphereShape';

export function ParticleScene() {
  let sceneRef: HTMLDivElement | undefined;
  let scene: any = null;
  let camera: any = null;
  let renderer: any = null;
  let particleSystem: any = null;
  let animationFrameId: number | null = null;

  // 粒子数据（非响应式，避免性能问题）
  let positions: Float32Array | null = null;
  let basePositions: Float32Array | null = null;
  let phases: Float32Array | null = null;

  // 形状插件
  const sphereShape = new SphereShape();

  /**
   * 初始化粒子数据
   */
  function initParticleData() {
    const count = PARTICLE_CONFIG.PARTICLE_COUNT;
    positions = new Float32Array(count * 3);
    basePositions = new Float32Array(count * 3);
    phases = new Float32Array(count);

    // 生成球体分布
    const sphereTargets = sphereShape.generateTargets(count, 0);

    for (let i = 0; i < count * 3; i++) {
      basePositions[i] = sphereTargets[i];
      positions[i] = sphereTargets[i];
    }

    // 生成相位
    for (let i = 0; i < count; i++) {
      phases[i] = Math.random() * Math.PI * 2;
    }

    return { positions, basePositions, phases };
  }

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

    // 初始化粒子数据
    const particleData = initParticleData();
    positions = particleData.positions;
    basePositions = particleData.basePositions;
    phases = particleData.phases;

    // 创建粒子系统
    createParticleSystem();

    // 开始渲染循环
    startRenderLoop();
  }

  /**
   * 创建粒子系统
   */
  function createParticleSystem() {
    if (!window.THREE) return;
    const THREE = window.THREE;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions!, 3));

    // 创建颜色属性
    const baseColor = particleStore.baseColor;
    const colors = new Float32Array(PARTICLE_CONFIG.PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_CONFIG.PARTICLE_COUNT; i++) {
      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: PARTICLE_CONFIG.PARTICLE_SIZE,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
  }

  /**
   * 渲染循环
   */
  function startRenderLoop() {
    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      const time = Date.now() * 0.001;

      // 更新粒子
      updateParticles(time);

      // 更新颜色（应用效果）
      updateColors();

      // 标记几何体需要更新
      if (particleSystem) {
        particleSystem.geometry.attributes.position.needsUpdate = true;
        particleSystem.geometry.attributes.color.needsUpdate = true;
      }

      // 平滑更新扩展
      particleActions.smoothUpdateSpread();

      // 清理过期涟漪
      particleActions.cleanupRipples(RIPPLE_CONFIG.RIPPLE_DURATION);

      renderer.render(scene, camera);
    };

    render();
  }

  /**
   * 更新粒子位置
   */
  function updateParticles(time: number) {
    if (!particleSystem || !positions || !basePositions || !phases) return;

    const pos = particleSystem.geometry.attributes.position.array;
    const posValue = particleStore.spherePosition;
    const spread = particleStore.currentSpread;

    // 预计算旋转
    const rotationAngle = 0.01 + time * 0.1;
    const cosAngle = Math.cos(rotationAngle);
    const sinAngle = Math.sin(rotationAngle);

    for (let i = 0; i < PARTICLE_CONFIG.PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // 应用扩展
      const baseX = basePositions[i3] * spread;
      const baseY = basePositions[i3 + 1] * spread;
      const baseZ = basePositions[i3 + 2] * spread;

      // 绕 Y 轴旋转
      const rotatedX = baseX * cosAngle - baseZ * sinAngle;
      const rotatedZ = baseX * sinAngle + baseZ * cosAngle;

      // 添加脉冲
      const pulse = 1 + 0.05 * Math.sin(time * 2 + phases[i]);

      // 添加球体位置
      pos[i3] = rotatedX * pulse + posValue.x;
      pos[i3 + 1] = baseY * pulse + posValue.y;
      pos[i3 + 2] = rotatedZ * pulse + (posValue.z ?? 0);
    }
  }

  /**
   * 更新粒子颜色
   */
  function updateColors() {
    if (!particleSystem) return;

    const colors = particleSystem.geometry.attributes.color.array;
    const bc = particleStore.baseColor;

    // 重置为基础颜色
    for (let i = 0; i < PARTICLE_CONFIG.PARTICLE_COUNT; i++) {
      colors[i * 3] = bc.r;
      colors[i * 3 + 1] = bc.g;
      colors[i * 3 + 2] = bc.b;
    }

    // 应用活跃效果（涟漪）
    // 注意：这里简化处理，实际可以使用 RippleEffect 类
    // 由于性能考虑，直接在这里实现
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
      } else {
        console.error('THREE.js not loaded');
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

    if (renderer && sceneRef) {
      sceneRef.removeChild(renderer.domElement);
      renderer.dispose();
    }
  });

  return <div ref={sceneRef} class="particle-scene" />;
}
