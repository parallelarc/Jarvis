# 3D 手势交互粒子系统

一个基于 Three.js / WebGL / MediaPipe 的交互式演示，通过手势控制 3D 粒子系统。

## 功能特性

### 手势交互

- **实时手部追踪** - 使用 MediaPipe Hands 追踪 21 个手部关键点
- **右手交互** - 用食指触摸球体，捏合可拖拽移动
- **左手缩放** - 双手同时触摸并捏合进入缩放模式，双手开合控制粒子扩散
- **挥手打招呼** - 举手挥动触发"HELLO"文字动画

### 粒子动画系统

- **2000 个粒子** - 使用斐波那契球面分布
- **多种状态** - 球体 → 爆炸 → 文字形成 → 文字 → 恢复
- **平滑过渡** - 状态间流畅的动画过渡
- **视觉效果** - 脉冲、旋转、颜色波纹

### 调试面板

按 `D` 键切换显示：
- FPS 计数器
- 手部检测状态
- 捏合距离与进度条
- 手指状态
- 手势识别显示
- 粒子状态信息

## 手势列表

| 手势 | 描述 |
|------|------|
| 指向 Pointing | 食指伸出 |
| 胜利 Victory | V 字手势 |
| 点赞 OK | 拇指食指相扣 |
| 打电话 Call Me | 拇指小指伸出 |
| 摇滚 Rock On | 食指小指伸出 |
| 竖大拇指 Thumbs Up/Down | 拇指向上/向下 |
| 张开手掌 Open Palm | 五指张开 |
| 握拳 Fist | 五指握拢 |
| 挥手 Waving | 张开手掌左右挥动 |

## 运行方式

```bash
# 克隆仓库
git clone https://github.com/parallelarc/Jarvis.git

# 进入目录
cd Jarvis

# 启动本地服务器（任选其一）
python -m http.server
# 或
npx http-server
# 或
php -S localhost:8000
```

然后在浏览器中打开 `http://localhost:8000`

## 技术栈

- **Three.js** - 3D 渲染
- **MediaPipe Hands** - 手部追踪与手势识别
- **HTML5 Canvas** - 手部关键点可视化
- **ES6 Modules** - 模块化 JavaScript

## 项目结构

```
js/
├── main.js           # 应用主入口，初始化与动画循环
├── appState.js       # 全局配置与状态管理
├── particles.js      # 粒子系统与动画状态机
├── gestureDetector.js # 手势检测库
├── handRenderer.js   # 手部骨骼 Canvas 渲染
└── debugPanel.js     # 调试面板 UI
```

## 浏览器要求

- 支持 WebGL 的现代浏览器
- 需要摄像头权限（本地或 HTTPS 环境）
- ES6 模块支持（Chrome 61+、Firefox 60+、Safari 11+）

## 使用说明

1. 允许浏览器访问摄像头
2. 举起右手，用食指触摸紫色球体
3. 捏合拇指和食指可拖拽球体
4. 左手也触摸球体并捏合，进入缩放模式
5. 举手挥动触发"HELLO"文字特效
6. 按 `D` 键查看调试信息

## 许可证

MIT License

## 致谢

- Three.js - https://threejs.org/
- MediaPipe - https://mediapipe.dev/
