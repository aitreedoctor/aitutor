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
    const bgmChecked = document.getElementById('check-meditation-bgm')?.checked;
    if (!bgmChecked) return;
    
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        bgmOsc1 = audioCtx.createOscillator();
        bgmOsc2 = audioCtx.createOscillator();
        bgmGain = audioCtx.createGain();
        
        bgmOsc1.type = 'sine';
        bgmOsc1.frequency.setValueAtTime(432, audioCtx.currentTime); // Healing Solfeggio frequency
        
        bgmOsc2.type = 'sine';
        bgmOsc2.frequency.setValueAtTime(435, audioCtx.currentTime); // 3Hz difference for alpha/theta brainwave beat
        
        const lowpass = audioCtx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(200, audioCtx.currentTime); // Filter high buzzes
        
        bgmGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        bgmGain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 3.0); // Smooth fade-in
        
        bgmOsc1.connect(lowpass);
        bgmOsc2.connect(lowpass);
        lowpass.connect(bgmGain);
        connectToDestination(bgmGain);
        
        bgmOsc1.start();
        bgmOsc2.start();
    } catch (e) {
        console.error("Failed to start synth BGM:", e);
    }
}

export function stopBgm() {
    if (bgmGain && audioCtx) {
        try {
            const currentGain = bgmGain.gain.value;
            bgmGain.gain.cancelScheduledValues(audioCtx.currentTime);
            bgmGain.gain.setValueAtTime(currentGain, audioCtx.currentTime);
            bgmGain.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + 1.2);
            
            const osc1 = bgmOsc1;
            const osc2 = bgmOsc2;
            setTimeout(() => {
                try {
                    osc1.stop();
                    osc2.stop();
                } catch(err){}
            }, 1300);
        } catch(err){}
    }
    bgmOsc1 = null;
    bgmOsc2 = null;
    bgmGain = null;
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
        btn.innerHTML = "<i class='xi-lighting'></i> 향초 피우기";
        btn.classList.replace('btn-secondary', 'btn-primary');
    }
    
    checkChatAvailability();
}

export function checkChatAvailability() {
    const queryCount = parseInt(localStorage.getItem('zeni_chat_count') || '0');
    const chatInput = document.getElementById('chat-input');
    const btnSendChat = document.getElementById('btn-send-chat');
    const paywall = document.getElementById('chat-lantern-paywall');
    
    const isIncenseBurning = (incenseTimeout !== null);
    
    if (!isIncenseBurning) {
        if (chatInput) {
            chatInput.disabled = true;
            chatInput.placeholder = "우측 '집중력 향상 카세트'를 재생하여 선배와 주파수를 먼저 연결해 주십시오...";
        }
        if (btnSendChat) btnSendChat.disabled = true;
        if (paywall) paywall.style.display = 'none';
    } else if (queryCount >= 5) {
        if (chatInput) {
            chatInput.disabled = true;
            chatInput.placeholder = "공부 기류가 쇠하여 등불을 켜야 대화가 가능합니다...";
        }
        if (btnSendChat) btnSendChat.disabled = true;
        if (paywall) paywall.style.display = 'block';
    } else {
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = "합격 선배와 1:1 상담을 시작하세요...";
        }
        if (btnSendChat) btnSendChat.disabled = false;
        if (paywall) paywall.style.display = 'none';
    }
}

export async function handleChatSubmit() {
    const chatInput = document.getElementById('chat-input');
    const msgText = chatInput.value.trim();
    if (!msgText) return;
    
    chatInput.value = '';
    
    let queryCount = parseInt(localStorage.getItem('zeni_chat_count') || '0');
    queryCount++;
    localStorage.setItem('zeni_chat_count', queryCount.toString());
    
    const messagesDiv = document.getElementById('chat-messages');
    
    const systemMsg = messagesDiv.querySelector('.system-msg');
    if (systemMsg) {
        systemMsg.remove();
    }
    
    const userMsg = document.createElement('div');
    userMsg.className = 'msg-bubble student-msg';
    userMsg.innerText = msgText;
    messagesDiv.appendChild(userMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    if (queryCount > 5) {
        checkChatAvailability();
        return;
    }
    
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg-bubble tutor-msg';
    loadingMsg.id = 'chat-loading-bubble';
    loadingMsg.innerHTML = `<i class="xi-spinner-5 xi-spin"></i> 수호신 AI Tutor가 영혼의 기류를 정돈하고 있습니다...`;
    messagesDiv.appendChild(loadingMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    try {
        const response = await fetch('/api/tutor/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message: msgText })
        });
        const data = await response.json();
        
        const loader = document.getElementById('chat-loading-bubble');
        if (loader) loader.remove();
        
        const tutorMsg = document.createElement('div');
        tutorMsg.className = 'msg-bubble tutor-msg';
        tutorMsg.innerHTML = safeMarkedParse(data.tutor_response);
        messagesDiv.appendChild(tutorMsg);
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        checkChatAvailability();
        
    } catch (e) {
        const loader = document.getElementById('chat-loading-bubble');
        if (loader) loader.remove();
        
        const errMsg = document.createElement('div');
        errMsg.className = 'msg-bubble tutor-msg';
        errMsg.innerHTML = `⚠️ 영혼의 연결 통로가 희미해졌습니다. (${e.message})`;
        messagesDiv.appendChild(errMsg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

export function triggerLanternPayment() {
    const btn = document.querySelector('.voluntary-lantern-btn');
    if (!btn) return;
    btn.disabled = true;
    btn.innerText = "등불 공명 중...";
    
    setTimeout(() => {
        localStorage.setItem('zeni_chat_count', '0');
        checkChatAvailability();
        
        const glow = document.getElementById('payment-glow-effect');
        if (glow) {
            glow.style.opacity = '1';
            setTimeout(() => {
                glow.style.opacity = '0';
            }, 1500);
        }
        
        const messagesDiv = document.getElementById('chat-messages');
        const thankYouMsg = document.createElement('div');
        thankYouMsg.className = 'msg-bubble tutor-msg';
        thankYouMsg.innerHTML = safeMarkedParse(`### ⚡ 등불의 공명 (Lantern Awakening)
네가 밝혀준 등불의 온기가 공부 책상 위로 따뜻하게 스며드는구나. 
이 에너지를 느끼며 밤새 네 뒤를 지키마. 
이제 다시 학습 기세를 다듬고 앞으로 나아가자. 어떤 개념이 헷갈리는지 선배에게 말해보거라.`);
        if (messagesDiv) {
            messagesDiv.appendChild(thankYouMsg);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        alert("등불 활성화 완료: 선배의 책상에 등불을 켰습니다. 5회의 추가 질문 기류가 충전되었습니다.");
        if (btn) {
            btn.disabled = false;
            btn.innerText = "선배의 책상에 등불 켜기 (무료 충전)";
        }
    }, 1500);
}

export function toggleMiniMeditation() {
    const circle = document.getElementById('mini-meditation-circle');
    const text = document.getElementById('mini-meditation-text');
    const instruction = document.getElementById('mini-meditation-instruction');
    const btn = document.getElementById('btn-mini-meditation-toggle');
    
    if (!circle || !text || !instruction || !btn) return;
    
    const isRunning = miniMeditationInterval !== null;
    
    if (!isRunning) {
        miniMeditationState = 0;
        btn.innerHTML = "<i class='xi-pause'></i> 호흡 중단";
        btn.classList.replace('btn-secondary', 'btn-danger');
        
        function runCycle() {
            circle.classList.remove('inhale', 'hold', 'exhale');
            
            if (miniMeditationState === 0) {
                circle.classList.add('inhale');
                text.innerText = "들숨";
                instruction.innerText = "숨을 천천히 들이쉬며 맑은 기운을 채우십시오. (4초)";
                miniMeditationState = 1;
            } else if (miniMeditationState === 1) {
                circle.classList.add('hold');
                text.innerText = "멈춤";
                instruction.innerText = "숨을 멈추고 영혼의 흔적에 집중하십시오. (4초)";
                miniMeditationState = 2;
            } else {
                circle.classList.add('exhale');
                text.innerText = "날숨";
                instruction.innerText = "가만히 숨을 내쉬며 어지러운 잡념을 비워내십시오. (4초)";
                miniMeditationState = 0;
            }
        }
        
        runCycle();
        miniMeditationInterval = setInterval(runCycle, 4000);
    } else {
        clearInterval(miniMeditationInterval);
        miniMeditationInterval = null;
        
        circle.classList.remove('inhale', 'hold', 'exhale');
        text.innerText = "준비";
        instruction.innerText = "주파수 조율을 위한 4초 호흡 주기 훈련을 수행합니다.";
        btn.innerHTML = "<i class='xi-play'></i> 호흡 시작";
        btn.classList.replace('btn-danger', 'btn-secondary');
    }
}

export function toggleMainMeditation() {
    const circle = document.getElementById('main-meditation-circle');
    const text = document.getElementById('main-meditation-text');
    const instruction = document.getElementById('main-meditation-instruction');
    const btn = document.getElementById('btn-main-meditation-toggle');
    
    if (!circle || !text || !instruction || !btn) return;
    
    const isRunning = mainMeditationInterval !== null;
    
    if (!isRunning) {
        mainMeditationState = 0;
        isMeditationSessionActive = true;
        btn.innerHTML = "<i class='xi-pause'></i> 호흡 중단";
        btn.className = "btn btn-danger";
        
        startBgm();
        
        function runCycle() {
            circle.style.transform = '';
            circle.style.borderColor = 'rgba(6, 182, 212, 0.85)';
            circle.style.background = 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, rgba(6, 182, 212, 0.05) 70%)';
            circle.style.color = '#06b6d4';
            
            if (mainMeditationState === 0) {
                circle.style.transform = 'scale(1.58)';
                text.innerText = "숨 들이쉬기";
                instruction.innerText = "아날로그 숲의 맑은 산소를 가슴속 깊이 채워 넣습니다.";
                speakGuidance("숨을 천천히 들이마십니다.");
                mainMeditationState = 1;
            } else if (mainMeditationState === 1) {
                circle.style.borderColor = 'rgba(212, 175, 55, 0.85)';
                circle.style.background = 'radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, rgba(212, 175, 55, 0.05) 70%)';
                circle.style.color = '#d4af37';
                text.innerText = "숨 멈추기";
                instruction.innerText = "단전 아래 모인 의식의 덩어리를 고요히 응시합니다.";
                speakGuidance("가만히 숨을 멈춥니다.");
                mainMeditationState = 2;
            } else {
                circle.style.transform = 'scale(0.85)';
                circle.style.borderColor = 'rgba(239, 68, 68, 0.85)';
                circle.style.background = 'radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.05) 70%)';
                circle.style.color = '#ef4444';
                text.innerText = "숨 내쉬기";
                instruction.innerText = "오개념과 성적에 대한 집착을 숲의 기류로 흘려보냅니다.";
                speakGuidance("입으로 잡념을 길게 내뿜습니다.");
                mainMeditationState = 0;
            }
        }
        
        runCycle();
        mainMeditationInterval = setInterval(runCycle, 6000);
    } else {
        clearInterval(mainMeditationInterval);
        mainMeditationInterval = null;
        isMeditationSessionActive = false;
        
        stopBgm();
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        
        circle.style.transform = '';
        circle.style.borderColor = '';
        circle.style.background = '';
        circle.style.color = '';
        text.innerText = "준비";
        instruction.innerText = "수험 잡념 정화를 위해 선배의 음성 안내와 함께 6초 정식 단전호흡을 시작합니다.";
        btn.innerHTML = "<i class='xi-play'></i> 호흡 시작";
        btn.className = "btn btn-primary";
    }
}
