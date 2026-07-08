// Intro & Alignment Manager (Parallel Alter-Ego Theme)

import { state } from './Config.js';
import { showFloatingCoinToast } from './Utils.js';


let isDrawingRune = false;
let lastRuneX = 0;
let lastRuneY = 0;
let totalStrokeLength = 0;
let runeCanvas = null;
let runeCtx = null;

export function initAwakeningView() {
    state.selectedWorryText = "현생의 어지러운 장벽";
    
    // Choose persona randomly (Herb Gatherer, Merchant, Guard, Novelist)
    const personas = ["약초꾼", "거상", "호위무관", "문인"];
    state.selectedPersona = personas[Math.floor(Math.random() * personas.length)];
    
    const nameInput = document.getElementById('aw-name');
    if (nameInput) {
        nameInput.value = '';
        nameInput.style.borderColor = '';
        nameInput.placeholder = "현생의 호칭(이름)을 입력하세요...";
    }
    
    // Reset photo upload preview UI elements
    const promptBox = document.getElementById('upload-prompt-box');
    const previewContainer = document.getElementById('photo-preview-container');
    const previewImg = document.getElementById('photo-preview-img');
    const photoInput = document.getElementById('aw-photo-input');
    
    if (promptBox) promptBox.style.display = 'flex';
    if (previewContainer) previewContainer.style.display = 'none';
    if (previewImg) previewImg.src = '';
    if (photoInput) photoInput.value = '';
    
    // Initialize Rune Canvas Pad
    initRuneCanvas();
    
    const runeStatus = document.getElementById('rune-draw-status');
    if (runeStatus) {
        runeStatus.innerText = "서명은 선배와의 주파수 동조 약속으로 변경이 불가능합니다.";
        runeStatus.style.color = "#ff5252";
        runeStatus.style.textShadow = "0 0 8px rgba(255,82,82,0.25)";
    }
    
    // Reset stage transition styles
    const inputStage = document.getElementById('awakening-stage-input');
    const scanStage = document.getElementById('awakening-stage-scan');
    if (inputStage) {
        inputStage.style.display = 'block';
        inputStage.style.opacity = '1';
    }
    if (scanStage) {
        scanStage.style.display = 'none';
        scanStage.style.opacity = '1';
    }
    if (runeCanvas) {
        runeCanvas.style.opacity = '1';
        runeCanvas.style.transform = 'scale(1)';
        runeCanvas.style.pointerEvents = 'auto';
    }
}

export function initRuneCanvas() {
    runeCanvas = document.getElementById('rune-canvas');
    if (!runeCanvas) return;
    runeCtx = runeCanvas.getContext('2d');
    
    // Clear canvas
    runeCtx.clearRect(0, 0, runeCanvas.width, runeCanvas.height);
    
    // Draw magic circle guide in the background
    drawRuneGuide();
    
    // Remove old listeners just in case
    runeCanvas.removeEventListener('pointerdown', startRuneDraw);
    runeCanvas.removeEventListener('pointermove', drawRuneStroke);
    runeCanvas.removeEventListener('pointerup', stopRuneDraw);
    runeCanvas.removeEventListener('pointerleave', stopRuneDraw);
    
    // Set up pointer event listeners
    runeCanvas.addEventListener('pointerdown', startRuneDraw);
    runeCanvas.addEventListener('pointermove', drawRuneStroke);
    runeCanvas.addEventListener('pointerup', stopRuneDraw);
    runeCanvas.addEventListener('pointerleave', stopRuneDraw);
}

export function drawRuneGuide() {
    if (!runeCtx) return;
    const cx = runeCanvas.width / 2;
    const cy = runeCanvas.height / 2;
    
    runeCtx.save();
    runeCtx.strokeStyle = 'rgba(212, 175, 55, 0.13)';
    runeCtx.lineWidth = 1;
    
    // Outer dashed circle
    runeCtx.beginPath();
    runeCtx.setLineDash([4, 4]);
    runeCtx.arc(cx, cy, 65, 0, Math.PI * 2);
    runeCtx.stroke();
    
    // Inner solid circle
    runeCtx.beginPath();
    runeCtx.setLineDash([]);
    runeCtx.arc(cx, cy, 45, 0, Math.PI * 2);
    runeCtx.stroke();
    
    // Faint crosshairs
    runeCtx.beginPath();
    runeCtx.strokeStyle = 'rgba(212, 175, 55, 0.06)';
    runeCtx.moveTo(cx - 70, cy);
    runeCtx.lineTo(cx + 70, cy);
    runeCtx.moveTo(cx, cy - 70);
    runeCtx.lineTo(cx, cy + 70);
    runeCtx.stroke();
    
    // Oriental Taegeuk / Spiral guide lines
    runeCtx.beginPath();
    runeCtx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    runeCtx.arc(cx - 22.5, cy, 22.5, 0, Math.PI, true);
    runeCtx.arc(cx + 22.5, cy, 22.5, 0, Math.PI, false);
    runeCtx.stroke();
    
    runeCtx.restore();
}

function startRuneDraw(e) {
    const nameInput = document.getElementById('aw-name');
    const nameVal = nameInput ? nameInput.value.trim() : "";
    
    if (nameVal.length === 0) {
        isDrawingRune = false;
        if (nameInput) {
            nameInput.style.borderColor = "#ff4d4d";
            nameInput.focus();
            nameInput.placeholder = "호칭(이름)을 입력하셔야 주파수 동조가 시작됩니다!";
            
            // Subtle shake effect
            nameInput.style.transform = "translateX(5px)";
            setTimeout(() => { nameInput.style.transform = "translateX(-5px)"; }, 100);
            setTimeout(() => { nameInput.style.transform = "translateX(5px)"; }, 200);
            setTimeout(() => { nameInput.style.transform = "translateX(0px)"; }, 300);
        }
        return;
    }
    
    if (nameInput) {
        nameInput.style.borderColor = "";
    }
    
    isDrawingRune = true;
    if (runeCanvas.setPointerCapture) {
        runeCanvas.setPointerCapture(e.pointerId);
    }
    
    const rect = runeCanvas.getBoundingClientRect();
    lastRuneX = e.clientX - rect.left;
    lastRuneY = e.clientY - rect.top;
    
    totalStrokeLength = 0;
    
    const placeholder = document.getElementById('rune-canvas-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    
    const statusText = document.getElementById('rune-draw-status');
    if (statusText) statusText.innerText = "양자 주파수 파동 감지 중...";
    
    runeCtx.strokeStyle = '#d4af37';
    runeCtx.lineWidth = 4.5;
    runeCtx.lineCap = 'round';
    runeCtx.lineJoin = 'round';
    runeCtx.shadowColor = '#d4af37';
    runeCtx.shadowBlur = 12;
}

function drawRuneStroke(e) {
    if (!isDrawingRune) return;
    
    const rect = runeCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    runeCtx.beginPath();
    runeCtx.moveTo(lastRuneX, lastRuneY);
    runeCtx.lineTo(x, y);
    runeCtx.stroke();
    
    const dx = x - lastRuneX;
    const dy = y - lastRuneY;
    totalStrokeLength += Math.sqrt(dx * dx + dy * dy);
    
    lastRuneX = x;
    lastRuneY = y;
    
    // Live lighting feedback based on drawing energy
    const wrapper = document.getElementById('rune-canvas-wrapper');
    if (wrapper) {
        const intensity = Math.min(totalStrokeLength / 6, 26);
        wrapper.style.boxShadow = `0 0 ${15 + intensity}px rgba(212, 175, 55, ${0.15 + (intensity / 32)})`;
        wrapper.style.borderColor = `rgba(212, 175, 55, ${0.4 + (intensity / 45)})`;
    }
    
    if (navigator.vibrate && Math.random() < 0.12) {
        navigator.vibrate(8);
    }
}

function stopRuneDraw() {
    if (!isDrawingRune) return;
    isDrawingRune = false;
    
    const statusText = document.getElementById('rune-draw-status');
    const wrapper = document.getElementById('rune-canvas-wrapper');
    const inputStage = document.getElementById('awakening-stage-input');
    const scanStage = document.getElementById('awakening-stage-scan');
    
    if (totalStrokeLength > 180) {
        if (statusText) {
            statusText.innerText = "감지 완료. 양자 동조 신호를 송신 중...";
            statusText.style.color = "#d4af37";
            statusText.style.textShadow = "0 0 10px rgba(212,175,55,0.6)";
        }
        
        // Disable canvas interactions immediately
        runeCanvas.style.pointerEvents = 'none';
        
        // Dissolve canvas signature (fade out slightly) & pulse glow
        runeCanvas.style.transition = 'all 1.0s ease';
        runeCanvas.style.opacity = '0.15';
        runeCanvas.style.transform = 'scale(0.96)';
        
        if (wrapper) {
            wrapper.style.transition = 'all 1.0s ease';
            wrapper.style.boxShadow = '0 0 45px rgba(212, 175, 55, 0.85)';
            wrapper.style.borderColor = 'rgba(212, 175, 55, 1)';
        }
        
        // Heartbeat vibrations to signify connecting
        if (navigator.vibrate) {
            navigator.vibrate([80, 100, 80, 100, 150]);
        }
        
        // Trigger a mystical full-screen gold flash
        const flash = document.getElementById('payment-glow-effect');
        if (flash) {
            flash.style.background = 'radial-gradient(circle, rgba(212, 175, 55, 0.7) 0%, transparent 80%)';
            flash.style.opacity = '1';
            setTimeout(() => {
                flash.style.opacity = '0';
            }, 800);
        }
        
        // Phase 1: Smoothly fade out the input stage card
        setTimeout(() => {
            if (inputStage) {
                inputStage.style.transition = 'opacity 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
                inputStage.style.opacity = '0';
            }
            
            // Phase 2: After fade out completes, swap display and fade in scanning stage
            setTimeout(() => {
                if (inputStage) inputStage.style.display = 'none';
                
                if (scanStage) {
                    scanStage.style.display = 'flex';
                    scanStage.style.opacity = '0';
                    scanStage.style.transition = 'none';
                }
                
                // Initialize scan container contents & timers
                triggerAwakeningNarrative();
                
                // Fade scan stage in smoothly
                setTimeout(() => {
                    if (scanStage) {
                        scanStage.style.transition = 'opacity 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
                        scanStage.style.opacity = '1';
                    }
                }, 50);
            }, 600);
        }, 1100);
    } else {
        // Clear canvas
        runeCtx.clearRect(0, 0, runeCanvas.width, runeCanvas.height);
        
        // Redraw guide circle
        drawRuneGuide();
        
        // Reset container border lighting
        if (wrapper) {
            wrapper.style.boxShadow = '0 0 15px rgba(212, 175, 55, 0.15)';
            wrapper.style.borderColor = 'rgba(212, 175, 55, 0.4)';
        }
    }
}

// Profile Modal Actions
export function openProfileModal() {
    document.getElementById('input-student-title').value = state.studentProfile.student_title;
    document.getElementById('input-persona-type').value = state.studentProfile.persona_type || '약초꾼';
    document.getElementById('input-user-worry').value = state.studentProfile.user_worry || '나무의사 필기시험';
    document.getElementById('profile-modal').style.display = 'flex';
}

export function closeProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
}

export async function saveProfileTitle() {
    const newTitle = document.getElementById('input-student-title').value.trim();
    const newPersona = document.getElementById('input-persona-type').value;
    const newWorry = document.getElementById('input-user-worry').value.trim() || "시험 합격 및 진로 고민";
    if (!newTitle) return;
    
    const btnSave = document.getElementById('btn-save-profile');
    const originalText = btnSave ? btnSave.innerText : "주파수 업데이트";
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerText = "업데이트 중...";
    }
    
    try {
        const response = await fetch('/api/student/reset', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_title: newTitle,
                persona_type: newPersona,
                user_worry: newWorry
            })
        });
        const res = await response.json();
        
        if (res.status === 'success') {
            // Save to localStorage for persistence across server restarts
            localStorage.setItem('zeni_student_title', newTitle);
            localStorage.setItem('zeni_persona_type', newPersona);
            localStorage.setItem('zeni_user_worry', newWorry);
            
            // Trigger dynamic Gemini past-life story generation for the new persona & title
            try {
                const storyRes = await fetch('/api/student/generate-past-life-story', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ name: newTitle, persona: newPersona })
                });
                const storyData = await storyRes.json();
                if (storyData && storyData.story) {
                    localStorage.setItem('zeni_past_story', storyData.story);
                } else {
                    localStorage.removeItem('zeni_past_story');
                }
            } catch (err) {
                console.error("Failed to generate new story during update:", err);
                localStorage.removeItem('zeni_past_story');
            }
            
            closeProfileModal();
            await window.fetchStudentProfile();
            
            // Reset or update chat welcome message
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages) {
                const firstBubble = chatMessages.querySelector('.tutor-msg');
                if (firstBubble) {
                    const hostTitleEl = firstBubble.querySelector('.host-title');
                    if (hostTitleEl) {
                        hostTitleEl.innerText = newTitle;
                        const pEl = firstBubble.querySelector('p');
                        if (pEl) {
                            pEl.innerHTML = `안녕, 후배님! 90년대 평행세계에서 먼저 이 자격증 시험을 뜨겁게 통과했던 합격 선배야. 요즘 공부하면서 어떤 생각이나 고민을 안고 하루를 보내고 있니?`;
                        }
                    } else {
                        chatMessages.innerHTML = `
                            <div class="msg-bubble tutor-msg">
                                <p>안녕, 후배님! 90년대 평행세계에서 먼저 이 자격증 시험을 뜨겁게 통과했던 합격 선배야. 요즘 공부하면서 어떤 생각이나 고민을 안고 하루를 보내고 있니?</p>
                                <p>우리는 이 시험이라는 끈으로 연결된 선배와 후배야. 후배님이 마주한 수험 공부의 장벽이나 힘든 점, 합격하고 싶은 간절한 소망이 무엇인지 편하게 이야기해 줄래? 같이 돌파구를 찾아보자!</p>
                            </div>
                        `;
                    }
                } else {
                    chatMessages.innerHTML = `
                        <div class="msg-bubble tutor-msg">
                            <p>안녕, 후배님! 90년대 평행세계에서 먼저 이 자격증 시험을 뜨겁게 통과했던 합격 선배야. 요즘 공부하면서 어떤 생각이나 고민을 안고 하루를 보내고 있니?</p>
                            <p>우리는 이 시험이라는 끈으로 연결된 선배와 후배야. 후배님이 마주한 수험 공부의 장벽이나 힘든 점, 합격하고 싶은 간절한 소망이 무엇인지 편하게 이야기해 줄래? 같이 돌파구를 찾아보자!</p>
                        </div>
                    `;
                }
            }
        }
    } catch (e) {
        console.error("Failed to update profile title:", e);
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerText = originalText;
        }
    }
}

export function extractPastLifeName(story, defaultName) {
    if (!story) return defaultName;
    const commonWords = ["약초꾼", "거상", "호위무관", "지식인", "문인", "의병", "소설가", "학자", "대령", "대지주", "상인", "군관", "당신", "그대", "사람", "불씨", "등불", "기둥", "바람", "씨앗", "흔적", "기류", "파동", "자아", "영혼", "인물", "밑거름", "동지", "후손", "동반자", "수호신", "지도자", "개척자", "선구자", "조력자", "근원지", "발상지", "시발점", "중심지", "피해자", "가해자", "주인공", "목격자", "참가자"];
    
    function cleanName(name) {
        if (!name) return "";
        let cleaned = name.trim();
        cleaned = cleaned.replace(/(?:이었다|였다|이었습니다|였습니다|였|이었|입니까|입니다|이다|은|는|이|가|의|과|와|을|를)$/, "");
        return cleaned.trim();
    }
    
    function isValidName(name) {
        const candidate = cleanName(name);
        return candidate && !commonWords.includes(candidate) && candidate.length >= 2 && candidate.length <= 4;
    }
    
    let firstWordMatch = story.match(/^['"“‘]?([가-힣]{2,7})['"”’]?(?:\([^)]*\))?(?:은|는|이|가|의)\s/);
    if (firstWordMatch && isValidName(firstWordMatch[1])) return cleanName(firstWordMatch[1]);
    
    let match = story.match(/['"“‘]?([가-힣]{2,7})['"”’]?(?:\([^)]*\))?[이|라는]\s+이름의/);
    if (match && isValidName(match[1])) return cleanName(match[1]);
    
    match = story.match(/(?:이름은|호칭은|태생의|태어난)\s+['"“‘]?([가-힣]{2,7})['"”’]?(?:\([^)]*\))?/);
    if (match && isValidName(match[1])) return cleanName(match[1]);
    
    match = story.match(/(?:약초꾼|거상|호위무관|지식인|문인|의병|소설가|학자|대령|대지주|상인|군관)[,\s]*['"“‘]?([가-힣]{2,7})['"”’]?(?:\([^)]*\))?(?:였습니다|였다|이었다|이었습니다|입니까|입니다)/);
    if (match && isValidName(match[1])) return cleanName(match[1]);
    
    match = story.match(/['"“‘]?([가-힣]{2,7})['"”’]?(?:\([^)]*\))?(?:였습니다|였다|이었다|이었습니다|입니까|입니다|의\s+기억|의\s+삶)/);
    if (match && isValidName(match[1])) return cleanName(match[1]);
    
    const knownNames = ["윤도현", "이현우", "민치상", "백인엽", "이도", "윤도", "이현수", "윤대현", "윤덕재", "강정"];
    for (const name of knownNames) {
        if (story.includes(name)) {
            return name;
        }
    }
    return defaultName;
}

export function getPersonaDates(persona) {
    if (persona === '거상') {
        return '1965.03.14 ~ 2029.12.08';
    } else if (persona === '호위무관') {
        return '1968.06.22 ~ 1997.10.21';
    } else if (persona === '문인') {
        return '1969.08.20 ~ 2026.03.05';
    }
    return '1971.04.05 ~ 1999.11.17';
}

export function formatPastLifeStoryForCard(story, pastLifeName, presentNickname) {
    if (!story) return "";
    let formatted = story.trim();
    const greetingRegex = /^(?:현생의\s*)?[가-힣a-zA-Z0-9\s]+?님(?:,\s*(?:당신|그대)의)?\s+전생은\s+/;
    if (greetingRegex.test(formatted)) {
        formatted = formatted.replace(greetingRegex, `${pastLifeName} 님의 평행세계 행적은 `);
    } else {
        const fallbackRegex = /^(?:현생의\s*)?[가-힣a-zA-Z0-9\s]+?님[,\s]+/;
        if (fallbackRegex.test(formatted)) {
            formatted = formatted.replace(fallbackRegex, `${pastLifeName} 님, `);
        }
    }
    
    if (presentNickname) {
        const escapedNickname = presentNickname.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const specificRegex1 = new RegExp(`${escapedNickname}\\s*님의\\s*전생은`, 'g');
        formatted = formatted.replace(specificRegex1, `${pastLifeName} 님의 평행세계 행적은`);
        const specificRegex2 = new RegExp(`${escapedNickname}\\s*님,\\s*당신의\\s*전생은`, 'g');
        formatted = formatted.replace(specificRegex2, `${pastLifeName} 님의 평행세계 행적은`);
    }
    return formatted;
}

export function triggerAwakeningNarrative() {
    if (navigator.vibrate) {
        navigator.vibrate([100, 100, 100, 100, 100]);
    }
    
    const connectBtn = document.getElementById('btn-connect-pastlife');
    const spinnerBox = document.getElementById('scan-spinner-box');
    const storyBox = document.getElementById('pastlife-story-box');
    const scanTitle = document.querySelector('#awakening-stage-scan h3');
    const statusTextEl = document.getElementById('scan-status-text');
    
    if (connectBtn) connectBtn.style.display = 'none';
    if (spinnerBox) spinnerBox.style.display = 'flex';
    if (statusTextEl) {
        statusTextEl.style.display = 'block';
        statusTextEl.innerText = "나의 학습 주파수 파동 감지 중...";
    }
    if (storyBox) {
        storyBox.style.display = 'none';
        storyBox.innerHTML = '';
    }
    if (scanTitle) {
        scanTitle.innerText = "평행세계 자아 탐색 중...";
    }
    
    document.getElementById('awakening-stage-input').style.display = 'none';
    const scanContainer = document.getElementById('awakening-stage-scan');
    scanContainer.style.display = 'flex';
    
    const userPhoto = localStorage.getItem('zeni_user_photo');
    const scanImg = document.getElementById('scan-photo-img');
    const scanPortrait = document.getElementById('scan-portrait-img');
    
    if (userPhoto && scanImg) {
        scanImg.src = userPhoto;
    } else if (scanImg) {
        scanImg.src = 'zeni_logo.png';
    }
    
    if (scanPortrait) {
        scanPortrait.src = 'portrait_modern.png';
    }
    
    if (scanImg) {
        scanImg.className = '';
        scanImg.style.opacity = '';
    }
    if (scanPortrait) {
        scanPortrait.className = '';
        scanPortrait.style.opacity = '';
    }
    
    const nameVal = document.getElementById('aw-name').value.trim() || "나의 현생";
    
    let storyPromise = fetch('/api/student/generate-past-life-story', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name: nameVal, persona: state.selectedPersona })
    })
    .then(res => res.json())
    .then(data => data.story)
    .catch(err => {
        console.error("Failed to fetch past life story:", err);
        return `${nameVal} 후배님, 평행세계의 합격자인 정문인은 1993년 당시 대학가 청년이자 신춘문예 등단 소설가로서, 카세트테이프 음악을 들으며 밤새 타자기를 두드려 개념 수험 요약 초안을 잡았던 전설적인 공부 멘토였어. 시대의 청년들에게 지식을 비추어주던 그는 평행세계 후배들의 길잡이가 되어주며 은은한 자취를 남겼단다.`;
    });
    
    const statusText = document.getElementById('scan-status-text');
    
    // 1.5s: Trigger Disintegrate on present photo & Prepared glow state on past photo
    setTimeout(() => {
        if (scanImg) {
            scanImg.classList.add('cinematic-disintegrate');
        }
        if (scanPortrait) {
            scanPortrait.classList.add('portrait-prep');
        }
        if (statusText) statusText.innerText = "양자 주파수 파동이 1993년의 평행세계로 정렬되기 시작합니다...";
        if (navigator.vibrate) navigator.vibrate(60);
    }, 1500);
    
    // 4.5s: Trigger Cinematic Reveal (Past-life photo slowly resolves and focuses from the glow state)
    setTimeout(() => {
        let vintageClass = 'past-life-guard';
        if (state.selectedPersona === '약초꾼') {
            vintageClass = 'past-life-herb';
        } else if (state.selectedPersona === '거상') {
            vintageClass = 'past-life-merchant';
        }
        
        if (scanPortrait) {
            scanPortrait.classList.remove('portrait-prep');
            scanPortrait.classList.add('cinematic-reveal');
            scanPortrait.classList.add(vintageClass);
        }
        if (statusText) statusText.innerText = "1993년 평행세계 자아의 학습 주파수를 분석하는 중...";
        if (navigator.vibrate) navigator.vibrate(60);
    }, 4500);
    
    // 8.0s: Reveal progress status update
    setTimeout(() => {
        if (statusText) statusText.innerText = "양자 결합을 통해 평행세계의 학습 장부 기록을 동조하는 중...";
        if (navigator.vibrate) navigator.vibrate(60);
    }, 8000);
    
    // 11.5s: Sync completion & show connection button (12-second total duration)
    setTimeout(() => {
        if (scanTitle) {
            scanTitle.innerText = "주파수 동조 완료";
        }
        if (statusText) {
            statusText.style.display = 'none';
        }
        if (spinnerBox) spinnerBox.style.display = 'none';
        
        // Apply user features overlay blend on top of portrait (double-exposure)
        if (scanImg) {
            scanImg.className = 'user-blend';
            scanImg.style.opacity = '';
        }
        
        // Show typewriter loading placeholder immediately
        if (storyBox) {
            storyBox.innerText = "평행세계 자아의 학습 궤적을 판독하는 중...";
            storyBox.style.display = 'block';
            storyBox.scrollTop = 0;
        }
        
        if (connectBtn) connectBtn.style.display = 'block';
        if (navigator.vibrate) navigator.vibrate([150, 100, 150]);
        
        // Asynchronously load the story in the background once ready
        storyPromise.then(story => {
            if (storyBox) {
                const defaultName = state.selectedPersona === '거상' ? '백인엽' : (state.selectedPersona === '호위무관' ? '민치상' : (state.selectedPersona === '문인' ? '윤도' : '이도'));
                const name = extractPastLifeName(story, defaultName);
                
                // Re-detect correct persona type based on the parsed name to align dates
                let detectedPersona = state.selectedPersona;
                if (name === '이도' || name === '이현수' || name === '강정') {
                    detectedPersona = '약초꾼';
                } else if (name === '백인엽' || name === '이현우' || name === '윤도현') {
                    detectedPersona = '거상';
                } else if (name === '민치상') {
                    detectedPersona = '호위무관';
                } else if (name === '윤도' || name === '윤대현') {
                    detectedPersona = '문인';
                }
                
                const dates = getPersonaDates(detectedPersona);
                const presentNickname = document.getElementById('aw-name') ? document.getElementById('aw-name').value.trim() : "대표님";
                const cleanedStory = formatPastLifeStoryForCard(story, name, presentNickname);
                
                storyBox.innerHTML = `<span style="font-family: 'Noto Sans KR', sans-serif; font-style: normal; font-weight: bold; color: var(--primary);">${name} (${dates})</span><br><br><strong style="font-family: 'Noto Sans KR', sans-serif; font-style: normal; color: var(--primary); margin-right: 6px;">평행세계의 기록:</strong>${cleanedStory}`;
                storyBox.scrollTop = 0;
            }
            localStorage.setItem('zeni_past_story', story);
        });
    }, 11500);
}

export function connectPastLifeConnection() {
    const threadOverlay = document.getElementById('thread-overlay');
    
    // 1. Show the quantum thread connection overlay (rhythmic heartbeats)
    if (threadOverlay) {
        threadOverlay.classList.add('active');
        if (navigator.vibrate) {
            navigator.vibrate([100, 60, 100, 60, 200]);
        }
    }
    
    // 2. Perform the backend reset and localStorage initialization in the background
    const name = document.getElementById('aw-name').value.trim() || "나의 현생";
    const worry = "현생의 모진 장벽";
    
    fetch('/api/student/reset', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            student_title: name,
            persona_type: state.selectedPersona,
            user_worry: worry
        })
    }).catch(e => console.error("Failed to reset student model on server:", e));
    
    localStorage.setItem('zeni_awakened', 'true');
    localStorage.setItem('zeni_chat_count', '0');
    
    // 3. After 2.2 seconds, hide awakening overlays and transition directly to the Chat Tab
    setTimeout(() => {
        const overlay = document.getElementById('awakening-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.display = 'none';
        }
        
        // Re-initialize app and redirect to Chat Tab
        window.initApp().then(() => {
            window.switchTab('chat');
        });
        
        // Fade out quantum thread overlay
        if (threadOverlay) {
            threadOverlay.classList.remove('active');
        }
    }, 2200);
}

export function startTypewriterNarrative() {
    const name = document.getElementById('aw-name').value.trim() || "나의 현생";
    const worry = "현생의 모진 장벽";
    
    let personaName = "1993년의 평행세계 호위무관";
    let searchFact = "친군영 호위무관 평산 전투";
    if (state.selectedPersona === '약초꾼') {
        personaName = "1993년의 평행세계 약초꾼";
        searchFact = "서유구 임원경제지 본리지";
    } else if (state.selectedPersona === '거상') {
        personaName = "1993년의 평행세계 개성 거상";
        searchFact = "개성 송상 거상 거래 기록";
    }
    
    // Language detection
    const userLang = navigator.language || navigator.userLanguage || "";
    if (userLang.toLowerCase().startsWith('en')) {
        if (state.selectedPersona === '약초꾼') {
            personaName = "Frontier Botanist";
            searchFact = "Westward expansion Botanist records";
        } else if (state.selectedPersona === '거상') {
            personaName = "Wall Street Investor";
            searchFact = "1920 Wall Street Investor journals";
        } else {
            personaName = "Sheriff";
            searchFact = "Old West Sheriff historical archives";
        }
    } else if (userLang.toLowerCase().startsWith('ja')) {
        if (state.selectedPersona === '약초꾼' || state.selectedPersona === '거상') {
            personaName = "Osaka Merchant";
            searchFact = "Osaka Merchant accounts database";
        } else {
            personaName = "Samurai";
            searchFact = "Edo period Samurai archives";
        }
    }
    
    const text = `"${name} 후배님.\n\n고작 그 ${worry} 종이 쪼가리,\n그 불확실한 수험의 장벽 앞에서 이토록 흔들리며 밤잠을 설치고 있었단 말이냐?\n\n평행세계에서 먼저 합격해 이 길을 다 닦아둔 또 다른 너의 기세가 아깝다.\n\n수많은 차원 중, [${personaName}] 평행자아의 학습 기억과 비법이 지금 너와 동조되었다.\n\n겁먹지 마라. 네 뒤엔 평행세계의 또 다른 네가 버티고 서 있다.\n\n(현업 데이터베이스에서 [${searchFact}]를 검색해 보아라. 평행세계 자아의 흔적을 확인하고 동조 에너지를 전수받아라.)"`;
    
    typewriterNarrative(text, document.getElementById('narrative-typewriter'), 50, () => {
        document.getElementById('btn-enter-app').style.display = 'inline-block';
    });
}

function typewriterNarrative(text, element, speed, callback) {
    element.innerHTML = '';
    let i = 0;
    
    function type() {
        if (i < text.length) {
            const char = text.charAt(i);
            if (char === '\n') {
                element.innerHTML += '<br>';
            } else {
                element.innerHTML += char;
            }
            i++;
            setTimeout(type, speed);
        } else if (callback) {
            callback();
        }
    }
    type();
}
