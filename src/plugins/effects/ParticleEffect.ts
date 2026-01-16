/**
 * 粒子效果基类
 */

export abstract class ParticleEffect {
  protected active = true;
  protected startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * 应用效果到粒子颜色
   */
  abstract apply(positions: Float32Array, colors: Float32Array): boolean;

  /**
   * 检查效果是否仍然活跃
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * 停止效果
   */
  stop(): void {
    this.active = false;
  }

  /**
   * 获取效果年龄（毫秒）
   */
  getAge(): number {
    return Date.now() - this.startTime;
  }
}
