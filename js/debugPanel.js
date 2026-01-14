/**
 * Debug Panel Plugin
 * A modular debug dashboard for hand tracking applications
 */

// State
let debugPanelElement = null;
let isInitialized = false;
let isVisible = true;

// FPS calculation
let frameCount = 0;
let lastFpsUpdate = 0;
let currentFps = 0;

// DOM element references
const elements = {};

/**
 * Initialize the debug panel
 */
export function initDebugPanel() {
    if (isInitialized) return;

    // Inject CSS
    injectStyles();

    // Create panel DOM
    createPanelDOM();

    // Bind keyboard event
    document.addEventListener('keydown', (e) => {
        if (e.key === 'd' || e.key === 'D') {
            toggleDebugPanel();
        }
    });

    // Start FPS counter
    requestAnimationFrame(updateFps);

    isInitialized = true;
}

/**
 * Update the debug panel with new data
 * @param {Object} data - The data to display
 */
export function updateDebugPanel(data) {
    if (!isInitialized) return;

    // Update hand states
    if (data.leftHand !== undefined) {
        setText('debug-left-hand', data.leftHand ? '✓' : '✗');
    }
    if (data.rightHand !== undefined) {
        setText('debug-right-hand', data.rightHand ? '✓' : '✗');
    }

    // Update pinch distance with progress bar
    if (data.pinchDistance !== undefined) {
        const pinchValue = data.pinchDistance.toFixed(3);
        setText('debug-pinch-value', pinchValue);

        const bar = elements['debug-pinch-bar'];
        if (bar) {
            const maxPinch = 0.2;
            const percentage = Math.min(100, (data.pinchDistance / maxPinch) * 100);
            bar.style.width = `${percentage}%`;

            // Color based on threshold
            const threshold = 0.08;
            if (data.pinchDistance < threshold) {
                bar.style.backgroundColor = '#00ff00';
            } else {
                bar.style.backgroundColor = '#ff6600';
            }
        }
    }

    // Update touching and selected states
    if (data.isTouching !== undefined) {
        const el = elements['debug-touching'];
        if (el) {
            el.textContent = data.isTouching ? 'Yes' : 'No';
            el.style.color = data.isTouching ? '#ffff00' : '#888';
        }
    }

    if (data.isSelected !== undefined) {
        const el = elements['debug-selected'];
        if (el) {
            el.textContent = data.isSelected ? 'Yes' : 'No';
            el.style.color = data.isSelected ? '#ffffff' : '#888';
        }
    }

    // Update left hand touch and pinch states
    if (data.leftHandTouching !== undefined) {
        const el = elements['debug-left-touching'];
        if (el) {
            el.textContent = data.leftHandTouching ? 'Yes' : 'No';
            el.style.color = data.leftHandTouching ? '#00ff00' : '#888';
        }
    }

    if (data.leftHandPinching !== undefined) {
        const el = elements['debug-left-pinching'];
        if (el) {
            el.textContent = data.leftHandPinching ? 'Yes' : 'No';
            el.style.color = data.leftHandPinching ? '#ffffff' : '#888';
        }
    }

    // Update zoom mode state
    if (data.isZoomMode !== undefined) {
        const el = elements['debug-zoom-mode'];
        if (el) {
            el.textContent = data.isZoomMode ? '🔍 Active' : 'No';
            el.style.color = data.isZoomMode ? '#ff00ff' : '#888';
        }
    }

    // Update both hands ready state
    if (data.bothTouching !== undefined && data.bothPinching !== undefined) {
        const el = elements['debug-both-ok'];
        if (el) {
            const bothReady = data.bothTouching && data.bothPinching;
            el.textContent = bothReady ? '✓✓' : (data.bothTouching ? 'Touch' : (data.bothPinching ? 'Pinch' : '—'));
            el.style.color = bothReady ? '#00ff00' : '#888';
        }
    }

    // Update zoom distance
    if (data.zoomDistance !== undefined) {
        setText('debug-zoom-distance', data.zoomDistance.toFixed(3));
    }

    // Update zoom delta (scale - 1)
    if (data.targetSpread !== undefined && data.zoomInitialSpread !== undefined) {
        const scale = data.zoomInitialSpread > 0 ? data.targetSpread / data.zoomInitialSpread : 1;
        const delta = scale - 1;
        const deltaText = Math.abs(delta).toFixed(2);
        const sign = delta > 0 ? '+' : '';
        setText('debug-zoom-delta', sign + deltaText);
    }

    // Update zoom scale ratio
    if (data.targetSpread !== undefined && data.zoomInitialSpread !== undefined) {
        const scale = data.zoomInitialSpread > 0 ? data.targetSpread / data.zoomInitialSpread : 1;
        setText('debug-zoom-scale', scale.toFixed(2) + 'x');
    }

    // Update sphere position
    if (data.spherePosition) {
        const pos = data.spherePosition;
        setText('debug-pos', `X:${pos.x.toFixed(2)} Y:${pos.y.toFixed(2)} Z:${pos.z.toFixed(2)}`);
    }

    // Update spread
    if (data.spread !== undefined) {
        setText('debug-spread', data.spread.toFixed(2));
    }

    // Update base color
    if (data.baseColor) {
        const color = data.baseColor;
        setText('debug-color', `(${color.r.toFixed(1)}, ${color.g.toFixed(1)}, ${color.b.toFixed(1)})`);
    }

    // Update ripples count
    if (data.ripplesCount !== undefined) {
        setText('debug-ripples', data.ripplesCount.toString());
    }

    // Update gesture states if provided
    if (data.gestures) {
        updateGestureStates(data.gestures);
    }
}

/**
 * Update gesture states display
 * @param {Object} gestures - Gesture detection results
 */
function updateGestureStates(gestures) {
    // Use right hand as primary, fallback to left hand
    const handGestures = gestures.right || gestures.left;

    if (!handGestures) {
        // Clear all gesture displays
        clearGestureDisplays();
        return;
    }

    // Update finger states
    const fingers = handGestures.fingers;
    if (fingers) {
        setFingerState('debug-finger-thumb', fingers.thumb);
        setFingerState('debug-finger-index', fingers.index);
        setFingerState('debug-finger-middle', fingers.middle);
        setFingerState('debug-finger-ring', fingers.ring);
        setFingerState('debug-finger-pinky', fingers.pinky);
        setText('debug-finger-count', fingers.extendedCount?.toString() || '0');
    }

    // Update gesture states
    const gestureStates = handGestures.gestures;
    if (gestureStates) {
        setGestureState('debug-gesture-point', gestureStates.pointing);
        setGestureState('debug-gesture-victory', gestureStates.victory);
        setGestureState('debug-gesture-thumbsup', gestureStates.thumbsUp);
        setGestureState('debug-gesture-ok', gestureStates.ok);
        setGestureState('debug-gesture-openpalm', gestureStates.openPalm);
        setGestureState('debug-gesture-fist', gestureStates.fist);
    }

    // Update palm direction
    const palm = handGestures.palm;
    if (palm) {
        setText('debug-palm-dir', palm.direction || '—');

        let facingText = '—';
        if (palm.facingUp) facingText = 'Up';
        else if (palm.facingDown) facingText = 'Down';
        else if (palm.facingCamera) facingText = 'Camera';
        setText('debug-palm-facing', facingText);
    }

    // Update two hands states
    const twoHand = gestures.twoHand;
    if (twoHand) {
        setText('debug-two-both', twoHand.bothPresent ? '✓' : '✗');
        setText('debug-two-distance', twoHand.distance?.toFixed(3) || '0.000');

        let zoomText = '—';
        if (twoHand.zoom?.isZoom) {
            zoomText = twoHand.zoom.direction === 'in' ? '🔍+' : '🔍-';
        }
        setText('debug-two-zoom', zoomText);
    }
}

/**
 * Set finger state display
 */
function setFingerState(elementId, isExtended) {
    const el = elements[elementId];
    if (el) {
        el.textContent = isExtended ? '↑' : '—';
        el.style.color = isExtended ? '#00ff00' : '#666';
    }
}

/**
 * Set gesture state display
 */
function setGestureState(elementId, isActive) {
    const el = elements[elementId];
    if (el) {
        el.textContent = isActive ? '✓' : '✗';
        el.style.color = isActive ? '#00ffff' : '#666';
    }
}

/**
 * Clear all gesture displays when no hands detected
 */
function clearGestureDisplays() {
    const fingerIds = ['debug-finger-thumb', 'debug-finger-index', 'debug-finger-middle',
                       'debug-finger-ring', 'debug-finger-pinky'];
    fingerIds.forEach(id => {
        const el = elements[id];
        if (el) {
            el.textContent = '—';
            el.style.color = '#666';
        }
    });

    setText('debug-finger-count', '0');

    const gestureIds = ['debug-gesture-point', 'debug-gesture-victory', 'debug-gesture-thumbsup',
                        'debug-gesture-ok', 'debug-gesture-openpalm', 'debug-gesture-fist'];
    gestureIds.forEach(id => {
        const el = elements[id];
        if (el) {
            el.textContent = '✗';
            el.style.color = '#666';
        }
    });

    setText('debug-palm-dir', '—');
    setText('debug-palm-facing', '—');
    setText('debug-two-both', '✗');
    setText('debug-two-distance', '0.000');
    setText('debug-two-zoom', '—');
}

/**
 * Toggle panel visibility
 */
export function toggleDebugPanel() {
    if (!isInitialized) return;
    isVisible = !isVisible;

    if (isVisible) {
        debugPanelElement.classList.remove('hidden');
    } else {
        debugPanelElement.classList.add('hidden');
    }
}

/**
 * Show the panel
 */
export function showDebugPanel() {
    if (!isInitialized) return;
    isVisible = true;
    debugPanelElement.classList.remove('hidden');
}

/**
 * Hide the panel
 */
export function hideDebugPanel() {
    if (!isInitialized) return;
    isVisible = false;
    debugPanelElement.classList.add('hidden');
}

// ========== Internal Functions ==========

/**
 * Create the panel DOM structure
 */
function createPanelDOM() {
    const panel = document.createElement('div');
    panel.className = 'debug-panel';
    panel.id = 'debug-panel';
    panel.innerHTML = `
        <div class="debug-header">
            <span class="debug-title">📊 Debug Panel</span>
            <button class="debug-toggle-btn" id="debug-toggle-btn">_</button>
        </div>
        <div class="debug-content">
            <div class="debug-section">
                <div class="debug-section-title">👋 Hands</div>
                <div class="debug-row">
                    <span class="debug-label">Left:</span>
                    <span id="debug-left-hand" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Right:</span>
                    <span id="debug-right-hand" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Pinch:</span>
                    <div class="debug-bar-container">
                        <div id="debug-pinch-bar" class="debug-bar"></div>
                    </div>
                    <span id="debug-pinch-value" class="debug-value-small">0.000</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Touching:</span>
                    <span id="debug-touching" class="debug-value">No</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Selected:</span>
                    <span id="debug-selected" class="debug-value">No</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">L-Touch:</span>
                    <span id="debug-left-touching" class="debug-value">No</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">L-Pinch:</span>
                    <span id="debug-left-pinching" class="debug-value">No</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Zoom Mode:</span>
                    <span id="debug-zoom-mode" class="debug-value">No</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Both OK:</span>
                    <span id="debug-both-ok" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Hands Dist:</span>
                    <span id="debug-zoom-distance" class="debug-value-small">0.00</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Delta:</span>
                    <span id="debug-zoom-delta" class="debug-value-small">0.00</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Scale:</span>
                    <span id="debug-zoom-scale" class="debug-value-small">1.00x</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">🌐 Sphere</div>
                <div class="debug-row">
                    <span class="debug-label">Pos:</span>
                    <span id="debug-pos" class="debug-value-small">X:0.00 Y:0.00 Z:0.00</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">🖐️ Fingers</div>
                <div class="debug-row">
                    <span class="debug-label">Thumb:</span>
                    <span id="debug-finger-thumb" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Index:</span>
                    <span id="debug-finger-index" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Middle:</span>
                    <span id="debug-finger-middle" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Ring:</span>
                    <span id="debug-finger-ring" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Pinky:</span>
                    <span id="debug-finger-pinky" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Extended:</span>
                    <span id="debug-finger-count" class="debug-value">0</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">✋ Gestures</div>
                <div class="debug-row">
                    <span class="debug-label">Point:</span>
                    <span id="debug-gesture-point" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Victory:</span>
                    <span id="debug-gesture-victory" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">ThumbsUp:</span>
                    <span id="debug-gesture-thumbsup" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">OK:</span>
                    <span id="debug-gesture-ok" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">OpenPalm:</span>
                    <span id="debug-gesture-openpalm" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Fist:</span>
                    <span id="debug-gesture-fist" class="debug-value">✗</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">🧭 Palm Direction</div>
                <div class="debug-row">
                    <span class="debug-label">Dir:</span>
                    <span id="debug-palm-dir" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Facing:</span>
                    <span id="debug-palm-facing" class="debug-value-small">—</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">🤝 Two Hands</div>
                <div class="debug-row">
                    <span class="debug-label">Both:</span>
                    <span id="debug-two-both" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Distance:</span>
                    <span id="debug-two-distance" class="debug-value-small">0.00</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Zoom:</span>
                    <span id="debug-two-zoom" class="debug-value">—</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">✨ Particles</div>
                <div class="debug-row">
                    <span class="debug-label">Count:</span>
                    <span id="debug-count" class="debug-value">2000</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Spread:</span>
                    <span id="debug-spread" class="debug-value-small">1.00</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Color:</span>
                    <span id="debug-color" class="debug-value-small">(1.0, 0.0, 1.0)</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">🌊 Ripples</div>
                <div class="debug-row">
                    <span class="debug-label">Active:</span>
                    <span id="debug-ripples" class="debug-value">0</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">⚡ Performance</div>
                <div class="debug-row">
                    <span class="debug-label">FPS:</span>
                    <span id="debug-fps" class="debug-value">0</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);
    debugPanelElement = panel;

    // Cache element references
    cacheElements();

    // Bind toggle button
    const toggleBtn = document.getElementById('debug-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleDebugPanel);
    }
}

/**
 * Cache DOM element references for faster updates
 */
function cacheElements() {
    const ids = [
        'debug-left-hand', 'debug-right-hand', 'debug-pinch-bar', 'debug-pinch-value',
        'debug-touching', 'debug-selected', 'debug-left-touching', 'debug-left-pinching',
        'debug-zoom-mode', 'debug-both-ok', 'debug-zoom-distance', 'debug-zoom-delta',
        'debug-zoom-scale', 'debug-pos', 'debug-count',
        'debug-spread', 'debug-color', 'debug-ripples', 'debug-fps',
        // Finger states
        'debug-finger-thumb', 'debug-finger-index', 'debug-finger-middle',
        'debug-finger-ring', 'debug-finger-pinky', 'debug-finger-count',
        // Gesture states
        'debug-gesture-point', 'debug-gesture-victory', 'debug-gesture-thumbsup',
        'debug-gesture-ok', 'debug-gesture-openpalm', 'debug-gesture-fist',
        // Palm direction
        'debug-palm-dir', 'debug-palm-facing',
        // Two hands
        'debug-two-both', 'debug-two-distance', 'debug-two-zoom'
    ];

    ids.forEach(id => {
        elements[id] = document.getElementById(id);
    });
}

/**
 * Set text content of an element
 */
function setText(id, text) {
    const el = elements[id];
    if (el) {
        el.textContent = text;
    }
}

/**
 * Update FPS counter
 */
function updateFps() {
    const now = performance.now();
    frameCount++;

    if (now - lastFpsUpdate >= 500) {
        currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
        setText('debug-fps', currentFps.toString());
        frameCount = 0;
        lastFpsUpdate = now;
    }

    requestAnimationFrame(updateFps);
}

/**
 * Inject CSS styles
 */
function injectStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/debugPanel.css';
    document.head.appendChild(link);
}
