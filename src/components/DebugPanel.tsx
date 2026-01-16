/**
 * 调试面板组件
 * 显示实时状态和手势信息
 */

import { createSignal, createMemo, onMount } from 'solid-js';
import { handStore } from '@/stores/handStore';
import { particleStore } from '@/stores/particleStore';
import { animationStore } from '@/stores/animationStore';
import type { ExtendedHandState } from '@/stores/handStore';

export function DebugPanel() {
  const [visible, setVisible] = createSignal(false);

  // 响应式状态 - 直接访问 store 属性
  const leftHand = () => handStore.left;
  const rightHand = () => handStore.right;
  const particleState = () => particleStore;
  const animState = () => animationStore;

  // 计算属性
  const activeHandsCount = createMemo(() =>
    [leftHand(), rightHand()].filter(h => h.active).length
  );

  /**
   * 切换显示
   */
  function toggleVisible() {
    setVisible(v => !v);
  }

  /**
   * 挂载时设置键盘快捷键
   */
  onMount(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        toggleVisible();
      }
    };
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  });

  /**
   * 渲染手部状态
   */
  function renderHandState(name: string, hand: ExtendedHandState) {
    return (
      <div class="hand-state">
        <h4>{name} Hand</h4>
        <div class="state-item">
          <span>Active:</span>
          <span class={hand.active ? 'yes' : 'no'}>
            {hand.active ? '✓' : '✗'}
          </span>
        </div>
        {hand.active && (
          <>
            <div class="state-item">
              <span>Touching:</span>
              <span class={hand.isTouching ? 'yes' : 'no'}>
                {hand.isTouching ? '✓' : '✗'}
              </span>
            </div>
            <div class="state-item">
              <span>Selected:</span>
              <span class={hand.isSelected ? 'yes' : 'no'}>
                {hand.isSelected ? '✓' : '✗'}
              </span>
            </div>
            <div class="state-item">
              <span>Pinching:</span>
              <span class={hand.isPinching ? 'yes' : 'no'}>
                {hand.isPinching ? '✓' : '✗'}
              </span>
            </div>
            <div class="state-item">
              <span>Pinch Distance:</span>
              <span>{hand.pinchDistance.toFixed(3)}</span>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {/* 切换按钮 */}
      <button
        class="debug-toggle"
        onClick={toggleVisible}
        classList={{ active: visible() }}
      >
        Debug
      </button>

      {/* 调试面板 */}
      {visible() && (
        <div class="debug-panel">
          <div class="debug-header">
            <h2>Debug Panel</h2>
            <button onClick={toggleVisible}>✕</button>
          </div>

          {/* 手部状态 */}
          <div class="debug-section">
            <h3>Hand State</h3>
            <div class="hands-grid">
              {renderHandState('Left', leftHand())}
              {renderHandState('Right', rightHand())}
            </div>
            <div class="state-item">
              <span>Active Hands:</span>
              <span>{activeHandsCount()}</span>
            </div>
          </div>

          {/* 粒子状态 */}
          <div class="debug-section">
            <h3>Particle State</h3>
            <div class="state-item">
              <span>Spread:</span>
              <span>{particleState().currentSpread.toFixed(2)}</span>
            </div>
            <div class="state-item">
              <span>Target Spread:</span>
              <span>{particleState().targetSpread.toFixed(2)}</span>
            </div>
            <div class="state-item">
              <span>Position:</span>
              <span>
                ({particleState().spherePosition.x.toFixed(2)},{' '}
                {particleState().spherePosition.y.toFixed(2)},{' '}
                {(particleState().spherePosition.z ?? 0).toFixed(2)})
              </span>
            </div>
            <div class="state-item">
              <span>Ripples:</span>
              <span>{particleState().ripples.length}</span>
            </div>
          </div>

          {/* 动画状态 */}
          <div class="debug-section">
            <h3>Animation State</h3>
            <div class="state-item">
              <span>State:</span>
              <span class="animation-state">{animState().current}</span>
            </div>
            <div class="state-item">
              <span>Hello Waving:</span>
              <span class={animState().helloWavingActive ? 'yes' : 'no'}>
                {animState().helloWavingActive ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
