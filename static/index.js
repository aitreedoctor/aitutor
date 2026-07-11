// Main Orchestrator & Bootloader (ES6 Module Entrypoint)

import { state } from './modules/Config.js?v=3.5.0';
import { 
    safeMarkedParse, 
    translateScientificNames, 
    formatQuestionText, 
    postProcessMarkdownHTML, 
    showFloatingCoinToast 
} from './modules/Utils.js?v=3.5.0';
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
} from './modules/IntroManager.js?v=3.5.0';
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
} from './modules/CbtManager.js?v=3.5.0';
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
    renderTeacherPostcardsArchive,
    downloadTalismanCard,
    downloadTalismanFromModal,
    closeTalismanSuccessModal
} from './modules/Dashboard.js?v=3.5.0';
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
} from './modules/Chat.js?v=3.5.0';
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
} from './modules/Admin.js?v=3.5.2';
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
} from './modules/WrongNotesManager.js?v=3.5.4';

import {
    startPedigreeCourse,
    renderPedigreeQuestion,
    selectPedigreeChoice,
    nextPedigreeQuestion,
    toggleSummaryCheatSheet
} from './modules/PedigreeManager.js?v=3.5.0';

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

    // Force disable CRT effect (feature removed)
    try {
        document.body.classList.remove('crt-effect-active');
        localStorage.removeItem('zeni_crt_effect');
    } catch(e) {
        console.error("Failed clearing CRT state:", e);
    }
    
    // Sync postcard selection & archive on startup
    try {
        selectTalisman('hoboo');
        renderTeacherPostcardsArchive();
    } catch(e) {
        console.error("Failed syncing postcards on init:", e);
    }
}

function toggleProfileDropdown(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const dropdown = document.getElementById('profile-menu-dropdown');
    if (dropdown) {
        const isHidden = dropdown.style.display === 'none';
        dropdown.style.display = isHidden ? 'block' : 'none';
    }
}

function handleDropdownAction(action, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    // Close dropdown
    const dropdown = document.getElementById('profile-menu-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    
    if (action === 'dashboard') {
        switchTab('dashboard');
    } else if (action === 'profile') {
        openProfileModal();
    } else if (action === 'reset') {
        if (confirm("학습 데이터와 기록을 초기화하시겠습니까? 초기화된 데이터는 복구할 수 없습니다.")) {
            resetStudentData();
        }
    }
}

async function resetStudentData() {
    try {
        const studentId = state.studentProfile ? state.studentProfile.student_id : "web_student_user";
        const res = await fetch('/api/student/reset', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_id: studentId,
                student_title: '대표님',
                persona_type: '약초꾼',
                user_worry: '시험 합격 및 진로 고민',
                active_study_pack: 'tree_doctor_past'
            })
        });
        if (res.ok) {
            localStorage.removeItem('zeni_awakened');
            localStorage.removeItem('zeni_user_photo');
            localStorage.removeItem('zeni_chat_count');
            localStorage.removeItem('zeni_past_story');
            localStorage.removeItem('zeni_student_title');
            localStorage.removeItem('zeni_persona_type');
            localStorage.removeItem('zeni_user_worry');
            
            alert("학습 데이터와 세션이 성공적으로 초기화되었습니다.");
            location.reload();
        } else {
            alert("초기화 실패했습니다.");
        }
    } catch (e) {
        console.error("Reset failed:", e);
        alert("초기화 처리 중 오류가 발생했습니다.");
    }
}

window.toggleProfileDropdown = toggleProfileDropdown;
window.handleDropdownAction = handleDropdownAction;

function triggerAdminMode() {
    const password = prompt("관리자 인증 비밀번호를 입력하십시오:");
    if (password === "tutor7688") {
        alert("관리자 권한이 인증되었습니다.");
        switchTab('admin');
    } else if (password !== null) {
        alert("비밀번호가 올바르지 않습니다.");
        if (window.location.hash === '#admin') {
            window.location.hash = '';
        }
    }
}

function checkHashRoute() {
    if (window.location.hash === '#admin') {
        window.location.hash = '';
        triggerAdminMode();
    }
}

window.triggerAdminMode = triggerAdminMode;
window.checkHashRoute = checkHashRoute;

function setupEventListeners() {
    // Listen for hash change and page load to detect secret admin route
    window.addEventListener('hashchange', checkHashRoute);
    checkHashRoute();

    // Tab switching
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.tabListenerAttached) return;
        item.dataset.tabListenerAttached = 'true';
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Profile Settings
    const btnMobileEdit = document.getElementById('btn-mobile-edit-profile');
    if (btnMobileEdit) {
        btnMobileEdit.addEventListener('click', openProfileModal);
    }
    
    // Click profile card to switch to dashboard
    const profileWidget = document.querySelector('.student-profile-widget');
    if (profileWidget && !profileWidget.dataset.clickAttached) {
        profileWidget.dataset.clickAttached = 'true';
        profileWidget.addEventListener('click', (e) => {
            if (e.target.closest('#btn-edit-profile') || e.target.closest('#profile-menu-dropdown')) {
                return;
            }
            switchTab('dashboard');
        });
    }

    // Close profile dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('profile-menu-dropdown');
        if (dropdown && dropdown.style.display === 'block') {
            if (!dropdown.contains(e.target) && !e.target.closest('.student-profile-widget')) {
                dropdown.style.display = 'none';
            }
        }
    });
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
    
    // Pedigree Event Listeners
    const btnCheatSheet = document.getElementById('pedigree-cheatsheet-btn');
    if (btnCheatSheet) {
        btnCheatSheet.addEventListener('click', toggleSummaryCheatSheet);
    }
    const btnCheatSheetClose = document.getElementById('pedigree-cheatsheet-close');
    if (btnCheatSheetClose) {
        btnCheatSheetClose.addEventListener('click', toggleSummaryCheatSheet);
    }
    const btnPedigreeNext = document.getElementById('pedigree-next-btn');
    if (btnPedigreeNext) {
        btnPedigreeNext.addEventListener('click', nextPedigreeQuestion);
    }
}

function switchTab(tabId) {
    if (tabId === 'pedigree') {
        const purchased = state.studentProfile ? (state.studentProfile.purchased_pedigrees || []) : [];
        let roundName = "";
        if (state.cbtQuestions && state.cbtQuestions.length > 0) {
            roundName = state.cbtQuestions[0].round;
        }
        if (!roundName) {
            roundName = "tree_doctor_past";
        }
        
        if (!purchased.includes(roundName)) {
            openPedigreePurchaseModal(roundName);
            return;
        }
    }
    state.currentTab = tabId;

    // Toggle active state for profile widget when dashboard is active
    const profileWidget = document.querySelector('.student-profile-widget');
    if (profileWidget) {
        if (tabId === 'dashboard') {
            profileWidget.classList.add('active');
        } else {
            profileWidget.classList.remove('active');
        }
    }
    
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
    if (tabId === 'subjective') {
        loadSubjectivePacks();
    } else if (tabId === 'dashboard') {
        fetchStudentProfile();
        loadDashboardPushes();
    } else if (tabId === 'library') {
        fetchLibraryPacks();
    } else if (tabId === 'chat') {
        checkChatAvailability();
    } else if (tabId === 'flashcards') {
        switchStudyRoomSubTab('cards');
    } else if (tabId === 'cbt') {
        if (state.cbtQuestions && state.cbtQuestions.length > 0) {
            const workspace = document.getElementById('cbt-questions-workspace');
            if (workspace) workspace.style.display = 'flex';
            
            const selectionScreen = document.getElementById('cbt-selection-screen');
            if (selectionScreen) selectionScreen.style.display = 'none';
            
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
        } else {
            loadStudyPacks();
        }
    } else if (tabId === 'wrong-notes') {
        initWrongNotesView();
    } else if (tabId === 'admin') {
        loadAdminDashboard();
    } else if (tabId === 'cbt-hub') {
        loadStudyPacks();
    }
    
    updateSidebarResumeButton();
}

function switchStudyRoomSubTab(subTabId) {
    const cardsSection = document.getElementById('studyroom-section-cards');
    const remedialSection = document.getElementById('studyroom-section-remedial');
    const twinSection = document.getElementById('studyroom-section-twin');
    
    if (cardsSection) cardsSection.style.display = 'none';
    if (remedialSection) remedialSection.style.display = 'none';
    if (twinSection) twinSection.style.display = 'none';
    
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'rgba(255,255,255,0.03)';
        btn.style.borderColor = 'rgba(255,255,255,0.1)';
        btn.style.color = '#cbd5e1';
    });
    
    const activeBtn = document.getElementById(`studyroom-tab-btn-${subTabId}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'rgba(212,175,55,0.15)';
        activeBtn.style.borderColor = 'var(--primary)';
        activeBtn.style.color = 'var(--primary)';
    }
    
    if (subTabId === 'cards') {
        if (cardsSection) cardsSection.style.display = 'block';
        loadFlashcards();
    } else if (subTabId === 'remedial') {
        if (remedialSection) remedialSection.style.display = 'block';
        initRemedialView();
    } else if (subTabId === 'twin') {
        if (twinSection) twinSection.style.display = 'block';
        if (window.initTwinSessionWorkspace) {
            window.initTwinSessionWorkspace();
        }
    }
}

window.switchStudyRoomSubTab = switchStudyRoomSubTab;

export function updateSidebarResumeButton() {
    const btn = document.getElementById('sidebar-resume-btn');
    if (!btn) return;
    
    const hasActiveQuestions = state.cbtQuestions && state.cbtQuestions.length > 0;
    const hasStarted = Object.keys(state.userCbtAnswers || {}).length > 0;
    
    const workspace = document.getElementById('cbt-questions-workspace');
    const isSolving = workspace && workspace.style.display === 'flex' && state.currentTab === 'cbt';
    
    if (hasActiveQuestions && hasStarted && !isSolving) {
        btn.style.display = 'flex';
    } else {
        btn.style.display = 'none';
    }
}

// Helper to strip emojis for strictly alphabetical Korean sorting
function getCleanNameForSorting(name) {
    if (!name) return "";
    const trimmed = name.trim();
    if (/^[가-힣a-zA-Z0-9]/.test(trimmed)) {
        return trimmed;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
        return parts.slice(1).join(" ");
    }
    return trimmed;
}

async function loadStudyPacks() {
    try {
        const response = await fetch('/api/tutor/packs');
        const packs = await response.json();
        window.studyPacks = packs || [];
        
        const select = document.getElementById('study-pack-select');
        const sidebarSelect = document.getElementById('sidebar-study-pack-select');
        
        const activePack = localStorage.getItem('active_study_pack') || 'tree_doctor_past';
        const featuredPacks = [
            { id: 'tree_doctor_past', name: '🌳 나무의사 2차 실기 필답형' },
            { id: 'plant_protection_subjective', name: '🌿 식물보호기사 실기 필답형' },
            { id: 'landscape_engineer_subjective', name: '🌸 조경기사 실기 필답형' },
            { id: 'forest_engineer_subjective', name: '🌲 산림기사 실기 필답형' },
            { id: 'infotech_engineer_subjective', name: '💻 정보처리기사 실기 필답형' },
            { id: 'electricity_engineer_subjective_crawled', name: '⚡ 전기기사 실기 필답형' },
            { id: 'hazardous_materials_industrial_subjective_crawled', name: '⚠️ 위험물산업기사 실기 필답형' },
            { id: 'clinical_psychologist_subjective_crawled', name: '🧠 임상심리사 2급 실기 필답형' },
            { id: 'vocational_counselor_subjective_crawled', name: '💼 직업상담사 2급 실기 필답형' },
            { id: 'industrial_safety_engineer_subjective_crawled', name: '🛡️ 산업안전기사 실기 필답형' },
            { id: 'industrial_safety_industrial_subjective_crawled', name: '🛡️ 산업안전산업기사 실기 필답형' }
        ];

        let activePackObj = packs.find(p => p.id === activePack);
        let selectOptions = [...featuredPacks];
        if (activePackObj && !featuredPacks.some(fp => fp.id === activePack)) {
            selectOptions.push({ id: activePackObj.id, name: activePackObj.name });
        }

        [select, sidebarSelect].forEach(sel => {
            if (sel) {
                sel.innerHTML = "";
                selectOptions.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.innerText = getShortPackName(p.id, p.name);
                    sel.appendChild(opt);
                });
                sel.value = activePack;
            }
        });
        
        // Render CBT Selection Hub Grid Dynamically
        const hubContainer = document.getElementById('cbt-hub-grid-container');
        if (hubContainer) {
            const categories = {
                craftsman: { title: "기능사", icon: "xi-branch", color: "var(--primary)", list: [] },
                industrial: { title: "산업기사", icon: "xi-bookmark-o", color: "#60a5fa", list: [] },
                engineer: { title: "기사", icon: "xi-bookmark-o", color: "#c084fc", list: [] },
                master: { title: "기능장", icon: "xi-fire", color: "#ff5252", list: [] },
                office: { title: "IT/사무/회계", icon: "xi-desktop", color: "#38bdf8", list: [] },
                public: { title: "공무원", icon: "xi-building", color: "#f43f5e", list: [] },
                national: { title: "전문국가자격증", icon: "xi-crown", color: "#fb923c", list: [] }
            };
            
            // Group packs by parent category prefix
            const groupedMap = {};
            
            // Build a set of all base pack IDs (master packs)
            const basePackIds = new Set();
            packs.forEach(p => {
                // If it is a clean pack ID (no underscores followed by round or subject details)
                if (!p.name.includes(" - ") && !p.id.includes("_기출") && !p.id.includes("_20") && !p.id.includes("_19")) {
                    basePackIds.add(p.id);
                }
            });
            
            // Map pack ID to its clean name
            const packNamesMap = {};
            packs.forEach(p => {
                packNamesMap[p.id] = p.name;
            });
            
            packs.forEach(p => {
                if (p.id === 'verification_test' || p.id.startsWith('verification')) {
                    return; // Skip developer internal verification test pack
                }
                let groupKey = p.id;
                let baseName = p.name;
                
                // Find matching base pack ID by finding the longest matching prefix
                let parts = p.id.split("_");
                for (let i = parts.length; i > 0; i--) {
                    let prefix = parts.slice(0, i).join("_");
                    if (basePackIds.has(prefix)) {
                        groupKey = prefix;
                        break;
                    }
                }
                
                // Fetch name of the base pack, or construct a pretty fallback
                // Fetch name of the base pack, or construct a pretty fallback
                if (packNamesMap[groupKey]) {
                    baseName = packNamesMap[groupKey];
                } else {
                    baseName = getShortPackName(groupKey, p.name);
                }
                
                // Clean hyphens to spaces and format baseName uniformly for clean merge
                baseName = baseName.replace(/-/g, ' ');
                baseName = baseName.replace(/\s*\([^)]*\)$/, '').trim();
                baseName = baseName.replace(/\s*기출(?:\s*문제)?(?:\s*팩)?$/, '').trim();
                baseName = baseName + " 기출 팩";
                
                // Clean any pre-existing emojis to prevent double emoji redundancy
                baseName = baseName.replace(/^[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]\s*/g, '');
                
                // Prepend matching emojis for elegant UI branding
                let emoji = "📋";
                const lowerKey = groupKey.toLowerCase();
                const lowerName = baseName.toLowerCase();
                
                if (lowerKey.includes("plant_protection") || lowerName.includes("식물보호")) {
                    emoji = "🌿";
                } else if (lowerKey.includes("tree_doctor") || lowerName.includes("나무의사")) {
                    emoji = "🌳";
                } else if (lowerKey.includes("realtor") || lowerName.includes("공인중개사")) {
                    emoji = "🏠";
                } else if (lowerKey.includes("landscape") || lowerName.includes("조경")) {
                    emoji = "🌸";
                } else if (lowerKey.includes("forest") || lowerName.includes("산림")) {
                    emoji = "🌲";
                } else if (lowerKey.includes("electric") || lowerName.includes("전기")) {
                    emoji = "⚡";
                } else if (lowerKey.includes("fire") || lowerName.includes("소방")) {
                    emoji = "🔥";
                } else if (lowerKey.includes("civil") || lowerKey.includes("building") || lowerName.includes("토목") || lowerName.includes("건축")) {
                    emoji = "🏗️";
                } else if (lowerKey.includes("barista") || lowerName.includes("바리스타")) {
                    emoji = "☕";
                } else if (lowerKey.includes("computer") || lowerKey.includes("comlit") || lowerName.includes("컴퓨터")) {
                    emoji = "💻";
                } else if (lowerKey.includes("word") || lowerName.includes("워드")) {
                    emoji = "⌨️";
                } else if (lowerKey.includes("fat") || lowerName.includes("회계") || lowerName.includes("fat")) {
                    emoji = "📊";
                } else if (lowerKey.includes("hairdresser") || lowerName.includes("미용사")) {
                    emoji = "💇";
                } else if (lowerKey.includes("housing") || lowerName.includes("주택관리")) {
                    emoji = "🏢";
                } else if (lowerKey.includes("history") || lowerName.includes("한국사")) {
                    emoji = "🇰🇷";
                } else if (lowerKey.includes("network") || lowerName.includes("네트워크")) {
                    emoji = "🌐";
                } else if (lowerKey.includes("confectionery") || lowerName.includes("제과")) {
                    emoji = "🍪";
                } else if (lowerKey.includes("bakery") || lowerName.includes("제빵")) {
                    emoji = "🍞";
                } else if (lowerKey.includes("bartending") || lowerName.includes("조주")) {
                    emoji = "🍸";
                } else if (lowerKey.includes("excavator") || lowerName.includes("굴착기")) {
                    emoji = "🚜";
                } else if (lowerKey.includes("forklift") || lowerName.includes("지게차")) {
                    emoji = "🚜";
                } else if (lowerKey.includes("gas") || lowerName.includes("가스")) {
                    emoji = "💨";
                } else if (lowerKey.includes("dangerous") || lowerName.includes("위험물")) {
                    emoji = "⚠️";
                } else if (lowerKey.includes("driver") || lowerName.includes("운전")) {
                    emoji = "🚗";
                } else if (lowerKey.includes("public") || lowerName.includes("공무원")) {
                    emoji = "🏛️";
                }
                
                baseName = emoji + " " + baseName;
                
                // Parse clean suffix for options dropdown
                let suffix = "";
                const dashIdx = p.name.indexOf(" - ");
                if (dashIdx !== -1) {
                    suffix = p.name.substring(dashIdx + 3).trim();
                } else {
                    suffix = "⚡ 통합 기출문제 팩 (전체 학습)";
                }
                
                const cleanKey = getCleanNameForSorting(baseName);
                if (!groupedMap[cleanKey]) {
                    groupedMap[cleanKey] = {
                        id: groupKey,
                        name: baseName,
                        subpacks: []
                    };
                }
                
                // Prevent duplicate subpack options (rounds) in the dropdown list
                const subExists = groupedMap[cleanKey].subpacks.some(sp => sp.name === suffix);
                if (!subExists) {
                    groupedMap[cleanKey].subpacks.push({
                        id: p.id,
                        name: suffix
                    });
                }
            });
            
            const groupedList = Object.values(groupedMap);
            
            // Count category items dynamically
            const counts = { all: 0, craftsman: 0, industrial: 0, engineer: 0, master: 0, office: 0, public: 0, national: 0 };
            
            groupedList.forEach(g => {
                let cat = 'national';
                const nameLower = g.name.toLowerCase();
                const idLower = g.id.toLowerCase();
                
                if (nameLower.includes('공무원') || idLower.includes('public') || idLower.includes('civil_service')) {
                    cat = 'public';
                } else if (
                    nameLower.includes('전산세무') ||
                    nameLower.includes('전산회계') ||
                    nameLower.includes('컴퓨터활용능력') ||
                    nameLower.includes('워드프로세서') ||
                    nameLower.includes('사무자동화') ||
                    nameLower.includes('정보처리') ||
                    nameLower.includes('정보기술') ||
                    idLower.includes('comlit') ||
                    idLower.includes('office') ||
                    idLower.includes('word') ||
                    idLower.includes('tax') ||
                    idLower.includes('account')
                ) {
                    cat = 'office';
                } else if (g.name.includes('기능장') || idLower.includes('master') || idLower.includes('craftsman_master')) {
                    cat = 'master';
                } else if (g.id.startsWith('plant_protection')) {
                    cat = 'industrial';
                } else if (g.id.startsWith('tree_doctor') || g.id.startsWith('realtor')) {
                    cat = 'national';
                } else if (g.id === 'driver_license' || g.name.includes('기능사')) {
                    cat = 'craftsman';
                } else if (g.name.includes('산업기사')) {
                    cat = 'industrial';
                } else if (g.name.includes('기사')) {
                    cat = 'engineer';
                }
                
                categories[cat].list.push(g);
                counts[cat]++;
                counts.all++;
            });
            
            // Update Tab Button Labels dynamically
            const tabButtons = document.querySelectorAll('.cbt-tab-btn');
            tabButtons.forEach(btn => {
                const filterType = btn.getAttribute('data-filter');
                let rawText = "";
                if (filterType === 'all') rawText = `전체 (${counts.all})`;
                else if (filterType === 'craftsman') rawText = `🛠️ 기능사 (${counts.craftsman})`;
                else if (filterType === 'industrial') rawText = `💎 산업기사 (${counts.industrial})`;
                else if (filterType === 'engineer') rawText = `⚡ 기사 (${counts.engineer})`;
                else if (filterType === 'master') rawText = `🔥 기능장 (${counts.master})`;
                else if (filterType === 'office') rawText = `🖥️ IT/사무 (${counts.office})`;
                else if (filterType === 'public') rawText = `🏛️ 공무원 (${counts.public})`;
                else if (filterType === 'national') rawText = `👑 전문자격 (${counts.national})`;
                btn.innerText = rawText;
            });
            // Save groups to global variable, sorted alphabetically (가나다순)
            const sortedGroups = Object.values(groupedMap);
            sortedGroups.sort((a, b) => {
                const nameA = getCleanNameForSorting(a.name);
                const nameB = getCleanNameForSorting(b.name);
                return nameA.localeCompare(nameB, 'ko');
            });
            window.currentCbtGroups = sortedGroups;
            window.packsRawGlobal = packs;
            
            // Define active filter and search query variables
            let activeFilter = 'all';
            let searchQuery = '';
            
            // Setup Search Input Listener
            const searchInput = document.getElementById('cbt-search-input');
            if (searchInput) {
                searchInput.value = ""; // Clear on reload
                searchInput.oninput = (e) => {
                    searchQuery = e.target.value;
                    renderCbtHubGrid(window.currentCbtGroups, activeFilter, searchQuery);
                };
            }
            
            // Setup Tab Buttons Listeners
            tabButtons.forEach(btn => {
                btn.onclick = (e) => {
                    tabButtons.forEach(b => b.classList.remove('active'));
                    
                    const targetBtn = e.currentTarget;
                    targetBtn.classList.add('active');
                    
                    activeFilter = targetBtn.getAttribute('data-filter');
                    renderCbtHubGrid(window.currentCbtGroups, activeFilter, searchQuery);
                };
            });
            
            // Render first grid load
            renderCbtHubGrid(window.currentCbtGroups, activeFilter, searchQuery);
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

// Global function to filter and render grid items
function renderCbtHubGrid(groups, activeFilter, searchQuery) {
    const hubContainer = document.getElementById('cbt-hub-grid-container');
    if (!hubContainer) return;
    
    // Korean chosung matching algorithm
    function matchChosung(word, query) {
        if (!query) return true;
        const chosungList = [
            'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'
        ];
        
        let normalizedWord = word.toLowerCase();
        let normalizedQuery = query.toLowerCase();
        
        let chosungStr = "";
        for (let i = 0; i < normalizedWord.length; i++) {
            let code = normalizedWord.charCodeAt(i) - 44032;
            if (code >= 0 && code <= 11172) {
                chosungStr += chosungList[Math.floor(code / 588)];
            } else {
                chosungStr += normalizedWord[i];
            }
        }
        
        return chosungStr.includes(normalizedQuery) || normalizedWord.includes(normalizedQuery);
    }
    
    // Filter groups
    const filtered = groups.filter(g => {
        let cat = 'national';
        const nameLower = g.name.toLowerCase();
        const idLower = g.id.toLowerCase();
        
        if (nameLower.includes('공무원') || idLower.includes('public') || idLower.includes('civil_service')) {
            cat = 'public';
        } else if (
            nameLower.includes('전산세무') ||
            nameLower.includes('전산회계') ||
            nameLower.includes('컴퓨터활용능력') ||
            nameLower.includes('워드프로세서') ||
            nameLower.includes('사무자동화') ||
            nameLower.includes('정보처리') ||
            nameLower.includes('정보기술') ||
            idLower.includes('comlit') ||
            idLower.includes('office') ||
            idLower.includes('word') ||
            idLower.includes('tax') ||
            idLower.includes('account')
        ) {
            cat = 'office';
        } else if (g.name.includes('기능장') || idLower.includes('master') || idLower.includes('craftsman_master')) {
            cat = 'master';
        } else if (g.id.startsWith('plant_protection')) {
            cat = 'industrial';
        } else if (g.id.startsWith('tree_doctor') || g.id.startsWith('realtor')) {
            cat = 'national';
        } else if (g.id === 'driver_license' || g.name.includes('기능사')) {
            cat = 'craftsman';
        } else if (g.name.includes('산업기사')) {
            cat = 'industrial';
        } else if (g.name.includes('기사')) {
            cat = 'engineer';
        }
        
        const matchesTab = (activeFilter === 'all' || activeFilter === cat);
        const matchesSearch = matchChosung(g.name, searchQuery);
        
        return matchesTab && matchesSearch;
    });
    
    // Sort filtered groups alphabetically (가나다순) ignoring emojis
    filtered.sort((a, b) => {
        const nameA = getCleanNameForSorting(a.name);
        const nameB = getCleanNameForSorting(b.name);
        return nameA.localeCompare(nameB, 'ko');
    });
    
    if (filtered.length === 0) {
        hubContainer.innerHTML = `
            <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; background: rgba(0,0,0,0.15); border: 1px dashed rgba(255,255,255,0.06); border-radius: 12px; padding: 40px; margin-top: 10px;">
                <i class="xi-search-no" style="font-size: 32px; color: var(--text-secondary); margin-bottom: 12px;"></i>
                <div style="color: var(--text-secondary); font-size: 13.5px; font-style: italic; text-align: center;">
                    검색 결과와 일치하는 자격증 학습 팩이 없습니다.
                </div>
            </div>
        `;
        return;
    }
    
    let hubHtml = "";
    filtered.forEach(g => {
        // Calculate total questions loaded for this card
        let totalQuestions = 0;
        g.subpacks.forEach(sp => {
            if (window.packsRawGlobal) {
                let foundRaw = window.packsRawGlobal.find(item => item.id === sp.id);
                if (foundRaw) {
                    totalQuestions += foundRaw.count;
                }
            }
        });
        
        // Define beautiful mentor tags and color theme
        let mentorName = "93학번 선배";
        let mentorTheme = "📋 일반 과목";
        let badgeColor = "rgba(255,255,255,0.06)";
        let hoverAccent = "rgba(212, 175, 55, 0.4)";
        
        if (g.id.includes("plant_protection") || g.id.includes("tree_doctor") || g.id.includes("landscape") || g.id.includes("조경") || g.id.includes("forest") || g.id.includes("산림")) {
            mentorName = "약초꾼 인엽";
            mentorTheme = "🌿 자연과학 멘토";
            badgeColor = "rgba(76, 175, 80, 0.12)";
            hoverAccent = "rgba(76, 175, 80, 0.4)";
        } else if (g.id.includes("realtor") || g.id.includes("commerce") || g.id.includes("distribution")) {
            mentorName = "거상";
            mentorTheme = "💰 경제실무 멘토";
            badgeColor = "rgba(255, 152, 0, 0.12)";
            hoverAccent = "rgba(255, 152, 0, 0.4)";
        } else if (g.id.includes("safety") || g.id.includes("fire") || g.id.includes("security")) {
            mentorName = "호위무관";
            mentorTheme = "🛡️ 보위안전 멘토";
            badgeColor = "rgba(33, 150, 243, 0.12)";
            hoverAccent = "rgba(33, 150, 243, 0.4)";
        } else if (g.id.includes("history") || g.id.includes("word") || g.id.includes("comlit") || g.id.includes("office")) {
            mentorName = "문인";
            mentorTheme = "✍️ 인문학술 멘토";
            badgeColor = "rgba(156, 39, 176, 0.12)";
            hoverAccent = "rgba(156, 39, 176, 0.4)";
        }
        
        hubHtml += `
            <div class="cbt-hub-card glass-card" style="padding: 18px 20px; border-radius: 16px; display: flex; flex-direction: column; justify-content: space-between; background: rgba(17, 24, 39, 0.55); border: 1px solid rgba(255,255,255,0.06); transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); box-shadow: 0 4px 6px rgba(0,0,0,0.15); height: 215px;" data-accent="${hoverAccent}">
                <div>
                    <!-- 멘토 매칭 헤더 -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px;">
                        <span style="font-size: 11px; font-weight: bold; color: var(--primary); background: ${badgeColor}; padding: 3px 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.04); white-space: nowrap;">
                            ${mentorTheme}
                        </span>
                        <span style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            담당: <b>${mentorName}</b>
                        </span>
                    </div>
                    
                    <!-- 카드 타이틀 (최소 높이 부여하여 완벽 정렬) -->
                    <h3 style="font-size: 15px; font-weight: bold; color: #fff; margin: 0 0 4px 0; line-height: 1.4; display: flex; align-items: center; gap: 6px; min-height: 42px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                        ${g.name}
                    </h3>
                    <p style="font-size: 11.5px; color: var(--text-secondary); margin: 0 0 10px 0;">
                        총 ${g.subpacks.length}개 기출/과목 (${totalQuestions}문항 적재)
                    </p>
                </div>
                
                <!-- 하위 셀렉터 및 연결단추 -->
                <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: auto;">
                    <select class="cbt-subpack-select" style="width: 100%; padding: 6px 10px; font-size: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.45); color: #e2e8f0; cursor: pointer; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='rgba(255,255,255,0.08)'">
                        ${g.subpacks.map(sp => `<option value="${sp.id}">${sp.name}</option>`).join("")}
                    </select>
                    <button class="btn btn-primary" onclick="const sel=this.previousElementSibling; changeStudyPack(sel.value); switchTab('cbt');" style="width: 100%; padding: 8px; font-size: 12.5px; font-weight: bold; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(212,175,55,0.12);">
                        학습 시작 <i class="xi-angle-right" style="font-size: 10px;"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    hubContainer.innerHTML = hubHtml;
    
    // Inject custom glow styles if they do not exist
    if (!document.getElementById('cbt-hub-hover-style')) {
        const style = document.createElement('style');
        style.id = 'cbt-hub-hover-style';
        style.innerHTML = `
            .cbt-hub-card {
                position: relative;
                overflow: hidden;
            }
            .cbt-hub-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 24px rgba(0,0,0,0.3) !important;
                background: rgba(17, 24, 39, 0.75) !important;
            }
            .cbt-hub-card:hover {
                border-color: var(--primary) !important;
            }
            .cbt-tab-btn {
                background: rgba(255, 255, 255, 0.04) !important;
                color: #e2e8f0 !important;
                border: 1px solid rgba(255, 255, 255, 0.06) !important;
            }
            .cbt-tab-btn:hover {
                background: rgba(255, 255, 255, 0.08) !important;
                color: #fff !important;
            }
            .cbt-tab-btn.active {
                background: var(--primary) !important;
                color: #000 !important;
                border-color: var(--primary) !important;
            }
        `;
        document.head.appendChild(style);
    }
}

async function changeStudyPack(packName) {
    localStorage.setItem('active_study_pack', packName);
    
    const select = document.getElementById('study-pack-select');
    const sidebarSelect = document.getElementById('sidebar-study-pack-select');
    
    [select, sidebarSelect].forEach(sel => {
        if (sel) {
            let exists = Array.from(sel.options).some(opt => opt.value === packName);
            if (!exists) {
                let foundRaw = window.studyPacks ? window.studyPacks.find(item => item.id === packName) : null;
                const opt = document.createElement('option');
                opt.value = packName;
                opt.innerText = foundRaw ? getShortPackName(foundRaw.id, foundRaw.name) : packName;
                sel.appendChild(opt);
            }
            sel.value = packName;
        }
    });
    
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
                user_worry: newWorry,
                active_study_pack: packName
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
    state.cbtQuestions = [];
    state.userCbtAnswers = {};
    state.cbtSolvedFeedbacks = {};
    
    if (!packName) {
        const select = document.getElementById('study-pack-select');
        packName = select ? select.value : 'tree_doctor_past';
    }

    const workspace = document.getElementById('cbt-questions-workspace');
    if (workspace) workspace.style.display = 'none';

    const selectionScreen = document.getElementById('cbt-selection-screen');
    if (selectionScreen) selectionScreen.style.display = 'block';

    updateSidebarResumeButton();

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
    try {
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
    } catch (err) {
        console.error("CBT Start Error:", err);
        fetch('/api/log-client-error', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                message: "CBT Start Error: " + err.message,
                filename: "index.js",
                lineno: 1170,
                colno: 1,
                stack: err.stack
            })
        });
        alert("시험 시작 중 오류가 발생했습니다: " + err.message + "\n" + err.stack);
    }
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

const postCardLetters = {
    hoboo: `혜진아, 오랜만이구나. 교무실 창밖을 보다가 문득 교실 맨 앞자리에서 눈을 반짝이며 공부하던 네 모습이 떠올라 이 엽서를 보낸다.

요즘 새로운 도전을 앞두고 많이 불안하고 외롭지? 내가 기억하는 너는 비바람 속에서도 묵묵히 제 자리를 지키며 싹을 틔우던 단단한 아이였단다.

지치고 힘들 땐 가끔 뒤를 돌아보며 숨을 골라도 괜찮아. 너는 이미 충분히 잘해왔고, 이번에도 너답게 이겨낼 거라 믿는다.

늘 멀리서 너를 응원하고 있으마.

- 너를 늘 믿었던 선생님이 -`,

    yeongboo: `공부하다가 눈꺼풀이 무겁고 마음이 흔들릴 때, 이 글을 보아라.

너의 소중한 꿈은 매일의 사소한 노력들이 모여 완성되는 법이란다. 오늘 흘린 땀방울이 내일의 합격이라는 달콤한 열매가 될 거야.

목표를 세웠던 첫 마음을 다시 한번 가슴에 새기고, 힘차게 나아가자. 너의 잠재력은 네가 생각하는 것보다 훨씬 크단다.

지금 이 순간 집중해서 한 걸음 더 나아가는 제자의 모습을 기대하마.

- 너의 불꽃을 깨우고 싶은 선생님이 -`,

    shinboo: `혜진아, 공부를 하다 보면 끝없는 터널을 걷는 것처럼 답답할 때가 있지.

그럴 땐 조급해하지 말고, 기본으로 돌아가 거라. 나무가 깊고 단단한 뿌리를 내려야 찬바람을 견디듯, 배움도 기초가 튼튼해야 흔들리지 않는단다.

틀린 문제는 너의 부족함이 아니라, 다음 단계로 나아가기 위한 든든한 징검다리야.

조금 늦더라도 바른 길을 걷고 있으니 안심하렴.

- 언제나 네 편이 되어 줄 선생님이 -`,

    jooboo: `마침내 네가 그 힘든 완주의 길을 끝마쳤구나!

매일 밤늦게까지 오답을 분석하고 끈기 있게 집중해 온 네 노력을 누구보다 잘 알고 있단다.

오늘 이 합격의 기쁨은 전적으로 네가 포기하지 않고 지켜낸 성실함의 결실이야.

앞으로 마주할 삶의 모든 시험에서도 너는 늘 빛나는 결실을 맺을 거란다.

진심으로 자랑스럽고 축하한다, 내 소중한 제자야.

- 합격의 기쁜 소식을 함께 나누며, 선생님이 -`
};

let currentSelectedPostcard = 'hoboo';

function selectTalisman(type) {
    currentSelectedPostcard = type;
    
    // Update active button styling
    const btns = document.querySelectorAll('.talisman-selector button');
    btns.forEach(btn => btn.classList.remove('active'));
    
    // Select the button based on index
    let index = 0;
    if (type === 'hoboo') index = 0;
    else if (type === 'yeongboo') index = 1;
    else if (type === 'shinboo') index = 2;
    else if (type === 'jooboo') index = 3;
    if (btns[index]) btns[index].classList.add('active');

    // Update image
    const imgEl = document.getElementById('mini-amulet-img');
    if (imgEl) {
        imgEl.src = `amulet_${type}.png`;
    }
    
    // Update zoom modal image source
    const zoomImgEl = document.getElementById('amulet-zoom-img');
    if (zoomImgEl) {
        zoomImgEl.src = `amulet_${type}.png`;
    }

    // Update titles and descriptions
    const titleEl = document.getElementById('mini-amulet-title');
    const descEl = document.getElementById('mini-amulet-desc');
    
    if (type === 'hoboo') {
        if (titleEl) titleEl.innerText = "응원 엽서 (Cheering)";
        if (descEl) descEl.innerText = "지치고 불안한 마음에 따뜻한 격려와 용기를 불어넣습니다.";
    } else if (type === 'yeongboo') {
        if (titleEl) titleEl.innerText = "자극 엽서 (Stimulation)";
        if (descEl) descEl.innerText = "나태해진 마음에 불꽃을 피우고 열정을 깨워줍니다.";
    } else if (type === 'shinboo') {
        if (titleEl) titleEl.innerText = "조언 엽서 (Counsel)";
        if (descEl) descEl.innerText = "방황하고 고민할 때 올바른 방향타가 되어 줍니다.";
    } else if (type === 'jooboo') {
        if (titleEl) titleEl.innerText = "합격 엽서 (Success)";
        if (descEl) descEl.innerText = "최종 합격에 다다르도록 강력한 기류의 힘을 보탭니다.";
    }

    // Sync button state based on purchase
    const payBtn = document.getElementById('btn-buy-postcard');
    if (payBtn) {
        const unlockedList = JSON.parse(localStorage.getItem('unlocked_teacher_postcards') || '[]');
        const isUnlocked = unlockedList.includes(type);
        
        if (isUnlocked) {
            payBtn.innerHTML = `<i class="xi-download"></i> 엽서 소장 완료`;
            payBtn.className = "btn btn-success btn-sm";
            payBtn.onclick = () => openAmuletZoomModal();
            payBtn.style.background = "var(--success)";
            payBtn.style.color = "#fff";
            payBtn.style.borderColor = "var(--success)";
        } else {
            payBtn.innerHTML = `<i class="xi-ticket"></i> 엽서 소장 (4,900원)`;
            payBtn.className = "btn btn-warning btn-sm";
            payBtn.onclick = () => triggerAmuletPayment();
            payBtn.style.background = "";
            payBtn.style.color = "";
            payBtn.style.borderColor = "";
        }
    }
}

function openAmuletZoomModal() {
    const modal = document.getElementById('amulet-zoom-modal');
    if (modal) modal.style.display = 'flex';
    
    const zoomImgEl = document.getElementById('amulet-zoom-img');
    if (zoomImgEl) {
        zoomImgEl.src = `amulet_${currentSelectedPostcard}.png`;
    }
}

function closeAmuletZoomModal() {
    const modal = document.getElementById('amulet-zoom-modal');
    if (modal) modal.style.display = 'none';
}

function openAmuletMeaningModal() {
    // Check if the current card is purchased/unlocked
    const unlockedList = JSON.parse(localStorage.getItem('unlocked_teacher_postcards') || '[]');
    const isUnlocked = unlockedList.includes(currentSelectedPostcard);
    if (!isUnlocked) {
        alert("은사님의 편지를 읽으려면 먼저 엽서를 소장해 주세요.");
        return;
    }

    const modal = document.getElementById('amulet-meaning-modal');
    if (modal) modal.style.display = 'flex';
    
    const textEl = document.getElementById('amulet-meaning-text');
    if (textEl) {
        // Dynamically replace name if profile name exists
        const profileTitleEl = document.getElementById('profile-title');
        let studentName = profileTitleEl ? profileTitleEl.innerText.replace(/님|학생/g, '').trim() : '제자';
        if (!studentName) studentName = '제자';
        
        let letterText = postCardLetters[currentSelectedPostcard] || '';
        letterText = letterText.replace(/혜진/g, studentName);
        textEl.innerText = letterText;
    }
}

function closeAmuletMeaningModal() {
    const modal = document.getElementById('amulet-meaning-modal');
    if (modal) modal.style.display = 'none';
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}

function readPostcardAloud() {
    const textEl = document.getElementById('amulet-meaning-text');
    if (textEl && textEl.innerText) {
        const text = textEl.innerText;
        if (typeof speakGuidance === 'function') {
            speakGuidance(text);
            showToast("은사님의 엽서를 낭독합니다.", "success");
        } else {
            console.error("speakGuidance is not available");
        }
    }
}
window.readPostcardAloud = readPostcardAloud;

function triggerAmuletPayment() {
    const btn = document.getElementById('btn-buy-postcard');
    if (!btn) return;
    btn.disabled = true;
    btn.innerText = "선생님의 마음을 담는 중...";
    
    setTimeout(() => {
        // Persist purchase
        const unlockedList = JSON.parse(localStorage.getItem('unlocked_teacher_postcards') || '[]');
        if (!unlockedList.includes(currentSelectedPostcard)) {
            unlockedList.push(currentSelectedPostcard);
            localStorage.setItem('unlocked_teacher_postcards', JSON.stringify(unlockedList));
        }

        // Update button state and refresh dashboard gallery
        selectTalisman(currentSelectedPostcard);
        if (window.renderTeacherPostcardsArchive) {
            window.renderTeacherPostcardsArchive();
        }
        
        alert("학창 시절 은사님의 격려 엽서가 발급되었습니다. 다운로드하여 소중한 마음을 평생 간직해 보세요.");
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
window.updateSidebarResumeButton = updateSidebarResumeButton;
window.triggerAmuletPayment = triggerAmuletPayment;
window.selectTalisman = selectTalisman;
window.openAmuletZoomModal = openAmuletZoomModal;
window.closeAmuletZoomModal = closeAmuletZoomModal;
window.openAmuletMeaningModal = openAmuletMeaningModal;
window.closeAmuletMeaningModal = closeAmuletMeaningModal;

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

function openFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (!modal) return;
    
    const profileTitleEl = document.getElementById('profile-title');
    const activeStudentName = profileTitleEl ? profileTitleEl.innerText.trim() : "대표님";
    
    const nameInput = document.getElementById('feedback-name');
    if (nameInput) {
        nameInput.value = activeStudentName;
    }
    
    const contentText = document.getElementById('feedback-content-text');
    if (contentText) {
        contentText.value = "";
    }
    
    modal.style.display = 'flex';
}

function closeFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function submitFeedback() {
    const nameInput = document.getElementById('feedback-name');
    const categorySelect = document.getElementById('feedback-category');
    const contentText = document.getElementById('feedback-content-text');
    const submitBtn = document.getElementById('btn-submit-feedback');
    
    const name = nameInput ? nameInput.value.trim() : "";
    const category = categorySelect ? categorySelect.value : "";
    const content = contentText ? contentText.value.trim() : "";
    
    if (!name) {
        alert("테스터 이름을 입력해주세요.");
        return;
    }
    if (!content) {
        alert("피드백 내용을 입력해주세요.");
        return;
    }
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "의견 전송 중...";
    }
    
    try {
        const response = await fetch('/api/student/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, category, content })
        });
        
        if (response.ok) {
            const data = await response.json();
            alert(data.message || "의견을 접수했습니다. 고맙다 후배야!");
            closeFeedbackModal();
        } else {
            const err = await response.json();
            alert("전송 실패: " + (err.detail || "알 수 없는 오류"));
        }
    } catch (e) {
        console.error("Feedback submit error:", e);
        alert("전송 중 네트워크 오류가 발생했습니다.");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "의견 보내기";
        }
    }
}

window.openFeedbackModal = openFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;
window.submitFeedback = submitFeedback;

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
window.renderTeacherPostcardsArchive = renderTeacherPostcardsArchive;
window.downloadTalismanCard = downloadTalismanCard;
window.downloadTalismanFromModal = downloadTalismanFromModal;
window.closeTalismanSuccessModal = closeTalismanSuccessModal;

// Pedigree Purchase & Modal bindings
let pendingPedigreeRoundName = "";

function openPedigreePurchaseModal(roundName) {
    pendingPedigreeRoundName = roundName;
    const modal = document.getElementById('pedigree-purchase-modal');
    if (modal) modal.style.display = 'flex';
}

function openPedigreePurchaseModalFromReport() {
    let roundName = "";
    if (state.cbtQuestions && state.cbtQuestions.length > 0) {
        roundName = state.cbtQuestions[0].round;
    }
    if (!roundName) {
        roundName = "tree_doctor_past";
    }
    openPedigreePurchaseModal(roundName);
}

function closePedigreePurchaseModal() {
    const modal = document.getElementById('pedigree-purchase-modal');
    if (modal) modal.style.display = 'none';
}

async function executePedigreePayment() {
    if (!pendingPedigreeRoundName) {
        alert("구매하려는 회차 정보가 누락되었습니다.");
        return;
    }
    
    const payBtn = document.getElementById('pedigree-pay-btn');
    if (payBtn) {
        payBtn.disabled = true;
        payBtn.innerHTML = `<i class="xi-spinner-3 xi-spin"></i> 결제 처리 중...`;
    }
    
    try {
        const response = await fetch('/api/tutor/buy-pedigree', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_id: state.activeStudentId,
                round_name: pendingPedigreeRoundName
            })
        });
        const res = await response.json();
        
        if (res.status === "success") {
            alert(res.message);
            closePedigreePurchaseModal();
            
            // Re-fetch profile to sync purchased list
            await fetchStudentProfile();
            
            // Close CBT report modal if open
            const reportModal = document.getElementById('cbt-report-modal');
            if (reportModal) {
                reportModal.style.display = 'none';
            }
            
            await startPedigreeCourse(pendingPedigreeRoundName);
        } else {
            alert("결제 승인 실패: " + (res.message || "알 수 없는 오류"));
        }
    } catch(err) {
        console.error("Failed to execute pedigree payment:", err);
        alert("결제 시스템 통신에 실패했습니다. 다시 시도해 주십시오.");
    } finally {
        if (payBtn) {
            payBtn.disabled = false;
            payBtn.innerHTML = `<i class="xi-speech"></i> 카카오페이로 9,900원 결제`;
        }
    }
}

function triggerPedigreeTalismanModal() {
    const persona = state.studentProfile ? state.studentProfile.persona_type : "약초꾼";
    
    // Unlock in gallery
    let unlocked = JSON.parse(localStorage.getItem('zeni_unlocked_talismans') || '[]');
    if (!unlocked.includes(persona)) {
        unlocked.push(persona);
        localStorage.setItem('zeni_unlocked_talismans', JSON.stringify(unlocked));
    }
    
    const datesMap = {
        "약초꾼": "1971.04.05 ~ 1999.11.17",
        "거상": "1965.03.14 ~ 2029.12.08",
        "호위무관": "1968.06.22 ~ 1997.10.21",
        "문인": "1969.08.20 ~ 2026.03.05"
    };
    const quotesMap = {
        "약초꾼": "산자락 깊이 숨은 약초의 숨결처럼, 그대의 배움도 묵묵히 합격의 열매를 맺을 걸세.",
        "거상": "기회는 준비된 상인에게만 보이는 법. 그대의 땀방울이 곧 합격의 큰 자산이 될 것이네.",
        "호위무관": "흔들리지 않는 방패처럼 그대의 신념을 지키게. 내 검이 그대의 합격길을 호위하겠네.",
        "문인": "붓끝에서 피어나는 문장처럼, 그대의 노력이 합격이라는 찬란한 역사로 기록될 걸세."
    };
    const portraitsMap = {
        "약초꾼": "portrait_modern.png",
        "거상": "portrait_classic.png",
        "호위무관": "portrait_modern.png",
        "문인": "portrait_classic.png"
    };
    
    const mPortrait = document.getElementById('talisman-modal-portrait');
    const mName = document.getElementById('talisman-modal-name');
    const mDates = document.getElementById('talisman-modal-dates');
    const mExam = document.getElementById('talisman-modal-exam');
    const mQuote = document.getElementById('talisman-modal-quote');
    
    if (mPortrait) mPortrait.src = portraitsMap[persona] || "portrait_modern.png";
    if (mName) mName.innerText = `${persona} 선배`;
    if (mDates) mDates.innerText = datesMap[persona] || datesMap["약초꾼"];
    if (mExam) mExam.innerText = `${state.selectedWorryText || '수목의학'} 합격`;
    if (mQuote) mQuote.innerText = `"${quotesMap[persona] || quotesMap["약초꾼"]}"`;
    
    const successModal = document.getElementById('talisman-success-modal');
    if (successModal) successModal.style.display = 'flex';
}

let flashcardsData = [];

function getStudentId() {
    return state.studentProfile ? state.studentProfile.student_id : "student_4";
}

async function loadFlashcards() {
    try {
        const studentId = getStudentId();
        const res = await fetch(`/api/student/cards?student_id=${studentId}`);
        if (!res.ok) throw new Error("Failed to fetch flashcards");
        flashcardsData = await res.json();
        
        // Populate subject filter dropdown options dynamically
        const filterSelect = document.getElementById("flashcards-subject-filter");
        if (filterSelect) {
            // Keep "ALL"
            filterSelect.innerHTML = '<option value="ALL">전체 과목</option>';
            const subjects = [...new Set(flashcardsData.map(c => c.subject))];
            subjects.forEach(sub => {
                const opt = document.createElement("option");
                opt.value = sub;
                opt.textContent = sub;
                filterSelect.appendChild(opt);
            });
        }
        
        renderFlashcards();
    } catch (e) {
        console.error(e);
        showToast("암기장 데이터를 불러오지 못했습니다.", "danger");
    }
}

function renderFlashcards() {
    const container = document.getElementById("flashcards-cards-container");
    const emptyView = document.getElementById("flashcards-empty-view");
    const listView = document.getElementById("flashcards-list-view");
    
    if (!container) return;
    
    // Apply filters
    const subjectFilter = document.getElementById("flashcards-subject-filter")?.value || "ALL";
    const dueFilter = document.getElementById("flashcards-due-filter")?.value || "ALL";
    
    let filtered = flashcardsData;
    if (subjectFilter !== "ALL") {
        filtered = filtered.filter(c => c.subject === subjectFilter);
    }
    if (dueFilter === "DUE") {
        filtered = filtered.filter(c => c.is_due);
    } else if (dueFilter === "NOT_RATED") {
        filtered = filtered.filter(c => c.rating === null);
    }
    
    if (filtered.length === 0) {
        emptyView.style.display = "flex";
        listView.style.display = "none";
        return;
    }
    
    emptyView.style.display = "none";
    listView.style.display = "block";
    container.innerHTML = "";
    
    filtered.forEach(card => {
        const cardEl = document.createElement("div");
        cardEl.className = "flashcard-note-item";
        cardEl.id = `flashcard-${card.question_text.replace(/\s+/g, '-')}`;
        
        const isRevealed = card.revealed === true;
        if (isRevealed) {
            cardEl.classList.add("revealed");
        }
        
        // Build options markup if any
        let optionsHtml = "";
        if (card.options && card.options.length > 0) {
            optionsHtml = `<div class="card-options-list">`;
            card.options.forEach((opt, idx) => {
                optionsHtml += `<div class="card-option-item">${idx + 1}) ${opt}</div>`;
            });
            optionsHtml += `</div>`;
        }
        
        // Next review date relative helper
        let dueText = "🆕 미평가";
        if (card.rating) {
            const timeDiff = card.next_review_date * 1000 - Date.now();
            if (timeDiff <= 0) {
                dueText = "⏳ 복습 대기 중";
            } else {
                const days = Math.ceil(timeDiff / (24 * 3600 * 1000));
                dueText = `🗓️ ${days}일 뒤 복습`;
            }
        }
        
        cardEl.innerHTML = `
            <div>
                <div class="card-header">
                    <span>${card.subject}</span>
                    <span>${card.round_name || ""}</span>
                </div>
                <div class="card-question">${card.question_text}</div>
                ${optionsHtml}
            </div>
            <div>
                <div class="card-answer-box">
                    <div class="card-answer-blur">${card.correct_answer}</div>
                    <div class="card-answer-placeholder" onclick="revealCardAnswer(this)">
                        <i class="xi-lock"></i> 눈가림 복원 (정답 보기)
                    </div>
                </div>
                <div class="card-rating-panel">
                    <button class="btn-rating btn-rating-hard" onclick="rateFlashcard('${encodeURIComponent(card.question_text)}', 'hard')">
                        <i class="xi-close-circle-o"></i> 어려움 (1일)
                    </button>
                    <button class="btn-rating btn-rating-medium" onclick="rateFlashcard('${encodeURIComponent(card.question_text)}', 'medium')">
                        <i class="xi-help-o"></i> 보통 (3일)
                    </button>
                    <button class="btn-rating btn-rating-easy" onclick="rateFlashcard('${encodeURIComponent(card.question_text)}', 'easy')">
                        <i class="xi-check-circle-o"></i> 쉬움 (7일)
                    </button>
                </div>
                <div class="card-status-badge">${dueText}</div>
            </div>
        `;
        
        container.appendChild(cardEl);
    });
}

function revealCardAnswer(btn) {
    const cardEl = btn.closest(".flashcard-note-item");
    if (cardEl) {
        cardEl.classList.add("revealed");
        const questionText = cardEl.querySelector(".card-question").textContent;
        const cardObj = flashcardsData.find(c => c.question_text === questionText);
        if (cardObj) cardObj.revealed = true;
    }
}

async function rateFlashcard(questionTextEscaped, rating) {
    const questionText = decodeURIComponent(questionTextEscaped);
    try {
        const studentId = getStudentId();
        const res = await fetch("/api/student/cards/rate", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                student_id: studentId,
                question_text: questionText,
                rating: rating
            })
        });
        if (!res.ok) throw new Error("Rating failed");
        showToast("복습 주기가 조정되었습니다.", "success");
        loadFlashcards();
        fetchStudentProfile();
    } catch (e) {
        console.error(e);
        showToast("평가 처리에 실패했습니다.", "danger");
    }
}

function filterFlashcards(val) {
    renderFlashcards();
}

function filterFlashcardsDue(val) {
    renderFlashcards();
}

function showToast(message, type = "success") {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.position = 'fixed';
    toast.style.bottom = '100px';
    toast.style.right = '40px';
    toast.style.background = type === 'success' ? '#10b981' : type === 'danger' ? '#ef4444' : '#f59e0b';
    toast.style.color = '#fff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.fontFamily = "'Noto Sans KR', sans-serif";
    toast.style.fontWeight = 'bold';
    toast.style.fontSize = '14px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    
    let icon = "xi-info-o";
    if (type === 'success') icon = "xi-check-circle-o";
    else if (type === 'danger') icon = "xi-warning";
    
    toast.innerHTML = `<i class="${icon}"></i> ${message}`;
    
    document.body.appendChild(toast);
    
    toast.animate([
        { transform: 'translateY(20px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 300, fill: 'forwards' });
    
    setTimeout(() => {
        toast.animate([
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-20px)', opacity: 0 }
        ], { duration: 300, fill: 'forwards' }).onfinish = () => {
            toast.remove();
        };
    }, 2500);
}
window.showToast = showToast;

// ==========================================
// ✏️ 실기 필답고사 (Subjective Exam) 컨트롤러
// ==========================================
let subjectiveState = {
    currentPackName: "",
    questions: [],
    allPacks: [],
    selectedCategory: "all",
    searchQuery: "",
    selectedPackName: "",
    timerInterval: null
};

async function loadSubjectivePacks() {
    const selectEl = document.getElementById('subjective-pack-select');
    if (!selectEl) return;
    
    try {
        const res = await fetch('/api/tutor/subjective/packs?t=' + Date.now());
        const packs = await res.json();
        subjectiveState.allPacks = packs || [];
        
        window.subjectivePacks = (packs || []).map(p => {
            let cleanName = p.replace(/_/g, ' ');
            let subject = "수목관리학";
            
            if (p.includes("tree_doctor") || p.includes("나무의사")) {
                subject = "수목관리학";
                if (p.includes("past")) cleanName = "나무의사 실기 기출 복원 기본팩";
                else if (p.includes("2023_10")) cleanName = "나무의사 실기 필답형 2023년 10회";
                else if (p.includes("7th") || p.includes("7회")) cleanName = "나무의사 실기 필답형 7회 복원";
                else if (p.includes("8th") || p.includes("8회")) cleanName = "나무의사 실기 필답형 8회 복원";
                else if (p.includes("9th") || p.includes("9회")) cleanName = "나무의사 실기 필답형 9회 복원";
                else if (p.includes("photos") || p.includes("사진복원")) cleanName = "나무의사 실기 필답형 사진복원 기출 팩";
                else cleanName = "나무의사 실기 필답형 최신기출 복원";
            } else if (p.includes("plant_protection")) {
                subject = "식물보호학";
                if (p.includes("2023_1")) cleanName = "식물보호기사 실기 필답형 2023년 1회";
                else cleanName = "식물보호기사 실기 필답형 기본팩";
            } else if (p.includes("landscape")) {
                subject = "조경학";
                cleanName = "조경기사 실기 필답형 기본팩";
            } else if (p.includes("forest")) {
                subject = "산림학";
                cleanName = "산림기사 실기 필답형 기본팩";
            } else if (p.includes("infotech")) {
                subject = "정보처리";
                cleanName = "정보처리기사 실기 필답형 기본팩";
            }
            
            return {
                id: p,
                name: cleanName,
                subject: subject,
                round: "기출 복원"
            };
        });
        
        renderSubjectivePacksDeck();
    } catch (err) {
        console.error("Failed to load subjective packs:", err);
        showToast("실기 기출문제집 목록을 불러오지 못했습니다.", "danger");
    }
}

function renderSubjectivePacksDeck() {
    const deckEl = document.getElementById('subjective-packs-deck');
    if (!deckEl) return;
    
    deckEl.innerHTML = "";
    
    const query = subjectiveState.searchQuery.toLowerCase().replace(/\s+/g, '');
    const cat = subjectiveState.selectedCategory;
    
    const filtered = subjectiveState.allPacks.filter(pack => {
        const readable = pack.replace(/_/g, ' ');
        const matchedQuery = readable.toLowerCase().replace(/\s+/g, '').includes(query);
        
        let matchedCat = true;
        if (cat !== 'all') {
            matchedCat = readable.includes(cat);
        }
        return matchedQuery && matchedCat;
    });
    
    fetch('/api/debug-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            allPacks: subjectiveState.allPacks,
            selectedCategory: cat,
            searchQuery: query,
            filtered: filtered
        })
    }).catch(e => console.error(e));
    
    if (filtered.length === 0) {
        deckEl.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px;">
                <i class="xi-search" style="font-size: 20px; margin-bottom: 6px; display: block; opacity: 0.5;"></i>
                검색 조건에 맞는 실기 시험지가 없습니다.
            </div>
        `;
        return;
    }
    
    // Group packs by category
    const categoriesOrder = ["나무의사", "식물보호", "조경", "산림", "정보처리", "기타 과목"];
    const emojis = {
        "나무의사": "🌳",
        "식물보호": "🌿",
        "조경": "🌸",
        "산림": "⛰️",
        "정보처리": "💻",
        "기타 과목": "✏️"
    };
    
    const grouped = {};
    filtered.forEach(pack => {
        let matchedGroup = "기타 과목";
        for (const c of categoriesOrder) {
            if (pack.includes(c)) {
                matchedGroup = c;
                break;
            }
        }
        if (!grouped[matchedGroup]) grouped[matchedGroup] = [];
        grouped[matchedGroup].push(pack);
    });
    
    categoriesOrder.forEach(catName => {
        const packs = grouped[catName];
        if (!packs || packs.length === 0) return;
        
        // Render Group Header
        const header = document.createElement('div');
        header.className = "subjective-group-header";
        header.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 18px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); font-family: 'Noto Sans KR', sans-serif;";
        header.innerHTML = `
            <span style="font-size: 13px; font-weight: 800; color: var(--primary); letter-spacing: 0.5px;">${emojis[catName]} ${catName}</span>
            <span style="font-size: 10px; background: rgba(255,255,255,0.06); color: var(--text-secondary); padding: 1.5px 6px; border-radius: 10px; font-weight: bold;">${packs.length}</span>
        `;
        deckEl.appendChild(header);
        
        // Render Group Container
        const container = document.createElement('div');
        container.style.cssText = "display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 12px;";
        
        packs.forEach(pack => {
            const item = document.createElement('div');
            const isActive = pack === subjectiveState.selectedPackName;
            item.className = `subjective-pack-item ${isActive ? 'active' : ''}`;
            
            const displayName = pack.replace(/_/g, ' ');
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 14px;">${emojis[catName]}</span>
                    <span style="font-size: 13px; font-weight: bold;">${displayName}</span>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 2px;">
                    <span>입장</span> <i class="xi-angle-right-min"></i>
                </div>
            `;
            
            item.onclick = () => {
                selectSubjectivePack(pack);
            };
            
            item.ondblclick = () => {
                selectSubjectivePack(pack);
                startSubjectiveExam();
            };
            
            container.appendChild(item);
        });
        
        deckEl.appendChild(container);
    });
}

async function startSubjectiveExam() {
    const selectEl = document.getElementById('subjective-pack-select');
    if (!selectEl || !selectEl.value) {
        alert("기출문제집을 선택해 주세요.");
        return;
    }
    
    const packName = selectEl.value;
    subjectiveState.currentPackName = packName;
    
    try {
        const res = await fetch(`/api/tutor/subjective/questions?pack_name=${encodeURIComponent(packName)}&t=${Date.now()}`);
        if (!res.ok) throw new Error("Pack load failed");
        
        const data = await res.json();
        subjectiveState.questions = data.questions || [];
        
        document.getElementById('subjective-selection-screen').style.display = 'none';
        document.getElementById('subjective-exam-workspace').style.display = 'block';
        
        document.getElementById('subjective-exam-title').innerText = data.pack_name.replace(/_/g, ' ');
        
        // Timer handling
        const timerEl = document.getElementById('subjective-countdown-timer');
        if (subjectiveState.timerInterval) {
            clearInterval(subjectiveState.timerInterval);
            subjectiveState.timerInterval = null;
        }
        
        if (packName === "나무의사_실기_필답형_통합_모의고사") {
            if (timerEl) {
                timerEl.style.display = 'inline-block';
                let totalSecs = 100 * 60; // 100 minutes
                
                const updateTimerText = () => {
                    const mins = Math.floor(totalSecs / 60);
                    const secs = totalSecs % 60;
                    timerEl.innerHTML = `<i class="xi-time"></i> 남은 시간: ${mins}:${secs.toString().padStart(2, '0')}`;
                };
                
                updateTimerText();
                
                subjectiveState.timerInterval = setInterval(() => {
                    totalSecs--;
                    if (totalSecs <= 0) {
                        clearInterval(subjectiveState.timerInterval);
                        subjectiveState.timerInterval = null;
                        timerEl.innerHTML = `<i class="xi-time"></i> 시험 시간 종료`;
                        alert("시험 시간(100분)이 종료되었습니다. 작성한 답안이 자동으로 채점됩니다.");
                        gradeAllSubjectiveAnswers();
                    } else {
                        updateTimerText();
                    }
                }, 1000);
            }
        } else {
            if (timerEl) timerEl.style.display = 'none';
        }
        
        renderSubjectiveQuestions();
        showToast("실기 필답고사가 시작되었습니다.", "success");
    } catch (err) {
        console.error("Failed to start subjective exam:", err);
        alert("실기 고사장 입장에 실패했습니다.");
    }
}

function exitSubjectiveExam() {
    if (confirm("정말 퇴실하시겠습니까? 작성 중인 답안이 저장되지 않을 수 있습니다.")) {
        if (subjectiveState.timerInterval) {
            clearInterval(subjectiveState.timerInterval);
            subjectiveState.timerInterval = null;
        }
        document.getElementById('subjective-exam-workspace').style.display = 'none';
        document.getElementById('subjective-selection-screen').style.display = 'block';
        subjectiveState.currentPackName = "";
        subjectiveState.questions = [];
    }
}

function selectSubjectivePack(packName) {
    subjectiveState.selectedPackName = packName;
    
    const selectEl = document.getElementById('subjective-pack-select');
    if (selectEl) {
        selectEl.innerHTML = `<option value="${packName}">${packName}</option>`;
        selectEl.value = packName;
    }
    
    // Toggle info card visibility
    const infoCard = document.getElementById('subjective-exam-info-card');
    if (infoCard) {
        if (packName === "나무의사_실기_필답형_통합_모의고사") {
            infoCard.style.display = 'block';
        } else {
            infoCard.style.display = 'none';
        }
    }
    
    renderSubjectivePacksDeck();
}

async function filterSubjectivePacksList() {
    const input = document.getElementById('subjective-search-input');
    if (input) {
        subjectiveState.searchQuery = input.value;
    }
    if (subjectiveState.allPacks.length === 0) {
        await loadSubjectivePacks();
    } else {
        renderSubjectivePacksDeck();
    }
}

async function filterSubjectiveCategory(category) {
    subjectiveState.selectedCategory = category;
    
    // Toggle active pill styling
    const pills = document.querySelectorAll('.subjective-filter-pill');
    pills.forEach(pill => {
        pill.classList.remove('active');
        pill.style.background = 'rgba(255,255,255,0.04)';
        pill.style.color = '#e2e8f0';
        pill.style.border = '1px solid rgba(255,255,255,0.08)';
    });
    
    const event = window.event;
    if (event && event.currentTarget) {
        const activePill = event.currentTarget;
        activePill.classList.add('active');
        activePill.style.background = 'var(--primary)';
        activePill.style.color = '#000';
        activePill.style.border = 'none';
    }
    
    if (subjectiveState.allPacks.length === 0) {
        await loadSubjectivePacks();
    } else {
        renderSubjectivePacksDeck();
    }
}

function openPhotoLightbox(src) {
    const modal = document.getElementById('photo-lightbox-modal');
    const img = document.getElementById('photo-lightbox-img');
    if (modal && img) {
        img.src = src;
        modal.style.display = 'flex';
    }
}

function closePhotoLightbox() {
    const modal = document.getElementById('photo-lightbox-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.openPhotoLightbox = openPhotoLightbox;
window.closePhotoLightbox = closePhotoLightbox;
window.filterSubjectivePacksList = filterSubjectivePacksList;
window.filterSubjectiveCategory = filterSubjectiveCategory;
window.selectSubjectivePack = selectSubjectivePack;



const speciesDb = {
    "Dendrolimus spectabilis": {
        name: "솔나방 (송충이)",
        sci: "Dendrolimus spectabilis",
        family: "솔나방과 (Lasiocampidae)",
        features: "유충은 몸길이 70~80mm로 회갈색이며 몸 전체에 긴 털이 밀생하고, 흉부 마디 등면에 남청색 독모가 있음. 성충 암컷은 몸집이 크고 더듬이가 빗살 모양, 수컷은 날씬하고 깃털 모양임.",
        cycle: "연 1회 발생, 유충 상태로 소나무 수피 틈이나 지피물 밑에서 월동.",
        control: "약제살포(페니트로티온 등), 수간주사(아바멕틴), 잠복소(짚풀 벨트) 설치.",
        searchQuery: "솔나방 유충",
        hdImage: "/hd_photos/dendrolimus_spectabilis.jpg"
    },
    "Bursaphelenchus xylophilus": {
        name: "소나무재선충",
        sci: "Bursaphelenchus xylophilus",
        family: "Parasitaphelenchidae",
        features: "스스로 이동하지 못하며 매개충(솔수염하늘소, 북방수염하늘소)의 기관을 통해 이동. 감염 시 도관부를 폐쇄하여 침엽수가 100% 고사(붉게 변색)함.",
        cycle: "매개충 몸속에서 월동 후, 매개충이 신초를 후식할 때 상처 부위를 통해 침입.",
        control: "예방주사(아바멕틴, 에마멕틴벤조에이트), 감염목 벌채 및 훈증/파쇄 처리.",
        searchQuery: "소나무재선충 솔수염하늘소",
        hdImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Bursaphelenchus_xylophilus_nematode.jpg/640px-Bursaphelenchus_xylophilus_nematode.jpg"
    },
    "Thecodiplosis japonensis": {
        name: "솔잎혹파리",
        sci: "Thecodiplosis japonensis",
        family: "혹파리과 (Cecidomyiidae)",
        features: "유충이 솔잎 기부에 충영(혹)을 형성하여 수액을 빨아먹음. 충영이 형성된 솔잎은 자라지 못하고 누렇게 말라 죽음.",
        cycle: "연 1회 발생, 유충 상태로 땅속(낙엽 밑)에서 월동.",
        control: "포스파미돈 등 수간주사, 5~6월 우화기 약제 수관살포.",
        searchQuery: "솔잎혹파리 충영",
        hdImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Pine_needle_gall_midge_injury.jpg/640px-Pine_needle_gall_midge_injury.jpg"
    },
    "Raffaelea quercivora": {
        name: "참나무시들음병",
        sci: "Raffaelea quercivora",
        family: "Ophiostomataceae (곰팡이)",
        features: "매개충인 '광릉긴나무조각'이 참나무 줄기에 구멍을 뚫고 들어갈 때 몸에 묻은 균이 침입. 균사가 도관을 막아 참나무 잎이 급격히 시들고 붉게 고사함.",
        cycle: "매개충 유충이 목질부 터널 안에서 월동 후 5~6월 성충으로 탈출하여 다른 나무로 이동.",
        control: "벌채 후 훈증/파쇄, 매개충 유인 트랩 및 끈끈이 롤러 설치, 예방 수간주사.",
        searchQuery: "참나무시들음병 광릉긴나무조각",
        hdImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Platypus_cylindrus.jpg/640px-Platypus_cylindrus.jpg"
    },
    "Fusarium circinatum": {
        name: "푸사리움 가지마름병 (Pitch Canker)",
        sci: "Fusarium circinatum",
        family: "Nectriaceae (자낭균)",
        features: "가지나 줄기에 송진이 심하게 흘러내리며 궤양이 생기고, 윗부분의 가지가 말라 죽음. 리기다소나무, 테다소나무 등에 피해가 큼.",
        cycle: "상처 부위나 기공을 통해 포자가 침입하여 전파됨.",
        control: "감염된 병든 가지 제거 및 소각, 건전한 묘목 사용, 저항성 품종 식재.",
        searchQuery: "푸사리움 가지마름병 리기다소나무",
        hdImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Fusarium_circinatum_culture.jpg/640px-Fusarium_circinatum_culture.jpg"
    },
    "Cronartium quercuum": {
        name: "소나무혹병 (Pine-oak gall rust)",
        sci: "Cronartium quercuum",
        family: "Melampsoraceae (담자균)",
        features: "소나무 가지나 줄기에 둥근 혹이 생기며 봄철에 혹 표면이 깨지면서 황색 가루(녹포자)가 비산함. 이종기생균으로 중간기주는 참나무류(신갈나무 등).",
        cycle: "봄에 소나무에서 참나무로 녹포자 이동, 가을에 참나무에서 소나무로 겨울포자/담자포자 이동.",
        control: "소나무 근처의 중간기주(참나무류) 제거, 병든 혹 가지 전정 후 소각.",
        searchQuery: "소나무혹병",
        hdImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Cronartium_quercuum_gall.jpg/640px-Cronartium_quercuum_gall.jpg"
    },
    "Agrobacterium tumefaciens": {
        name: "근두암종병 (Crown gall)",
        sci: "Agrobacterium tumefaciens",
        family: "Rhizobiaceae (세균)",
        features: "뿌리나 지제부에 혹(종양)이 형성됨. 세균의 Ti 플라스미드 DNA가 식물 게놈에 삽입되어 식물 호르몬(옥신, 시토키닌) 과다 분비를 유발해 이상 비대 성장함.",
        cycle: "토양 속에서 장기간 생존하며 뿌리의 상처를 통해 침입.",
        control: "감염목 폐기 및 소각, 작업 도구 소독, 건전 묘목 사용, 생물학적 방제(K84 균주).",
        searchQuery: "근두암종병 뿌리혹",
        hdImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Crown_gall_gall.jpg/640px-Crown_gall_gall.jpg"
    },
    "Agelastica alni": {
        name: "오리나무잎벌레",
        sci: "Agelastica alni",
        family: "잎벌레과 (Chrysomelidae)",
        features: "유충과 성충이 오리나무 잎을 갉아먹어 잎맥만 남김. 유충은 검은색이며 성충은 남청색으로 광택이 남.",
        cycle: "연 1회 발생, 성충 상태로 흙속이나 돌 밑, 낙엽 밑에서 월동.",
        control: "가해기(5~6월)에 클로르플루아주론 등 유제 수관살포.",
        searchQuery: "오리나무잎벌레",
        hdImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Agelastica_alni_adult.jpg/640px-Agelastica_alni_adult.jpg"
    },
    "Gymnosporangium asiaticum": {
        name: "향나무 녹병 (붉은별무늬병)",
        sci: "Gymnosporangium asiaticum",
        family: "Pucciniaceae (담자균)",
        features: "봄철 비가 오면 향나무 잎에 갈색설상의 겨울포자퇴가 흡수·팽창하여 황색 젤리 모양으로 변함. 중간기주는 장미과 식물(배나무, 사과나무 등).",
        cycle: "봄에 향나무에서 배나무로 소생자 이동, 가을에 배나무에서 향나무로 녹포자 이동.",
        control: "배나무원 주위 1~2km 이내 향나무 식재 금지, 살균제(티아디메놀 등) 교호 살포.",
        searchQuery: "향나무 녹병 겨울포자퇴",
        hdImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Gymnosporangium_juniperi-virginianae_gall.jpg/640px-Gymnosporangium_juniperi-virginianae_gall.jpg"
    }
};

function renderSubjectiveQuestions() {
    const listEl = document.getElementById('subjective-questions-list');
    if (!listEl) return;
    
    listEl.innerHTML = "";
    
    subjectiveState.questions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = "subjective-question-card";
        
        // Match species guide
        let species = null;
        const fullText = (q.question_text + " " + (q.model_answer || "")).toLowerCase();
        
        if (fullText.includes("솔나방")) species = speciesDb["Dendrolimus spectabilis"];
        else if (fullText.includes("재선충")) species = speciesDb["Bursaphelenchus xylophilus"];
        else if (fullText.includes("혹파리")) species = speciesDb["Thecodiplosis japonensis"];
        else if (fullText.includes("시들음병")) species = speciesDb["Raffaelea quercivora"];
        else if (fullText.includes("가지마름병") || fullText.includes("푸사리움")) species = speciesDb["Fusarium circinatum"];
        else if (fullText.includes("혹병")) species = speciesDb["Cronartium quercuum"];
        else if (fullText.includes("근두암") || fullText.includes("종양")) species = speciesDb["Agrobacterium tumefaciens"];
        else if (fullText.includes("잎벌레")) species = speciesDb["Agelastica alni"];
        else if (fullText.includes("향나무") || fullText.includes("녹병")) species = speciesDb["Gymnosporangium asiaticum"];

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <span style="font-size: 13.5px; font-weight: bold; color: var(--primary); font-family: 'Noto Sans KR', sans-serif; display: flex; align-items: center; gap: 8px;">
                    문항 ${idx + 1} (${q.subject} / 배점 ${q.points}점)
                    ${q.is_ai ? `
                    <span style="font-size: 10px; background: rgba(129, 140, 248, 0.15); border: 1px solid #818cf8; color: #818cf8; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-family: 'Noto Sans KR', sans-serif; display: inline-flex; align-items: center; gap: 2px; vertical-align: middle;" class="no-print">
                        <i class="xi-chip"></i> AI 예상
                    </span>
                    ` : ''}
                </span>
            </div>
            
            <h3 style="font-family: 'Nanum Myeongjo', serif; font-size: 16px; color: #fff; line-height: 1.6; margin-bottom: 16px; word-break: keep-all; font-weight: 500;">
                ${q.question_text}
            </h3>
            
            ${species ? `
            <div style="margin-bottom: 18px; background: rgba(129, 140, 248, 0.08); padding: 14px; border-radius: 8px; border: 1px solid rgba(129, 140, 248, 0.25); text-align: left;" class="no-print">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(129, 140, 248, 0.15); padding-bottom: 6px; flex-wrap: wrap; gap: 8px;">
                    <span style="font-size: 12.5px; font-weight: bold; color: #818cf8; display: flex; align-items: center; gap: 4px;">
                        <i class="xi-book-o" style="font-size: 14px;"></i> 🌳 실시간 고화질 생태 도감 참조
                    </span>
                    <a href="https://search.naver.com/search.naver?where=image&query=${encodeURIComponent('나무의사 ' + species.searchQuery)}" target="_blank" class="btn btn-warning btn-sm" style="padding: 3px 8px; font-size: 11px; font-weight: bold; background: #e2e8f0 !important; color: #0f172a !important; border: none !important; display: flex; align-items: center; gap: 2px;">
                        <i class="xi-search"></i> 네이버 고화질 사진 검색
                    </a>
                </div>
                <div style="display: grid; grid-template-columns: 1fr; gap: 12px; align-items: start;">
                    ${species.hdImage ? `
                    <div style="text-align: center; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); max-width: 100%;">
                        <span style="display: block; font-size: 11px; color: var(--primary); font-weight: bold; text-align: left; margin-bottom: 6px;">
                            <i class="xi-image-o"></i> ${species.name} 고화질 참조 사진 (클릭 시 확대)
                        </span>
                        <img src="${species.hdImage}" style="max-height: 200px; max-width: 100%; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08); cursor: zoom-in; object-fit: contain;" onclick="openPhotoLightbox('${species.hdImage}')" />
                    </div>
                    ` : ''}
                    <div style="font-size: 12px; line-height: 1.6; color: #cbd5e1; display: grid; gap: 5px;">
                        <div><strong>명칭(학명):</strong> <span style="color: #fff;">${species.name} (<em>${species.sci}</em>)</span></div>
                        <div><strong>분류(과명):</strong> <span style="color: #94a3b8;">${species.family}</span></div>
                        <div><strong>형태 특징:</strong> <span style="color: #94a3b8;">${species.features}</span></div>
                        <div><strong>생활사:</strong> <span style="color: #94a3b8;">${species.cycle}</span></div>
                        <div><strong>방제 방법:</strong> <span style="color: #94a3b8;">${species.control}</span></div>
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${q.image ? `
            <div style="margin-bottom: 18px; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border: 1.5px solid rgba(255,255,255,0.06); text-align: center;">
                <span style="display: block; font-size: 11.5px; color: var(--primary); margin-bottom: 8px; font-weight: bold; text-align: left; display: flex; align-items: center; gap: 4px;">
                    <i class="xi-image-o" style="font-size: 14px;"></i> 📌 이 문제의 원본 시험지 사진 (클릭하면 전체 화면 확대)
                </span>
                <img src="/past_photos/${q.image}" style="max-width: 100%; max-height: 250px; border-radius: 4px; cursor: zoom-in; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.015)'" onmouseout="this.style.transform='scale(1)'" onclick="openPhotoLightbox('/past_photos/${q.image}')" />
            </div>
            ` : ''}
            
            <textarea class="subjective-notepad" id="sub-ans-${q.id}" placeholder="여기에 주관식 답안을 서술하세요..."></textarea>
            <div class="subjective-print-lines"></div>

            <div style="margin-top: 14px; display: flex; gap: 8px; align-items: center; justify-content: flex-end;" class="no-print">
                <button class="btn btn-secondary btn-sm" onclick="submitSubjectiveGrade('${q.id}')" style="padding: 6px 12px; font-size: 12px; font-weight: bold; background: rgba(212,175,55,0.15) !important; border: 1px solid var(--primary) !important; color: var(--primary) !important;">
                    <i class="xi-check-circle"></i> 내 답안 AI 채점하기
                </button>
            </div>
            
            <div id="sub-feedback-${q.id}" class="subjective-feedback-panel" style="display: none;"></div>
        `;
        listEl.appendChild(card);
    });
}

async function submitSubjectiveGrade(questionId, isSilent = false) {
    const ansEl = document.getElementById(`sub-ans-${questionId}`);
    if (!ansEl) return;
    
    const studentAnswer = ansEl.value.trim();
    if (!studentAnswer) {
        if (!isSilent) alert("답안을 작성한 뒤 채점을 요청해 주세요.");
        return;
    }
    
    const feedbackEl = document.getElementById(`sub-feedback-${questionId}`);
    if (feedbackEl) {
        feedbackEl.style.display = "block";
        feedbackEl.innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;"><i class="xi-spinner xi-spin"></i> AI 채점관이 답안을 분석하는 중...</span>';
    }
    
    try {
        const studentId = state.studentProfile ? state.studentProfile.student_id : "student_4";
        const res = await fetch('/api/tutor/subjective/grade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: studentId,
                pack_name: subjectiveState.currentPackName,
                question_id: questionId,
                student_answer: studentAnswer
            })
        });
        
        if (!res.ok) throw new Error("Grading failed");
        
        const data = await res.json();
        
        let keywordHTML = "";
        data.matches.forEach(kw => {
            const badgeClass = kw.matched ? "keyword-badge matched" : "keyword-badge unmatched";
            const icon = kw.matched ? "<i class='xi-check'></i>" : "<i class='xi-close'></i>";
            const statusText = kw.matched ? "획득" : "누락";
            keywordHTML += `<span class="${badgeClass}">${icon} ${kw.keyword} (${statusText} / ${kw.weight}점)</span>`;
        });
        
        feedbackEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.06); padding-bottom: 8px; margin-bottom: 12px;">
                <span style="font-size: 13.5px; font-weight: bold; color: #fff;">📝 채점 결과</span>
                <span style="font-size: 15px; font-weight: bold; color: var(--primary);">${data.score} / ${data.max_score} 점</span>
            </div>
            
            <div style="margin-bottom: 12px;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">키워드 매칭 분석:</div>
                <div style="display: flex; flex-wrap: wrap;">
                    ${keywordHTML}
                </div>
            </div>
            
            <div style="background: rgba(0,0,0,0.2); border-radius: 6px; padding: 10px 12px; font-size: 13px; line-height: 1.5; color: #e2e8f0; font-family: 'Nanum Myeongjo', serif; margin-bottom: 10px;">
                <strong style="color: var(--primary); display: block; margin-bottom: 4px;">🎓 모범 답안:</strong>
                ${data.model_answer}
            </div>

            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 8px;">
                <i class="xi-info-o"></i> 이 채점은 키워드 기반 자가 진단 가이드이며, 문맥적 부정이 가미된 경우는 점수가 다를 수 있으므로 <strong>우측 모범답안과 작성 답안을 최종 대조</strong>하여 판단해 주세요.
            </div>
        `;
        if (!isSilent) showToast("채점이 완료되었습니다.", "success");
    } catch (err) {
        console.error("Subjective grading failed:", err);
        if (feedbackEl) {
            feedbackEl.innerHTML = '<span style="color: #f87171; font-size: 13px;"><i class="xi-warning"></i> 채점에 실패했습니다. 다시 시도해 주세요.</span>';
        }
    }
}

async function gradeAllSubjectiveAnswers() {
    for (const q of subjectiveState.questions) {
        await submitSubjectiveGrade(q.id, true);
    }
}

window.loadSubjectivePacks = loadSubjectivePacks;
window.startSubjectiveExam = startSubjectiveExam;
window.exitSubjectiveExam = exitSubjectiveExam;
window.submitSubjectiveGrade = submitSubjectiveGrade;

window.revealCardAnswer = revealCardAnswer;
window.rateFlashcard = rateFlashcard;
window.filterFlashcards = filterFlashcards;
window.filterFlashcardsDue = filterFlashcardsDue;

window.openPedigreePurchaseModal = openPedigreePurchaseModal;
window.openPedigreePurchaseModalFromReport = openPedigreePurchaseModalFromReport;
window.closePedigreePurchaseModal = closePedigreePurchaseModal;
window.executePedigreePayment = executePedigreePayment;
window.triggerPedigreeTalismanModal = triggerPedigreeTalismanModal;
window.startPedigreeCourse = startPedigreeCourse;

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

