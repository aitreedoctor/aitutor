// Wrong Notes, Remedial prescription & Sidebar Accordion Manager

import { state } from './Config.js';
import { 
    translateScientificNames, 
    formatQuestionText, 
    safeMarkedParse, 
    postProcessMarkdownHTML, 
    showFloatingCoinToast 
} from './Utils.js';

import { addBonusCoinsOnServer } from './FeedbackManager.js';

let activeTwinAnswer = "";

export async function initWrongNotesView() {
    try {
        const response = await fetch(`/api/student/wrong-answers?student_id=${state.activeStudentId}`);
        state.wrongNotesList = await response.json();
        
        const filterSelect = document.getElementById('wrong-notes-subject-filter');
        const emptyView = document.getElementById('wrong-notes-empty-view');
        const listView = document.getElementById('wrong-notes-list-view');
        
        if (!state.wrongNotesList || state.wrongNotesList.length === 0) {
            emptyView.style.display = 'flex';
            listView.style.display = 'none';
            return;
        }
        
        emptyView.style.display = 'none';
        listView.style.display = 'block';
        
        // Build dynamic subject filter list
        const subjects = new Set();
        state.wrongNotesList.forEach(item => {
            if (item.subject) subjects.add(item.subject);
        });
        
        // Reset filter options
        filterSelect.innerHTML = `<option value="ALL">전체 과목 보기</option>`;
        subjects.forEach(subj => {
            filterSelect.innerHTML += `<option value="${subj}">${subj}</option>`;
        });
        
        renderWrongNotes(state.wrongNotesList);
    } catch(err) {
        console.error("Failed to load wrong notes:", err);
    }
}

export function renderWrongNotes(items) {
    const cardsContainer = document.getElementById('wrong-notes-cards-container');
    if (!cardsContainer) return;
    cardsContainer.innerHTML = "";
    
    items.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = "remedial-card wrong-note-card";
        card.style.marginBottom = "16px";
        
        let displayOptions = item.options || [];
        let maxChoices = 4;
        if (displayOptions.length === 5 && displayOptions[4] && displayOptions[4].trim() !== "") {
            maxChoices = 5;
        }
        displayOptions = displayOptions.slice(0, maxChoices);
        const allOptionsEmpty = displayOptions.every(opt => !opt || opt.trim() === "");
        if (allOptionsEmpty || displayOptions.length === 0) {
            displayOptions = Array(maxChoices).fill("");
        }
        
        let optionsHtml = "";
        displayOptions.forEach((optText, oIdx) => {
            const optNum = (oIdx + 1).toString();
            let optClass = "twin-choice-btn";
            let iconHtml = "";
            
            if (optNum === item.correct_answer) {
                optClass += " correct";
                iconHtml = `<i class="xi-check-circle" style="margin-right: 6px;"></i>`;
            } else if (optNum === item.selected_answer) {
                optClass += " incorrect";
                iconHtml = `<i class="xi-close-circle" style="margin-right: 6px;"></i>`;
            }
            
            const displayText = optText ? translateScientificNames(optText) : `선택지 ${optNum}`;
            optionsHtml += `
                <button class="${optClass}" style="width: 100%; margin-top: 8px; text-align: left;" disabled>
                    ${iconHtml} ${optNum}) ${displayText}
                </button>
            `;
        });
        
        const safeOptions = JSON.stringify(item.options).replace(/"/g, '&quot;');
        const safeQuestionText = item.question_text.replace(/'/g, "\\'");
        
        let imageHtml = "";
        if (item.image_url) {
            imageHtml = `<div style="margin-top: 10px; margin-bottom: 10px;"><img src="${item.image_url}" referrerpolicy="no-referrer" alt="Question Diagram" style="max-width: 100%; max-height: 200px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: #fff; padding: 4px;" /></div>`;
        }
        
        card.innerHTML = `
            <div class="card-header" style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between;">
                <span style="font-size: 11px; font-weight: bold; color: #ff5252;"><i class="xi-file-remove"></i> 오답 장부 [${item.subject}]</span>
                <span style="font-size: 11.5px; color: var(--text-secondary);">${item.round_name}</span>
            </div>
            <h3 style="font-size: 14.5px; color: #fff; line-height: 1.6; margin-bottom: 16px;">${formatQuestionText(item.question_text)}</h3>
            ${imageHtml}
            <div class="choices-container" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
                ${optionsHtml}
            </div>
            
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn btn-secondary btn-sm" onclick="toggleWrongNotesPrescription(${idx})" style="padding: 6px 12px; font-size: 12px;">
                    <i class="xi-eye"></i> AI 선배의 처방전 보기
                </button>
                <button class="btn btn-warning btn-sm" onclick="openTwinQuestionModal('${safeQuestionText}', '${safeOptions}', '${item.correct_answer}')" style="padding: 6px 12px; font-size: 12px;">
                    <i class="xi-branch"></i> 쌍둥이 문제 도전 (+10냥)
                </button>
            </div>
            
            <!-- Collapsible AI prescription content -->
            <div class="glass-card" id="wrong-prescription-${idx}" style="display: none; margin-top: 14px; padding: 16px; border: 1px solid rgba(212,175,55,0.2); background: rgba(0,0,0,0.55); border-radius: 8px;">
                <h4 style="font-size: 12.5px; color: var(--primary); font-weight: bold; margin-bottom: 8px;"><i class="xi-brightness"></i> AI 합격 선배의 처방 진단</h4>
                <div class="markdown-body" style="font-size: 13px; line-height: 1.7; color: #cbd5e1;">
                    ${item.tutor_response ? safeMarkedParse(item.tutor_response) : "처방전이 복구되지 않았습니다. 실시간 풀이 시 발행된 처방을 참조하세요."}
                </div>
            </div>
        `;
        cardsContainer.appendChild(card);
    });
    postProcessMarkdownHTML(cardsContainer);
}

export function filterWrongNotesBySubject(subjectVal) {
    if (subjectVal === 'ALL') {
        renderWrongNotes(state.wrongNotesList);
    } else {
        const filtered = state.wrongNotesList.filter(item => item.subject === subjectVal);
        renderWrongNotes(filtered);
    }
}

export function toggleWrongNotesPrescription(idx) {
    const box = document.getElementById(`wrong-prescription-${idx}`);
    if (box) {
        if (box.style.display === 'none') {
            box.style.display = 'block';
        } else {
            box.style.display = 'none';
        }
    }
}

export async function openTwinQuestionModal(questionText, optionsJson, correctVal) {
    const modal = document.getElementById('twin-question-modal');
    const loading = document.getElementById('twin-modal-loading');
    const content = document.getElementById('twin-modal-content');
    
    if (modal) modal.style.display = 'flex';
    if (loading) loading.style.display = 'flex';
    if (content) content.style.display = 'none';
    
    try {
        const options = JSON.parse(optionsJson);
        const response = await fetch('/api/tutor/twin-question', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                question_text: questionText,
                options: options,
                correct_answer: correctVal
            })
        });
        
        const twin = await response.json();
        
        document.getElementById('twin-question-text').innerText = twin.question_text;
        activeTwinAnswer = twin.correct_answer;
        
        const choicesContainer = document.getElementById('twin-choices-container');
        choicesContainer.innerHTML = "";
        
        twin.options.forEach((optText, oIdx) => {
            const optNum = (oIdx + 1).toString();
            choicesContainer.innerHTML += `
                <button class="twin-choice-btn" id="twin-opt-${optNum}" onclick="submitTwinChoice('${optNum}')" style="width: 100%; margin-top: 8px; text-align: left; padding: 10px 14px;">
                    ${optNum}) ${optText}
                </button>
            `;
        });
        
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';
    } catch(err) {
        console.error("Failed to load twin question:", err);
        if (loading) loading.innerHTML = `<span style="color: #ff5252;">쌍둥이 문제 생성을 실패했습니다. 다시 시도해 주세요.</span>`;
    }
}

export function closeTwinQuestionModal() {
    document.getElementById('twin-question-modal').style.display = 'none';
}

export async function submitTwinChoice(selectedVal) {
    const choicesContainer = document.getElementById('twin-choices-container');
    choicesContainer.querySelectorAll('button').forEach(b => b.disabled = true);
    
    const isCorrect = (selectedVal === activeTwinAnswer);
    const selectedBtn = document.getElementById(`twin-opt-${selectedVal}`);
    const correctBtn = document.getElementById(`twin-opt-${activeTwinAnswer}`);
    
    if (isCorrect) {
        if (selectedBtn) selectedBtn.classList.add('correct');
        showFloatingCoinToast("🪙 쌍둥이 격파 보너스 +10냥!", true);
    } else {
        if (selectedBtn) selectedBtn.classList.add('incorrect');
        if (correctBtn) correctBtn.classList.add('correct');
        showFloatingCoinToast("오답입니다. 기본 개념을 다시 짚으세요.", false);
    }
    
    try {
        const response = await fetch('/api/tutor/solve-twin', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_id: state.activeStudentId,
                is_correct: isCorrect
            })
        });
        const data = await response.json();
        document.getElementById('user-coins').innerText = data.coins;
        await window.fetchStudentProfile();
    } catch(err) {
        console.error("Failed to submit twin choice:", err);
    }
}

// Remedial Adaptive view handlers
export async function initRemedialView() {
    const studyPackSelect = document.getElementById('study-pack-select');
    const packName = studyPackSelect ? studyPackSelect.value : 'tree_doctor_past';
    
    try {
        const response = await fetch(`/api/tutor/remedial-package?pack_name=${packName}&student_id=${state.activeStudentId}`);
        const pkg = await response.json();
        
        const welcomeView = document.getElementById('remedial-welcome-view');
        const activeView = document.getElementById('remedial-active-view');
        const container = document.getElementById('remedial-cards-container');
        
        if (pkg.triggered && pkg.remedial_questions.length > 0) {
            if (welcomeView) welcomeView.style.display = 'none';
            if (activeView) activeView.style.display = 'block';
            if (container) {
                container.innerHTML = "";
                
                pkg.remedial_questions.forEach((q, idx) => {
                    const card = document.createElement('div');
                    card.className = "remedial-card";
                    card.id = `remedial-card-${idx}`;
                    card.style.marginBottom = "20px";
                    
                    let displayOptions = q.options || [];
                    let maxChoices = 4;
                    if (displayOptions.length === 5 && displayOptions[4] && displayOptions[4].trim() !== "") {
                        maxChoices = 5;
                    }
                    displayOptions = displayOptions.slice(0, maxChoices);
                    const allOptionsEmpty = displayOptions.every(opt => !opt || opt.trim() === "");
                    if (allOptionsEmpty || displayOptions.length === 0) {
                        displayOptions = Array(maxChoices).fill("");
                    }
                    
                    let optionsHtml = "";
                    displayOptions.forEach((optText, oIdx) => {
                        const displayText = optText ? optText : `선택지 ${oIdx+1}`;
                        optionsHtml += `
                            <button class="twin-choice-btn" style="width: 100%; margin-top: 8px;" onclick="solveRemedialQuestion(${idx}, '${q.subject}', '${q.correct_answer}', '${oIdx+1}', '${q.question_text.replace(/'/g, "\'")}', '${q.round}')">
                                ${oIdx+1}) ${displayText}
                            </button>
                        `;
                    });
                    
                    let imageHtml = "";
                    if (q.image_url) {
                        imageHtml = `<div style="margin-top: 10px; margin-bottom: 10px;"><img src="${q.image_url}" referrerpolicy="no-referrer" alt="Question Diagram" style="max-width: 100%; max-height: 200px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: #fff; padding: 4px;" /></div>`;
                    }
                    
                    card.innerHTML = `
                        <div class="card-header" style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between;">
                            <span style="font-size: 11px; font-weight: bold; color: var(--warning);"><i class="xi-alert-c"></i> 특별 처방 처방전 [${q.subject}]</span>
                            <span style="font-size: 11.5px; color: var(--text-secondary);">${q.round}</span>
                        </div>
                        <h3 style="font-size: 14.5px; color: #fff; line-height: 1.6; margin-bottom: 16px;">${formatQuestionText(q.question_text)}</h3>
                        ${imageHtml}
                        <div class="remedial-choices-container" id="remedial-choices-${idx}" style="display: flex; flex-direction: column; gap: 8px;">
                            ${optionsHtml}
                        </div>
                    `;
                    container.appendChild(card);
                });
            }
        } else {
            if (welcomeView) welcomeView.style.display = 'flex';
            if (activeView) activeView.style.display = 'none';
        }
    } catch(err) {
        console.error("Failed to load remedial package:", err);
    }
}

export async function solveRemedialQuestion(cardIdx, subject, correctVal, selectedVal, questionText, roundName) {
    const choicesDiv = document.getElementById(`remedial-choices-${cardIdx}`);
    if (!choicesDiv) return;
    choicesDiv.querySelectorAll('button').forEach(b => b.disabled = true);
    
    const correctIndex = parseInt(correctVal) - 1;
    const selectedIndex = parseInt(selectedVal) - 1;
    const isCorrect = (selectedVal === correctVal);
    
    const buttons = choicesDiv.querySelectorAll('button');
    if (isCorrect) {
        buttons[selectedIndex].classList.add('correct');
        showFloatingCoinToast("🪙 처방 보너스 엽전 +10냥!", true);
    } else {
        buttons[selectedIndex].classList.add('incorrect');
        buttons[correctIndex].classList.add('correct');
        showFloatingCoinToast("오답입니다. 개념 장부를 돌아보세요.", false);
    }
    
    try {
        const response = await fetch('/api/tutor/remedial-solve', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_id: state.activeStudentId,
                subject: subject,
                question_text: questionText,
                selected_answer: selectedVal,
                correct_answer: correctVal,
                round_name: roundName
            })
        });
        const res = await response.json();
        document.getElementById('user-coins').innerText = res.coins_balance;
        
        setTimeout(() => {
            const card = document.getElementById(`remedial-card-${cardIdx}`);
            if (card) {
                card.animate([
                    { opacity: 1, transform: 'scale(1)' },
                    { opacity: 0, transform: 'scale(0.95)' }
                ], { duration: 250, fill: 'forwards' }).onfinish = async () => {
                    card.remove();
                    
                    const container = document.getElementById('remedial-cards-container');
                    if (container && container.children.length === 0) {
                        await addBonusCoinsOnServer(30);
                        showFloatingCoinToast("🪙 보충 패키지 완수 보너스 +30냥!", true);
                        await initRemedialView();
                        await window.fetchStudentProfile();
                    }
                };
            }
        }, 2000);
        
    } catch(err) {
        console.error("Failed to solve remedial question:", err);
    }
}

// Sidebar Accordion & Menu Navigation
export function toggleCategory(category) {
    const menu = document.getElementById(`menu-${category}`);
    const header = document.querySelector(`[onclick^="toggleCategory('${category}')"]`);
    if (menu) {
        const currentDisplay = menu.style.display || window.getComputedStyle(menu).display;
        const isOpen = currentDisplay === 'block';
        menu.style.display = isOpen ? 'none' : 'block';
        if (header) {
            if (isOpen) header.classList.remove('active');
            else header.classList.add('active');
        }
    }
}

export function selectSubMenu(packId, category, event) {
    if (event) {
        event.stopPropagation();
    }
    
    window.changeStudyPack(packId);
    window.switchTab('cbt');
}

export function syncActiveSubMenu(packId) {
    document.querySelectorAll('.sub-menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeItem = document.querySelector(`.sub-menu-item[data-pack="${packId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
        
        let element = activeItem.parentElement;
        while (element && element.classList) {
            if (element.classList.contains('sub-menu') || element.classList.contains('nested-sub-menu')) {
                element.style.display = 'block';
            }
            if (element.classList.contains('nav-accordion') || element.classList.contains('nested-category')) {
                const header = element.querySelector('.nav-accordion-header, .nested-category-header');
                if (header) header.classList.add('active');
            }
            element = element.parentElement;
        }
    }
}

let activeStudyroomTwinAnswer = "";

export function initTwinSessionWorkspace() {
    const triggerArea = document.getElementById('studyroom-twin-trigger-area');
    const playArea = document.getElementById('studyroom-twin-play-area');
    
    if (triggerArea) triggerArea.style.display = 'block';
    if (playArea) playArea.style.display = 'none';
    
    const titleEl = document.getElementById('studyroom-twin-status-title');
    const descEl = document.getElementById('studyroom-twin-status-desc');
    const btnEl = document.getElementById('btn-studyroom-twin-trigger');
    
    const wrongList = state.wrongNotesList || [];
    
    if (wrongList.length === 0) {
        if (titleEl) titleEl.innerText = "오답 장부가 비어 있습니다!";
        if (descEl) descEl.innerText = "CBT 시험에서 문제를 틀려 오답 장부에 문항들이 축적되어야 AI가 이를 분석하여 쌍둥이 변형 문제를 출제할 수 있습니다. 먼저 시험을 치러 주십시오.";
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.style.opacity = '0.5';
            btnEl.style.cursor = 'not-allowed';
        }
    } else {
        if (titleEl) titleEl.innerText = "쌍둥이 변형 문제 추출 대기 중";
        if (descEl) descEl.innerText = `현재 오답 장부에 총 ${wrongList.length}개의 틀린 문제가 적재되어 있습니다. 이 중 무작위로 하나를 추출해 쌍둥이 매칭 대결을 생성합니다.`;
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.style.opacity = '1';
            btnEl.style.cursor = 'pointer';
        }
    }
}

export async function launchTwinSessionFromStudyRoom() {
    const triggerArea = document.getElementById('studyroom-twin-trigger-area');
    const playArea = document.getElementById('studyroom-twin-play-area');
    const loading = document.getElementById('studyroom-twin-loading');
    const content = document.getElementById('studyroom-twin-content');
    
    if (triggerArea) triggerArea.style.display = 'none';
    if (playArea) playArea.style.display = 'block';
    if (loading) loading.style.display = 'flex';
    if (content) content.style.display = 'none';
    
    const wrongList = state.wrongNotesList || [];
    if (wrongList.length === 0) {
        initTwinSessionWorkspace();
        return;
    }
    
    const randomIdx = Math.floor(Math.random() * wrongList.length);
    const item = wrongList[randomIdx];
    
    try {
        const response = await fetch('/api/tutor/twin-question', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                question_text: item.question_text,
                options: item.options,
                correct_answer: item.correct_answer
            })
        });
        
        if (!response.ok) throw new Error("Failed to generate twin question");
        const twin = await response.json();
        
        document.getElementById('studyroom-twin-question-text').innerText = twin.question_text;
        activeStudyroomTwinAnswer = twin.correct_answer;
        
        const choicesContainer = document.getElementById('studyroom-twin-choices-container');
        choicesContainer.innerHTML = "";
        
        twin.options.forEach((optText, oIdx) => {
            const optNum = (oIdx + 1).toString();
            choicesContainer.innerHTML += `
                <button class="twin-choice-btn" id="studyroom-twin-opt-${optNum}" onclick="submitStudyroomTwinChoice('${optNum}')" style="width: 100%; margin-top: 8px; text-align: left; padding: 12px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #fff; cursor: pointer; transition: all 0.2s;">
                    ${optNum}) ${optText}
                </button>
            `;
        });
        
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';
    } catch(err) {
        console.error("Failed to load twin question:", err);
        if (loading) {
            loading.innerHTML = `
                <span style="color: #ff5252; font-size: 13.5px;"><i class="xi-warning"></i> 쌍둥이 문제 생성에 실패했습니다.</span>
                <button class="btn btn-secondary btn-sm" onclick="initTwinSessionWorkspace()" style="margin-top: 12px; padding: 6px 12px;">뒤로 가기</button>
            `;
        }
    }
}

export async function submitStudyroomTwinChoice(selectedVal) {
    const choicesContainer = document.getElementById('studyroom-twin-choices-container');
    choicesContainer.querySelectorAll('button').forEach(b => {
        b.disabled = true;
        b.style.cursor = 'default';
    });
    
    const isCorrect = (selectedVal === activeStudyroomTwinAnswer);
    const selectedBtn = document.getElementById(`studyroom-twin-opt-${selectedVal}`);
    const correctBtn = document.getElementById(`studyroom-twin-opt-${activeStudyroomTwinAnswer}`);
    
    if (isCorrect) {
        if (selectedBtn) {
            selectedBtn.style.background = 'rgba(16, 185, 129, 0.2)';
            selectedBtn.style.borderColor = '#10b981';
            selectedBtn.style.color = '#10b981';
        }
        showFloatingCoinToast("🪙 쌍둥이 격파 보너스 +10냥!", true);
    } else {
        if (selectedBtn) {
            selectedBtn.style.background = 'rgba(239, 68, 68, 0.2)';
            selectedBtn.style.borderColor = '#ef4444';
            selectedBtn.style.color = '#ef4444';
        }
        if (correctBtn) {
            correctBtn.style.background = 'rgba(16, 185, 129, 0.2)';
            correctBtn.style.borderColor = '#10b981';
            correctBtn.style.color = '#10b981';
        }
        showFloatingCoinToast("오답입니다. 기본 개념을 다시 학습하세요.", false);
    }
    
    const backBtn = document.createElement('button');
    backBtn.className = "btn btn-secondary";
    backBtn.innerText = "단원 목록으로 돌아가기";
    backBtn.style.marginTop = "20px";
    backBtn.style.width = "100%";
    backBtn.onclick = initTwinSessionWorkspace;
    choicesContainer.appendChild(backBtn);
    
    try {
        const response = await fetch('/api/tutor/solve-twin', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_id: state.activeStudentId,
                is_correct: isCorrect
            })
        });
        const data = await response.json();
        const userCoinsEl = document.getElementById('user-coins');
        if (userCoinsEl) userCoinsEl.innerText = data.coins;
        await window.fetchStudentProfile();
    } catch(err) {
        console.error("Failed to submit twin choice:", err);
    }
}

window.initTwinSessionWorkspace = initTwinSessionWorkspace;
window.launchTwinSessionFromStudyRoom = launchTwinSessionFromStudyRoom;
window.submitStudyroomTwinChoice = submitStudyroomTwinChoice;
