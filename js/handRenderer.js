import { CONFIG } from './appState.js';

let canvasElement;
let canvasCtx;

// Cached drawing values (computed on resize)
let lineWidth = 3;
let pointSize = 5;

export function initHandRenderer(canvas) {
    canvasElement = canvas;
    canvasCtx = canvas.getContext('2d');
    updateDrawingSizes();
}

export function updateDrawingSizes() {
    if (!canvasElement) return;
    const screenSize = Math.min(window.innerWidth, window.innerHeight);
    lineWidth = Math.max(2, Math.min(5, screenSize / 300));
    pointSize = Math.max(2, Math.min(8, screenSize / 250));
}

export function clearCanvas() {
    if (!canvasCtx || !canvasElement) return;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
}

export function drawLandmarks(landmarks, isLeft, isTouching = false, isSelected = false) {
    if (!canvasCtx || !canvasElement) return;

    // Choose color
    let handColor;
    if (isSelected) {
        handColor = '#FFFFFF';
    } else if (isTouching) {
        handColor = '#FFFF00';
    } else if (isLeft) {
        handColor = '#00FF00';
    } else {
        handColor = '#00FFFF';
    }

    // Draw connections
    canvasCtx.lineWidth = lineWidth;
    canvasCtx.strokeStyle = handColor;

    for (const [i, j] of CONFIG.CONNECTIONS) {
        const start = landmarks[i];
        const end = landmarks[j];

        canvasCtx.beginPath();
        canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
        canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
        canvasCtx.stroke();
    }

    // Draw landmarks
    for (let i = 0; i < landmarks.length; i++) {
        const landmark = landmarks[i];
        const pointColor = (i === 4 || i === 8) ? '#FF0000' : handColor;

        canvasCtx.fillStyle = pointColor;
        canvasCtx.beginPath();
        canvasCtx.arc(
            landmark.x * canvasElement.width,
            landmark.y * canvasElement.height,
            pointSize * (i === 4 || i === 8 ? 1.2 : 1),
            0,
            2 * Math.PI
        );
        canvasCtx.fill();
    }
}
