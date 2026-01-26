/**
 * 调试面板 - 完全重写的简单版本
 */

import { createSignal, createMemo, Show, For } from 'solid-js';
import { handStore } from '@/stores/handStore';
import { faceStore, faceActions } from '@/stores/faceStore';
import { objectStore, objectActions } from '@/stores/objectStore';
import { calculateDistance } from '@/utils/math';
import { getMediaPipeFps } from '@/hooks/useGestureTracking';
import { getFaceDetectionFps } from '@/services/FaceDetectionService';
import './DebugPanel.css';

// 全局可见状态
const [visible, setVisible] = createSignal(false);
// 全局 bbox 调试模式状态
const [debugBBox, setDebugBBox] = createSignal(false);
// 旋转模式：'gesture' | 'face' | 'none'
const [rotationMode, setRotationMode] = createSignal<'gesture' | 'face' | 'none'>('gesture');

export function toggleDebugPanel() {
  setVisible(v => !v);
}

export function getDebugBBoxState() {
  return debugBBox();
}

export function setDebugBBoxState(value: boolean) {
  setDebugBBox(value);
}

export function getRotationMode() {
  return rotationMode();
}

export function setRotationModeValue(mode: 'gesture' | 'face' | 'none') {
  setRotationMode(mode);
}

// 导出供其他模块使用
export const rotationModeSignal = rotationMode;

export function DebugPanel() {
  // 直接从 store 读取数据 - 使用 createMemo 确保响应式
  // 只订阅具体字段，避免整个 store 变化触发重新计算
  const leftHand = createMemo(() => handStore.left);
  const rightHand = createMemo(() => handStore.right);
  const zoomMode = createMemo(() => handStore.zoomMode);

  // MediaPipe FPS（独立于页面 FPS）
  const mpFps = createMemo(() => getMediaPipeFps());

  // FaceDetection FPS
  const faceFps = createMemo(() => getFaceDetectionFps());

  // 分别订阅对象状态的各个字段
  const selectedObjectId = createMemo(() => objectStore.selectedObjectId);
  const objects = createMemo(() => objectStore.objects);

  // 计算双手距离
  const handsDistance = createMemo(() => {
    const left = leftHand();
    const right = rightHand();
    if (!left.landmarks || !right.landmarks) return null;
    const leftWrist = left.landmarks[0];
    const rightWrist = right.landmarks[0];
    return calculateDistance(leftWrist, rightWrist);
  });

  // 检测到的手数量
  const handsDetected = createMemo(() => {
    let count = 0;
    if (leftHand().active) count++;
    if (rightHand().active) count++;
    return count;
  });

  // 面部检测状态
  const faceDetected = createMemo(() => faceStore.detected);
  const facePosition = createMemo(() => ({ x: faceStore.x, y: faceStore.y }));
  const faceEnabled = createMemo(() => faceStore.enabled);

  // FPS 计数
  const [fps, setFps] = createSignal(0);
  let frameCount = 0;
  let lastTime = performance.now();

  // FPS 更新循环
  function updateFps() {
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 500) {
      setFps(Math.round(frameCount * 1000 / (now - lastTime)));
      frameCount = 0;
      lastTime = now;
    }
    requestAnimationFrame(updateFps);
  }

  // 启动 FPS 计数
  requestAnimationFrame(updateFps);

  // 键盘快捷键
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'd' || e.key === 'D') {
      toggleDebugPanel();
    }
  }

  // 切换 BBox 显示
  function toggleBBox() {
    const newState = !debugBBox();
    setDebugBBox(newState);

    const sceneAPI = (window as any).svgSceneAPI;
    if (sceneAPI) {
      const scene = sceneAPI.getScene();
      const svgObjects = sceneAPI.getSVGObjects();
      if (svgObjects) {
        svgObjects.forEach((obj: any) => {
          obj.showDebugBounds(newState, scene);
        });
      }
    }
  }

  // 挂载时设置
  window.addEventListener('keydown', handleKeyDown);

  return (
    <>
      {/* 切换按钮 - 已隐藏 */}
      <button
        class="debug-toggle"
        onClick={toggleDebugPanel}
        classList={{ active: visible() }}
        style={{ display: 'none' }}
      >
        Debug
      </button>

      {/* 调试面板 */}
      <Show when={visible()}>
        <div class="debug-panel">
          <div class="debug-header">
            <h2>Debug Panel</h2>
            <button class="debug-close" onClick={toggleDebugPanel}>✕</button>
          </div>

          <div class="debug-content">
            {/* 系统信息 */}
            <div class="debug-section">
              <h3>System</h3>
              <div class="debug-row">
                <span>FPS:</span>
                <span class="debug-value">{fps()}</span>
              </div>
              <div class="debug-row">
                <span>MP-FPS:</span>
                <span class="debug-value">{mpFps()}</span>
              </div>
              <div class="debug-row">
                <span>Face-FPS:</span>
                <span class="debug-value">{faceFps()}</span>
              </div>
              <div class="debug-row">
                <span>Hands:</span>
                <span class="debug-value">{handsDetected()} detected</span>
              </div>
              <div class="debug-row">
                <span>Show BBoxes:</span>
                <button
                  class="debug-toggle-btn"
                  onClick={toggleBBox}
                  classList={{ active: debugBBox() }}
                >
                  {debugBBox() ? 'ON' : 'OFF'}
                </button>
              </div>
              <div class="debug-row">
                <span>Rotation Mode:</span>
                <div style="display: flex; gap: 4px;">
                  <button
                    class="debug-toggle-btn"
                    onClick={() => setRotationMode(rotationMode() === 'gesture' ? 'none' : 'gesture')}
                    classList={{ active: rotationMode() === 'gesture' }}
                  >
                    Gesture
                  </button>
                  <button
                    class="debug-toggle-btn"
                    onClick={() => setRotationMode(rotationMode() === 'face' ? 'none' : 'face')}
                    classList={{ active: rotationMode() === 'face' }}
                  >
                    Face
                  </button>
                </div>
              </div>
              <Show when={faceDetected() && rotationMode() === 'face'}>
                <div class="debug-row">
                  <span>Face Pos:</span>
                  <span class="debug-value">
                    ({facePosition().x.toFixed(2)}, {facePosition().y.toFixed(2)})
                  </span>
                </div>
              </Show>
            </div>

            {/* 左手状态 */}
            <div class="debug-section">
              <h3>Left Hand</h3>
              <HandInfo hand={leftHand()} />
            </div>

            {/* 右手状态 */}
            <div class="debug-section">
              <h3>Right Hand</h3>
              <HandInfo hand={rightHand()} />
            </div>

            {/* 双手交互 */}
            <div class="debug-section">
              <h3>Two-Hand</h3>
              <div class="debug-row">
                <span>Both Active:</span>
                <span class="debug-value">{leftHand().active && rightHand().active ? 'Yes' : 'No'}</span>
              </div>
              <div class="debug-row">
                <span>Distance:</span>
                <span class="debug-value">
                  {handsDistance() !== null ? handsDistance()!.toFixed(4) : 'N/A'}
                </span>
              </div>
              <div class="debug-row">
                <span>Zoom Mode:</span>
                <span class={zoomMode().active ? 'debug-value yes' : 'debug-value no'}>
                  {zoomMode().active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <Show when={zoomMode().active}>
                <div class="debug-row">
                  <span>Initial Spread:</span>
                  <span class="debug-value">{zoomMode().initialSpread.toFixed(2)}</span>
                </div>
              </Show>
            </div>

            {/* SVG 对象状态 */}
            <div class="debug-section">
              <h3>SVG Objects</h3>
              <div class="debug-row">
                <span>Selected:</span>
                <span class="debug-value">
                  {selectedObjectId() || 'None'}
                </span>
              </div>
              <div class="debug-objects-list">
                <For each={Object.entries(objects())}>
                  {([id, obj]) => (
                    <div class="debug-object-item" classList={{ selected: obj.selected }}>
                      <span class="debug-object-id">{id}</span>
                      <span class="debug-object-pos">
                        ({obj.position.x.toFixed(1)}, {obj.position.y.toFixed(1)})
                      </span>
                      <span class="debug-object-scale">
                        {obj.scale.toFixed(2)}x
                      </span>
                    </div>
                  )}
                </For>
              </div>
              <button
                class="debug-reset-btn"
                onClick={() => objectActions.resetAllObjects()}
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}

// 手部信息子组件
function HandInfo(props: { hand: typeof handStore.left | typeof handStore.right }) {
  const hand = createMemo(() => props.hand);

  return (
    <div class="hand-info">
      <div class="debug-row">
        <span>Active:</span>
        <span class={hand().active ? 'debug-value yes' : 'debug-value no'}>
          {hand().active ? 'Yes' : 'No'}
        </span>
      </div>
      <Show when={hand().active}>
        <div class="debug-row">
          <span>Gesture:</span>
          <span class="debug-value gesture-name">
            {hand().currentGesture || '-'}
          </span>
        </div>
        <div class="debug-row">
          <span>Touching:</span>
          <span class={hand().isTouching ? 'debug-value yes' : 'debug-value no'}>
            {hand().isTouching ? 'Yes' : 'No'}
          </span>
        </div>
        <Show when={hand().touchedObjectId}>
          <div class="debug-row">
            <span>Touching Object:</span>
            <span class="debug-value yes">{hand().touchedObjectId}</span>
          </div>
        </Show>
        <div class="debug-row">
          <span>Selected:</span>
          <span class={hand().isSelected ? 'debug-value yes' : 'debug-value no'}>
            {hand().isSelected ? 'Yes' : 'No'}
          </span>
        </div>
        <div class="debug-row">
          <span>Pinching:</span>
          <span class={hand().isPinching ? 'debug-value yes' : 'debug-value no'}>
            {hand().isPinching ? 'Yes' : 'No'}
          </span>
        </div>
        <Show when={hand().isPinching && hand().pinchingFinger}>
          <div class="debug-row">
            <span>Pinch Finger:</span>
            <span class="debug-value">{hand().pinchingFinger}</span>
          </div>
        </Show>
        <Show when={hand().isPinching || hand().palmSize > 0}>
          <div class="debug-row">
            <span>Pinch Distance:</span>
            <span class="debug-value">{hand().pinchDistance.toFixed(4)}</span>
          </div>
        </Show>
        {/* 自适应阈值调试信息 */}
        <Show when={hand().palmSize > 0}>
          <div class="debug-row">
            <span>Palm Size:</span>
            <span class="debug-value">{hand().palmSize.toFixed(4)}</span>
          </div>
          <div class="debug-row">
            <span>Dynamic Threshold:</span>
            <span class="debug-value">{hand().dynamicThreshold.toFixed(4)}</span>
          </div>
        </Show>
        {/* Finger states */}
        <Show when={hand().fingersExtended}>
          <div class="debug-row">
            <span>Fingers:</span>
            <span class="debug-value finger-states">
              <span classList={{ active: hand().fingersExtended!.thumb }}>T</span>:
              <span classList={{ active: hand().fingersExtended!.index }}>I</span>:
              <span classList={{ active: hand().fingersExtended!.middle }}>M</span>:
              <span classList={{ active: hand().fingersExtended!.ring }}>R</span>:
              <span classList={{ active: hand().fingersExtended!.pinky }}>P</span>
            </span>
          </div>
        </Show>
        {/* Palm direction */}
        <Show when={hand().palmDirection}>
          <div class="debug-row">
            <span>Palm:</span>
            <span class="debug-value palm-dir">{hand().palmDirection}</span>
          </div>
        </Show>
        <div class="debug-row">
          <span>Has Landmarks:</span>
          <span class={hand().landmarks ? 'debug-value yes' : 'debug-value no'}>
            {hand().landmarks ? `Yes (${hand().landmarks!.length})` : 'No'}
          </span>
        </div>
        <Show when={hand().dragOffset}>
          <div class="debug-row">
            <span>Drag Offset:</span>
            <span class="debug-value">
              ({hand().dragOffset!.x.toFixed(2)}, {hand().dragOffset!.y.toFixed(2)})
            </span>
          </div>
        </Show>
      </Show>
    </div>
  );
}
