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
        'debug-touching', 'debug-selected', 'debug-pos', 'debug-count',
        'debug-spread', 'debug-color', 'debug-ripples', 'debug-fps'
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
