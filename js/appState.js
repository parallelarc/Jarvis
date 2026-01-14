// Main application configuration
export const CONFIG = {
    // Particle system
    PARTICLE_COUNT: 2000,
    BASE_RADIUS: 2.0,
    PARTICLE_SIZE: 0.05,

    // Hand interaction
    PINCH_THRESHOLD: 0.08,
    BOUNDARY_Y: 4.5,

    // Spread control
    SPREAD_MIN: 0.3,
    SPREAD_MAX: 5.0,
    SPREAD_SMOOTHING: 0.1,

    // Ripple effect
    RIPPLE_DURATION: 2000,
    RIPPLE_EXPANSION_SPEED: 0.005,
    RIPPLE_WIDTH: 0.5,

    // Colors
    DEFAULT_COLOR: { r: 1.0, g: 0.0, b: 1.0 }, // Magenta

    // Camera
    CAMERA_FOV: 75,
    CAMERA_NEAR: 0.1,
    CAMERA_FAR: 1000,
    CAMERA_Z: 5,

    // Hand landmark connections
    CONNECTIONS: [
        [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],       // Index
        [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
        [0, 13], [13, 14], [14, 15], [15, 16],// Ring
        [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
        [5, 9], [9, 13], [13, 17]             // Palm
    ]
};

export const VIEW = {
    // The display is mirrored via CSS; keep raw coordinates for interactions.
    MIRROR_X: true
};

// Animation state constants
export const ANIMATION_STATE = {
    BALL: 'ball',           // Default sphere state
    EXPLODING: 'exploding', // Particles exploding outward
    FORMING: 'forming',     // Particles forming text
    TEXT: 'text',           // Text display state
    RECOVERING: 'recovering' // Returning to sphere
};

// Application state
export const state = {
    // Hand tracking
    rightHandActive: false,
    leftHandActive: false,

    // Right hand drag
    isTouching: false,
    isSelected: false,
    dragOffset: { x: 0, y: 0, z: 0 },
    spherePosition: { x: 0, y: 0, z: 0 },

    // Left hand
    leftHandTouching: false,
    leftHandPinching: false,
    leftHandPinchDistance: 0,

    // Two-hand zoom
    isZoomMode: false,
    zoomInitialSpread: 1.0,
    zoomLeftInitialDist: 0,
    zoomRightInitialDist: 0,
    zoomCurrentDistance: 0,

    // Gesture detection
    previousHandsDistance: null,

    // Spread control
    targetSpread: 1.0,
    currentSpread: 1.0,

    // Visual
    baseColor: { ...CONFIG.DEFAULT_COLOR },
    ripples: [],

    // Animation state
    animationState: ANIMATION_STATE.BALL,
    animationStartTime: 0,
    explosionCenter: { x: 0, y: 0, z: 0 },

    // Hello waving gesture state
    helloWavingActive: false,
    lastWavingTime: 0
};

// Helper functions
export function calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = point1.z - (point2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function normalizedToWorld(point) {
    return {
        x: (point.x - 0.5) * 10,
        y: (0.5 - point.y) * 10,
        z: 0
    };
}

export function isPointNearParticlesWithPos(point, spherePos, spread) {
    const worldPos = normalizedToWorld(point);
    const dx = worldPos.x - spherePos.x;
    const dy = worldPos.y - spherePos.y;
    const dz = -spherePos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance < CONFIG.BASE_RADIUS * spread;
}

export function blendColors(color1, color2, ratio) {
    return {
        r: color1.r * (1 - ratio) + color2.r * ratio,
        g: color1.g * (1 - ratio) + color2.g * ratio,
        b: color1.b * (1 - ratio) + color2.b * ratio
    };
}

export function hexToRgb(hex) {
    return {
        r: ((hex >> 16) & 255) / 255,
        g: ((hex >> 8) & 255) / 255,
        b: (hex & 255) / 255
    };
}

function getHandLandmarks(results, handedness) {
    if (!results.multiHandLandmarks || !results.multiHandedness) return null;
    for (let i = 0; i < results.multiHandedness.length; i++) {
        if (results.multiHandedness[i].label === handedness) {
            return results.multiHandLandmarks[i];
        }
    }
    return null;
}

// Process right hand (drag interaction)
function processRightHand(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const thumbNear = isPointNearParticlesWithPos(thumbTip, state.spherePosition, state.currentSpread);
    const indexNear = isPointNearParticlesWithPos(indexTip, state.spherePosition, state.currentSpread);
    const bothTouching = thumbNear && indexNear;

    const pinchDistance = calculateDistance(thumbTip, indexTip);

    if (state.isSelected) {
        if (pinchDistance < CONFIG.PINCH_THRESHOLD) {
            // Drag mode
            const handWorldPos = normalizedToWorld(indexTip);
            state.spherePosition.x = handWorldPos.x - state.dragOffset.x;
            state.spherePosition.y = handWorldPos.y - state.dragOffset.y;
            state.spherePosition.z = handWorldPos.z - state.dragOffset.z;

            // Apply boundaries
            const aspectRatio = window.innerWidth / window.innerHeight;
            const boundaryX = CONFIG.BOUNDARY_Y * aspectRatio;

            state.spherePosition.x = Math.max(-boundaryX, Math.min(boundaryX, state.spherePosition.x));
            state.spherePosition.y = Math.max(-CONFIG.BOUNDARY_Y, Math.min(CONFIG.BOUNDARY_Y, state.spherePosition.y));
            state.spherePosition.z = Math.max(-2, Math.min(2, state.spherePosition.z));
        } else {
            state.isSelected = false;
        }
    } else if (bothTouching && pinchDistance < CONFIG.PINCH_THRESHOLD) {
        state.isSelected = true;
        const handWorldPos = normalizedToWorld(indexTip);
        state.dragOffset = {
            x: handWorldPos.x - state.spherePosition.x,
            y: handWorldPos.y - state.spherePosition.y,
            z: handWorldPos.z - state.spherePosition.z
        };
    }

    state.isTouching = bothTouching;
    state.rightHandActive = true;

    return { isLeft: false, isTouching: bothTouching, isSelected: state.isSelected };
}

// Process left hand (zoom preparation)
function processLeftHand(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const thumbNear = isPointNearParticlesWithPos(thumbTip, state.spherePosition, state.currentSpread);
    const indexNear = isPointNearParticlesWithPos(indexTip, state.spherePosition, state.currentSpread);
    state.leftHandTouching = thumbNear && indexNear;

    const pinchDistance = calculateDistance(thumbTip, indexTip);
    state.leftHandPinching = pinchDistance < CONFIG.PINCH_THRESHOLD;
    state.leftHandPinchDistance = pinchDistance;

    state.leftHandActive = true;

    return { isLeft: true, isTouching: state.leftHandTouching, isPinching: state.leftHandPinching };
}

// Process two-hand zoom
function processTwoHandZoom(results) {
    const rightTouching = state.isTouching;
    const rightPinching = state.isSelected;
    const bothTouching = state.leftHandTouching && rightTouching;
    const bothPinching = state.leftHandPinching && rightPinching;

    if (state.isZoomMode) {
        if (bothPinching) {
            const leftLandmarks = getHandLandmarks(results, 'Left');
            const rightLandmarks = getHandLandmarks(results, 'Right');

            if (leftLandmarks && rightLandmarks) {
                const leftWorldPos = normalizedToWorld(leftLandmarks[8]);
                const rightWorldPos = normalizedToWorld(rightLandmarks[8]);

                const leftCurrentDist = calculateDistance(leftWorldPos, state.spherePosition);
                const rightCurrentDist = calculateDistance(rightWorldPos, state.spherePosition);

                const leftScale = state.zoomLeftInitialDist > 0 ? leftCurrentDist / state.zoomLeftInitialDist : 1;
                const rightScale = state.zoomRightInitialDist > 0 ? rightCurrentDist / state.zoomRightInitialDist : 1;
                const avgScale = (leftScale + rightScale) / 2;

                state.targetSpread = Math.max(CONFIG.SPREAD_MIN, Math.min(CONFIG.SPREAD_MAX, state.zoomInitialSpread * avgScale));
            }
        } else {
            state.isZoomMode = false;
        }
    } else if (bothTouching && bothPinching) {
        state.isZoomMode = true;

        const leftLandmarks = getHandLandmarks(results, 'Left');
        const rightLandmarks = getHandLandmarks(results, 'Right');

        if (leftLandmarks && rightLandmarks) {
            const leftWorldPos = normalizedToWorld(leftLandmarks[8]);
            const rightWorldPos = normalizedToWorld(rightLandmarks[8]);

            state.zoomLeftInitialDist = calculateDistance(leftWorldPos, state.spherePosition);
            state.zoomRightInitialDist = calculateDistance(rightWorldPos, state.spherePosition);
            state.zoomInitialSpread = state.currentSpread;
        }
    }

    return { bothTouching, bothPinching };
}

// Main hand processing - called from onResults
export function processHands(results) {
    const handStates = [];

    // Reset flags
    state.rightHandActive = false;
    state.leftHandActive = false;
    let pinchDistance = 0;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i].label;
            const isLeft = handedness === 'Left';

            handStates.push(isLeft ? processLeftHand(landmarks) : processRightHand(landmarks));
            if (!isLeft) pinchDistance = calculateDistance(landmarks[4], landmarks[8]);
        }
    } else {
        state.leftHandTouching = false;
        state.leftHandPinching = false;
        state.leftHandPinchDistance = 0;
    }

    // Process two-hand zoom
    const zoomState = processTwoHandZoom(results);

    return { handStates, pinchDistance, zoomState };
}
