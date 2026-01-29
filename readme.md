# Javis - 手势交互 3D 演示

基于 SolidJS + TypeScript + Three.js + MediaPipe 的手势交互演示项目。

## 功能特性

- **实时手部追踪** - MediaPipe Hands 追踪 21 个手部关键点
- **单手交互** - 食指指向选中，捏合拖拽/旋转物体
- **双手缩放** - 双手同时捏合控制物体缩放
- **面部检测** - MediaPipe FaceDetection 检测微笑等表情
- **调试面板** - 按 `D` 键查看实时状态

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3000，允许摄像头权限即可体验。

## 技术栈

| 技术 | 用途 |
|------|------|
| SolidJS | 响应式 UI 框架 |
| TypeScript | 类型安全 |
| Three.js | 3D 渲染 |
| MediaPipe | 手部/面部追踪 |
| Vite | 构建工具 |

## 项目结构

```
src/
├── components/     # UI 组件
├── stores/         # SolidJS 状态管理
├── services/       # 业务逻辑（追踪、交互）
├── domain/         # 手势检测核心
├── hooks/          # 自定义 hooks
├── config/         # 配置常量
└── utils/          # 工具函数
```

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run preview      # 预览生产版本
npm run type-check   # TypeScript 类型检查
```

## 浏览器要求

- 支持 WebGL 的现代浏览器
- 摄像头权限（需 localhost 或 HTTPS）

## 模型文件

MediaPipe 模型文件已本地化存储在 `public/models/`。如需重新下载：

```bash
# Face Detection
mkdir -p public/models/face_detection
curl -o public/models/face_detection/face_detection_short_range.tflite \
  https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection_short_range.tflite
curl -o public/models/face_detection/face_detection_solution_simd_wasm_bin.js \
  https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection_solution_simd_wasm_bin.js

# Hands
mkdir -p public/models/hands
curl -o public/models/hands/hand_landmark_full.tflite \
  https://cdn.jsdelivr.net/npm/@mediapipe/hands/hand_landmark_full.tflite
curl -o public/models/hands/hands_solution_simd_wasm_bin.js \
  https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands_solution_simd_wasm_bin.js

# Face Mesh
mkdir -p public/models/face_mesh
curl -o public/models/face_mesh/face_landmark.tflite \
  https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_landmark.tflite
curl -o public/models/face_mesh/face_mesh_solution_simd_wasm_bin.js \
  https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js

# 库文件
mkdir -p public/models/libs
curl -o public/models/libs/face_detection.js \
  https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js
curl -o public/models/libs/hands.js \
  https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js
curl -o public/models/libs/face_mesh.js \
  https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js
```

## 许可证

MIT
