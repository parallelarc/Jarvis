import { CONFIG, state, ANIMATION_STATE, VIEW } from './appState.js';

let particleSystem;
let scene;

const particlePositions = new Float32Array(CONFIG.PARTICLE_COUNT * 3);
const particleColors = new Float32Array(CONFIG.PARTICLE_COUNT * 3);
const particleBasePositions = new Float32Array(CONFIG.PARTICLE_COUNT * 3);
const particlePhases = new Float32Array(CONFIG.PARTICLE_COUNT);

// 文字目标位置和动画相关
const particleTargets = new Float32Array(CONFIG.PARTICLE_COUNT * 3);
const explosionEndPositions = new Float32Array(CONFIG.PARTICLE_COUNT * 3);
let textTargetPositions = [];
let isTextTargetsGenerated = false;

export function initParticleSystem(threeScene) {
    scene = threeScene;

    const geometry = new THREE.BufferGeometry();

    // Generate particles on sphere surface
    for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const x = CONFIG.BASE_RADIUS * Math.sin(phi) * Math.cos(theta);
        const y = CONFIG.BASE_RADIUS * Math.sin(phi) * Math.sin(theta);
        const z = CONFIG.BASE_RADIUS * Math.cos(phi);

        particleBasePositions[i * 3] = x;
        particleBasePositions[i * 3 + 1] = y;
        particleBasePositions[i * 3 + 2] = z;

        particlePositions[i * 3] = x;
        particlePositions[i * 3 + 1] = y;
        particlePositions[i * 3 + 2] = z;

        particleColors[i * 3] = CONFIG.DEFAULT_COLOR.r;
        particleColors[i * 3 + 1] = CONFIG.DEFAULT_COLOR.g;
        particleColors[i * 3 + 2] = CONFIG.DEFAULT_COLOR.b;

        particlePhases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const material = new THREE.PointsMaterial({
        size: CONFIG.PARTICLE_SIZE,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });

    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    // 预生成文字目标位置
    generateTextTargets('hello');

    return particleSystem;
}

/**
 * 生成文字目标位置（使用Canvas采样）
 * @param {string} text - 要显示的文字
 */
function generateTextTargets(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Canvas尺寸（足够容纳文字）
    const textSize = 150;
    const width = 500;
    const height = 200;

    canvas.width = width;
    canvas.height = height;

    // 绘制黑色背景
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // 绘制白色文字
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${textSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    // 获取像素数据
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = [];

    // 采样间隔（控制文字粒子密度）
    const sampleStep = 3;

    const mirrorX = VIEW.MIRROR_X ? -1 : 1;

    for (let y = 0; y < height; y += sampleStep) {
        for (let x = 0; x < width; x += sampleStep) {
            const i = (y * width + x) * 4;
            // 检查红色通道（白色像素 = 255）
            if (imageData.data[i] > 128) {
                // 映射到3D坐标（屏幕中心为原点）
                pixels.push({
                    x: (x - width / 2) * 0.015 * mirrorX,  // 缩放因子 + 文字水平翻转
                    y: -(y - height / 2) * 0.015, // Y轴翻转
                    z: 0
                });
            }
        }
    }

    // 为每个粒子分配目标位置
    // 粒子0到N-1分配给文字点
    const textPixelCount = Math.min(pixels.length, CONFIG.PARTICLE_COUNT);

    for (let i = 0; i < textPixelCount; i++) {
        particleTargets[i * 3] = pixels[i].x;
        particleTargets[i * 3 + 1] = pixels[i].y;
        particleTargets[i * 3 + 2] = pixels[i].z;
    }

    // 多余粒子分配到文字周围形成"星云"效果
    for (let i = textPixelCount; i < CONFIG.PARTICLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 2.5 + Math.random() * 0.8;
        particleTargets[i * 3] = Math.cos(angle) * radius;
        particleTargets[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
        particleTargets[i * 3 + 2] = Math.sin(angle) * radius;
    }

    textTargetPositions = pixels;
    isTextTargetsGenerated = true;
}

/**
 * 捕获爆炸结束位置
 */
function captureExplosionEndPositions() {
    for (let i = 0; i < CONFIG.PARTICLE_COUNT * 3; i++) {
        explosionEndPositions[i] = particlePositions[i];
    }
}

/**
 * 触发爆炸动画
 */
export function triggerExplosion() {
    state.animationState = ANIMATION_STATE.EXPLODING;
    state.animationStartTime = Date.now();
    // 爆炸中心设为当前球体位置
    state.explosionCenter = { ...state.spherePosition };
}

/**
 * 触发恢复动画
 */
export function triggerRecovery() {
    state.animationState = ANIMATION_STATE.RECOVERING;
    state.animationStartTime = Date.now();
}

/**
 * 更新动画状态
 * @returns {number} 当前状态的经过时间(ms)
 */
function updateAnimationState() {
    const now = Date.now();
    const elapsed = now - state.animationStartTime;

    switch (state.animationState) {
        case ANIMATION_STATE.EXPLODING:
            if (elapsed > 500) {
                state.animationState = ANIMATION_STATE.FORMING;
                state.animationStartTime = now;
                captureExplosionEndPositions();
            }
            break;

        case ANIMATION_STATE.FORMING:
            if (elapsed > 1000) {
                state.animationState = ANIMATION_STATE.TEXT;
            }
            break;

        case ANIMATION_STATE.TEXT:
            // 保持TEXT状态，等待挥手停止信号
            break;

        case ANIMATION_STATE.RECOVERING:
            if (elapsed > 800) {
                state.animationState = ANIMATION_STATE.BALL;
            }
            break;
    }

    return elapsed;
}

/**
 * easeOutCubic 缓动函数
 */
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * 应用爆炸动画
 */
function applyExplosionAnimation(progress) {
    // progress: 0 -> 1
    const force = 5 * (1 - progress); // 爆炸力随时间衰减

    for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        // 从当前位置计算爆炸方向
        const dx = particlePositions[i3] - state.explosionCenter.x;
        const dy = particlePositions[i3 + 1] - state.explosionCenter.y;
        const dz = particlePositions[i3 + 2] - state.explosionCenter.z;

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

        // 沿径向向外移动
        particlePositions[i3] += (dx / len) * force * 0.08;
        particlePositions[i3 + 1] += (dy / len) * force * 0.08;
        particlePositions[i3 + 2] += (dz / len) * force * 0.08;
    }
}

/**
 * 应用聚合动画（粒子聚合成文字）
 */
function applyFormingAnimation(progress) {
    const ease = easeOutCubic(progress);

    for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        const startX = explosionEndPositions[i3];
        const startY = explosionEndPositions[i3 + 1];
        const startZ = explosionEndPositions[i3 + 2];

        const targetX = particleTargets[i3];
        const targetY = particleTargets[i3 + 1];
        const targetZ = particleTargets[i3 + 2];

        // 插值计算当前位置
        particlePositions[i3] = startX + (targetX - startX) * ease;
        particlePositions[i3 + 1] = startY + (targetY - startY) * ease;
        particlePositions[i3 + 2] = startZ + (targetZ - startZ) * ease;
    }
}

/**
 * 应用文字状态动画（轻微抖动保持动态感）
 */
function applyTextAnimation(time) {
    for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const jitter = 0.005;

        particlePositions[i3] = particleTargets[i3] + (Math.random() - 0.5) * jitter;
        particlePositions[i3 + 1] = particleTargets[i3 + 1] + (Math.random() - 0.5) * jitter;
        particlePositions[i3 + 2] = particleTargets[i3 + 2] + (Math.random() - 0.5) * jitter;
    }
}

/**
 * 应用恢复动画（文字回到球体）
 */
function applyRecoveringAnimation(progress) {
    const ease = easeOutCubic(progress);

    for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        // 从文字目标位置回到球体基准位置
        const startX = particleTargets[i3];
        const startY = particleTargets[i3 + 1];
        const startZ = particleTargets[i3 + 2];

        const targetX = particleBasePositions[i3];
        const targetY = particleBasePositions[i3 + 1];
        const targetZ = particleBasePositions[i3 + 2];

        particlePositions[i3] = startX + (targetX - startX) * ease;
        particlePositions[i3 + 1] = startY + (targetY - startY) * ease;
        particlePositions[i3 + 2] = startZ + (targetZ - startZ) * ease;
    }
}

/**
 * 球体状态动画（原有逻辑）
 */
function animateBallState(time) {
    // Smooth spread update
    state.currentSpread += (state.targetSpread - state.currentSpread) * CONFIG.SPREAD_SMOOTHING;

    // Pre-compute rotation
    const rotationAngle = 0.01 + time * 0.1;
    const cosAngle = Math.cos(rotationAngle);
    const sinAngle = Math.sin(rotationAngle);

    for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        // Apply spread
        const baseX = particleBasePositions[i3] * state.currentSpread;
        const baseY = particleBasePositions[i3 + 1] * state.currentSpread;
        const baseZ = particleBasePositions[i3 + 2] * state.currentSpread;

        // Rotate around Y axis
        const rotatedX = baseX * cosAngle - baseZ * sinAngle;
        const rotatedZ = baseX * sinAngle + baseZ * cosAngle;

        // Add pulse
        const pulse = 1 + 0.05 * Math.sin(time * 2 + particlePhases[i]);

        // Add sphere position
        particlePositions[i3] = rotatedX * pulse + state.spherePosition.x;
        particlePositions[i3 + 1] = baseY * pulse + state.spherePosition.y;
        particlePositions[i3 + 2] = rotatedZ * pulse + state.spherePosition.z;
    }
}

export function addRipple(contactPoint, color) {
    state.ripples.push({
        contactPoint: { ...contactPoint },
        color: { ...color },
        startTime: Date.now()
    });
}

function updateColorsWithRipple() {
    const currentTime = Date.now();

    for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const particlePos = {
            x: particlePositions[i3],
            y: particlePositions[i3 + 1],
            z: particlePositions[i3 + 2]
        };

        let finalColor = { ...state.baseColor };

        for (const ripple of state.ripples) {
            const age = currentTime - ripple.startTime;

            if (age < CONFIG.RIPPLE_DURATION) {
                const distance = Math.sqrt(
                    Math.pow(particlePos.x - ripple.contactPoint.x, 2) +
                    Math.pow(particlePos.y - ripple.contactPoint.y, 2) +
                    Math.pow(particlePos.z - ripple.contactPoint.z, 2)
                );
                const rippleRadius = age * CONFIG.RIPPLE_EXPANSION_SPEED;

                if (Math.abs(distance - rippleRadius) < CONFIG.RIPPLE_WIDTH) {
                    const intensity = (1 - age / CONFIG.RIPPLE_DURATION) *
                        (1 - Math.abs(distance - rippleRadius) / CONFIG.RIPPLE_WIDTH);
                    finalColor = blendColors(finalColor, ripple.color, intensity * 0.8);
                }
            }
        }

        particleColors[i3] = finalColor.r;
        particleColors[i3 + 1] = finalColor.g;
        particleColors[i3 + 2] = finalColor.b;
    }

    // Clean up old ripples
    while (state.ripples.length > 0 &&
           currentTime - state.ripples[0].startTime > CONFIG.RIPPLE_DURATION) {
        state.ripples.shift();
    }
}

function blendColors(color1, color2, ratio) {
    return {
        r: color1.r * (1 - ratio) + color2.r * ratio,
        g: color1.g * (1 - ratio) + color2.g * ratio,
        b: color1.b * (1 - ratio) + color2.b * ratio
    };
}

export function animateParticles() {
    if (!particleSystem) return;

    const time = Date.now() * 0.001;
    const elapsed = updateAnimationState();

    // 根据动画状态分发到不同的动画函数
    switch (state.animationState) {
        case ANIMATION_STATE.BALL:
            animateBallState(time);
            break;

        case ANIMATION_STATE.EXPLODING:
            applyExplosionAnimation(elapsed / 500);
            break;

        case ANIMATION_STATE.FORMING:
            applyFormingAnimation(elapsed / 1000);
            break;

        case ANIMATION_STATE.TEXT:
            applyTextAnimation(time);
            break;

        case ANIMATION_STATE.RECOVERING:
            applyRecoveringAnimation(elapsed / 800);
            break;
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
    updateColorsWithRipple();
    particleSystem.geometry.attributes.color.needsUpdate = true;
}

export { particleSystem };
