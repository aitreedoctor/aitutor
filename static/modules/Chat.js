// Chat, Cassette Audio & Meditation Manager

import { state } from './Config.js';
import { safeMarkedParse } from './Utils.js';

let incenseTimeout = null;
let miniMeditationInterval = null;
let miniMeditationState = 0; // 0: inhale, 1: hold, 2: exhale

let mainMeditationInterval = null;
let mainMeditationState = 0;

let audioCtx = null;
let bgmOsc1 = null;
let bgmOsc2 = null;
let bgmGain = null;
let noiseSource = null;
let noiseGain = null;

let masterGain = null;
let audioDestination = null;
let playingPremiumAudio = null;
let isMeditationSessionActive = false;
let ignoreSpeechEvents = false;

let analyserNode = null;
let vuAnimationId = null;

function startVuMeterLoop() {
    if (vuAnimationId) {
        cancelAnimationFrame(vuAnimationId);
    }
    
    if (!analyserNode) return;
    
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const needleLeft = document.getElementById('vu-left-needle');
    const needleRight = document.getElementById('vu-right-needle');
    
    function draw() {
        vuAnimationId = requestAnimationFrame(draw);
        
        if (!analyserNode) return;
        
        analyserNode.getByteTimeDomainData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = (dataArray[i] - 128) / 128;
            sum += v * v;
        }
        const rms = Math.sqrt(sum / bufferLength);
        
        const vol = Math.min(rms * 3.5, 1.0);
        
        const isPlaying = document.getElementById('cassette-reel-left')?.classList.contains('playing');
        
        let targetAngleL = -40;
        let targetAngleR = -40;
        
        if (isPlaying) {
            const baseVolume = vol > 0.015 ? vol : 0.06 + Math.random() * 0.03;
            
            targetAngleL = -40 + baseVolume * 80;
            targetAngleR = -40 + baseVolume * 80;
            
            targetAngleL += (Math.random() - 0.5) * 5;
            targetAngleR += (Math.random() - 0.5) * 5;
        } else {
            targetAngleL = -40;
            targetAngleR = -40;
        }
        
        targetAngleL = Math.max(-40, Math.min(40, targetAngleL));
        targetAngleR = Math.max(-40, Math.min(40, targetAngleR));
        
        if (needleLeft) {
            needleLeft.style.transform = `rotate(${targetAngleL}deg)`;
        }
        if (needleRight) {
            needleRight.style.transform = `rotate(${targetAngleR}deg)`;
        }
    }
    
    draw();
}

function connectToDestination(node) {
    if (!audioCtx) return;
    if (!masterGain) {
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
        
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 256;
        
        masterGain.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);
        
        startVuMeterLoop();
    }
    node.connect(masterGain);
    if (audioDestination) {
        node.connect(audioDestination);
    }
}

export function startBgm() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        // Create White Noise Buffer for Real Tape Hiss (ASMR) - Pure Hiss, No Humming
        const bufferSize = audioCtx.sampleRate * 2;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;
        
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1500, audioCtx.currentTime);
        noiseFilter.Q.setValueAtTime(0.5, audioCtx.currentTime);
        
        noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        noiseGain.gain.linearRampToValueAtTime(0.015, audioCtx.currentTime + 3.0);
        
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        connectToDestination(noiseGain);
        
        noiseSource.start();
    } catch (e) {
        console.error("Failed to start synth BGM:", e);
    }
}

export function stopBgm() {
    if (noiseGain && noiseSource && audioCtx) {
        try {
            const currentNoiseGain = noiseGain.gain.value;
            noiseGain.gain.cancelScheduledValues(audioCtx.currentTime);
            noiseGain.gain.setValueAtTime(currentNoiseGain, audioCtx.currentTime);
            noiseGain.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + 1.2);
            
            const nSource = noiseSource;
            setTimeout(() => {
                try {
                    nSource.stop();
                } catch(err){}
            }, 1300);
        } catch(err){}
    }
    bgmOsc1 = null;
    bgmOsc2 = null;
    bgmGain = null;
    noiseSource = null;
    noiseGain = null;
}

export async function speakGuidance(phrase) {
    const voiceChecked = document.getElementById('check-meditation-voice')?.checked;
    if (!voiceChecked) return;
    
    ignoreSpeechEvents = true;
    if (playingPremiumAudio) {
        try {
            playingPremiumAudio.pause();
        } catch(err){}
        playingPremiumAudio = null;
    }
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    ignoreSpeechEvents = false;
    
    // 1. Try Premium ElevenLabs voice cloning dynamic synthesis if configured on backend
    try {
        const res = await fetch("/api/meditation/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: phrase })
        });
        const data = await res.json();
        if (data.audio_url) {
            const audio = new Audio(data.audio_url);
            playingPremiumAudio = audio;
            
            if (audioCtx) {
                const source = audioCtx.createMediaElementSource(audio);
                connectToDestination(source);
            }
            audio.onended = () => {
                if (playingPremiumAudio === audio) playingPremiumAudio = null;
                if (ignoreSpeechEvents) return;
                if (isMeditationSessionActive) {
                    window.dispatchEvent(new CustomEvent('speech_ended'));
                }
            };
            audio.onerror = () => {
                if (playingPremiumAudio === audio) playingPremiumAudio = null;
                if (ignoreSpeechEvents) return;
                if (isMeditationSessionActive) {
                    window.dispatchEvent(new CustomEvent('speech_ended'));
                }
            };
            audio.play();
            return;
        }
    } catch(err) {
        console.error("ElevenLabs premium TTS check failed, falling back to Web Speech:", err);
    }
    
    // 2. Fallback to offline Web Speech API (Default Browser Voice)
    if (window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(phrase);
        utterance.lang = 'ko-KR';
        
        const voices = window.speechSynthesis.getVoices();
        const koVoices = voices.filter(v => v.lang.startsWith('ko'));
        if (koVoices.length > 0) {
            const heami = koVoices.find(v => v.name.includes('Heami'));
            if (heami) {
                utterance.voice = heami;
            } else {
                utterance.voice = koVoices[0];
            }
        }
        
        utterance.rate = 0.92; // Calm, slow pace
        utterance.pitch = 1.0;  // Natural tone
        
        utterance.onend = () => {
            if (ignoreSpeechEvents) return;
            if (isMeditationSessionActive) {
                window.dispatchEvent(new CustomEvent('speech_ended'));
            }
        };
        utterance.onerror = (event) => {
            if (ignoreSpeechEvents || event.error === 'interrupted') return;
            if (isMeditationSessionActive) {
                window.dispatchEvent(new CustomEvent('speech_ended'));
            }
        };
        
        window.speechSynthesis.speak(utterance);
    }
}

// Pre-load voices
if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

export function toggleIncense() {
    const reelLeft = document.getElementById('cassette-reel-left');
    const reelRight = document.getElementById('cassette-reel-right');
    const status = document.getElementById('incense-status-text');
    const btn = document.getElementById('btn-incense-toggle');
    const chatMsgs = document.getElementById('chat-messages');
    
    if (!reelLeft || !reelRight || !status || !btn) return;
    
    const isPlaying = reelLeft.classList.contains('playing');
    
    if (!isPlaying) {
        // Start playing tape
        startBgm();
        reelLeft.classList.add('playing');
        reelRight.classList.add('playing');
        status.innerText = "재생 중 (3분)";
        status.style.color = "var(--primary)";
        btn.innerHTML = "<i class='xi-stop'></i> 테이프 정지";
        btn.classList.replace('btn-primary', 'btn-secondary');
        
        if (chatMsgs) {
            chatMsgs.classList.add('incense-active-glow');
        }
        
        // Show comforting system message bubble
        const isAlreadyWelcome = document.querySelector('.incense-system-msg');
        if (!isAlreadyWelcome && chatMsgs) {
            const persona = (state.studentProfile && state.studentProfile.persona_type) ? state.studentProfile.persona_type : '약초꾼';
            let systemMsgText = "카세트가 돌아가니 어지러운 기류가 고요한 독서실의 백색소음으로 가라앉는구나. 차분하게 나와의 대화에 집중해 보아라.";
            if (persona === '거상') {
                systemMsgText = "백색소음 테이프가 마음의 장부를 맑게 씻어내 주는구먼. 차분히 호흡을 정돈하고 장사에 집중하듯 정갈한 자세로 나와 대화하세.";
            } else if (persona === '호위무관') {
                systemMsgText = "93년 공부방의 백색소음 테이프가 돌아가니 수호 영역 내에 맑은 집중이 도는구나. 무거운 짐을 내려놓고 침착하게 대화에 임하거라. 내 언제나 지킨다.";
            } else if (persona === '문인') {
                systemMsgText = "카세트테이프의 클래식 선율이 서재의 고요함을 자아내는구나. 붓을 들기 전 마음의 원고지를 정리하듯, 차분하게 나와 글귀를 나누자꾸나.";
            }
            
            const msgBubble = document.createElement('div');
            msgBubble.className = 'msg-bubble system-msg incense-system-msg';
            msgBubble.style.textAlign = 'center';
            msgBubble.style.color = 'var(--primary)';
            msgBubble.style.fontFamily = "'Nanum Myeongjo', serif";
            msgBubble.style.fontStyle = 'normal';
            msgBubble.style.background = 'rgba(212, 175, 55, 0.05)';
            msgBubble.style.border = '1px dashed rgba(212, 175, 55, 0.3)';
            msgBubble.style.borderRadius = '12px';
            msgBubble.style.margin = '12px auto';
            msgBubble.style.padding = '12px 16px';
            msgBubble.style.fontSize = '12.5px';
            msgBubble.style.lineHeight = '1.6';
            msgBubble.style.maxWidth = '90%';
            msgBubble.innerText = systemMsgText;
            chatMsgs.appendChild(msgBubble);
            chatMsgs.scrollTop = chatMsgs.scrollHeight;
        }
        
        incenseTimeout = setTimeout(() => {
            extinguishIncense(true);
        }, 180000); // 3 minutes
        
        checkChatAvailability();
    } else {
        extinguishIncense(false);
    }
}

export function extinguishIncense(isCompleted = false) {
    const reelLeft = document.getElementById('cassette-reel-left');
    const reelRight = document.getElementById('cassette-reel-right');
    const status = document.getElementById('incense-status-text');
    const btn = document.getElementById('btn-incense-toggle');
    const chatMsgs = document.getElementById('chat-messages');
    
    if (incenseTimeout) {
        clearTimeout(incenseTimeout);
        incenseTimeout = null;
    }
    
    stopBgm();
    
    if (reelLeft) reelLeft.classList.remove('playing');
    if (reelRight) reelRight.classList.remove('playing');
    if (chatMsgs) chatMsgs.classList.remove('incense-active-glow');
    
    if (status) {
        if (isCompleted) {
            status.innerText = "테이프 끝남";
            status.style.color = "var(--text-secondary)";
        } else {
            status.innerText = "정지됨";
            status.style.color = "";
        }
    }
    
    if (btn) {
        btn.innerHTML = "<i class='xi-play'></i> 테이프 재생";
        btn.classList.replace('btn-secondary', 'btn-primary');
    }
    
    checkChatAvailability();
}

export function checkChatAvailability() {
    // Stubbed - chat feature removed
}

export async function handleChatSubmit() {
    // Stubbed - chat feature removed
}

export function triggerLanternPayment() {
    // Stubbed - chat feature removed
}

export function toggleMiniMeditation() {
    // Stubbed - meditation feature removed
}

export function toggleMainMeditation() {
    // Stubbed - meditation feature removed
}
