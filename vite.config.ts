import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
    fs: {
      strict: false,
    },
  },
  build: {
    target: 'esnext',
    // 打包优化：将 Three.js 相关模块打包到单独的 chunk
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three', 'three/addons/loaders/SVGLoader.js'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: {
    include: ['three', 'three/addons/loaders/SVGLoader.js'],
  },
});
