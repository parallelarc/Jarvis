/**
 * GestureDetector - 手势检测原子技能库
 *
 * 基于 MediaPipe Hands 21 个关键点，提供各类手势状态的检测函数
 * 可作为独立模块被其他项目引用
 *
 * MediaPipe Hands 关键点索引:
 * - 0: 手腕
 * - 1-4: 拇指 (MCP→IP→TIP)
 * - 5-8: 食指 (MCP→PIP→DIP→TIP)
 * - 9-12: 中指 (MCP→PIP→DIP→TIP)
 * - 13-16: 无名指 (MCP→PIP→DIP→TIP)
 * - 17-20: 小指 (MCP→PIP→DIP→TIP)
 */

// ========== 配置参数 ==========

const CONFIG = {
    // 手指伸直判定阈值 (指尖到手掌底部的距离 / 指根到手掌底部的距离)
    FINGER_EXTENDED_RATIO: 1.2,

    // 捏合判定阈值 (归一化坐标距离)
    PINCH_THRESHOLD: 0.08,

    // OK手势判定阈值 (拇指-食指距离)
    OK_THRESHOLD: 0.06,

    // 挥手检测参数
    WAVE_SPEED_THRESHOLD: 0.03,     // X轴移动阈值
    WAVE_TIME_WINDOW_MS: 900,       // 挥手检测时间窗口（ms）
    WAVE_MIN_SAMPLES: 5,            // 最少采样点数
    WAVE_MIN_AMPLITUDE: 0.01,       // 最小挥手幅度（更灵敏）
    WAVE_MIN_DELTA_X: 0.002,        // 单步X变化阈值（过滤抖动）
    WAVE_DIRECTION_CHANGES: 1,      // 最小方向改变次数（更灵敏）
    WAVE_Y_RANGE_RATIO: 5.0,        // Y轴变化上限倍数（更宽松）
    WAVE_VELOCITY_THRESHOLD: 0.15,  // 速度阈值（单位/秒）

    // Hello waving打招呼检测参数（保持原有）
    WAVE_X_THRESHOLD: 0.01,        // X轴移动阈值（更灵敏）
    WAVE_MIN_DIRECTION_CHANGES: 1, // 最小方向改变次数（更灵敏）
    WAVE_RAISE_Y_THRESHOLD: 0.7,   // 手举起Y阈值（更宽松）
    WAVE_TRIGGER_DURATION: 800     // 触发所需的持续时间(ms)
};

// ========== 内部状态 ==========

// 用于动态手势检测的历史数据
const gestureHistory = {
    leftHand: {
        positions: [],
        velocities: [],          // 新增：跟踪速度
        lastWaveTime: 0,
        isWaving: false,
        waveDirectionChanges: 0, // 新增：方向变化计数
        lastX: null,             // 新增：上次X位置
        lastVelocityX: 0,        // 新增：上次X速度
        // Hello waving打招呼状态
        waveStartTime: 0,
        helloDirectionChanges: 0,
        lastHelloX: null,
        lastHelloDirection: 0,
        consecutiveWaveFrames: 0
    },
    rightHand: {
        positions: [],
        velocities: [],          // 新增：跟踪速度
        lastWaveTime: 0,
        isWaving: false,
        waveDirectionChanges: 0, // 新增：方向变化计数
        lastX: null,             // 新增：上次X位置
        lastVelocityX: 0,        // 新增：上次X速度
        // Hello waving打招呼状态
        waveStartTime: 0,
        helloDirectionChanges: 0,
        lastHelloX: null,
        lastHelloDirection: 0,
        consecutiveWaveFrames: 0
    }
};

// ========== 基础辅助函数 ==========

/**
 * 计算两点之间的欧几里得距离
 * @param {Object} p1 - 点1 {x, y, z}
 * @param {Object} p2 - 点2 {x, y, z}
 * @returns {number} 距离
 */
function calculateDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 计算点到参考点的距离
 * @param {Array} landmarks - 21个关键点
 * @param {number} pointIndex - 点索引
 * @param {number} referenceIndex - 参考点索引 (默认为手腕0)
 * @returns {number} 距离
 */
function distanceFromWrist(landmarks, pointIndex, referenceIndex = 0) {
    return calculateDistance(landmarks[pointIndex], landmarks[referenceIndex]);
}

/**
 * 判断手指是否伸直
 * 通过比较指尖与手腕的距离、指根与手腕的距离来判断
 *
 * @param {Array} landmarks - 21个关键点
 * @param {Array} fingerIndices - 手指的关键点索引 [mcp, pip, dip, tip]
 * @returns {boolean} 是否伸直
 */
function isFingerExtended(landmarks, fingerIndices) {
    const [mcp, pip, dip, tip] = fingerIndices;

    // 计算指尖到手腕的距离
    const tipDistance = distanceFromWrist(landmarks, tip);
    // 计算指根到手腕的距离
    const mcpDistance = distanceFromWrist(landmarks, mcp);

    // 手指伸直时，指尖距离应该显著大于指根距离
    return tipDistance > mcpDistance * CONFIG.FINGER_EXTENDED_RATIO;
}

/**
 * 判断手指是否弯曲 (与伸直相反)
 * @param {Array} landmarks - 21个关键点
 * @param {Array} fingerIndices - 手指的关键点索引
 * @returns {boolean} 是否弯曲
 */
function isFingerCurled(landmarks, fingerIndices) {
    return !isFingerExtended(landmarks, fingerIndices);
}

// ========== 基础手指状态检测 ==========

/**
 * 检测拇指是否伸直
 * 拇指特殊处理，因为它的活动方向与其他手指不同
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否伸直
 */
export function isThumbExtended(landmarks) {
    // 拇指关键点: 1(MCP) → 2(IP) → 3(DIP) → 4(TIP)
    // 检测拇指是否远离食指根部(5)
    const thumbTip = landmarks[4];
    const indexMCP = landmarks[5];
    const wrist = landmarks[0];

    // 拇指尖到食指根部的距离
    const thumbToIndex = calculateDistance(thumbTip, indexMCP);
    // 手腕到食指根部的距离
    const wristToIndex = calculateDistance(wrist, indexMCP);

    // 拇指伸直时，距离应该更大
    return thumbToIndex > wristToIndex * 0.7;
}

/**
 * 检测食指是否伸直
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否伸直
 */
export function isIndexExtended(landmarks) {
    return isFingerExtended(landmarks, [5, 6, 7, 8]); // MCP, PIP, DIP, TIP
}

/**
 * 检测中指是否伸直
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否伸直
 */
export function isMiddleExtended(landmarks) {
    return isFingerExtended(landmarks, [9, 10, 11, 12]);
}

/**
 * 检测无名指是否伸直
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否伸直
 */
export function isRingExtended(landmarks) {
    return isFingerExtended(landmarks, [13, 14, 15, 16]);
}

/**
 * 检测小指是否伸直
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否伸直
 */
export function isPinkyExtended(landmarks) {
    return isFingerExtended(landmarks, [17, 18, 19, 20]);
}

/**
 * 获取所有手指的伸直状态
 * @param {Array} landmarks - 21个关键点
 * @returns {Object} 各手指的伸直状态
 */
export function getAllFingersExtended(landmarks) {
    return {
        thumb: isThumbExtended(landmarks),
        index: isIndexExtended(landmarks),
        middle: isMiddleExtended(landmarks),
        ring: isRingExtended(landmarks),
        pinky: isPinkyExtended(landmarks)
    };
}

/**
 * 计算伸直的手指数量
 * @param {Array} landmarks - 21个关键点
 * @returns {number} 伸直的手指数量
 */
export function countExtendedFingers(landmarks) {
    const fingers = getAllFingersExtended(landmarks);
    return Object.values(fingers).filter(v => v).length;
}

// ========== 捏合状态检测 ==========

/**
 * 检测拇指与食指是否捏合
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否捏合
 */
export function isThumbIndexPinching(landmarks) {
    return calculateDistance(landmarks[4], landmarks[8]) < CONFIG.PINCH_THRESHOLD;
}

/**
 * 检测拇指与中指是否捏合
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否捏合
 */
export function isThumbMiddlePinching(landmarks) {
    return calculateDistance(landmarks[4], landmarks[12]) < CONFIG.PINCH_THRESHOLD;
}

/**
 * 检测拇指与无名指是否捏合
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否捏合
 */
export function isThumbRingPinching(landmarks) {
    return calculateDistance(landmarks[4], landmarks[16]) < CONFIG.PINCH_THRESHOLD;
}

/**
 * 检测拇指与小指是否捏合
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否捏合
 */
export function isThumbPinkyPinching(landmarks) {
    return calculateDistance(landmarks[4], landmarks[20]) < CONFIG.PINCH_THRESHOLD;
}

/**
 * 获取所有捏合状态
 * @param {Array} landmarks - 21个关键点
 * @returns {Object} 各指头的捏合状态
 */
export function getAllPinchStates(landmarks) {
    return {
        thumbIndex: {
            isPinching: isThumbIndexPinching(landmarks),
            distance: calculateDistance(landmarks[4], landmarks[8])
        },
        thumbMiddle: {
            isPinching: isThumbMiddlePinching(landmarks),
            distance: calculateDistance(landmarks[4], landmarks[12])
        },
        thumbRing: {
            isPinching: isThumbRingPinching(landmarks),
            distance: calculateDistance(landmarks[4], landmarks[16])
        },
        thumbPinky: {
            isPinching: isThumbPinkyPinching(landmarks),
            distance: calculateDistance(landmarks[4], landmarks[20])
        }
    };
}

/**
 * 获取当前正在捏合的手指
 * @param {Array} landmarks - 21个关键点
 * @returns {string|null} 'index', 'middle', 'ring', 'pinky' 或 null
 */
export function getPinchingFinger(landmarks) {
    if (isThumbIndexPinching(landmarks)) return 'index';
    if (isThumbMiddlePinching(landmarks)) return 'middle';
    if (isThumbRingPinching(landmarks)) return 'ring';
    if (isThumbPinkyPinching(landmarks)) return 'pinky';
    return null;
}

// ========== 常见手势检测 ==========

/**
 * 检测是否为"指点"手势 (仅食指伸直)
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否指点手势
 */
export function isPointingGesture(landmarks) {
    const fingers = getAllFingersExtended(landmarks);
    return fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;
}

/**
 * 检测是否为"胜利"手势 (食指+中指伸直，呈V形)
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否胜利手势
 */
export function isVictoryGesture(landmarks) {
    const fingers = getAllFingersExtended(landmarks);
    return fingers.index && fingers.middle && !fingers.ring && !fingers.pinky && !fingers.thumb;
}

/**
 * 检测是否为"点赞"手势 (仅拇指伸直，向上)
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否点赞手势
 */
export function isThumbsUpGesture(landmarks) {
    const fingers = getAllFingersExtended(landmarks);
    // 拇指伸直，其他手指弯曲
    if (!fingers.thumb || fingers.index || fingers.middle || fingers.ring || fingers.pinky) {
        return false;
    }
    // 拇指尖应该在手腕上方 (y坐标更小)
    const thumbTip = landmarks[4];
    const wrist = landmarks[0];
    return thumbTip.y < wrist.y - 0.1;
}

/**
 * 检测是否为"拇指向下"手势
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否拇指向下
 */
export function isThumbsDownGesture(landmarks) {
    const fingers = getAllFingersExtended(landmarks);
    if (!fingers.thumb || fingers.index || fingers.middle || fingers.ring || fingers.pinky) {
        return false;
    }
    const thumbTip = landmarks[4];
    const wrist = landmarks[0];
    return thumbTip.y > wrist.y + 0.1;
}

/**
 * 检测是否为"OK"手势 (拇指与食指形成圆圈)
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否OK手势
 */
export function isOKGesture(landmarks) {
    // 拇指与食指距离很近
    const distance = calculateDistance(landmarks[4], landmarks[8]);
    if (distance > CONFIG.OK_THRESHOLD) return false;

    // 其他手指应该伸直
    const fingers = getAllFingersExtended(landmarks);
    return fingers.middle || fingers.ring || fingers.pinky;
}

/**
 * 检测是否为"打电话"手势 (拇指+小指伸直)
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否打电话手势
 */
export function isCallMeGesture(landmarks) {
    const fingers = getAllFingersExtended(landmarks);
    return fingers.thumb && fingers.pinky && !fingers.index && !fingers.middle && !fingers.ring;
}

/**
 * 检测是否为"摇滚"手势 (食指+小指伸直)
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否摇滚手势
 */
export function isRockOnGesture(landmarks) {
    const fingers = getAllFingersExtended(landmarks);
    return fingers.index && fingers.pinky && !fingers.middle && !fingers.ring && !fingers.thumb;
}

/**
 * 检测是否为张开手掌
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否张开手掌
 */
export function isOpenPalm(landmarks) {
    const fingers = getAllFingersExtended(landmarks);
    // 至少4根手指伸直
    const count = countExtendedFingers(landmarks);
    return count >= 4;
}

/**
 * 检测是否为握拳
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否握拳
 */
export function isFist(landmarks) {
    const fingers = getAllFingersExtended(landmarks);
    // 所有手指都不伸直（或最多拇指伸直）
    const count = countExtendedFingers(landmarks);
    return count <= 1 && !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;
}

// ========== 手掌方向检测 ==========

/**
 * 获取手掌中心点 (近似)
 * @param {Array} landmarks - 21个关键点
 * @returns {Object} 中心点 {x, y, z}
 */
export function getPalmCenter(landmarks) {
    // 使用手腕(0)和中指根部(9)的中点作为手掌中心
    const wrist = landmarks[0];
    const middleMCP = landmarks[9];
    return {
        x: (wrist.x + middleMCP.x) / 2,
        y: (wrist.y + middleMCP.y) / 2,
        z: (wrist.z + middleMCP.z) / 2
    };
}

/**
 * 获取手掌法向量 (用于判断朝向)
 * @param {Array} landmarks - 21个关键点
 * @returns {Object} 法向量 {x, y, z}
 */
export function getPalmNormal(landmarks) {
    // 使用手腕、中指根部、小指根部三个点计算平面法向量
    const p0 = landmarks[0];  // 手腕
    const p1 = landmarks[9];  // 中指根部
    const p2 = landmarks[17]; // 小指根部

    // 计算两个向量
    const v1 = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
    const v2 = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };

    // 叉积得到法向量
    return {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
    };
}

/**
 * 检测手掌是否朝上
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否朝上
 */
export function isPalmFacingUp(landmarks) {
    const normal = getPalmNormal(landmarks);
    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);
    // Y轴主导且为负，表示朝上
    return absY > absX && absY > absZ && normal.y < 0;
}

/**
 * 检测手掌是否朝下
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否朝下
 */
export function isPalmFacingDown(landmarks) {
    const normal = getPalmNormal(landmarks);
    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);
    // Y轴主导且为正，表示朝下
    return absY > absX && absY > absZ && normal.y > 0;
}

/**
 * 检测手掌是否朝向摄像头
 * @param {Array} landmarks - 21个关键点
 * @returns {boolean} 是否朝向摄像头
 */
export function isPalmFacingCamera(landmarks) {
    const normal = getPalmNormal(landmarks);
    // Z轴主导表示朝向摄像头（仅判断主导轴，忽略正负）
    return Math.abs(normal.z) > Math.abs(normal.x) && Math.abs(normal.z) > Math.abs(normal.y);
}

/**
 * 获取手掌方向描述
 * @param {Array} landmarks - 21个关键点
 * @returns {string} 方向描述 'up', 'down', 'left', 'right', 'camera', 'away'
 */
export function getPalmDirection(landmarks) {
    const normal = getPalmNormal(landmarks);

    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);

    if (absZ > absX && absZ > absY) {
        return normal.z > 0 ? 'camera' : 'away';
    }
    if (absX > absY && absX > absZ) {
        return normal.x > 0 ? 'right' : 'left';
    }
    return normal.y > 0 ? 'down' : 'up';
}

// ========== 动态手势检测 ==========

/**
 * 更新手势历史记录
 * @param {string} handKey - 'leftHand' 或 'rightHand'
 * @param {Object} position - 位置 {x, y}
 */
function updateGestureHistory(handKey, position) {
    const history = gestureHistory[handKey];
    const now = performance.now();
    const entry = { x: position.x, y: position.y, t: now };
    history.positions.push(entry);

    // 计算X轴速度
    let velocityX = 0;
    if (history.positions.length >= 2) {
        const prevPos = history.positions[history.positions.length - 2];
        const dt = entry.t - prevPos.t;
        if (dt > 0) {
            velocityX = (entry.x - prevPos.x) / (dt / 1000);
        }
    }
    history.velocities.push(velocityX);

    // 保持固定时间窗口的历史记录
    while (history.positions.length > 0 &&
           now - history.positions[0].t > CONFIG.WAVE_TIME_WINDOW_MS) {
        history.positions.shift();
        history.velocities.shift();
    }
}

/**
 * 检测挥手手势 - 优化版
 * 核心原理：检测X轴的**来回摆动**（方向反复变化），而不仅仅是位移范围
 *
 * @param {Array} landmarks - 21个关键点
 * @param {string} handKey - 'leftHand' 或 'rightHand'
 * @returns {boolean} 是否在挥手
 */
export function isWaving(landmarks, handKey = 'rightHand') {
    // Only count waving when the palm is open, facing the camera, and not OK.
    if (!isOpenPalm(landmarks) || !isPalmFacingCamera(landmarks) || isOKGesture(landmarks)) {
        return false;
    }

    const palmCenter = getPalmCenter(landmarks);
    updateGestureHistory(handKey, palmCenter);

    const history = gestureHistory[handKey];

    if (history.positions.length < CONFIG.WAVE_MIN_SAMPLES) {
        return false;
    }

    // 1. 计算X轴位移范围
    const xPositions = history.positions.map(p => p.x);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);
    const xRange = maxX - minX;

    // 检查最小幅度
    if (xRange < CONFIG.WAVE_MIN_AMPLITUDE) {
        return false;
    }

    // 2. 计算Y轴位移（挥手时Y轴变化不宜过大）
    const yPositions = history.positions.map(p => p.y);
    const minY = Math.min(...yPositions);
    const maxY = Math.max(...yPositions);
    const yRange = maxY - minY;

    // Y轴变化不应明显大于X轴变化
    if (yRange > xRange * CONFIG.WAVE_Y_RANGE_RATIO) {
        return false;
    }

    // 3. 检测方向变化次数（基于位置序列）
    let directionChanges = 0;
    let lastDirection = 0;

    for (let i = 1; i < history.positions.length; i++) {
        const dx = history.positions[i].x - history.positions[i - 1].x;
        if (Math.abs(dx) < CONFIG.WAVE_MIN_DELTA_X) {
            continue;
        }
        const direction = dx > 0 ? 1 : -1;
        if (lastDirection !== 0 && direction !== lastDirection) {
            directionChanges++;
        }
        lastDirection = direction;
    }

    // 4. 判断是否满足挥手条件
    return directionChanges >= CONFIG.WAVE_DIRECTION_CHANGES;
}

/**
 * 重置挥手检测历史
 * @param {string} handKey - 'leftHand' 或 'rightHand'
 */
export function resetWaveHistory(handKey = 'rightHand') {
    if (gestureHistory[handKey]) {
        gestureHistory[handKey].positions = [];
        gestureHistory[handKey].velocities = [];
        gestureHistory[handKey].waveDirectionChanges = 0;
        gestureHistory[handKey].lastVelocityX = 0;
    }
}

/**
 * 更新Hello挥手状态（内部函数）
 * @param {string} handKey - 'leftHand' 或 'rightHand'
 * @param {Object} palmCenter - 手掌中心 {x, y, z}
 * @param {boolean} isHandRaised - 手是否举起
 */
function updateHelloWaveState(handKey, palmCenter, isHandRaised) {
    const state = gestureHistory[handKey];

    // 手放下时重置
    if (!isHandRaised) {
        state.waveStartTime = 0;
        state.helloDirectionChanges = 0;
        state.consecutiveWaveFrames = 0;
        state.lastHelloX = null;
        state.lastHelloDirection = 0;
        return;
    }

    // 追踪X方向变化
    if (state.lastHelloX !== null) {
        const deltaX = palmCenter.x - state.lastHelloX;
        const direction = deltaX > CONFIG.WAVE_X_THRESHOLD ? 1 :
                         (deltaX < -CONFIG.WAVE_X_THRESHOLD ? -1 : 0);

        // 检测方向改变
        if (direction !== 0 && direction !== state.lastHelloDirection && state.lastHelloDirection !== 0) {
            state.helloDirectionChanges++;
            state.lastHelloDirection = direction;
        } else if (direction !== 0 && state.lastHelloDirection === 0) {
            state.lastHelloDirection = direction;
        }

        // 达到最小方向改变次数
        if (state.helloDirectionChanges >= CONFIG.WAVE_MIN_DIRECTION_CHANGES) {
            if (state.waveStartTime === 0) {
                state.waveStartTime = Date.now();
            }
            state.consecutiveWaveFrames++;
        }
    }

    state.lastHelloX = palmCenter.x;
}

/**
 * 检测Hello打招呼挥手手势（举手并挥动，持续2秒）
 * @param {Array} landmarks - 21个关键点
 * @param {string} handKey - 'leftHand' 或 'rightHand'
 * @returns {Object} {isWaving: boolean, duration: number}
 */
export function isHelloWaving(landmarks, handKey = 'rightHand') {
    const palmCenter = getPalmCenter(landmarks);

    // 1. 检测手是否举起 (Y坐标小于阈值，手掌张开)
    const isHandRaised = palmCenter.y < CONFIG.WAVE_RAISE_Y_THRESHOLD && isOpenPalm(landmarks);

    // 2. 更新挥手状态
    updateHelloWaveState(handKey, palmCenter, isHandRaised);

    const waveState = gestureHistory[handKey];

    // 3. 判断是否满足触发条件
    if (waveState.waveStartTime > 0) {
        const duration = Date.now() - waveState.waveStartTime;
        if (duration > CONFIG.WAVE_TRIGGER_DURATION && waveState.consecutiveWaveFrames > 5) {
            return { isWaving: true, duration };
        }
    }

    return { isWaving: false, duration: 0 };
}

/**
 * 重置Hello挥手状态
 * @param {string} handKey - 'leftHand' 或 'rightHand'
 */
export function resetHelloWave(handKey = 'rightHand') {
    const state = gestureHistory[handKey];
    if (state) {
        state.waveStartTime = 0;
        state.helloDirectionChanges = 0;
        state.consecutiveWaveFrames = 0;
        state.lastHelloX = null;
        state.lastHelloDirection = 0;
    }
}

// ========== 双手交互检测 ==========

/**
 * 计算双手之间的距离
 * @param {Array} leftLandmarks - 左手关键点
 * @param {Array} rightLandmarks - 右手关键点
 * @returns {number} 距离
 */
export function getHandsDistance(leftLandmarks, rightLandmarks) {
    const leftCenter = getPalmCenter(leftLandmarks);
    const rightCenter = getPalmCenter(rightLandmarks);
    return calculateDistance(leftCenter, rightCenter);
}

/**
 * 检测双手缩放手势 (靠近/分开)
 * @param {Array} leftLandmarks - 左手关键点
 * @param {Array} rightLandmarks - 右手关键点
 * @param {number} previousDistance - 之前的距离
 * @returns {Object} {isZoom: boolean, direction: 'in' | 'out' | null}
 */
export function detectZoomGesture(leftLandmarks, rightLandmarks, previousDistance) {
    if (!leftLandmarks || !rightLandmarks || !previousDistance) {
        return { isZoom: false, direction: null };
    }

    const currentDistance = getHandsDistance(leftLandmarks, rightLandmarks);
    const delta = currentDistance - previousDistance;
    const threshold = 0.02;

    if (Math.abs(delta) > threshold) {
        return {
            isZoom: true,
            direction: delta > 0 ? 'out' : 'in',
            distance: currentDistance
        };
    }

    return {
        isZoom: false,
        direction: null,
        distance: currentDistance
    };
}

// ========== 统一检测入口 ==========

/**
 * 检测单只手的全部手势状态
 * @param {Array} landmarks - 21个关键点
 * @param {string} handedness - 'Left' 或 'Right'
 * @returns {Object} 所有手势状态
 */
export function detectHandGestures(landmarks, handedness = 'Right') {
    const fingers = getAllFingersExtended(landmarks);
    const pinchStates = getAllPinchStates(landmarks);
    const palmCenter = getPalmCenter(landmarks);
    const handKey = handedness === 'Left' ? 'leftHand' : 'rightHand';

    // 检测Hello打招呼挥手
    const helloWaving = isHelloWaving(landmarks, handKey);

    return {
        // 基础手指状态
        fingers: {
            thumb: fingers.thumb,
            index: fingers.index,
            middle: fingers.middle,
            ring: fingers.ring,
            pinky: fingers.pinky,
            extendedCount: countExtendedFingers(landmarks)
        },

        // 捏合状态
        pinch: {
            isPinching: pinchStates.thumbIndex.isPinching ||
                       pinchStates.thumbMiddle.isPinching ||
                       pinchStates.thumbRing.isPinching ||
                       pinchStates.thumbPinky.isPinching,
            thumbIndex: pinchStates.thumbIndex.isPinching,
            thumbMiddle: pinchStates.thumbMiddle.isPinching,
            thumbRing: pinchStates.thumbRing.isPinching,
            thumbPinky: pinchStates.thumbPinky.isPinching,
            thumbIndexDistance: pinchStates.thumbIndex.distance,
            pinchingFinger: getPinchingFinger(landmarks)
        },

        // 常见手势
        gestures: {
            pointing: isPointingGesture(landmarks),
            victory: isVictoryGesture(landmarks),
            thumbsUp: isThumbsUpGesture(landmarks),
            thumbsDown: isThumbsDownGesture(landmarks),
            ok: isOKGesture(landmarks),
            callMe: isCallMeGesture(landmarks),
            rockOn: isRockOnGesture(landmarks),
            openPalm: isOpenPalm(landmarks),
            fist: isFist(landmarks)
        },

        // 手掌方向
        palm: {
            center: palmCenter,
            direction: getPalmDirection(landmarks),
            facingUp: isPalmFacingUp(landmarks),
            facingDown: isPalmFacingDown(landmarks),
            facingCamera: isPalmFacingCamera(landmarks)
        },

        // 动态手势
        dynamic: {
            waving: isWaving(landmarks, handKey),
            helloWaving: helloWaving
        }
    };
}

/**
 * 检测双手交互状态
 * @param {Array} leftLandmarks - 左手关键点
 * @param {Array} rightLandmarks - 右手关键点
 * @param {number} previousDistance - 之前的双手距离
 * @returns {Object} 双手交互状态
 */
export function detectTwoHandGestures(leftLandmarks, rightLandmarks, previousDistance = null) {
    if (!leftLandmarks || !rightLandmarks) {
        return {
            bothPresent: false,
            distance: 0,
            zoom: { isZoom: false, direction: null }
        };
    }

    const distance = getHandsDistance(leftLandmarks, rightLandmarks);
    const zoom = detectZoomGesture(leftLandmarks, rightLandmarks, previousDistance);

    return {
        bothPresent: true,
        distance: distance,
        zoom: zoom
    };
}

/**
 * 检测所有手势状态 (包括双手)
 * @param {Object} results - MediaPipe 的 results 对象
 * @param {number} previousDistance - 之前的双手距离
 * @returns {Object} 完整的手势状态
 */
export function detectAllGestures(results, previousDistance = null) {
    let leftGestures = null;
    let rightGestures = null;
    let twoHandGestures = null;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i].label;

            if (handedness === 'Left') {
                leftGestures = detectHandGestures(landmarks, 'Left');
            } else {
                rightGestures = detectHandGestures(landmarks, 'Right');
            }
        }

        // 检测双手交互
        twoHandGestures = detectTwoHandGestures(
            leftGestures ? results.multiHandLandmarks.find((_, i) => results.multiHandedness[i].label === 'Left') : null,
            rightGestures ? results.multiHandLandmarks.find((_, i) => results.multiHandedness[i].label === 'Right') : null,
            previousDistance
        );
    }

    return {
        left: leftGestures,
        right: rightGestures,
        twoHand: twoHandGestures
    };
}

// ========== 配置导出（允许外部修改） ==========

export { CONFIG, gestureHistory };
