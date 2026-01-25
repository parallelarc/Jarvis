/**
 * Three.js 统一访问工具
 * 支持 npm 包和全局变量两种方式
 * 优先使用 npm 包，确保离线可用
 */

import * as THREEImport from 'three';

// 如果全局 THREE 不存在（没有 CDN 加载），使用 npm 包的版本
if (typeof (window as any).THREE === 'undefined') {
  (window as any).THREE = THREEImport;
  console.log('[Three.js] Using npm package version (offline mode)');
}

export const THREE = (window as any).THREE as any;
