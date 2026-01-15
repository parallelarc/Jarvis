# 手势粒子增强系统设计文档

**日期:** 2025-01-15
**目标:** 为手势交互项目添加炫酷的粒子效果和手势控制功能

---

## 一、需求概述

### 1.1 功能需求

| 类别 | 具体功能 |
|------|---------|
| **手势触发粒子变换** | 手势触发预设的粒子形态变化（共享效果库） |
| **触摸/捏合增强** | 波纹、火花喷射、发光光晕、磁场吸引 |
| **新粒子形状** | DNA双螺旋、星系螺旋、环形轨道 |
| **手势跟随** | 食指指向时粒子魔法尾迹跟随 |
| **触发方式** | 持续保持手势一定时间后触发 |

### 1.2 现有手势

| 手势 | 当前用途 | 新功能 |
|------|---------|--------|
| Pointing | - | 魔法尾迹模式 |
| Victory | - | 触发 DNA 双螺旋形态 |
| Thumbs Up | - | 触发星系螺旋形态 |
| OK | - | 触发环形轨道形态 |
| Call Me | - | 触发星云扩散形态 |
| Rock On | - | 触发漩涡吸入形态 |
| Open Palm | 默认状态 | 力场模式（可选） |
| Fist | - | 粒子收缩/聚合 |
| Waving | 触发HELLO动画 | 保持现有功能 |

---

## 二、系统架构

### 2.1 状态机设计

```
                        ┌─────────────────────────────────────┐
                        │           BALL (默认球形)              │
                        └─────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
            保持手势触发        保持手势触发         保持手势触发
           Victory/DNA         Thumbs Up/          OK/RING
                    │              Galaxy              │
                    ▼                  ▼                  ▼
        ┌───────────────┐    ┌───────────────┐   ┌───────────────┐
        │  MORPHING     │───▶│     DNA       │   │     RING      │
        │ (过渡动画)     │    │ (双螺旋)      │   │  (环形轨道)   │
        └───────────────┘    └───────────────┘   └───────────────┘
                    │                   │                  │
                    └───────────────────┴──────────────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │   TOUCH_EFFECTS       │
                            │  (触摸叠加效果层)      │
                            │  • 波纹增强            │
                            │  • 火花喷射            │
                            │  • 发光光晕            │
                            │  • 磁场吸引            │
                            └───────────────────────┘
```

### 2.2 新增状态定义

```javascript
// 粒子动画状态枚举
const ParticleState = {
    // 基础状态（现有）
    BALL: 'BALL',           // 默认球形

    // 新增形态状态
    DNA: 'DNA',             // 双螺旋结构
    GALAXY: 'GALAXY',       // 星系螺旋
    RING: 'RING',           // 环形轨道
    NEBULA: 'NEBULA',       // 星云扩散
    VORTEX: 'VORTEX',       // 漩涡吸入

    // 过渡状态
    MORPHING: 'MORPHING',   // 形态过渡动画

    // 文字状态（现有）
    TEXT: 'TEXT',
    EXPLODING: 'EXPLODING',
    FORMING: 'FORMING',
    RECOVERING: 'RECOVERING'
};
```

---

## 三、手势到效果的映射

### 3.1 手势触发配置

```javascript
// 手势触发配置
const GESTURE_EFFECTS_CONFIG = {
    Pointing: {
        effect: 'MAGIC_TRAIL',
        duration: 0,           // 持续模式
        triggerTime: 500,      // 触发所需时间(ms)
        confidence: 0.8
    },
    Victory: {
        effect: 'DNA',
        duration: 0,           // 持续到切换
        triggerTime: 600,
        confidence: 0.8
    },
    ThumbsUp: {
        effect: 'GALAXY',
        duration: 0,
        triggerTime: 600,
        confidence: 0.8
    },
    OK: {
        effect: 'RING',
        duration: 0,
        triggerTime: 500,
        confidence: 0.85
    },
    CallMe: {
        effect: 'NEBULA',
        duration: 0,
        triggerTime: 600,
        confidence: 0.8
    },
    RockOn: {
        effect: 'VORTEX',
        duration: 0,
        triggerTime: 600,
        confidence: 0.8
    },
    Fist: {
        effect: 'CONTRACT',    // 收缩当前形态
        duration: 0,
        triggerTime: 400,
        confidence: 0.75
    }
};
```

### 3.2 触发逻辑

```javascript
// 手势持续时间跟踪器
const gestureTimers = {
    Pointing: { startTime: null, triggered: false },
    Victory: { startTime: null, triggered: false },
    // ... 其他手势
};

// 触发条件检查
function checkGestureTrigger(gestureName, isActive) {
    const config = GESTURE_EFFECTS_CONFIG[gestureName];
    if (!config) return false;

    const timer = gestureTimers[gestureName];

    if (isActive && !timer.triggered) {
        if (!timer.startTime) {
            timer.startTime = Date.now();
        }
        const elapsed = Date.now() - timer.startTime;

        if (elapsed >= config.triggerTime) {
            timer.triggered = true;
            triggerEffect(config.effect);
            return true;
        }
    } else if (!isActive) {
        // 重置计时器
        timer.startTime = null;
        timer.triggered = false;
    }

    return false;
}
```

---

## 四、新增粒子形态实现

### 4.1 DNA 双螺旋

```javascript
/**
 * 计算 DNA 双螺旋粒子位置
 * @param {number} index - 粒子索引
 * @param {number} total - 总粒子数
 * @param {number} time - 当前时间
 * @returns {Object} {x, y, z} 目标位置
 */
function getDNAPosition(index, total, time) {
    const particlesPerStrand = Math.floor(total / 2);
    const strand = index < particlesPerStrand ? 0 : 1;
    const i = strand === 0 ? index : index - particlesPerStrand;

    const height = 3;
    const turns = 3;
    const radius = 1.2;

    const t = (i / particlesPerStrand) * turns * Math.PI * 2;
    const y = (i / particlesPerStrand) * height - height / 2;
    const phase = strand * Math.PI; // 第二条链相位差180°
    const rotationSpeed = time * 0.5;

    const x = radius * Math.cos(t + rotationSpeed + phase);
    const z = radius * Math.sin(t + rotationSpeed + phase);

    // 添加碱基对连接（部分粒子在两条链之间）
    const isConnector = i % 10 === 0;
    if (isConnector) {
        const otherX = radius * Math.cos(t + rotationSpeed + (1 - strand) * Math.PI);
        const otherZ = radius * Math.sin(t + rotationSpeed + (1 - strand) * Math.PI);
        return {
            x: (x + otherX) / 2,
            y: y,
            z: (z + otherZ) / 2
        };
    }

    return { x, y, z };
}
```

### 4.2 星系螺旋

```javascript
/**
 * 计算星系螺旋粒子位置
 */
function getGalaxyPosition(index, total, time) {
    const arms = 3; // 旋臂数量
    const armIndex = index % arms;
    const particlesPerArm = Math.floor(total / arms);
    const i = Math.floor(index / arms);

    const maxRadius = 3;
    const t = (i / particlesPerArm) * Math.PI * 2;
    const radius = (i / particlesPerArm) * maxRadius;

    // 对数螺旋公式
    const spiralFactor = 2;
    const angle = t * spiralFactor + (armIndex / arms) * Math.PI * 2;
    const rotationSpeed = time * 0.2;

    // 越靠外旋转越慢（差分旋转）
    const localRotation = rotationSpeed * (1 - (i / particlesPerArm) * 0.5);

    const x = radius * Math.cos(angle + localRotation);
    const z = radius * Math.sin(angle + localRotation);

    // 厚度分布（中心更厚）
    const thickness = 0.1 + (1 - radius / maxRadius) * 0.5;
    const y = (Math.random() - 0.5) * thickness;

    // 中心核球（部分粒子）
    const isCore = index < total * 0.15;
    if (isCore) {
        const r = Math.random() * 0.5;
        const theta = Math.random() * Math.PI * 2;
        return {
            x: r * Math.cos(theta),
            y: (Math.random() - 0.5) * 0.3,
            z: r * Math.sin(theta)
        };
    }

    return { x, y, z };
}
```

### 4.3 环形轨道

```javascript
/**
 * 计算环形轨道粒子位置
 */
function getRingPosition(index, total, time) {
    const rings = 3;
    const ringIndex = index % rings;
    const particlesPerRing = Math.floor(total / rings);
    const i = Math.floor(index / rings);

    const baseRadius = 1.5;
    const ringSpacing = 0.5;
    const radius = baseRadius + ringIndex * ringSpacing;

    const angle = (i / particlesPerRing) * Math.PI * 2;
    const rotationSpeed = (ringIndex % 2 === 0 ? 1 : -1) * time * 0.3;

    const x = radius * Math.cos(angle + rotationSpeed);
    const z = radius * Math.sin(angle + rotationSpeed);

    // 环的厚度
    const thickness = 0.08;
    const y = (Math.random() - 0.5) * thickness;

    // 环上的亮斑（卫星粒子）
    const isMoon = i % 20 === 0;
    if (isMoon) {
        const moonOffset = 0.15;
        return {
            x: x + Math.cos(angle + rotationSpeed) * moonOffset,
            y: y + Math.sin(time * 2 + index) * 0.1,
            z: z + Math.sin(angle + rotationSpeed) * moonOffset
        };
    }

    return { x, y, z };
}
```

---

## 五、触摸增强效果

### 5.1 增强波纹系统

```javascript
// 增强的波纹配置
const RIPPLE_CONFIG = {
    DURATION: 2000,
    EXPANSION_SPEED: 0.008,
    WIDTH: 0.6,
    MAX_RIPPLES: 5,
    COLOR_PALETTE: [
        { r: 0.4, g: 0.8, b: 1.0 },  // 青色
        { r: 1.0, g: 0.6, b: 0.2 },  // 橙色
        { r: 1.0, g: 0.3, b: 0.5 },  // 粉色
        { r: 0.6, g: 0.4, b: 1.0 }   // 紫色
    ]
};

// 波纹类
class EnhancedRipple {
    constructor(position, colorIndex) {
        this.position = position.clone();
        this.startTime = Date.now();
        this.color = RIPPLE_CONFIG.COLOR_PALETTE[colorIndex % RIPPLE_CONFIG.COLOR_PALETTE.length];
        this.waves = [0]; // 多层波纹
    }

    getProgress() {
        return Math.min((Date.now() - this.startTime) / RIPPLE_CONFIG.DURATION, 1);
    }

    isActive() {
        return this.getProgress() < 1;
    }

    // 获取波纹对粒子的影响
    getInfluence(particlePosition) {
        const progress = this.getProgress();
        if (progress >= 1) return null;

        const distance = particlePosition.distanceTo(this.position);
        const currentRadius = progress * 3;
        const waveWidth = RIPPLE_CONFIG.WIDTH;

        // 多层波纹效果
        let totalInfluence = 0;
        for (let offset of [0, 0.3, 0.6]) {
            const waveRadius = currentRadius - offset;
            if (Math.abs(distance - waveRadius) < waveWidth) {
                const waveProgress = 1 - Math.abs(distance - waveRadius) / waveWidth;
                const alpha = (1 - progress) * waveProgress;
                totalInfluence += alpha;
            }
        }

        return {
            color: this.color,
            intensity: Math.min(totalInfluence, 1),
            displacement: this.getDisplacement(particlePosition, distance, progress)
        };
    }

    getDisplacement(particlePosition, distance, progress) {
        // 波纹传播方向的位移
        const direction = new THREE.Vector3()
            .subVectors(particlePosition, this.position)
            .normalize();
        const waveAmplitude = 0.1 * (1 - progress);

        // 正弦波位移
        const phase = distance * 10 - progress * Math.PI * 4;
        return direction.multiplyScalar(Math.sin(phase) * waveAmplitude);
    }
}
```

### 5.2 火花粒子系统

```javascript
// 火花粒子配置
const SPARK_CONFIG = {
    COUNT: 30,              // 每次触发生成的火花数
    LIFETIME: 800,          // 火花寿命(ms)
    SPEED: 0.05,            // 初始速度
    GRAVITY: -0.001,        // 重力
    SIZE: 0.03              // 火花大小
};

// 火花粒子类
class SparkParticle {
    constructor(position) {
        this.position = position.clone();
        this.startTime = Date.now();

        // 随机方向
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        this.velocity = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta)
        ).multiplyScalar(SPARK_CONFIG.SPEED * (0.5 + Math.random() * 0.5));

        // 随机颜色（暖色调）
        const hue = 0.05 + Math.random() * 0.1; // 金黄色范围
        this.color = new THREE.Color().setHSL(hue, 1, 0.6);
        this.size = SPARK_CONFIG.SIZE * (0.5 + Math.random());
    }

    update(deltaTime) {
        const age = Date.now() - this.startTime;
        if (age > SPARK_CONFIG.LIFETIME) return false;

        // 物理更新
        this.velocity.y += SPARK_CONFIG.GRAVITY;
        this.position.add(this.velocity);

        // 阻力
        this.velocity.multiplyScalar(0.98);

        return true;
    }

    getAlpha() {
        const age = Date.now() - this.startTime;
        return 1 - (age / SPARK_CONFIG.LIFETIME);
    }
}

// 火花管理器
class SparkSystem {
    constructor() {
        this.sparks = [];
    }

    emit(position, count = SPARK_CONFIG.COUNT) {
        for (let i = 0; i < count; i++) {
            this.sparks.push(new SparkParticle(position.clone()));
        }
    }

    update() {
        this.sparks = this.sparks.filter(spark => spark.update());
    }

    getActiveSparks() {
        return this.sparks;
    }
}
```

### 5.3 发光光晕

```javascript
// 光晕配置
const GLOW_CONFIG = {
    DURATION: 1500,
    MAX_RADIUS: 0.8,
    COLOR: { r: 0.6, g: 0.8, b: 1.0 }
};

// 光晕类
class GlowEffect {
    constructor(position) {
        this.position = position.clone();
        this.startTime = Date.now();
        this.color = { ...GLOW_CONFIG.COLOR };
    }

    getProgress() {
        return Math.min((Date.now() - this.startTime) / GLOW_CONFIG.DURATION, 1);
    }

    isActive() {
        return this.getProgress() < 1;
    }

    // 获取光晕对粒子的影响
    getInfluence(particlePosition) {
        const progress = this.getProgress();
        if (progress >= 1) return null;

        const distance = particlePosition.distanceTo(this.position);
        const maxRadius = GLOW_CONFIG.MAX_RADIUS * progress;

        if (distance > maxRadius) return null;

        const intensity = Math.pow(1 - distance / maxRadius, 2) * (1 - progress);

        return {
            color: this.color,
            intensity: intensity
        };
    }
}
```

### 5.4 磁场吸引

```javascript
// 磁场配置
const MAGNETIC_CONFIG = {
    RADIUS: 1.5,
    STRENGTH: 0.02,
    DECAY: 0.95
};

// 磁场管理器
class MagneticField {
    constructor() {
        this.fields = []; // { position, strength, handedness }
    }

    addField(position, handedness) {
        // 查找或创建该手的磁场
        const existing = this.fields.find(f => f.handedness === handedness);
        if (existing) {
            existing.position.copy(position);
            existing.strength = MAGNETIC_CONFIG.STRENGTH;
        } else {
            this.fields.push({
                position: position.clone(),
                strength: MAGNETIC_CONFIG.STRENGTH,
                handedness: handedness
            });
        }
    }

    removeField(handedness) {
        this.fields = this.fields.filter(f => f.handedness !== handedness);
    }

    // 获取磁场对粒子的作用力
    getForce(particlePosition) {
        let totalForce = new THREE.Vector3();

        for (const field of this.fields) {
            const direction = new THREE.Vector3()
                .subVectors(field.position, particlePosition);
            const distance = direction.length();

            if (distance < MAGNETIC_CONFIG.RADIUS && distance > 0.1) {
                // 距离衰减
                const falloff = 1 - (distance / MAGNETIC_CONFIG.RADIUS);
                const forceMagnitude = field.strength * falloff * falloff;

                direction.normalize().multiplyScalar(forceMagnitude);
                totalForce.add(direction);
            }
        }

        return totalForce;
    }

    update() {
        // 磁场自然衰减
        for (const field of this.fields) {
            field.strength *= MAGNETIC_CONFIG.DECAY;
        }
        // 移除弱场
        this.fields = this.fields.filter(f => f.strength > 0.001);
    }
}
```

---

## 六、魔法尾迹系统

### 6.1 尾迹粒子系统

```javascript
// 尾迹配置
const TRAIL_CONFIG = {
    PARTICLES_PER_FRAME: 3,
    LIFETIME: 1000,
    SIZE: 0.04,
    FADE_SPEED: 0.002
};

// 尾迹粒子类
class TrailParticle {
    constructor(position, velocity, color) {
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.startTime = Date.now();
        this.color = color.clone();
        this.size = TRAIL_CONFIG.SIZE;
    }

    update() {
        const age = Date.now() - this.startTime;
        if (age > TRAIL_CONFIG.LIFETIME) return false;

        // 漂浮运动
        this.position.add(this.velocity);
        this.velocity.y += 0.001; // 轻微上升
        this.velocity.multiplyScalar(0.99); // 阻力

        return true;
    }

    getAlpha() {
        const age = Date.now() - this.startTime;
        return Math.max(0, 1 - age / TRAIL_CONFIG.LIFETIME);
    }
}

// 魔法尾迹管理器
class MagicTrail {
    constructor() {
        this.particles = [];
        this.lastEmitPosition = new THREE.Vector3();
        this.isActive = false;
        this.hue = 0.6; // 初始色相
    }

    activate() {
        this.isActive = true;
    }

    deactivate() {
        this.isActive = false;
    }

    emit(fingerPosition, palmDirection) {
        if (!this.isActive) return;

        // 颜色循环
        this.hue = (this.hue + 0.01) % 1;
        const color = new THREE.Color().setHSL(this.hue, 1, 0.6);

        // 生成粒子
        for (let i = 0; i < TRAIL_CONFIG.PARTICLES_PER_FRAME; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05
            );

            // 速度沿手指方向但有随机扩散
            const velocity = palmDirection.clone().multiplyScalar(0.01);
            velocity.x += (Math.random() - 0.5) * 0.01;
            velocity.y += (Math.random() - 0.5) * 0.01;
            velocity.z += (Math.random() - 0.5) * 0.01;

            this.particles.push(new TrailParticle(
                fingerPosition.clone().add(offset),
                velocity,
                color
            ));
        }
    }

    update() {
        this.particles = this.particles.filter(p => p.update());
    }

    getParticles() {
        return this.particles;
    }
}
```

---

## 七、文件修改计划

### 7.1 新增文件

| 文件 | 功能 |
|------|------|
| `js/effects/particleShapes.js` | 新粒子形态位置计算函数 |
| `js/effects/touchEffects.js` | 触摸效果（波纹、火花、光晕、磁场） |
| `js/effects/magicTrail.js` | 魔法尾迹系统 |
| `js/gestureTrigger.js` | 手势触发逻辑和计时器管理 |
| `js/effects/sparkSystem.js` | 火花粒子系统 |
| `js/effects/glowEffect.js` | 发光光晕效果 |

### 7.2 修改文件

| 文件 | 修改内容 |
|------|---------|
| `js/particles.js` | 添加新状态处理、形态过渡逻辑 |
| `js/appState.js` | 添加新状态枚举、效果配置常量 |
| `js/main.js` | 集成手势触发、效果渲染循环 |
| `js/gestureDetector.js` | 添加手势置信度计算（可选） |
| `js/debugPanel.js` | 添加新状态和效果的调试显示 |

---

## 八、实施优先级

### Phase 1: 核心形态变换
1. 添加新状态到 appState.js
2. 实现粒子形状计算函数 (particleShapes.js)
3. 实现 MORPHING 过渡状态
4. 手势触发系统 (gestureTrigger.js)
5. 集成到 main.js

### Phase 2: 触摸增强效果
1. 增强波纹系统
2. 火花粒子系统
3. 发光光晕效果
4. 磁场吸引效果
5. 触摸效果渲染集成

### Phase 3: 魔法尾迹
1. 尾迹粒子系统
2. Pointing 手势触发
3. 渲染集成

### Phase 4: 调试和优化
1. Debug 面板更新
2. 性能优化
3. 视觉调优

---

## 九、技术细节

### 9.1 形态过渡算法

使用三次缓出函数 (easeOutCubic) 实现平滑过渡：

```javascript
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function lerpPosition(from, to, t) {
    const easedT = easeOutCubic(t);
    return {
        x: from.x + (to.x - from.x) * easedT,
        y: from.y + (to.y - from.y) * easedT,
        z: from.z + (to.z - from.z) * easedT
    };
}
```

### 9.2 颜色混合

```javascript
function blendColor(baseColor, effectColor, intensity) {
    return {
        r: baseColor.r + (effectColor.r - baseColor.r) * intensity,
        g: baseColor.g + (effectColor.g - baseColor.g) * intensity,
        b: baseColor.b + (effectColor.b - baseColor.b) * intensity
    };
}
```

### 9.3 性能考虑

- 限制同时存在的特效数量
- 使用对象池减少 GC 压力
- 粒子更新使用 TypedArray 优化
- 按距离裁剪不可见效果

---

## 十、测试计划

| 测试项 | 验证内容 |
|--------|---------|
| 手势识别准确率 | 各手势在保持指定时间后正确触发 |
| 形态过渡平滑性 | 状态切换无突变，动画流畅 |
| 触摸效果响应 | 波纹、火花、光晕正确触发和衰减 |
| 磁场效果 | 粒子被正确吸引，力场边界清晰 |
| 尾迹效果 | Pointing 时粒子正确跟随和消散 |
| 性能 | 维持 60fps，无内存泄漏 |
| 双手交互 | 效果正确叠加，无冲突 |

---

*设计文档 v1.0*
