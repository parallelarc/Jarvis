/**
 * Debug Panel Plugin
 * A modular debug dashboard for hand tracking applications
 */

// State
let debugPanelElements = { left: null, right: null };
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

    // Update pinch distances with progress bars
    if (data.leftPinchDistance !== undefined) {
        updatePinchBar('left', data.leftPinchDistance);
    }
    if (data.pinchDistance !== undefined) {
        updatePinchBar('right', data.pinchDistance);
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

    // Update right hand touch and selected states
    if (data.isTouching !== undefined) {
        const el = elements['debug-right-touching'];
        if (el) {
            el.textContent = data.isTouching ? 'Yes' : 'No';
            el.style.color = data.isTouching ? '#ffff00' : '#888';
        }
    }

    if (data.isSelected !== undefined) {
        const el = elements['debug-right-selected'];
        if (el) {
            el.textContent = data.isSelected ? 'Yes' : 'No';
            el.style.color = data.isSelected ? '#ffffff' : '#888';
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

    // Update Hello wave state
    if (data.helloWavingActive !== undefined) {
        const el = elements['debug-hello-waving'];
        if (el) {
            el.textContent = data.helloWavingActive ? '👋 Waving' : 'No';
            el.style.color = data.helloWavingActive ? '#00ffff' : '#888';
        }
    }

    // Update animation state
    if (data.animationState !== undefined) {
        const stateNames = {
            'ball': '🔮 Ball',
            'exploding': '💥 Exploding',
            'forming': '✨ Forming',
            'text': '📝 Hello',
            'recovering': '🔄 Recovering'
        };
        setText('debug-anim-state', stateNames[data.animationState] || data.animationState);
    }

    // Update gesture states if provided
    if (data.gestures) {
        updateGestureStates(data.gestures.left, 'left');
        updateGestureStates(data.gestures.right, 'right');
        updateTwoHandStates(data.gestures.twoHand);
    } else {
        updateGestureStates(null, 'left');
        updateGestureStates(null, 'right');
        updateTwoHandStates(null);
    }
}

/**
 * Update pinch bar and value for a hand side
 * @param {string} side - left or right
 * @param {number} distance - pinch distance
 */
function updatePinchBar(side, distance) {
    const pinchValue = distance.toFixed(3);
    setText(`debug-${side}-pinch-value`, pinchValue);

    const bar = elements[`debug-${side}-pinch-bar`];
    if (bar) {
        const maxPinch = 0.2;
        const percentage = Math.min(100, (distance / maxPinch) * 100);
        bar.style.width = `${percentage}%`;

        // Color based on threshold
        const threshold = 0.08;
        bar.style.backgroundColor = distance < threshold ? '#00ff00' : '#ff6600';
    }
}

/**
 * Update gesture states display
 * @param {Object|null} handGestures - Gesture detection results for a hand
 * @param {string} side - left or right
 */
function updateGestureStates(handGestures, side) {
    if (!handGestures) {
        clearGestureDisplays(side);
        return;
    }

    // Update finger states
    const fingers = handGestures.fingers;
    if (fingers) {
        setFingerState(`debug-${side}-finger-thumb`, fingers.thumb);
        setFingerState(`debug-${side}-finger-index`, fingers.index);
        setFingerState(`debug-${side}-finger-middle`, fingers.middle);
        setFingerState(`debug-${side}-finger-ring`, fingers.ring);
        setFingerState(`debug-${side}-finger-pinky`, fingers.pinky);
        setText(`debug-${side}-finger-count`, fingers.extendedCount?.toString() || '0');
    }

    // Update gesture states
    const gestureStates = handGestures.gestures;
    if (gestureStates) {
        setGestureState(`debug-${side}-gesture-point`, gestureStates.pointing);
        setGestureState(`debug-${side}-gesture-victory`, gestureStates.victory);
        setGestureState(`debug-${side}-gesture-thumbsup`, gestureStates.thumbsUp);
        setGestureState(`debug-${side}-gesture-ok`, gestureStates.ok);
        setGestureState(`debug-${side}-gesture-openpalm`, gestureStates.openPalm);
        setGestureState(`debug-${side}-gesture-fist`, gestureStates.fist);
    }

    // Update dynamic gesture states
    const dynamic = handGestures.dynamic;
    if (dynamic) {
        setGestureState(`debug-${side}-gesture-wave`, dynamic.waving);
    }

    // Update palm direction
    const palm = handGestures.palm;
    if (palm) {
        const zVal = palm.normal ? ` (Z:${palm.normal.z.toFixed(2)})` : '';
        setText(`debug-${side}-palm-dir`, (palm.direction || '—') + zVal);
    }
}

/**
 * Update two-hand states display
 * @param {Object|null} twoHand - Two-hand gesture detection results
 */
function updateTwoHandStates(twoHand) {
    if (!twoHand) {
        setText('debug-two-both', '✗');
        setText('debug-two-distance', '0.000');
        setText('debug-two-zoom', '—');
        return;
    }

    setText('debug-two-both', twoHand.bothPresent ? '✓' : '✗');
    setText('debug-two-distance', twoHand.distance?.toFixed(3) || '0.000');

    let zoomText = '—';
    if (twoHand.zoom?.isZoom) {
        zoomText = twoHand.zoom.direction === 'in' ? '🔍+' : '🔍-';
    }
    setText('debug-two-zoom', zoomText);
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
function clearGestureDisplays(side) {
    const fingerIds = [
        `debug-${side}-finger-thumb`, `debug-${side}-finger-index`, `debug-${side}-finger-middle`,
        `debug-${side}-finger-ring`, `debug-${side}-finger-pinky`
    ];
    fingerIds.forEach(id => {
        const el = elements[id];
        if (el) {
            el.textContent = '—';
            el.style.color = '#666';
        }
    });

    setText(`debug-${side}-finger-count`, '0');

    const gestureIds = [
        `debug-${side}-gesture-point`, `debug-${side}-gesture-victory`, `debug-${side}-gesture-thumbsup`,
        `debug-${side}-gesture-ok`, `debug-${side}-gesture-openpalm`, `debug-${side}-gesture-fist`,
        `debug-${side}-gesture-wave`
    ];
    gestureIds.forEach(id => {
        const el = elements[id];
        if (el) {
            el.textContent = '✗';
            el.style.color = '#666';
        }
    });

    setText(`debug-${side}-palm-dir`, '—');
    setText(`debug-${side}-palm-facing`, '—');
}

/**
 * Toggle panel visibility
 */
export function toggleDebugPanel() {
    if (!isInitialized) return;
    isVisible = !isVisible;
    setPanelsVisible(isVisible);
}

/**
 * Show the panel
 */
export function showDebugPanel() {
    if (!isInitialized) return;
    isVisible = true;
    setPanelsVisible(true);
}

/**
 * Hide the panel
 */
export function hideDebugPanel() {
    if (!isInitialized) return;
    isVisible = false;
    setPanelsVisible(false);
}

function setPanelsVisible(visible) {
    Object.values(debugPanelElements).forEach(panel => {
        if (panel) {
            panel.classList.toggle('hidden', !visible);
        }
    });
}

// ========== Internal Functions ==========

/**
 * Create the panel DOM structure
 */
function createPanelDOM() {
    const panels = document.createElement('div');
    panels.className = 'debug-panels';

    const leftPanel = document.createElement('div');
    // Swap position: Left Hand Panel uses 'right' class
    leftPanel.className = 'debug-panel right';
    leftPanel.id = 'debug-panel-left';
    leftPanel.innerHTML = `
        <div class="debug-header">
            <span class="debug-title">🖐️ Left Hand</span>
            <button class="debug-toggle-btn" id="debug-toggle-btn-left">_</button>
        </div>
        <div class="debug-content">
            <div class="debug-section">
                <div class="debug-section-title">👋 Left Hand</div>
                <div class="debug-row">
                    <span class="debug-label">Active:</span>
                    <span id="debug-left-hand" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Pinch:</span>
                    <div class="debug-bar-container">
                        <div id="debug-left-pinch-bar" class="debug-bar"></div>
                    </div>
                    <span id="debug-left-pinch-value" class="debug-value-small">0.000</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Touching:</span>
                    <span id="debug-left-touching" class="debug-value">No</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Pinching:</span>
                    <span id="debug-left-pinching" class="debug-value">No</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">🖐️ Fingers</div>
                <div class="debug-row">
                    <span class="debug-label">Thumb:</span>
                    <span id="debug-left-finger-thumb" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Index:</span>
                    <span id="debug-left-finger-index" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Middle:</span>
                    <span id="debug-left-finger-middle" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Ring:</span>
                    <span id="debug-left-finger-ring" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Pinky:</span>
                    <span id="debug-left-finger-pinky" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Extended:</span>
                    <span id="debug-left-finger-count" class="debug-value">0</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">✋ Gestures</div>
                <div class="debug-row">
                    <span class="debug-label">Point:</span>
                    <span id="debug-left-gesture-point" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Victory:</span>
                    <span id="debug-left-gesture-victory" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">ThumbsUp:</span>
                    <span id="debug-left-gesture-thumbsup" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">OK:</span>
                    <span id="debug-left-gesture-ok" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">OpenPalm:</span>
                    <span id="debug-left-gesture-openpalm" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Fist:</span>
                    <span id="debug-left-gesture-fist" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Wave:</span>
                    <span id="debug-left-gesture-wave" class="debug-value">✗</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">🧭 Palm Direction</div>
                <div class="debug-row">
                    <span class="debug-label">Dir:</span>
                    <span id="debug-left-palm-dir" class="debug-value">—</span>
                </div>
            </div>
        </div>
    `;

    const rightPanel = document.createElement('div');
    // Swap position: Right Hand Panel uses 'left' class
    rightPanel.className = 'debug-panel left';
    rightPanel.id = 'debug-panel-right';
    rightPanel.innerHTML = `
        <div class="debug-header">
            <span class="debug-title">✋ Right Hand</span>
            <button class="debug-toggle-btn" id="debug-toggle-btn-right">_</button>
        </div>
        <div class="debug-content">
            <div class="debug-section">
                <div class="debug-section-title">👋 Right Hand</div>
                <div class="debug-row">
                    <span class="debug-label">Active:</span>
                    <span id="debug-right-hand" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Pinch:</span>
                    <div class="debug-bar-container">
                        <div id="debug-right-pinch-bar" class="debug-bar"></div>
                    </div>
                    <span id="debug-right-pinch-value" class="debug-value-small">0.000</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Touching:</span>
                    <span id="debug-right-touching" class="debug-value">No</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Selected:</span>
                    <span id="debug-right-selected" class="debug-value">No</span>
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
                <div class="debug-section-title">🖐️ Fingers</div>
                <div class="debug-row">
                    <span class="debug-label">Thumb:</span>
                    <span id="debug-right-finger-thumb" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Index:</span>
                    <span id="debug-right-finger-index" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Middle:</span>
                    <span id="debug-right-finger-middle" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Ring:</span>
                    <span id="debug-right-finger-ring" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Pinky:</span>
                    <span id="debug-right-finger-pinky" class="debug-value">—</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Extended:</span>
                    <span id="debug-right-finger-count" class="debug-value">0</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">✋ Gestures</div>
                <div class="debug-row">
                    <span class="debug-label">Point:</span>
                    <span id="debug-right-gesture-point" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Victory:</span>
                    <span id="debug-right-gesture-victory" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">ThumbsUp:</span>
                    <span id="debug-right-gesture-thumbsup" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">OK:</span>
                    <span id="debug-right-gesture-ok" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">OpenPalm:</span>
                    <span id="debug-right-gesture-openpalm" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Fist:</span>
                    <span id="debug-right-gesture-fist" class="debug-value">✗</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Wave:</span>
                    <span id="debug-right-gesture-wave" class="debug-value">✗</span>
                </div>
            </div>

            <div class="debug-section">
                <div class="debug-section-title">🧭 Palm Direction</div>
                <div class="debug-row">
                    <span class="debug-label">Dir:</span>
                    <span id="debug-right-palm-dir" class="debug-value">—</span>
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
                <div class="debug-section-title">🌐 Sphere</div>
                <div class="debug-row">
                    <span class="debug-label">Pos:</span>
                    <span id="debug-pos" class="debug-value-small">X:0.00 Y:0.00 Z:0.00</span>
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
                <div class="debug-section-title">👋 Hello Wave</div>
                <div class="debug-row">
                    <span class="debug-label">Waving:</span>
                    <span id="debug-hello-waving" class="debug-value">No</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Anim:</span>
                    <span id="debug-anim-state" class="debug-value-small">🔮 Ball</span>
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

    panels.appendChild(leftPanel);
    panels.appendChild(rightPanel);
    document.body.appendChild(panels);
    debugPanelElements = { left: leftPanel, right: rightPanel };

    // Cache element references
    cacheElements();

    // Bind toggle button
    const toggleButtons = [
        document.getElementById('debug-toggle-btn-left'),
        document.getElementById('debug-toggle-btn-right')
    ];
    toggleButtons.forEach(button => {
        if (button) {
            button.addEventListener('click', toggleDebugPanel);
        }
    });
}

/**
 * Cache DOM element references for faster updates
 */
function cacheElements() {
    const ids = [
        'debug-left-hand', 'debug-right-hand',
        'debug-left-pinch-bar', 'debug-left-pinch-value',
        'debug-right-pinch-bar', 'debug-right-pinch-value',
        'debug-left-touching', 'debug-left-pinching',
        'debug-right-touching', 'debug-right-selected',
        'debug-zoom-mode', 'debug-both-ok', 'debug-zoom-distance', 'debug-zoom-delta',
        'debug-zoom-scale', 'debug-pos', 'debug-count',
        'debug-spread', 'debug-color', 'debug-ripples', 'debug-fps',
        // Hello wave states
        'debug-hello-waving', 'debug-anim-state',
        // Left finger states
        'debug-left-finger-thumb', 'debug-left-finger-index', 'debug-left-finger-middle',
        'debug-left-finger-ring', 'debug-left-finger-pinky', 'debug-left-finger-count',
        // Left gesture states
        'debug-left-gesture-point', 'debug-left-gesture-victory', 'debug-left-gesture-thumbsup',
        'debug-left-gesture-ok', 'debug-left-gesture-openpalm', 'debug-left-gesture-fist',
        'debug-left-gesture-wave',
        // Left palm direction
        'debug-left-palm-dir',
        // Right finger states
        'debug-right-finger-thumb', 'debug-right-finger-index', 'debug-right-finger-middle',
        'debug-right-finger-ring', 'debug-right-finger-pinky', 'debug-right-finger-count',
        // Right gesture states
        'debug-right-gesture-point', 'debug-right-gesture-victory', 'debug-right-gesture-thumbsup',
        'debug-right-gesture-ok', 'debug-right-gesture-openpalm', 'debug-right-gesture-fist',
        'debug-right-gesture-wave',
        // Right palm direction
        'debug-right-palm-dir',
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
