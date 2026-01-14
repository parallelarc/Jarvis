import { CONFIG, state, processHands, ANIMATION_STATE } from './appState.js';
import { initParticleSystem, animateParticles, triggerExplosion, triggerRecovery } from './particles.js';
import { initHandRenderer, clearCanvas, drawLandmarks, updateDrawingSizes } from './handRenderer.js';
import { initDebugPanel, updateDebugPanel } from './debugPanel.js';
import { detectAllGestures, resetHelloWave } from './gestureDetector.js';

// DOM elements
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const threeContainer = document.getElementById('three-canvas');
const statusElement = document.getElementById('status');

// Three.js
let scene, camera, renderer;
let hands;

// Initialize webcam
async function initWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'user'
            }
        });
        videoElement.srcObject = stream;

        return new Promise(resolve => {
            videoElement.onloadedmetadata = () => resolve(videoElement);
        });
    } catch (error) {
        statusElement.textContent = `Error: ${error.message}`;
        throw error;
    }
}

// Initialize Three.js
function initThreeJS() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        CONFIG.CAMERA_FOV,
        window.innerWidth / window.innerHeight,
        CONFIG.CAMERA_NEAR,
        CONFIG.CAMERA_FAR
    );
    camera.position.z = CONFIG.CAMERA_Z;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    threeContainer.appendChild(renderer.domElement);

    initParticleSystem(scene);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    animate();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    animateParticles();
    renderer.render(scene, camera);
}

/**
 * 检测挥手手势并触发动画
 * @param {Object} allGestures - 所有手势检测结果
 */
function checkHelloWavingGesture(allGestures) {
    const leftWaving = Boolean(
        allGestures.left?.dynamic?.helloWaving?.isWaving ||
        allGestures.left?.dynamic?.waving
    );
    const rightWaving = Boolean(
        allGestures.right?.dynamic?.helloWaving?.isWaving ||
        allGestures.right?.dynamic?.waving
    );
    const isAnyHandWaving = leftWaving || rightWaving;

    // 检查左手
    if (leftWaving && state.animationState === ANIMATION_STATE.BALL) {
        triggerExplosion();
    }

    // 检查右手
    if (rightWaving && state.animationState === ANIMATION_STATE.BALL) {
        triggerExplosion();
    }

    // 更新挥手状态
    state.helloWavingActive = isAnyHandWaving;
    state.lastWavingTime = isAnyHandWaving ? Date.now() : state.lastWavingTime;

    // 挥手停止且在TEXT状态时，触发恢复
    if (!isAnyHandWaving && state.animationState === ANIMATION_STATE.TEXT) {
        triggerRecovery();
    }
}

// Process hand tracking results
function onResults(results) {
    clearCanvas();

    // Ensure canvas size matches window
    if (canvasElement.width !== window.innerWidth ||
        canvasElement.height !== window.innerHeight) {
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;
        updateDrawingSizes();
    }

    // Process hands
    const { handStates, pinchDistance, zoomState } = processHands(results);

    // Draw hands
    if (results.multiHandLandmarks) {
        statusElement.textContent = `${results.multiHandLandmarks.length} hand${results.multiHandLandmarks.length > 1 ? 's' : ''} detected`;

        results.multiHandLandmarks.forEach((landmarks, i) => {
            const isLeft = results.multiHandedness[i].label === 'Left';
            const s = handStates[i];
            drawLandmarks(landmarks, isLeft, s?.isTouching, s?.isSelected || s?.isPinching);
        });
    } else {
        statusElement.textContent = 'No hands detected';
    }

    // Detect gestures
    const allGestures = detectAllGestures(results, state.previousHandsDistance);

    if (allGestures.twoHand?.bothPresent) {
        state.previousHandsDistance = allGestures.twoHand.distance;
    } else {
        state.previousHandsDistance = null;
    }

    // 检测Hello挥手打招呼并触发动画
    checkHelloWavingGesture(allGestures);

    // Update debug panel
    updateDebugPanel({
        leftHand: state.leftHandActive,
        rightHand: state.rightHandActive,
        pinchDistance,
        isTouching: state.isTouching,
        isSelected: state.isSelected,
        spherePosition: { ...state.spherePosition },
        spread: state.currentSpread,
        targetSpread: state.targetSpread,
        baseColor: { ...state.baseColor },
        ripplesCount: state.ripples.length,
        gestures: allGestures,
        isZoomMode: state.isZoomMode,
        leftHandTouching: state.leftHandTouching,
        leftHandPinching: state.leftHandPinching,
        bothTouching: zoomState.bothTouching,
        bothPinching: zoomState.bothPinching,
        zoomDistance: state.zoomCurrentDistance,
        zoomInitialSpread: state.zoomInitialSpread,
        // Hello wave 动画状态
        helloWavingActive: state.helloWavingActive,
        animationState: state.animationState
    });
}

// Initialize MediaPipe Hands
async function initMediaPipeHands() {
    statusElement.textContent = 'Initializing MediaPipe Hands...';

    hands = new Hands({
        locateFile: (file) => {
            const localFiles = [
                'hands_solution_packed_assets.data',
                'hands_solution_packed_assets.fileset',
                'hands_solution_packed_assets_loader.js',
                'hands_solution_simd_wasm_bin.js',
                'hands_solution_simd_wasm_bin.wasm',
                'hands_solution_similarity_calculator.data',
                'hands.binarypb',
                'hand_landmark_full.tflite'
            ];
            if (localFiles.includes(file)) {
                return `./models/hands/${file}`;
            }
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    await hands.initialize();
    statusElement.textContent = 'Hand tracking ready!';
    return hands;
}

// Handle window resize
window.addEventListener('resize', () => {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
    updateDrawingSizes();

    if (renderer) {
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    if (camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    }
});

// Start the application
async function startApp() {
    try {
        await initWebcam();
        initThreeJS();
        initHandRenderer(canvasElement);
        initDebugPanel();

        hands = await initMediaPipeHands();
        hands.onResults(onResults);

        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({ image: videoElement });
            },
            width: 1920,
            height: 1080
        });

        camera.start();
    } catch (error) {
        statusElement.textContent = `Error: ${error.message}`;
        console.error('Error starting application:', error);
    }
}

startApp();
