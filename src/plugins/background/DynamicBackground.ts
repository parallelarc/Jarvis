/**
 * 动态温暖背景插件
 * 复刻电视屏幕的温暖橙色背景效果
 * 特征：径向渐变 + 方向性光照 + 微妙的微动 + 暗角
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
      uResolution: { value: new THREE.Vector2(1, 1) },
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
        DYNAMIC_BACKGROUND_CONFIG.HIGHLIGHT_COLOR.r,
        DYNAMIC_BACKGROUND_CONFIG.HIGHLIGHT_COLOR.g,
        DYNAMIC_BACKGROUND_CONFIG.HIGHLIGHT_COLOR.b
      )},
      uLightDir: { value: new THREE.Vector2(
        DYNAMIC_BACKGROUND_CONFIG.LIGHT_DIRECTION.x,
        DYNAMIC_BACKGROUND_CONFIG.LIGHT_DIRECTION.y
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
      uniform vec2 uResolution;
      uniform vec3 uColor1;      // 主色（深橙 #FF7F50）
      uniform vec3 uColor2;      // 次色（浅橙 #FFA07A）
      uniform vec3 uColor3;      // 高光（暖白 #FFF5EE）
      uniform vec2 uLightDir;    // 光照方向（左上到右下）
      varying vec2 vUv;

      // 简单噪声函数（用于微动效果）
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
        for(int i = 0; i < 3; i++) {
          sum += amp * noise(p);
          p *= 2.0;
          amp *= 0.5;
        }
        return sum;
      }

      void main() {
        vec2 uv = vUv - 0.5;  // 坐标范围: (-0.5, -0.5) 到 (0.5, 0.5)

        // 1. 光源位置随时间平移（从左上到右上，再循环）
        // 光源在顶部 y=0.4，x 从 -0.5 到 0.5 往返移动
        float lightX = sin(uTime * 0.15) * 0.5;  // -0.5 到 0.5 的循环（更慢的速度）
        vec2 lightPos = vec2(lightX, 0.4);      // 光源位置在顶部

        // 2. 光束方向：向右下斜射 (45度角)
        vec2 lightDir = normalize(vec2(1.0, -1.0));  // 右下方向

        // 3. 计算像素到光源的向量
        vec2 toPixel = uv - lightPos;
        float distToLight = length(toPixel);
        vec2 toPixelDir = normalize(toPixel + 0.001);

        // 4. 计算光束强度
        // 距离衰减（光源附近更亮）
        float distanceAttenuation = 1.0 / (1.0 + distToLight * 2.5);
        distanceAttenuation = clamp(distanceAttenuation, 0.0, 1.0);

        // 方向性：光束主要向右下照射，像素在光束方向上更亮
        float beamAngle = dot(toPixelDir, lightDir);  // -1 到 1
        float beamMask = smoothstep(-0.5, 1.0, beamAngle);  // 只照亮右下半球

        // 光束聚焦：类似聚光灯效果
        float beamFocus = pow(max(beamAngle, 0.0), 3.0);

        // 组合光束强度
        float beamIntensity = distanceAttenuation * beamMask * (0.3 + beamFocus * 0.7);

        // 5. 基础环境光（右下角始终较暗）
        float ambient = (-uv.x + uv.y) * 0.4 + 0.4;  // 左上亮、右下暗
        ambient = clamp(ambient, 0.2, 0.8);

        // 6. 径向渐变（中心稍亮）
        float dist = length(uv);
        float radial = 1.0 - smoothstep(0.0, 0.6, dist) * 0.3;

        // 7. 微妙的流动纹理（增加视觉层次）
        float flow = fbm(vec2(uv.x * 2.0, uv.y * 2.0 + uTime * 0.02)) * 0.05;

        // 8. 暗角效果
        float vignette = 1.0 - smoothstep(0.4, 0.7, dist) * 0.25;

        // 组合所有光照
        float totalIntensity = ambient + beamIntensity * 0.5 + radial * 0.1 + flow;

        // 颜色混合
        vec3 color = uColor1;  // 基础深橙色
        color = mix(color, uColor2, totalIntensity * 0.7);  // 混入中间色
        color = mix(color, uColor3, beamIntensity * 0.5);   // 光束区域添加高光

        // 应用暗角
        color *= vignette;

        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }

  update(deltaTime: number): void {
    // 微动效果 - 非常缓慢的时间更新
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
