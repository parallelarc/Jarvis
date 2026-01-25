/**
 * 主应用组件
 */

import { SVGScene } from '@/components/SVGScene';
import { DebugPanel } from '@/components/DebugPanel';
import { HandOverlay } from '@/components/HandOverlay';
import { useGestureTracking } from '@/hooks/useGestureTracking';
import './App.css';

export default function App() {
  // 启动手势追踪
  const { status, isLoading } = useGestureTracking();

  return (
    <>
      {/* 加载状态 */}
      {isLoading() && (
        <div class="loading">
          <div class="spinner" />
          <p>{status()}</p>
        </div>
      )}

      {/* SVG 场景 */}
      <SVGScene />

      {/* 手势叠加层 - 显示骨架 */}
      <HandOverlay />

      {/* 调试面板 */}
      <DebugPanel />
    </>
  );
}
