// Main Orchestrator & Bootloader (ES6 Module Entrypoint)

import { state } from './modules/Config.js';
import { 
    safeMarkedParse, 
    translateScientificNames, 
    formatQuestionText, 
    postProcessMarkdownHTML, 
    showFloatingCoinToast 
} from './modules/Utils.js';
import { 
    initAwakeningView, 
    initRuneCanvas, 
    drawRuneGuide, 
    openProfileModal, 
    closeProfileModal, 
    saveProfileTitle, 
    connectPastLifeConnection, 
    startTypewriterNarrative,
    extractPastLifeName,
    getPersonaDates,
    formatPastLifeStoryForCard
} from './modules/IntroManager.js';
import { 
    filterCbtQuestions, 
    renderCbtQuestion, 
    selectCbtChoice, 
    prevCbtQuestion, 
    nextCbtQuestion, 
    generateOmrBubbles, 
    updateOmrProgress, 
    toggleMobileOmr, 
    submitCbtAnswer, 
    gradeCbtExam, 
    closeCbtReportModal, 
    triggerAmuletFromReport 
} from './modules/CbtManager.js';
import { 
    fetchStudentProfile, 
    switchMember, 
    openNewMemberModal, 
    closeNewMemberModal, 
    submitNewMember, 
    loadMembersDropdown, 
    loadDashboardPushes, 
    handlePhotoUpload, 
    severPastLifeConnection,
    renderTalismanArchive,
    downloadTalismanCard,
    downloadTalismanFromModal,
    closeTalismanSuccessModal
} from './modules/Dashboard.js';
import { 
    toggleIncense, 
    extinguishIncense, 
    checkChatAvailability, 
    handleChatSubmit, 
    triggerLanternPayment, 
    toggleMiniMeditation, 
    toggleMainMeditation,
    startBgm,
    stopBgm,
    speakGuidance
} from './modules/Chat.js';
import { 
    loadAdminDashboard, 
    executeAdminAction, 
    fetchLibraryPacks, 
    renderLibraryCards, 
    filterLibraryCategory, 
    filterLibrarySearch, 
    activatePackFromLibrary, 
    showPackDetail, 
    closePackDetailModal,
    switchImporterTab,
    handleImportFileSelect,
    submitImportOrScrape
} from './modules/Admin.js';
import { 
    initWrongNotesView, 
    renderWrongNotes, 
    filterWrongNotesBySubject, 
    toggleWrongNotesPrescription, 
    openTwinQuestionModal, 
    closeTwinQuestionModal, 
    submitTwinChoice, 
    initRemedialView, 
    solveRemedialQuestion, 
    toggleCategory, 
    selectSubMenu, 
    syncActiveSubMenu 
} from './modules/WrongNotesManager.js';

// Setup bootloader
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initApp();
        setupEventListeners();
    });
} else {
    initApp();
    setupEventListeners();
}

async function initApp() {
    // Set default audio control states
    const bgmCheck = document.getElementById('check-meditation-bgm');
    const voiceCheck = document.getElementById('check-meditation-voice');
    const autoplayCheck = document.getElementById('check-meditation-autoplay');
    if (bgmCheck) bgmCheck.checked = true;
    if (voiceCheck) voiceCheck.checked = true;
    if (autoplayCheck) autoplayCheck.checked = true;

    // Force one-time reset for user testing
    const needForceReset = !localStorage.getItem('zeni_reset_v132');
    if (needForceReset) {
        localStorage.removeItem('zeni_awakened');
        localStorage.removeItem('zeni_user_photo');
        localStorage.removeItem('zeni_chat_count');
        localStorage.removeItem('zeni_past_story');
        localStorage.removeItem('zeni_student_title');
        localStorage.removeItem('zeni_persona_type');
        localStorage.removeItem('zeni_user_worry');
        localStorage.setItem('zeni_reset_v132', 'true');
    }
    
    // Sync localStorage profile back to server
    const savedTitle = localStorage.getItem('zeni_student_title');
    const savedPersona = localStorage.getItem('zeni_persona_type');
    const savedWorry = localStorage.getItem('zeni_user_worry');
    if (savedTitle && savedPersona && savedWorry) {
        try {
            await fetch('/api/student/reset', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    student_title: savedTitle,
                    persona_type: savedPersona,
                    user_worry: savedWorry
                })
            });
        } catch(err) {
            console.error("Failed to sync profile to server on init:", err);
        }
    }
    
    // Force zeni_awakened to true to completely bypass the Zeni summoning/awakening wizard screen
    localStorage.setItem('zeni_awakened', 'true');
    
    document.getElementById('awakening-overlay').style.display = 'none';
    try {
        await loadMembersDropdown();
    } catch(e) {
        console.error("Failed loading members dropdown:", e);
    }
    try {
        await fetchStudentProfile();
    } catch(e) {
        console.error("Failed fetching student profile:", e);
    }
    try {
        await loadStudyPacks();
    } catch(e) {
        console.error("Failed loading study packs:", e);
    }
    try {
        loadDashboardPushes();
    } catch(e) {
        console.error("Failed loading dashboard pushes:", e);
    }

    // Restore CRT effect state
    try {
        const crtState = localStorage.getItem('zeni_crt_effect');
        const crtCheckbox = document.getElementById('crt-toggle-checkbox');
        if (crtState === 'enabled') {
            if (crtCheckbox) crtCheckbox.checked = true;
            document.body.classList.add('crt-effect-active');
        } else {
            if (crtCheckbox) crtCheckbox.checked = false;
            document.body.classList.remove('crt-effect-active');
        }
    } catch(e) {
        console.error("Failed restoring CRT state:", e);
    }
}

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Profile Settings
    const btnEdit = document.getElementById('btn-edit-profile');
    if (btnEdit) {
        btnEdit.addEventListener('click', openProfileModal);
    }
    const btnMobileEdit = document.getElementById('btn-mobile-edit-profile');
    if (btnMobileEdit) {
        btnMobileEdit.addEventListener('click', openProfileModal);
    }
    const btnSave = document.getElementById('btn-save-profile');
    if (btnSave) {
        btnSave.addEventListener('click', saveProfileTitle);
    }

    // General Chatbot input submit
    const btnSendChat = document.getElementById('btn-send-chat');
    const chatInput = document.getElementById('chat-input');
    if (btnSendChat && chatInput) {
        btnSendChat.addEventListener('click', handleChatSubmit);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleChatSubmit();
            }
        });
    }
}

function switchTab(tabId) {
    state.currentTab = tabId;
    
    // Toggle active menu class
    document.querySelectorAll('.nav-menu .nav-item, .mobile-nav .nav-item').forEach(item => {
        if (item.getAttribute('data-tab') === tabId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Toggle panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    const targetPane = document.getElementById(`${tabId}-tab`);
    if (targetPane) targetPane.classList.add('active');
    
    // Tab specific load actions
    if (tabId === 'dashboard') {
        fetchStudentProfile();
        loadDashboardPushes();
    } else if (tabId === 'library') {
        fetchLibraryPacks();
    } else if (tabId === 'chat') {
        checkChatAvailability();
    } else if (tabId === 'cbt') {
        loadStudyPacks();
    } else if (tabId === 'wrong-notes') {
        initWrongNotesView();
    } else if (tabId === 'remedial') {
        initRemedialView();
    } else if (tabId === 'admin') {
        loadAdminDashboard();
    }
}

async function loadStudyPacks() {
    try {
        const response = await fetch('/api/tutor/packs');
        const packs = await response.json();
        
        const select = document.getElementById('study-pack-select');
        const sidebarSelect = document.getElementById('sidebar-study-pack-select');
        
        [select, sidebarSelect].forEach(sel => {
            if (sel) {
                sel.innerHTML = "";
                packs.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.innerText = getShortPackName(p.id, p.name);
                    sel.appendChild(opt);
                });
            }
        });
        
        // Render CBT Selection Hub Grid Dynamically
        const hubContainer = document.getElementById('cbt-hub-grid-container');
        if (hubContainer) {
            const categories = {
                craftsman: { title: "기능사", icon: "xi-branch", color: "var(--primary)", list: [] },
                industrial: { title: "산업기사", icon: "xi-bookmark-o", color: "#60a5fa", list: [] },
                engineer: { title: "기사", icon: "xi-bookmark-o", color: "#c084fc", list: [] },
                national: { title: "전문국가자격증", icon: "xi-crown", color: "#fb923c", list: [] }
            };
            
            // Group packs by parent category prefix
            const groupedMap = {};
            packs.forEach(p => {
                let groupKey = p.id;
                let baseName = p.name;
                let suffix = "";
                
                if (p.id.startsWith("plant_protection")) {
                    groupKey = "plant_protection";
                    baseName = "🌿 식물보호 기출 팩";
                } else if (p.id.startsWith("tree_doctor")) {
                    groupKey = "tree_doctor";
                    baseName = "🌳 나무의사 기출 팩";
                } else if (p.id.startsWith("realtor_1")) {
                    groupKey = "realtor_1";
                    baseName = "🏠 공인중개사 1차 기출 팩";
                } else if (p.id.startsWith("realtor_2")) {
                    groupKey = "realtor_2";
                    baseName = "🏠 공인중개사 2차 기출 팩";
                } else {
                    baseName = getShortPackName(p.id, p.name);
                }
                
                const dashIdx = p.name.indexOf(" - ");
                if (dashIdx !== -1) {
                    suffix = p.name.substring(dashIdx + 3).trim();
                } else {
                    suffix = p.name;
                }
                
                if (!groupedMap[groupKey]) {
                    groupedMap[groupKey] = {
                        id: groupKey,
                        name: baseName,
                        subpacks: []
                    };
                }
                groupedMap[groupKey].subpacks.push({
                    id: p.id,
                    name: suffix
                });
            });
            
            const groupedList = Object.values(groupedMap);
            
            groupedList.forEach(g => {
                let cat = 'national';
                
                if (g.id === 'plant_protection') {
                    cat = 'industrial';
                } else if (g.id === 'tree_doctor' || g.id.startsWith('realtor')) {
                    cat = 'national';
                } else if (g.id === 'driver_license' || g.name.includes('기능사')) {
                    cat = 'craftsman';
                } else if (g.name.includes('산업기사')) {
                    cat = 'industrial';
                } else if (g.name.includes('기사')) {
                    cat = 'engineer';
                }
                categories[cat].list.push(g);
            });
            
            let hubHtml = "";
            for (const [key, cat] of Object.entries(categories)) {
                let listHtml = "";
                if (cat.list.length === 0) {
                    listHtml = `
                        <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; min-height: 120px;">
                            <div style="text-align: center; color: var(--text-secondary); font-size: 13px; font-style: italic;">
                                <i class="xi-lock-o" style="font-size: 24px; margin-bottom: 8px; display: block; color: var(--text-secondary);"></i>
                                추가 과목 준비 중
                            </div>
                        </div>
                    `;
                } else {
                    listHtml = '<div class="cbt-hub-pack-list" style="display: flex; flex-direction: column; gap: 10px;">';
                    cat.list.forEach(g => {
                        if (g.subpacks.length === 1) {
                            listHtml += `
                                <button class="btn btn-secondary pack-card-btn" onclick="changeStudyPack('${g.subpacks[0].id}'); switchTab('cbt');" style="width:100%; text-align:left; display:flex; justify-content:space-between; align-items:center;">
                                    <span>${g.name}</span>
                                    <i class="xi-angle-right" style="font-size:12px;"></i>
                                </button>
                            `;
                        } else {
                            listHtml += `
                                <div class="pack-card-btn-group" style="width: 100%; display: flex; flex-direction: column; gap: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 12px 14px; border-radius: 8px;">
                                    <div style="font-size: 13px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                                        ${g.name}
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <select class="cbt-subpack-select" style="flex-grow: 1; padding: 8px 10px; font-size: 12.5px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(17,24,39,0.85); color: #e2e8f0; cursor: pointer; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='rgba(255,255,255,0.08)'">
                                            ${g.subpacks.map(sp => `<option value="${sp.id}">${sp.name}</option>`).join("")}
                                        </select>
                                        <button class="btn btn-primary" onclick="const sel=this.previousElementSibling; changeStudyPack(sel.value); switchTab('cbt');" style="padding: 6px 12px; font-size: 12px; font-weight: bold; border-radius: 6px; white-space: nowrap; height: 35px; display: flex; align-items: center; justify-content: center;">
                                            이동
                                        </button>
                                    </div>
                                </div>
                            `;
                        }
                    });
                    listHtml += '</div>';
                }
                
                hubHtml += `
                    <div class="cbt-hub-card glass-card" style="padding: 24px; border-radius: 12px; display: flex; flex-direction: column; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06);">
                        <h3 style="font-size: 16px; font-weight: bold; color: #fff; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;">
                            <i class="${cat.icon}" style="color: ${cat.color}; font-size: 18px;"></i> ${cat.title}
                        </h3>
                        ${listHtml}
                    </div>
                `;
            }
            hubContainer.innerHTML = hubHtml;
        }
        
        if (packs.length > 0) {
            const activePack = localStorage.getItem('active_study_pack') || packs[0].id;
            if (sidebarSelect) sidebarSelect.value = activePack;
            if (select) select.value = activePack;
            await changeStudyPack(activePack);
        }
    } catch(err) {
        console.error("Failed to load study packs:", err);
    }
}

async function changeStudyPack(packName) {
    localStorage.setItem('active_study_pack', packName);
    
    const select = document.getElementById('study-pack-select');
    const sidebarSelect = document.getElementById('sidebar-study-pack-select');
    if (select) select.value = packName;
    if (sidebarSelect) sidebarSelect.value = packName;
    
    syncActiveSubMenu(packName);
    
    let newPersona = '자격증';
    let newWorry = '식물보호기사 필기 합격';
    
    if (packName === 'tree_doctor_past') {
        newPersona = '자격증';
        newWorry = '나무의사 자격시험 합격';
    } else if (packName === 'plant_protection') {
        newPersona = '자격증';
        newWorry = '식물보호기사 필기 합격';
    } else if (packName === 'driver_license') {
        newPersona = '자격증';
        newWorry = '운전면허 필기시험 합격';
    } else if (packName === 'pilot_license') {
        newPersona = '자격증';
        newWorry = '조종면허 필기시험 합격';
    }
    
    try {
        const studentTitle = (state.studentProfile && state.studentProfile.student_title) ? state.studentProfile.student_title : '대표님';
        await fetch('/api/student/reset', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_id: state.activeStudentId,
                student_title: studentTitle,
                persona_type: newPersona,
                user_worry: newWorry
            })
        });
        
        if (state.studentProfile) {
            state.studentProfile.persona_type = newPersona;
            state.studentProfile.user_worry = newWorry;
        }
        localStorage.setItem('zeni_persona_type', newPersona);
        localStorage.setItem('zeni_user_worry', newWorry);
        
        await fetchStudentProfile();
        
    } catch(err) {
        console.error("Failed to sync tutor persona on pack change:", err);
    }
    
    try {
        const response = await fetch(`/api/tutor/cbt-questions?pack_name=${packName}`);
        let questions = await response.json();
        state.allPackQuestions = questions;
        
        showCbtSelectionScreen(packName);
        
    } catch(err) {
        console.error("Error changing study pack: ", err);
    }
}

function applyCbtFilters(resetRound = true, resetSubject = true) {
    const qMode = localStorage.getItem('active_question_mode') || 'all';
    const modeSelect = document.getElementById('question-mode-select');
    if (modeSelect) modeSelect.value = qMode;
    
    let modeQuestions = [];
    if (qMode === 'past') {
        modeQuestions = state.allPackQuestions.filter(q => q.round && q.round.includes('기출') && !q.round.includes('AI'));
        if (modeQuestions.length === 0) {
            modeQuestions = state.allPackQuestions;
        }
    } else if (qMode === 'ai') {
        modeQuestions = state.allPackQuestions.filter(q => q.round && (q.round.includes('AI') || q.round.includes('예측') || q.round.includes('예상')));
    } else {
        modeQuestions = state.allPackQuestions;
    }
    
    const roundSelect = document.getElementById('round-filter-select');
    const prevRound = roundSelect ? roundSelect.value : '전체';
    
    if (roundSelect) {
        const roundsSet = new Set();
        modeQuestions.forEach(q => {
            if (q.round) roundsSet.add(q.round);
        });
        
        const sortedRounds = Array.from(roundsSet).sort((a, b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, ''), 10);
            const numB = parseInt(b.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.localeCompare(b);
        });
        
        roundSelect.innerHTML = `<option value="전체">전체 회차</option>`;
        sortedRounds.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.innerText = r;
            roundSelect.appendChild(opt);
        });
        
        if (resetRound) {
            roundSelect.value = '전체';
        } else {
            if (sortedRounds.includes(prevRound)) {
                roundSelect.value = prevRound;
            } else {
                roundSelect.value = '전체';
            }
        }
    }
    
    const selectedRound = roundSelect ? roundSelect.value : '전체';
    let roundQuestions = modeQuestions;
    if (selectedRound !== '전체') {
        roundQuestions = modeQuestions.filter(q => q.round === selectedRound);
    }
    
    state.cbtQuestions = roundQuestions;
    
    const subjectSelect = document.getElementById('subject-filter-select');
    const prevSubject = subjectSelect ? subjectSelect.value : '전체';
    
    if (subjectSelect) {
        const subjects = new Set(["전체"]);
        state.cbtQuestions.forEach(q => {
            if (q.subject) subjects.add(q.subject);
        });
        
        subjectSelect.innerHTML = "";
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.innerText = s;
            subjectSelect.appendChild(opt);
        });
        
        if (resetSubject) {
            subjectSelect.value = '전체';
        } else {
            if (subjects.has(prevSubject)) {
                subjectSelect.value = prevSubject;
            } else {
                subjectSelect.value = '전체';
            }
        }
    }
    
    state.currentCbtIndex = 0;
    state.userCbtAnswers = {};
    state.cbtSolvedFeedbacks = {};
    
    const feedbackCard = document.getElementById('cbt-feedback-card');
    if (feedbackCard) feedbackCard.style.display = 'none';
    
    generateOmrBubbles();
    renderCbtQuestion();
}

function showCbtSelectionScreen(packName = null) {
    if (!packName) {
        const select = document.getElementById('study-pack-select');
        packName = select ? select.value : 'tree_doctor_past';
    }

    const workspace = document.getElementById('cbt-questions-workspace');
    if (workspace) workspace.style.display = 'none';

    const selectionScreen = document.getElementById('cbt-selection-screen');
    if (selectionScreen) selectionScreen.style.display = 'block';

    const modeSelect = document.getElementById('question-mode-select');
    const roundSelect = document.getElementById('round-filter-select');
    const subjectSelect = document.getElementById('subject-filter-select');
    const omrToggle = document.querySelector('.mobile-omr-toggle');
    const backBtn = document.getElementById('btn-back-to-selection');

    if (modeSelect) modeSelect.style.display = 'none';
    if (roundSelect) roundSelect.style.display = 'none';
    if (subjectSelect) subjectSelect.style.display = 'none';
    if (omrToggle) omrToggle.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';

    const badge = document.getElementById('cbt-selection-pack-badge');
    if (badge) {
        const studyPackSelect = document.getElementById('study-pack-select');
        const packText = studyPackSelect && studyPackSelect.selectedIndex >= 0 
            ? studyPackSelect.options[studyPackSelect.selectedIndex].text 
            : getShortPackName(packName, packName);
        badge.innerText = packText;
    }

    const hasAiQuestions = state.allPackQuestions.some(q => 
        q.round && (q.round.includes('AI') || q.round.includes('예측') || q.round.includes('예상'))
    );

    const aiCard = document.getElementById('mode-card-ai');
    if (aiCard) {
        if (hasAiQuestions) {
            aiCard.classList.remove('disabled');
            aiCard.style.pointerEvents = 'auto';
            aiCard.querySelector('p').innerText = "AI 튜터가 출제 확률이 가장 높은 핵심 패턴을 분석하여 생성한 특화 모의고사 세트입니다.";
        } else {
            aiCard.classList.add('disabled');
            aiCard.style.pointerEvents = 'none';
            aiCard.querySelector('p').innerText = "이 패키지에는 AI 예상문제가 준비되어 있지 않습니다. (준비 중)";
        }
    }

    let initialMode = localStorage.getItem('active_question_mode') || 'past';
    if (initialMode === 'all') initialMode = 'past';
    if (initialMode === 'ai' && !hasAiQuestions) {
        initialMode = 'past';
    }

    selectCbtIntroMode(initialMode);
}

function selectCbtIntroMode(mode) {
    state.selectedIntroMode = mode;
    
    const pastCard = document.getElementById('mode-card-past');
    const aiCard = document.getElementById('mode-card-ai');
    
    if (mode === 'past') {
        if (pastCard) pastCard.className = "mode-selection-card active";
        if (aiCard) aiCard.className = "mode-selection-card" + (aiCard.classList.contains('disabled') ? " disabled" : "");
        if (pastCard) {
            const indPast = pastCard.querySelector('.active-indicator');
            if (indPast) indPast.style.display = 'block';
        }
        if (aiCard) {
            const indAi = aiCard.querySelector('.active-indicator');
            if (indAi) indAi.style.display = 'none';
        }
    } else {
        if (pastCard) pastCard.className = "mode-selection-card";
        if (aiCard) aiCard.className = "mode-selection-card active active-ai";
        if (pastCard) {
            const indPast = pastCard.querySelector('.active-indicator');
            if (indPast) indPast.style.display = 'none';
        }
        if (aiCard) {
            const indAi = aiCard.querySelector('.active-indicator');
            if (indAi) indAi.style.display = 'block';
        }
    }

    populateIntroRounds(mode);
}

function populateIntroRounds(mode) {
    let modeQuestions = [];
    if (mode === 'past') {
        modeQuestions = state.allPackQuestions.filter(q => q.round && q.round.includes('기출') && !q.round.includes('AI'));
        if (modeQuestions.length === 0) {
            modeQuestions = state.allPackQuestions;
        }
    } else if (mode === 'ai') {
        modeQuestions = state.allPackQuestions.filter(q => q.round && (q.round.includes('AI') || q.round.includes('예측') || q.round.includes('예상')));
    } else {
        modeQuestions = state.allPackQuestions;
    }

    const roundsSet = new Set();
    modeQuestions.forEach(q => {
        if (q.round) roundsSet.add(q.round);
    });

    const sortedRounds = Array.from(roundsSet).sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ''), 10);
        const numB = parseInt(b.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return a.localeCompare(b);
    });

    const roundGrid = document.getElementById('cbt-selection-round-grid');
    if (!roundGrid) return;

    roundGrid.innerHTML = "";

    const allOpt = document.createElement('div');
    allOpt.className = "cbt-round-pill active" + (mode === 'ai' ? " active-ai" : "");
    allOpt.innerText = "전체 회차";
    allOpt.setAttribute('data-round', '전체');
    allOpt.onclick = () => selectIntroRound('전체');
    roundGrid.appendChild(allOpt);

    state.selectedIntroRound = '전체';

    sortedRounds.forEach(r => {
        const opt = document.createElement('div');
        opt.className = "cbt-round-pill";
        opt.innerText = r;
        opt.setAttribute('data-round', r);
        opt.onclick = () => selectIntroRound(r);
        roundGrid.appendChild(opt);
    });
}

function selectIntroRound(roundName) {
    state.selectedIntroRound = roundName;

    const pills = document.querySelectorAll('#cbt-selection-round-grid .cbt-round-pill');
    pills.forEach(p => {
        p.classList.remove('active');
        p.classList.remove('active-ai');
    });

    pills.forEach(p => {
        if (p.getAttribute('data-round') === roundName) {
            p.classList.add('active');
            if (state.selectedIntroMode === 'ai') {
                p.classList.add('active-ai');
            }
        }
    });
}

function startCbtFromSelection() {
    localStorage.setItem('active_question_mode', state.selectedIntroMode);

    const modeSelect = document.getElementById('question-mode-select');
    if (modeSelect) modeSelect.value = state.selectedIntroMode;

    applyCbtFilters(false, true);

    const roundSelect = document.getElementById('round-filter-select');
    if (roundSelect) {
        const options = Array.from(roundSelect.options).map(o => o.value);
        if (options.includes(state.selectedIntroRound)) {
            roundSelect.value = state.selectedIntroRound;
        } else {
            roundSelect.value = '전체';
        }
    }

    applyCbtFilters(false, false);

    const selectionScreen = document.getElementById('cbt-selection-screen');
    if (selectionScreen) selectionScreen.style.display = 'none';

    const workspace = document.getElementById('cbt-questions-workspace');
    if (workspace) workspace.style.display = 'flex';

    const modeSelectEl = document.getElementById('question-mode-select');
    const roundSelectEl = document.getElementById('round-filter-select');
    const subjectSelectEl = document.getElementById('subject-filter-select');
    const omrToggle = document.querySelector('.mobile-omr-toggle');
    const backBtn = document.getElementById('btn-back-to-selection');

    if (modeSelectEl) modeSelectEl.style.display = 'block';
    if (roundSelectEl) roundSelectEl.style.display = 'block';
    if (subjectSelectEl) subjectSelectEl.style.display = 'block';
    if (omrToggle) omrToggle.style.display = 'flex';
    if (backBtn) backBtn.style.display = 'flex';
}

function getShortPackName(id, fullName) {
    const idLower = id.toLowerCase();
    
    // Extract suffix if present (e.g. " - 농약학" or " - 2019-04-27 기출")
    let suffix = "";
    const dashIdx = fullName.indexOf(" - ");
    if (dashIdx !== -1) {
        suffix = fullName.substring(dashIdx).trim(); // Keeps the " - Suffix" part
    }
    
    if (idLower.includes("tree_doctor")) return "🌳 나무의사" + (suffix || " 기출 팩");
    if (idLower.includes("plant_protection")) return "🌿 식물보호" + (suffix || " 기출 팩");
    if (idLower.includes("driver")) return "🚗 운전면허" + (suffix || " 필기대비");
    if (idLower.includes("pilot")) return "✈️ 조종면허" + (suffix || " 필기대비");
    
    if (idLower.includes("gas")) return "🔥 가스 기능사 팩" + suffix;
    if (idLower.includes("forest")) return "🌲 산림 기능사 팩" + suffix;
    if (idLower.includes("electric")) return "⚡ 전기 기능사 팩" + suffix;
    if (idLower.includes("landscape") && !idLower.includes("landscape_industrial")) return "🌿 조경 기능사 팩" + suffix;
    
    if (idLower.includes("dangerous")) return "🔥 위험물기능사" + (suffix || " 기출 팩");
    if (idLower.includes("comlit_1")) return "💻 컴활 1급" + (suffix || " 기출 팩");
    if (idLower.includes("comlit_2")) return "💻 컴활 2급" + (suffix || " 기출 팩");
    if (idLower.includes("wordprocessor")) return "📝 워드프로세서" + (suffix || " 기출 팩");
    if (idLower.includes("korean_cook")) return "🍳 한식조리" + (suffix || " 기출 팩");
    if (idLower.includes("confectionery")) return "🥐 제과기능사" + (suffix || " 기출 팩");
    if (idLower.includes("bakery")) return "🍞 제빵기능사" + (suffix || " 기출 팩");
    if (idLower.includes("hairdresser")) return "💇 미용사(일반)" + (suffix || " 기출 팩");
    
    if (idLower.includes("infopro_engineer") || idLower === "infopro_engineer") return "💾 정보처리기사" + (suffix || " 기출 팩");
    if (idLower.includes("indus_safety")) return "🛡️ 산업안전기사" + (suffix || " 기출 팩");
    if (idLower.includes("realtor_1")) return "🏠 공인중개사 1차" + (suffix || " 기출 팩");
    if (idLower.includes("realtor_2")) return "🏠 공인중개사 2차" + (suffix || " 기출 팩");
    
    if (idLower.includes("forklift")) return "🚜 지게차운전기능사" + (suffix || " 기출 팩");
    if (idLower.includes("excavator")) return "🏗️ 굴착기운전기능사" + (suffix || " 기출 팩");
    if (idLower.includes("landscape_industrial")) return "🌿 조경산업기사" + (suffix || " 기출 팩");
    if (idLower.includes("office_automation")) return "💻 사무자동화산업기사" + (suffix || " 기출 팩");
    if (idLower.includes("korean_history")) return "🇰🇷 한국사능력검정" + (suffix || " 기출 팩");
    
    if (idLower.includes("computer_graphics")) return "🎨 컴퓨터그래픽스" + (suffix || " 기출 팩");
    if (idLower.includes("web_design")) return "🌐 웹디자인기능사" + (suffix || " 기출 팩");
    if (idLower.includes("infosec_engineer")) return "🔒 정보보안기사" + (suffix || " 기출 팩");
    if (idLower.includes("fire_fighting_electric")) return "🚒 소방설비기사(전기)" + (suffix || " 기출 팩");
    if (idLower.includes("jisung_craftsman")) return "🗺️ 지적기능사" + (suffix || " 기출 팩");
    if (idLower.includes("social_worker_1")) return "🤝 사회복지사 1급" + (suffix || " 기출 팩");
    if (idLower.includes("barista_2")) return "☕ 바리스타 2급" + (suffix || " 기출 팩");
    if (idLower.includes("network_admin_2")) return "🖥️ 네트워크관리사 2급" + (suffix || " 기출 팩");
    if (idLower.includes("housing_manager_1")) return "🏢 주택관리사 1차" + (suffix || " 기출 팩");
    if (idLower.includes("fat_1")) return "📊 FAT 1급" + (suffix || " 기출 팩");
    
    return fullName;
}

function triggerAmuletPayment() {
    const btn = document.querySelector('.scarcity-amulet-box button');
    if (!btn) return;
    btn.disabled = true;
    btn.innerText = "기세를 부적에 담는 중...";
    
    setTimeout(() => {
        btn.innerText = "부적 발급 성공! (소장 완료)";
        btn.style.background = "var(--success)";
        btn.style.color = "#fff";
        btn.style.borderColor = "var(--success)";
        
        alert("평행세계 자아의 인장이 현실 부적으로 발급되었습니다. 동조 기운이 후배님의 휴대폰 안으로 깃들 것입니다.");
    }, 1500);
}

// Bind all imports and definitions to window for HTML compatibility
window.initApp = initApp;
window.switchTab = switchTab;
window.loadStudyPacks = loadStudyPacks;
window.changeStudyPack = changeStudyPack;
window.applyCbtFilters = applyCbtFilters;
window.showCbtSelectionScreen = showCbtSelectionScreen;
window.selectCbtIntroMode = selectCbtIntroMode;
window.populateIntroRounds = populateIntroRounds;
window.selectIntroRound = selectIntroRound;
window.startCbtFromSelection = startCbtFromSelection;
window.triggerAmuletPayment = triggerAmuletPayment;

window.initAwakeningView = initAwakeningView;
window.initRuneCanvas = initRuneCanvas;
window.drawRuneGuide = drawRuneGuide;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.saveProfileTitle = saveProfileTitle;
window.connectPastLifeConnection = connectPastLifeConnection;
window.startTypewriterNarrative = startTypewriterNarrative;
window.extractPastLifeName = extractPastLifeName;
window.getPersonaDates = getPersonaDates;
window.formatPastLifeStoryForCard = formatPastLifeStoryForCard;

window.filterCbtQuestions = filterCbtQuestions;
window.renderCbtQuestion = renderCbtQuestion;
window.selectCbtChoice = selectCbtChoice;
window.prevCbtQuestion = prevCbtQuestion;
window.nextCbtQuestion = nextCbtQuestion;
window.generateOmrBubbles = generateOmrBubbles;
window.updateOmrProgress = updateOmrProgress;
window.toggleMobileOmr = toggleMobileOmr;
window.submitCbtAnswer = submitCbtAnswer;
window.gradeCbtExam = gradeCbtExam;
window.closeCbtReportModal = closeCbtReportModal;
window.triggerAmuletFromReport = triggerAmuletFromReport;

window.fetchStudentProfile = fetchStudentProfile;
window.switchMember = switchMember;
window.openNewMemberModal = openNewMemberModal;
window.closeNewMemberModal = closeNewMemberModal;
window.submitNewMember = submitNewMember;
window.loadMembersDropdown = loadMembersDropdown;
window.loadDashboardPushes = loadDashboardPushes;
window.handlePhotoUpload = handlePhotoUpload;
window.severPastLifeConnection = severPastLifeConnection;

function toggleCrtEffect(isActive) {
    if (isActive) {
        document.body.classList.add('crt-effect-active');
        localStorage.setItem('zeni_crt_effect', 'enabled');
    } else {
        document.body.classList.remove('crt-effect-active');
        localStorage.setItem('zeni_crt_effect', 'disabled');
    }
}
window.toggleCrtEffect = toggleCrtEffect;

window.toggleIncense = toggleIncense;
window.extinguishIncense = extinguishIncense;
window.checkChatAvailability = checkChatAvailability;
window.handleChatSubmit = handleChatSubmit;
window.triggerLanternPayment = triggerLanternPayment;
window.toggleMiniMeditation = toggleMiniMeditation;
window.toggleMainMeditation = toggleMainMeditation;
window.startBgm = startBgm;
window.stopBgm = stopBgm;
window.speakGuidance = speakGuidance;

window.loadAdminDashboard = loadAdminDashboard;
window.executeAdminAction = executeAdminAction;
window.fetchLibraryPacks = fetchLibraryPacks;
window.renderLibraryCards = renderLibraryCards;
window.filterLibraryCategory = filterLibraryCategory;
window.filterLibrarySearch = filterLibrarySearch;
window.activatePackFromLibrary = activatePackFromLibrary;
window.showPackDetail = showPackDetail;
window.closePackDetailModal = closePackDetailModal;

window.initWrongNotesView = initWrongNotesView;
window.renderWrongNotes = renderWrongNotes;
window.filterWrongNotesBySubject = filterWrongNotesBySubject;
window.toggleWrongNotesPrescription = toggleWrongNotesPrescription;
window.openTwinQuestionModal = openTwinQuestionModal;
window.closeTwinQuestionModal = closeTwinQuestionModal;
window.submitTwinChoice = submitTwinChoice;
window.initRemedialView = initRemedialView;
window.solveRemedialQuestion = solveRemedialQuestion;
window.toggleCategory = toggleCategory;
window.selectSubMenu = selectSubMenu;
window.syncActiveSubMenu = syncActiveSubMenu;
window.switchImporterTab = switchImporterTab;
window.handleImportFileSelect = handleImportFileSelect;
window.submitImportOrScrape = submitImportOrScrape;
window.renderTalismanArchive = renderTalismanArchive;
window.downloadTalismanCard = downloadTalismanCard;
window.downloadTalismanFromModal = downloadTalismanFromModal;
window.closeTalismanSuccessModal = closeTalismanSuccessModal;

export {
    initApp,
    switchTab,
    loadStudyPacks,
    changeStudyPack,
    applyCbtFilters,
    showCbtSelectionScreen,
    selectCbtIntroMode,
    populateIntroRounds,
    selectIntroRound,
    startCbtFromSelection,
    triggerAmuletPayment,

    initAwakeningView,
    initRuneCanvas,
    drawRuneGuide,
    openProfileModal,
    closeProfileModal,
    saveProfileTitle,
    connectPastLifeConnection,
    startTypewriterNarrative,
    extractPastLifeName,
    getPersonaDates,
    formatPastLifeStoryForCard,

    filterCbtQuestions,
    renderCbtQuestion,
    selectCbtChoice,
    prevCbtQuestion,
    nextCbtQuestion,
    generateOmrBubbles,
    updateOmrProgress,
    toggleMobileOmr,
    submitCbtAnswer,
    gradeCbtExam,
    closeCbtReportModal,
    triggerAmuletFromReport,

    fetchStudentProfile,
    switchMember,
    openNewMemberModal,
    closeNewMemberModal,
    submitNewMember,
    loadMembersDropdown,
    loadDashboardPushes,
    handlePhotoUpload,
    severPastLifeConnection,
    renderTalismanArchive,
    downloadTalismanCard,
    downloadTalismanFromModal,
    closeTalismanSuccessModal,

    toggleIncense,
    extinguishIncense,
    checkChatAvailability,
    handleChatSubmit,
    triggerLanternPayment,
    toggleMiniMeditation,
    toggleMainMeditation,
    startBgm,
    stopBgm,
    speakGuidance,

    loadAdminDashboard,
    executeAdminAction,
    fetchLibraryPacks,
    renderLibraryCards,
    filterLibraryCategory,
    filterLibrarySearch,
    activatePackFromLibrary,
    showPackDetail,
    closePackDetailModal,
    switchImporterTab,
    handleImportFileSelect,
    submitImportOrScrape,
    toggleCrtEffect,

    initWrongNotesView,
    renderWrongNotes,
    filterWrongNotesBySubject,
    toggleWrongNotesPrescription,
    openTwinQuestionModal,
    closeTwinQuestionModal,
    submitTwinChoice,
    initRemedialView,
    solveRemedialQuestion,
    toggleCategory,
    selectSubMenu,
    syncActiveSubMenu
};

