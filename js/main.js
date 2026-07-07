/**
 * Vanilla-Timer Main Logic (Pointer Events / Mobile & PC Compatible Version)
 * Jicchan LCD Edition
 */

// --- DOM Elements ---
const displayMinutes = document.getElementById('display-minutes');
const displaySeconds = document.getElementById('display-seconds');
const btnMinute = document.getElementById('btn-minute');
const btnSecond = document.getElementById('btn-second');
const btnStart = document.getElementById('btn-start');
const lcdContainer = document.getElementById('lcd-container');

// --- State Variables ---
let remainingSeconds = 0;
let initialSeconds = 0;
let isRunning = false;
let isAlarming = false;
let targetTime = 0;

let animationFrameId = null;
let backgroundInterval = null;
let autoStopTimeout = null;
let alarmStopLock = false;

// Audio
let audioCtx = null;
let alarmInterval = null;

// Wake Lock
let wakeLock = null;

// Initialization
function init() {
    updateDisplay();
}

// --- Audio API ---
function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playChime() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc1.type = 'sine';
    osc2.type = 'sine';
    
    osc1.frequency.setValueAtTime(880, t); // A5
    osc2.frequency.setValueAtTime(1108.73, t); // C#6
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.3, t + 0.05); // Attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.8); // Decay
    
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 1);
    osc2.stop(t + 1);
}

function playAlarm() {
    initAudio();
    playChime();
    alarmInterval = setInterval(playChime, 1000);
}

function stopAlarmSound() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
}

// --- Wake Lock API ---
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
            console.warn(`Wake Lock error: ${err.name}, ${err.message}`);
        }
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release().then(() => {
            wakeLock = null;
        }).catch(() => {});
    }
}

document.addEventListener('visibilitychange', () => {
    if (wakeLock !== null && document.visibilityState === 'visible' && isRunning) {
        requestWakeLock();
    }
});

// --- UI Updates ---
function updateDisplay() {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    
    const mStr = m.toString().padStart(2, '0');
    const sStr = s.toString().padStart(2, '0');
    
    displayMinutes.textContent = mStr;
    displaySeconds.textContent = sStr;
    
    if (isRunning) {
        document.title = `${mStr}分${sStr}秒 - タイマー`;
    } else if (remainingSeconds > 0) {
        document.title = `${mStr}分${sStr}秒 - タイマー(設定中)`;
    } else {
        document.title = `00分00秒 - タイマー`;
    }
}

// --- Timer Logic ---
function incrementTime(type) {
    if (isRunning || isAlarming) return;
    
    let m = Math.floor(remainingSeconds / 60);
    let s = remainingSeconds % 60;
    
    if (type === 'min') {
        m = m >= 99 ? 0 : m + 1;
    } else {
        s = s >= 59 ? 0 : s + 1;
    }
    
    remainingSeconds = m * 60 + s;
    updateDisplay();
    
    btnStart.disabled = remainingSeconds === 0;
}

function startTimer() {
    if (remainingSeconds <= 0) return;
    
    initAudio();
    isRunning = true;
    initialSeconds = remainingSeconds;
    targetTime = Date.now() + remainingSeconds * 1000;
    
    btnStart.querySelector('.btn-text').textContent = '一時停止';
    btnStart.classList.replace('btn-primary', 'btn-secondary');
    
    btnMinute.classList.add('is-locked');
    btnSecond.classList.add('is-locked');
    
    requestWakeLock();
    
    loop();
    
    // Background safety interval
    backgroundInterval = setInterval(() => {
        if (isRunning && Date.now() >= targetTime) {
            timeUp();
        }
    }, 500);
}

function pauseTimer() {
    isRunning = false;
    cancelAnimationFrame(animationFrameId);
    clearInterval(backgroundInterval);
    
    const remainingMs = targetTime - Date.now();
    remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    
    updateDisplay();
    
    btnStart.querySelector('.btn-text').textContent = 'スタート';
    btnStart.classList.replace('btn-secondary', 'btn-primary');
    
    btnMinute.classList.remove('is-locked');
    btnSecond.classList.remove('is-locked');
    
    releaseWakeLock();
}

function toggleTimer() {
    if (isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function resetTimer() {
    if (isRunning || isAlarming) return;
    initAudio();
    remainingSeconds = 0;
    initialSeconds = 0;
    updateDisplay();
    btnStart.disabled = true;
}

function loop() {
    if (!isRunning) return;
    const now = Date.now();
    const remainingMs = targetTime - now;

    if (remainingMs <= 0) {
        timeUp();
    } else {
        const currentSeconds = Math.ceil(remainingMs / 1000);
        if (currentSeconds !== remainingSeconds) {
            remainingSeconds = currentSeconds;
            updateDisplay();
        }
        
        animationFrameId = requestAnimationFrame(loop);
    }
}

function timeUp() {
    isRunning = false;
    isAlarming = true;
    cancelAnimationFrame(animationFrameId);
    clearInterval(backgroundInterval);
    
    remainingSeconds = 0;
    updateDisplay();
    
    btnStart.querySelector('.btn-text').textContent = 'ストップ';
    btnStart.classList.replace('btn-secondary', 'btn-primary');
    btnStart.disabled = false;
    
    playAlarm();
    lcdContainer.classList.add('lcd-flash-anim');
    
    autoStopTimeout = setTimeout(() => {
        if (isAlarming) {
            stopAlarmAndReset();
        }
    }, 3000); // Auto-stop after 3 seconds
}

function resetToInitial() {
    remainingSeconds = initialSeconds;
    updateDisplay();
    
    btnStart.querySelector('.btn-text').textContent = 'スタート';
    if (btnStart.classList.contains('btn-secondary')) {
        btnStart.classList.replace('btn-secondary', 'btn-primary');
    }
    btnStart.disabled = false;
    
    btnMinute.classList.remove('is-locked');
    btnSecond.classList.remove('is-locked');
    
    releaseWakeLock();
}

function stopAlarmAndReset() {
    if (alarmStopLock) return;
    alarmStopLock = true;
    
    stopAlarmSound();
    lcdContainer.classList.remove('lcd-flash-anim');
    
    if (autoStopTimeout) {
        clearTimeout(autoStopTimeout);
        autoStopTimeout = null;
    }
    
    resetToInitial();
    
    setTimeout(() => {
        alarmStopLock = false;
        isAlarming = false;
    }, 500);
}

function triggerFullReset() {
    handleTimeSetEnd();
    if (isAlarming) {
        stopAlarmAndReset();
    }
    if (isRunning) {
        pauseTimer();
    }
    initAudio();
    remainingSeconds = 0;
    initialSeconds = 0;
    updateDisplay();
    btnStart.disabled = true;
}

// --- Event Listeners ---

// 1. Long Press Logic & Simultaneous Reset
let pressTimer = null;
let pressInterval = null;

let isQPressed = false;
let isWPressed = false;
let minPointerActive = false;
let secPointerActive = false;

function checkSimultaneousReset() {
    if ((isQPressed && isWPressed) || (minPointerActive && secPointerActive)) {
        triggerFullReset();
        return true;
    }
    return false;
}

function handleTimeSetStart(type) {
    if (isRunning || isAlarming) return;
    initAudio();
    incrementTime(type);
    
    pressTimer = setTimeout(() => {
        pressInterval = setInterval(() => {
            incrementTime(type);
        }, 100);
    }, 500);
}

function handleTimeSetEnd() {
    clearTimeout(pressTimer);
    clearInterval(pressInterval);
}

btnMinute.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    minPointerActive = true;
    if (checkSimultaneousReset()) return;
    handleTimeSetStart('min');
});

btnSecond.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    secPointerActive = true;
    if (checkSimultaneousReset()) return;
    handleTimeSetStart('sec');
});

function handlePointerUp() {
    minPointerActive = false;
    secPointerActive = false;
    handleTimeSetEnd();
}
window.addEventListener('pointerup', handlePointerUp);
window.addEventListener('pointercancel', handlePointerUp);


// 2. Button Clicks
btnStart.addEventListener('click', () => {
    if (isAlarming) return;
    toggleTimer();
});


// 3. Spam & Alarm Interaction Capture
function captureInteraction(e) {
    if (isAlarming) {
        e.preventDefault();
        e.stopPropagation();
        stopAlarmAndReset();
    }
}

window.addEventListener('keydown', captureInteraction, true);
window.addEventListener('click', captureInteraction, true);
window.addEventListener('pointerdown', captureInteraction, true);


// 4. Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    if (isAlarming) return;
    if (e.repeat) return; // Prevent OS auto-repeat

    if (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q') {
        isQPressed = true;
        if (checkSimultaneousReset()) return;
        handleTimeSetStart('min');
    }
    if (e.code === 'KeyW' || e.key === 'w' || e.key === 'W') {
        isWPressed = true;
        if (checkSimultaneousReset()) return;
        handleTimeSetStart('sec');
    }
    if (e.code === 'KeyE' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (!btnStart.disabled) {
            btnStart.click();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q') {
        isQPressed = false;
        handleTimeSetEnd();
    }
    if (e.code === 'KeyW' || e.key === 'w' || e.key === 'W') {
        isWPressed = false;
        handleTimeSetEnd();
    }
});

// 5. Global Context Menu Block
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// 6. Global Audio Unlocker
document.addEventListener('pointerdown', () => {
    initAudio();
}, { once: true });

// Boot
init();