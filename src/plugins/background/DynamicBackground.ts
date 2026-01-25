/**
 * 动态阳光背景插件
 * 使用 Three.js ShaderMaterial 实现缓慢流动的色彩效果
 * 模拟阳光从上方照射到墙面的视觉质感
 */

import { DYNAMIC_BACKGROUND_CONFIG } from '@/config';
import { THREE } from '@/utils/three';

export class DynamicBackground {
  private mesh: any = null;
  private material: any = null;
  private uniforms: any = null;

  constructor(scene: any) {
    this.init(scene);
  }

  private init(scene: any): void {
    // 全屏平面几何体
    const geometry = new THREE.PlaneGeometry(
      DYNAMIC_BACKGROUND_CONFIG.PLANE_SIZE,
      DYNAMIC_BACKGROUND_CONFIG.PLANE_SIZE
    );

    // Shader uniforms
    this.uniforms = {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(
        DYNAMIC_BACKGROUND_CONFIG.PRIMARY_COLOR.r,
        DYNAMIC_BACKGROUND_CONFIG.PRIMARY_COLOR.g,
        DYNAMIC_BACKGROUND_CONFIG.PRIMARY_COLOR.b
      )},
      uColor2: { value: new THREE.Color(
        DYNAMIC_BACKGROUND_CONFIG.SECONDARY_COLOR.r,
        DYNAMIC_BACKGROUND_CONFIG.SECONDARY_COLOR.g,
        DYNAMIC_BACKGROUND_CONFIG.SECONDARY_COLOR.b
      )},
      uColor3: { value: new THREE.Color(
        DYNAMIC_BACKGROUND_CONFIG.SHADOW_COLOR.r,
        DYNAMIC_BACKGROUND_CONFIG.SHADOW_COLOR.g,
        DYNAMIC_BACKGROUND_CONFIG.SHADOW_COLOR.b
      )},
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = DYNAMIC_BACKGROUND_CONFIG.PLANE_Z;
    scene.add(this.mesh);
  }

  private getVertexShader(): string {
    return `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  private getFragmentShader(): string {
    return `
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      varying vec2 vUv;

      // 简单噪声函数
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float sum = 0.0;
        float amp = 0.5;
        for(int i = 0; i < 4; i++) {
          sum += amp * noise(p);
          p *= 2.0;
          amp *= 0.5;
        }
        return sum;
      }

      void main() {
        // 坐标从中心(0,0)到四周
        vec2 uv = vUv - 0.5;

        // 从上方的光束效果 - 整体保持明亮
        float beam = 0.8 + 0.2 * smoothstep(-0.5, 0.5, uv.y + 0.3);

        // 缓慢流动的云纹
        float flow1 = fbm(vec2(uv.x * 1.5, uv.y * 2.0 + uTime * 0.15));
        float flow2 = fbm(vec2(uv.x * 2.5 - uTime * 0.08, uv.y * 1.5));

        // 组合效果 - 高亮度基准
        float intensity = beam * (0.85 + 0.15 * flow1) * (0.9 + 0.1 * flow2);

        // 三色混合 - 主色为主，暗部几乎不出现
        vec3 color = mix(uColor1 * 1.1, uColor1, intensity);  // 主色稍微提亮
        color = mix(color, uColor2, intensity * flow1 * 0.4);  // 云纹高光

        // 极轻微暗角
        float dist = length(uv);
        float vignette = 1.0 - smoothstep(0.5, 0.8, dist) * 0.1;
        color *= vignette;

        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }

  update(deltaTime: number): void {
    if (this.uniforms) {
      this.uniforms.uTime.value += deltaTime * DYNAMIC_BACKGROUND_CONFIG.TIME_SCALE;
    }
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.material.dispose();
    }
  }
}
