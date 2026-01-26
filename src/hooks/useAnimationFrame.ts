/**
 * useAnimationFrame Hook
 * 提供动画帧循环的功能
 */

import { onMount, onCleanup } from 'solid-js';

export interface UseAnimationFrameOptions {
  /**
   * 是否在挂载时自动启动
   */
  autoStart?: boolean;
}

/**
 * 动画帧回调函数类型
 */
export type AnimationFrameCallback = (deltaTime: number, elapsedTime: number) => void;

/**
 * 使用动画帧 Hook
 *
 * @param callback - 每帧调用的回调函数
 * @param options - 配置选项
 * @returns 控制对象 { start, stop, isRunning }
 */
export function useAnimationFrame(
  callback: AnimationFrameCallback,
  options: UseAnimationFrameOptions = {}
) {
  const { autoStart = true } = options;

  let animationFrameId: number | null = null;
  let isRunning = false;
  let lastTime = 0;
  let elapsedTime = 0;

  /**
   * 动画循环函数
   */
  function animate(currentTime: number) {
    if (!isRunning) return;

    // 计算时间差（秒）
    const deltaTime = lastTime > 0 ? (currentTime - lastTime) / 1000 : 0;
    elapsedTime += deltaTime;
    lastTime = currentTime;

    // 调用回调函数
    callback(deltaTime, elapsedTime);

    // 请求下一帧
    animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * 开始动画循环
   */
  function start() {
    if (isRunning) return;
    isRunning = true;
    lastTime = 0;
    elapsedTime = 0;
    animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * 停止动画循环
   */
  function stop() {
    isRunning = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  /**
   * 组件挂载时自动启动
   */
  onMount(() => {
    if (autoStart) {
      start();
    }
  });

  /**
   * 组件清理时停止动画
   */
  onCleanup(() => {
    stop();
  });

  return {
    start,
    stop,
    get isRunning() { return isRunning; },
  };
}

/**
 * 使用固定时间步长的动画帧 Hook
 * 适用于需要恒定物理更新频率的场景
 *
 * @param callback - 每帧调用的回调函数
 * @param fixedDelta - 固定时间步长（秒）
 * @returns 控制对象
 */
function useFixedTimestepAnimation(
  callback: (deltaTime: number) => void,
  fixedDelta = 1 / 60
) {
  let accumulator = 0;

  const { start, stop, isRunning } = useAnimationFrame((deltaTime, elapsedTime) => {
    accumulator += deltaTime;

    while (accumulator >= fixedDelta) {
      callback(fixedDelta);
      accumulator -= fixedDelta;
    }
  }, { autoStart: false });

  return { start, stop, isRunning };
}
