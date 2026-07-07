/**
 * Vanilla-Timer Main Logic (Pointer Events / Mobile & PC Compatible Version)
 */

// --- DOM Elements ---
const displayMinutes = document.getElementById('display-minutes');
const displaySeconds = document.getElementById('display-seconds');
const btnMinute = document.getElementById('btn-minute');
const btnSecond = document.getElementById('btn-second');
const btnStart = document.getElementById('btn-start');
const btnReset = document.getElementById('btn-reset');
const progressIndicator = document.getElementById('progress-indicator');

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

// Constants
const MAX_SECONDS = 99 * 60 + 59; // 5999秒 (99:59)
const CIRCUMFERENCE = 2 * Math.PI * 45; // 282.743

// --- Initialization ---
function init() {
    progressIndicator.style.strokeDasharray = CIRCUMFERENCE;
    updateDisplay();
    updateRingSetting();
    
    // Service Worker placeholder
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            console.log('Service Worker placeholder: Ready for future PWA registration.');
        });
    }
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
        document.title = `${mStr}:${sStr} - タイマー`;
    } else if (remainingSeconds > 0) {
        document.title = `${mStr}:${sStr} - タイマー(設定中)`;
    } else {
        document.title = `00:00 - タイマー`;
    }
}

function updateRingSetting() {
    if (remainingSeconds === 0) {
        progressIndicator.style.strokeDashoffset = CIRCUMFERENCE;
        return;
    }
    
    const percent = remainingSeconds / MAX_SECONDS;
    const offset = CIRCUMFERENCE - (Math.min(1, percent) * CIRCUMFERENCE);
    progressIndicator.style.strokeDashoffset = offset;
}

function updateRingRunning(percent) {
    const offset = CIRCUMFERENCE - (percent * CIRCUMFERENCE);
    progressIndicator.style.strokeDashoffset = offset;
}

// --- Timer Logic ---
function incrementTime(type) {
    if (isRunning || isAlarming) return;
    
    let m = Math.floor(remainingSeconds / 60);
    let s = remainingSeconds % 60;
    
    if (type === 'min') {
        m = Math.min(m + 1, 99);
    } else {
        s = Math.min(s + 1, 59);
    }
    
    remainingSeconds = m * 60 + s;
    updateDisplay();
    updateRingSetting();
    
    btnStart.disabled = remainingSeconds === 0;
}

function startTimer() {
    if (remainingSeconds <= 0) return;
    
    initAudio();
    isRunning = true;
    initialSeconds = remainingSeconds;
    targetTime = Date.now() + remainingSeconds * 1000;
    
    btnStart.textContent = '一時停止';
    btnStart.classList.replace('btn-primary', 'btn-secondary');
    
    btnMinute.disabled = true;
    btnSecond.disabled = true;
    btnReset.disabled = true;
    
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
    updateRingSetting();
    
    btnStart.textContent = 'スタート';
    btnStart.classList.replace('btn-secondary', 'btn-primary');
    
    btnMinute.disabled = false;
    btnSecond.disabled = false;
    btnReset.disabled = false;
    
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
    updateRingSetting();
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
        
        const percent = remainingMs / (MAX_SECONDS * 1000);
        updateRingRunning(Math.max(0, Math.min(1, percent)));
        
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
    updateRingRunning(0);
    
    btnStart.textContent = 'ストップ';
    btnStart.classList.replace('btn-secondary', 'btn-primary');
    btnStart.disabled = false;
    
    playAlarm();
    
    autoStopTimeout = setTimeout(() => {
        if (isAlarming) {
            stopAlarmAndReset();
        }
    }, 60000); // Auto-stop after 1 minute
}

function resetToInitial() {
    remainingSeconds = initialSeconds;
    updateDisplay();
    updateRingSetting();
    
    btnStart.textContent = 'スタート';
    if (btnStart.classList.contains('btn-secondary')) {
        btnStart.classList.replace('btn-secondary', 'btn-primary');
    }
    btnStart.disabled = false;
    
    btnMinute.disabled = false;
    btnSecond.disabled = false;
    btnReset.disabled = false;
    
    releaseWakeLock();
}

function stopAlarmAndReset() {
    if (alarmStopLock) return;
    alarmStopLock = true;
    
    stopAlarmSound();
    
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

// --- Event Listeners ---

// 1. Long Press Logic (【修正】Pointer Eventsに統一してPC・スマホ両対応)
let pressTimer = null;
let pressInterval = null;

function handleTimeSetStart(type) {
    if (isRunning || isAlarming) return;
    initAudio();
    incrementTime(type);
    
    pressTimer = setTimeout(() => {
        pressInterval = setInterval(() => {
            incrementTime(type);
        }, 120);
    }, 400);
}

function handleTimeSetEnd() {
    clearTimeout(pressTimer);
    clearInterval(pressInterval);
}

function bindLongPress(button, type) {
    // pointerdown はマウスのクリックもスマホのタッチも両方同時にカバーします
    button.addEventListener('pointerdown', (e) => {
        // マウス操作の時は左クリック（ボタン0）だけを許可
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        handleTimeSetStart(type);
    });
}

bindLongPress(btnMinute, 'min');
bindLongPress(btnSecond, 'sec');

// 解除処理も共通化
window.addEventListener('pointerup', handleTimeSetEnd);
window.addEventListener('pointercancel', handleTimeSetEnd);

// 2. Button Clicks (標準のクリックイベントでPC・スマホ共に確実に発火)
btnStart.addEventListener('click', () => {
    if (isAlarming) return;
    toggleTimer();
});

btnReset.addEventListener('click', () => {
    if (isAlarming) return;
    resetTimer();
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
window.addEventListener('pointerdown', captureInteraction, true); // タッチでのアラーム停止を確実に

// 4. Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    if (isAlarming) return;
    
    if (e.code === 'Space') {
        e.preventDefault();
        if (!btnStart.disabled) {
            btnStart.click();
        }
    } else if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
        if (!btnReset.disabled) {
            btnReset.click();
        }
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