// Client State Management
let currentTab = 'dashboard';

// Format question text with html safety and support for bogey box
function formatQuestionText(text) {
    if (!text) return '';
    
    // Escape HTML tags to prevent broken rendering of brackets
    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
        
    // Format custom bogey tag placeholders
    escaped = escaped
        .replace(/\[BOGEY_START\]/g, '<div class="cbt-bogey-box">')
        .replace(/\[BOGEY_END\]/g, '</div>');
        
    // Replace newlines with <br>
    return escaped.replace(/\n/g, '<br>');
}
let examsList = [];
let activeExam = null; // { round_name, questions: [] }
let activeQuestionIdx = 0;
let answersSheet = {}; // q_no -> selected_choice (string '1'~'5')
let studentProfile = null;
let examTimerInterval = null;
let examSeconds = 0;

// Chart.js references
let radarChartInstance = null;
let barChartInstance = null;

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

// App Initialization
async function initApp() {
    await fetchStudentProfile();
    await fetchExamsList();
    initCharts();
}

// Setup Event Listeners
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
    document.getElementById('btn-edit-profile').addEventListener('click', openProfileModal);
    const btnMobileEdit = document.getElementById('btn-mobile-edit-profile');
    if (btnMobileEdit) {
        btnMobileEdit.addEventListener('click', openProfileModal);
    }
    document.getElementById('btn-save-profile').addEventListener('click', saveProfileTitle);

    // Exam Controls
    document.getElementById('btn-start-exam').addEventListener('click', startCBTExam);
    document.getElementById('btn-prev-q').addEventListener('click', () => navigateQuestion(-1));
    document.getElementById('btn-next-q').addEventListener('click', () => navigateQuestion(1));
    document.getElementById('btn-submit-exam').addEventListener('click', submitExamAnswers);

    // Study Mode & Tutor Explanation Controls
    document.getElementById('btn-show-tutor-explain').addEventListener('click', toggleTutorExplanation);
    document.getElementById('cbt-study-mode').addEventListener('change', (e) => {
        const tutorBox = document.getElementById('cbt-tutor-box');
        const explainContent = document.getElementById('cbt-tutor-explain-content');
        if (e.target.checked) {
            if (activeExam) {
                tutorBox.style.display = 'block';
            }
        } else {
            tutorBox.style.display = 'none';
            explainContent.style.display = 'none';
            explainContent.innerHTML = '';
        }
    });

    // Mobile OMR Drawer Toggles
    const btnToggleOMR = document.getElementById('btn-toggle-omr');
    const btnCloseOMR = document.getElementById('btn-close-omr');
    const omrCard = document.querySelector('.omr-card');
    if (btnToggleOMR && omrCard) {
        btnToggleOMR.addEventListener('click', () => {
            omrCard.classList.add('show');
        });
    }
    if (btnCloseOMR && omrCard) {
        btnCloseOMR.addEventListener('click', () => {
            omrCard.classList.remove('show');
        });
    }

    // Mobile Chat Back Navigation
    const btnChatBack = document.getElementById('btn-chat-back');
    const chatRoomLayout = document.querySelector('.chat-room-layout');
    if (btnChatBack && chatRoomLayout) {
        btnChatBack.addEventListener('click', () => {
            chatRoomLayout.classList.remove('show-chat');
        });
    }

    // Analysis sub-tab switching
    document.querySelectorAll('.analysis-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const subtabId = btn.getAttribute('data-subtab');
            
            // Toggle active tab button
            document.querySelectorAll('.analysis-tab-btn').forEach(b => {
                b.classList.toggle('active', b === btn);
            });
            
            // Toggle active subpane
            document.querySelectorAll('.analysis-subpane').forEach(pane => {
                pane.classList.toggle('active', pane.id === `subtab-${subtabId}`);
            });
        });
    });
}

// Fetch Student Profile & Refresh UI
async function fetchStudentProfile() {
    try {
        const response = await fetch('/api/student/dashboard');
        studentProfile = await response.json();
        
        // Update Title Display
        document.getElementById('profile-title').innerText = studentProfile.student_title;
        document.getElementById('welcome-name').innerText = studentProfile.student_title;
        const mobileTitle = document.getElementById('mobile-profile-title');
        if (mobileTitle) {
            mobileTitle.innerText = studentProfile.student_title;
        }
        
        // Update Stats Display
        document.getElementById('stat-total-solved').innerText = studentProfile.total_solved_overall;
        
        // Calculate average accuracy
        const vis = studentProfile.visualization;
        const accuracies = vis.radar_chart_data.datasets[0].data;
        const avgAcc = accuracies.length > 0 
            ? (accuracies.reduce((a, b) => a + b, 0) / accuracies.length).toFixed(1) 
            : '0.0';
        document.getElementById('stat-overall-accuracy').innerText = `${avgAcc}%`;
        
        const remedialInfo = studentProfile.remedial_status;
        document.getElementById('stat-remedial-count').innerText = remedialInfo.remedial_subjects.length;
        
        // Update Warning Banner & Badge Status
        const banner = document.getElementById('warning-banner');
        const statusBadge = document.getElementById('profile-status');
        const remedialBadge = document.getElementById('remedial-badge');
        const mobileRemedialBadge = document.getElementById('mobile-remedial-badge');
        
        if (remedialInfo.is_remedial_required) {
            banner.style.display = 'flex';
            document.getElementById('warning-message').innerText = remedialInfo.coaching_message;
            statusBadge.innerText = '과락 위험';
            statusBadge.className = 'status-badge status-warn';
            if (remedialBadge) remedialBadge.style.display = 'inline-block';
            if (mobileRemedialBadge) mobileRemedialBadge.style.display = 'inline-block';
        } else {
            banner.style.display = 'none';
            statusBadge.innerText = '상태 양호';
            statusBadge.className = 'status-badge status-good';
            if (remedialBadge) remedialBadge.style.display = 'none';
            if (mobileRemedialBadge) mobileRemedialBadge.style.display = 'none';
        }
        
        // Update Sidebar Notifications for Wrong Answers in Chat Tab
        updateWrongQuestionsList();
        
        // Update Charts
        updateChartsData();
        
        // Load remedial questions if tab is active
        if (currentTab === 'remedial') {
            loadRemedialTab();
        }
        
    } catch (e) {
        console.error("Failed to load student profile:", e);
    }
}

// Fetch list of exams
async function fetchExamsList() {
    try {
        const response = await fetch('/api/exams');
        const data = await response.json();
        examsList = data.exams;
        
        const select = document.getElementById('exam-select');
        select.innerHTML = "<option value=''>기출문제를 선택해 주세요</option>";
        
        examsList.forEach(exam => {
            const opt = document.createElement('option');
            opt.value = exam.exam_name;
            opt.innerText = `${exam.exam_name} (${exam.question_count}문항)`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error("Failed to fetch exams list:", e);
    }
}

// Tab Switching Routing
function switchTab(tabId) {
    currentTab = tabId;
    
    // Toggle active menu class
    document.querySelectorAll('.nav-item').forEach(item => {
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
    
    document.getElementById(`${tabId}-tab`).classList.add('active');
    
    // Tab specific load actions
    if (tabId === 'dashboard') {
        fetchStudentProfile();
    } else if (tabId === 'remedial') {
        loadRemedialTab();
    }
}

// Profile Modal Actions
function openProfileModal() {
    document.getElementById('input-student-title').value = studentProfile.student_title;
    document.getElementById('profile-modal').style.display = 'flex';
}

function closeProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
}

async function saveProfileTitle() {
    const newTitle = document.getElementById('input-student-title').value.trim();
    if (!newTitle) return;
    
    try {
        const response = await fetch('/api/student/reset', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ student_title: newTitle })
        });
        const res = await response.json();
        if (res.status === 'success') {
            closeProfileModal();
            fetchStudentProfile();
            // Reset chat welcome message
            document.getElementById('chat-messages').innerHTML = `
                <div class="msg-bubble tutor-msg">
                    <p>안녕하세요, <span class="host-title">${newTitle}</span>! AI Tutor 방에 오신 것을 환영합니다.</p>
                    <p>CBT 모의고사에서 문제를 틀리면, 좌측 리스트에 즉시 취약 노드가 추가됩니다. 문제를 클릭하면 제가 <strong>인지 오류 원인</strong>을 진단해 드리고 <strong>쌍둥이 변형 문제</strong>를 처방해 드릴게요!</p>
                </div>
            `;
        }
    } catch (e) {
        console.error("Failed to update profile title:", e);
    }
}

// Chart.js Setup
function initCharts() {
    const radarCtx = document.getElementById('radarChart').getContext('2d');
    const barCtx = document.getElementById('barChart').getContext('2d');
    
    radarChartInstance = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: [],
            datasets: [{
                label: '과목별 성취도 (%)',
                data: [],
                fill: true,
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderColor: 'rgb(99, 102, 241)',
                pointBackgroundColor: 'rgb(99, 102, 241)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(99, 102, 241)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#9ca3af', font: { family: 'Noto Sans KR', size: 12 } },
                    ticks: { backdropColor: 'transparent', color: '#6b7280', showLabelBackdrop: false },
                    suggestedMin: 0,
                    suggestedMax: 100
                }
            },
            plugins: {
                legend: { labels: { color: '#f3f4f6', font: { family: 'Noto Sans KR' } } }
            }
        }
    });

    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: '정답 수',
                    data: [],
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 1
                },
                {
                    label: '오답 수',
                    data: [],
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', font: { family: 'Noto Sans KR' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', stepSize: 1 }
                }
            },
            plugins: {
                legend: { labels: { color: '#f3f4f6', font: { family: 'Noto Sans KR' } } }
            }
        }
    });
}

function updateChartsData() {
    if (!studentProfile || !radarChartInstance || !barChartInstance) return;
    
    const vis = studentProfile.visualization;
    
    // Update Radar Chart
    radarChartInstance.data.labels = vis.radar_chart_data.labels;
    radarChartInstance.data.datasets[0].data = vis.radar_chart_data.datasets[0].data;
    radarChartInstance.update();
    
    // Update Bar Chart
    barChartInstance.data.labels = vis.bar_chart_data.labels;
    barChartInstance.data.datasets[0].data = vis.bar_chart_data.correct;
    barChartInstance.data.datasets[1].data = vis.bar_chart_data.incorrect;
    barChartInstance.update();
}

// CBT Mock Exam: Load questions
async function startCBTExam() {
    const roundName = document.getElementById('exam-select').value;
    if (!roundName) {
        alert("시험을 치를 기출문제를 선택해 주세요.");
        return;
    }
    
    try {
        const response = await fetch(`/api/exams/${encodeURIComponent(roundName)}`);
        const data = await response.json();
        
        activeExam = data;
        activeQuestionIdx = 0;
        answersSheet = {};
        
        // Reset splash screen and render exam pane
        document.getElementById('cbt-splash').style.display = 'none';
        document.getElementById('cbt-header').style.display = 'none';
        document.getElementById('exam-panel').style.display = 'block';
        
        // Generate OMR marking circles
        renderOMRGrid();
        
        // Load first question
        loadQuestion(0);
        
        // Start Timer
        startExamTimer();
        
    } catch (e) {
        console.error("Failed to start CBT Exam:", e);
    }
}

function startExamTimer() {
    if (examTimerInterval) clearInterval(examTimerInterval);
    examSeconds = 0;
    
    const timerEl = document.getElementById('exam-timer');
    examTimerInterval = setInterval(() => {
        examSeconds++;
        const minutes = Math.floor(examSeconds / 60).toString().padStart(2, '0');
        const seconds = (examSeconds % 60).toString().padStart(2, '0');
        timerEl.innerHTML = `<i class="xi-time"></i> ${minutes}:${seconds}`;
    }, 1000);
}

function loadQuestion(idx) {
    if (!activeExam || idx < 0 || idx >= activeExam.questions.length) return;
    
    activeQuestionIdx = idx;
    const q = activeExam.questions[idx];
    
    // Update UI elements
    document.getElementById('exam-subject-badge').innerText = q.subject;
    document.getElementById('cbt-question-text').innerHTML = formatQuestionText(q.question_text);
    document.getElementById('cbt-progress-text').innerText = `${idx + 1} / ${activeExam.questions.length}`;
    
    // Render question image if exists
    const imgEl = document.getElementById('cbt-question-image');
    if (q.image_url) {
        imgEl.src = q.image_url;
        imgEl.style.display = 'inline-block';
    } else {
        imgEl.style.display = 'none';
        imgEl.removeAttribute('src');
    }
    
    // Render option buttons
    const choicesList = document.getElementById('cbt-choices-list');
    choicesList.innerHTML = '';
    
    q.options.forEach((optionText, choiceIdx) => {
        if (!optionText.strip) optionText = optionText.trim();
        if (!optionText) return; // Skip empty option paddings
        
        const btn = document.createElement('button');
        const choiceNum = (choiceIdx + 1).toString();
        btn.className = 'choice-btn';
        
        // Highlight if already marked
        if (answersSheet[q.question_text] === choiceNum) {
            btn.classList.add('selected');
        }
        
        btn.innerHTML = `<strong>${choiceNum})</strong> ${optionText}`;
        btn.onclick = () => markAnswer(q.question_text, choiceNum);
        choicesList.appendChild(btn);
    });
    
    // Highlight active row in OMR card
    document.querySelectorAll('.omr-row').forEach((row, rowIdx) => {
        if (rowIdx === idx) {
            row.classList.add('active-row');
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            row.classList.remove('active-row');
        }
    });

    // Study Mode & Explanation Box reset
    const studyModeChecked = document.getElementById('cbt-study-mode').checked;
    const tutorBox = document.getElementById('cbt-tutor-box');
    const explainContent = document.getElementById('cbt-tutor-explain-content');
    
    if (studyModeChecked) {
        tutorBox.style.display = 'block';
        explainContent.style.display = 'none';
        explainContent.innerHTML = '';
    } else {
        tutorBox.style.display = 'none';
    }
}

function renderOMRGrid() {
    const grid = document.getElementById('omr-grid');
    grid.innerHTML = '';
    
    activeExam.questions.forEach((q, idx) => {
        const row = document.createElement('div');
        row.className = 'omr-row';
        row.innerHTML = `<span class="q-num">${idx + 1}</span>`;
        
        const choicesDiv = document.createElement('div');
        choicesDiv.className = 'omr-choices';
        
        for (let choiceNum = 1; choiceNum <= 5; choiceNum++) {
            const circle = document.createElement('span');
            circle.className = 'omr-choice';
            circle.innerText = choiceNum;
            circle.setAttribute('data-q-idx', idx);
            circle.setAttribute('data-choice', choiceNum);
            
            circle.onclick = () => {
                markAnswer(q.question_text, choiceNum.toString());
                loadQuestion(idx); // Go to this question
                if (window.innerWidth <= 768) {
                    const omrCard = document.querySelector('.omr-card');
                    if (omrCard) omrCard.classList.remove('show');
                }
            };
            
            choicesDiv.appendChild(circle);
        }
        row.appendChild(choicesDiv);
        grid.appendChild(row);
    });
    
    updateOMRProgressRatio();
}

function markAnswer(questionText, choiceNum) {
    // If clicking already selected choice, unmark it
    if (answersSheet[questionText] === choiceNum) {
        delete answersSheet[questionText];
    } else {
        answersSheet[questionText] = choiceNum;
    }
    
    // Re-highlight choice buttons in current question view
    const q = activeExam.questions[activeQuestionIdx];
    if (q.question_text === questionText) {
        document.querySelectorAll('.choice-btn').forEach((btn, choiceIdx) => {
            const cNum = (choiceIdx + 1).toString();
            if (answersSheet[questionText] === cNum) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }
    
    // Re-highlight OMR circles
    const qIdx = activeExam.questions.findIndex(item => item.question_text === questionText);
    if (qIdx !== -1) {
        const row = document.querySelectorAll('.omr-row')[qIdx];
        row.querySelectorAll('.omr-choice').forEach(circle => {
            const cNum = circle.getAttribute('data-choice');
            if (answersSheet[questionText] === cNum) {
                circle.classList.add('marked');
            } else {
                circle.classList.remove('marked');
            }
        });
    }
    
    updateOMRProgressRatio();
}

function updateOMRProgressRatio() {
    const total = activeExam ? activeExam.questions.length : 0;
    const marked = Object.keys(answersSheet).length;
    document.getElementById('omr-progress-ratio').innerText = `${marked} / ${total}`;
}

function navigateQuestion(direction) {
    if (!activeExam) return;
    const targetIdx = activeQuestionIdx + direction;
    if (targetIdx >= 0 && targetIdx < activeExam.questions.length) {
        loadQuestion(targetIdx);
    }
}

async function toggleTutorExplanation() {
    const explainContent = document.getElementById('cbt-tutor-explain-content');
    if (explainContent.style.display === 'block') {
        explainContent.style.display = 'none';
        return;
    }

    const q = activeExam.questions[activeQuestionIdx];
    if (!q) return;

    // Show loading indicator
    explainContent.style.display = 'block';
    explainContent.innerHTML = `<i class="xi-spinner-5 xi-spin"></i> AI Tutor가 정답 확인 및 오개념 분석 해설을 준비 중입니다...`;

    // Fetch user accuracy
    let subAcc = 0.7;
    if (studentProfile && studentProfile.visualization && studentProfile.visualization.radar_chart_data) {
        const subAccMap = studentProfile.visualization.radar_chart_data;
        const subIdx = subAccMap.labels.indexOf(q.subject);
        subAcc = subIdx !== -1 ? subAccMap.datasets[0].data[subIdx] / 100 : 0.7;
    }
    const isRemedial = studentProfile ? studentProfile.remedial_status.is_remedial_required : false;
    const selectedAns = answersSheet[q.question_text] || "0"; // "0" if not selected yet

    try {
        const response = await fetch('/api/tutor/diagnose', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                subject: q.subject,
                question_text: q.question_text,
                options: q.options,
                selected_answer: selectedAns,
                correct_answer: q.correct_answer,
                round_name: q.round,
                subject_accuracy: subAcc,
                remedial_trigger: isRemedial
            })
        });
        const data = await response.json();
        
        // Render response as HTML using marked.js
        explainContent.innerHTML = marked.parse(data.tutor_response);
    } catch (e) {
        console.error("Failed to fetch tutor explanation:", e);
        explainContent.innerHTML = `⚠️ 오류가 발생했습니다. AI 튜터 서버와의 연결 상태를 확인해 주세요. (${e.message})`;
    }
}

// Final Submit CBT Exam Answers
async function submitExamAnswers() {
    if (!activeExam) return;
    
    const total = activeExam.questions.length;
    const marked = Object.keys(answersSheet).length;
    
    if (marked < total) {
        if (!confirm(`전체 ${total}문항 중 ${total - marked}문항을 마킹하지 않았습니다. 그래도 제출하시겠습니까?`)) {
            return;
        }
    } else {
        if (!confirm("답안지를 제출하고 채점을 진행하시겠습니까?")) {
            return;
        }
    }
    
    // Stop Timer
    if (examTimerInterval) clearInterval(examTimerInterval);
    
    // Submit each answer one-by-one to server for tracking
    let corrects = 0;
    
    // Render full-screen submit loading indicator or block UI
    document.getElementById('btn-submit-exam').innerText = "채점 중...";
    document.getElementById('btn-submit-exam').disabled = true;
    
    for (const q of activeExam.questions) {
        const selected = answersSheet[q.question_text] || ""; // Empty if not solved
        
        try {
            const response = await fetch('/api/student/submit', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    subject: q.subject,
                    question_text: q.question_text,
                    selected_answer: selected,
                    correct_answer: q.correct_answer,
                    round_name: q.round
                })
            });
            const data = await response.json();
            if (data.is_correct) {
                corrects++;
            }
        } catch (e) {
            console.error("Error submitting grading details:", e);
        }
    }
    
    const accuracy = ((corrects / total) * 100).toFixed(1);
    alert(`제출이 완료되었습니다!\n득점: ${corrects} / ${total}문항\n성적: ${accuracy}%`);
    
    // Reset Exam views
    document.getElementById('exam-panel').style.display = 'none';
    document.getElementById('cbt-splash').style.display = 'flex';
    document.getElementById('cbt-header').style.display = 'flex';
    document.getElementById('btn-submit-exam').innerText = "최종 답안 제출";
    document.getElementById('btn-submit-exam').disabled = false;
    activeExam = null;
    
    // Switch to Dashboard
    await fetchStudentProfile();
    switchTab('dashboard');
}

// Update Chat history list for Wrong Answers
function updateWrongQuestionsList() {
    const listDiv = document.getElementById('wrong-questions-list');
    listDiv.innerHTML = '';
    
    if (!studentProfile || studentProfile.total_solved_overall === 0) {
        listDiv.innerHTML = '<p class="empty-text">최근 틀린 문항이 없습니다. 모의고사를 풀어보세요!</p>';
        return;
    }
    
    // Filter history for wrong attempts
    const wrongAttempts = studentProfile.remedial_status.is_remedial_required 
        ? getWrongAttemptsFromHistory()
        : [];
        
    if (wrongAttempts.length === 0) {
        listDiv.innerHTML = '<p class="empty-text">과락 과목이 없거나 오답 노드가 정리되었습니다. 상태가 우수합니다!</p>';
        return;
    }
    
    wrongAttempts.forEach((attempt, idx) => {
        const item = document.createElement('div');
        item.className = 'wrong-item';
        item.innerHTML = `
            <div class="wrong-meta">
                <span class="wrong-subject">${attempt.subject}</span>
                <span class="wrong-round">${attempt.round}</span>
            </div>
            <p title="${attempt.question_text}">${attempt.question_text}</p>
        `;
        item.onclick = () => requestTutorDiagnosis(attempt, item);
        listDiv.appendChild(item);
    });
}

function getWrongAttemptsFromHistory() {
    // Extract unique wrong questions from student history
    // Since history isn't returned fully, we can check solving history metadata or mock it.
    // In our server.py, we only save history in memory, but we can fetch wrong history from dashboard or profile.
    // Let's call endpoint to fetch history
    // Wait, let's write a simple helper that filters history. 
    // In `server.py`, the student model solving history is saved. Let's make an endpoint to fetch it.
    // Wait, let's look at get_dashboard_api_data. It doesn't return full solving history to save size.
    // Let's fetch it from a mock or let's create a route in server.py? No, we don't need another route, 
    // we can add a route or we can just fetch wrong items.
    // Wait, let's create a new route in server.py? We already wrote server.py.
    // Ah, wait! In server.py, the profile contains wrong list? No, server.py did not have a separate wrong list endpoint,
    // but the `demo.py` is fine. Wait, in `server.py`, the `/api/student/dashboard` returns:
    // `remedial_status`: is_remedial_required, remedial_subjects, coaching_message.
    // To list wrong items, we can write a quick endpoint, or just parse wrong questions from the remedial package!
    // Yes! The remedial package returned by `/api/student/remedial` contains the exact wrong/unsolved questions for weak subjects!
    // So we can use the remedial package questions to populate the list!
    // Let's fetch `/api/student/remedial` and use those questions for our "최근 틀린 문항 진단" list! That is extremely clever.
    return [];
}

// Fetch remedial list and render Chat sidebar
async function updateWrongQuestionsList() {
    const listDiv = document.getElementById('wrong-questions-list');
    
    try {
        const response = await fetch('/api/student/remedial');
        const data = await response.json();
        
        listDiv.innerHTML = '';
        if (!data.triggered || data.remedial_questions.length === 0) {
            listDiv.innerHTML = '<p class="empty-text">취약 오답 노드가 없습니다. 대시보드를 확인하세요!</p>';
            return;
        }
        
        data.remedial_questions.forEach((q) => {
            const item = document.createElement('div');
            item.className = 'wrong-item';
            item.innerHTML = `
                <div class="wrong-meta">
                    <span class="wrong-subject">${q.subject}</span>
                    <span class="wrong-round">${q.round}</span>
                </div>
                <p title="${q.question_text}">${q.question_text}</p>
            `;
            item.onclick = () => requestTutorDiagnosis(q, item);
            listDiv.appendChild(item);
        });
    } catch (e) {
        console.error("Failed to load remedial questions for sidebar:", e);
    }
}

// AI Tutor Diagnosis API Call & Response render
async function requestTutorDiagnosis(q, itemEl) {
    // Highlight item
    document.querySelectorAll('.wrong-item').forEach(el => el.classList.remove('active-row'));
    itemEl.classList.add('active-row');
    
    // Slide in chat area on mobile
    const chatRoomLayout = document.querySelector('.chat-room-layout');
    if (chatRoomLayout && window.innerWidth <= 768) {
        chatRoomLayout.classList.add('show-chat');
    }
    
    const messagesDiv = document.getElementById('chat-messages');
    
    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'msg-bubble student-msg';
    userMsg.innerText = `[질문] ${q.subject} 과목의 "${q.question_text.slice(0, 30)}..." 문항이 헷갈립니다. 제가 무엇을 놓치고 있는지 진단해 주세요!`;
    messagesDiv.appendChild(userMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // Show tutor loading bubble
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg-bubble tutor-msg';
    loadingMsg.id = 'tutor-loading-bubble';
    loadingMsg.innerHTML = `<i class="xi-spinner-5 xi-spin"></i> 인지 오류 분석 및 쌍둥이 기출 변형 문항을 제작 중입니다...`;
    messagesDiv.appendChild(loadingMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // Get subject accuracy to pass in payload
    const subAccMap = studentProfile.visualization.radar_chart_data;
    const subIdx = subAccMap.labels.indexOf(q.subject);
    const subAcc = subIdx !== -1 ? subAccMap.datasets[0].data[subIdx] / 100 : 0.5;
    
    try {
        const response = await fetch('/api/tutor/diagnose', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                subject: q.subject,
                question_text: q.question_text,
                options: q.options,
                selected_answer: "1", // simulated selected answer (wrong)
                correct_answer: q.correct_answer,
                round_name: q.round,
                subject_accuracy: subAcc,
                remedial_trigger: studentProfile.remedial_status.is_remedial_required
            })
        });
        
        const data = await response.json();
        
        // Remove loading bubble
        document.getElementById('tutor-loading-bubble').remove();
        
        // Render tutor diagnosis response
        const tutorMsg = document.createElement('div');
        tutorMsg.className = 'msg-bubble tutor-msg';
        
        // Render markdown content using marked.js
        tutorMsg.innerHTML = marked.parse(data.tutor_response);
        messagesDiv.appendChild(tutorMsg);
        
        // Inject Interactive Twin Question Widget
        renderTwinQuestionWidget(data.tutor_response, messagesDiv);
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
    } catch (e) {
        document.getElementById('tutor-loading-bubble').remove();
        console.error("Tutor diagnosis failed:", e);
        const errMsg = document.createElement('div');
        errMsg.className = 'msg-bubble tutor-msg';
        errMsg.innerHTML = `⚠️ 오류가 발생했습니다. AI 튜터 서버와의 연결 상태를 확인해 주세요. (${e.message})`;
        messagesDiv.appendChild(errMsg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

// Parses and injects a live interactive quiz for the twin question inside the chat
function renderTwinQuestionWidget(tutorResponseText, containerEl) {
    // Search for Twin Question in markdown text
    // Structure: "### 🎯 적응형 쌍둥이 변형 문제" followed by questions and answers
    // Let's parse standard choices from markdown text
    const twinStartIdx = tutorResponseText.indexOf("### 🎯 적응형 쌍둥이 변형 문제");
    if (twinStartIdx === -1) return;
    
    const twinText = tutorResponseText.substring(twinStartIdx);
    
    // Find choices
    const choices = [];
    const choiceRegex = /\d\)\s*(.*)/g;
    let match;
    while ((match = choiceRegex.exec(twinText)) !== null) {
        choices.push(match[1].trim());
    }
    
    // Find correct answer (e.g. "정답: 2" or "정답: 4" or "정답: 2)")
    const ansMatch = reSearch(/정답:\s*(\d)/, twinText);
    const correctAnsNum = ansMatch ? ansMatch[1] : "2"; // Default mockup
    
    if (choices.length < 3) return; // Not enough options to build quiz
    
    const widget = document.createElement('div');
    widget.className = 'twin-widget';
    widget.innerHTML = `
        <h4>🎯 실시간 오개념 검증 퀴즈 (쌍둥이 변형)</h4>
        <p>위 문제에 답해보세요. 정답 제출 시 즉각 피드백이 제공됩니다.</p>
        <div class="twin-choices"></div>
    `;
    
    const choicesDiv = widget.querySelector('.twin-choices');
    
    choices.forEach((optText, idx) => {
        const choiceNum = (idx + 1).toString();
        const btn = document.createElement('button');
        btn.className = 'twin-choice-btn';
        btn.innerHTML = `<strong>${choiceNum})</strong> ${optText}`;
        
        btn.onclick = () => {
            // Disable all buttons in widget
            choicesDiv.querySelectorAll('.twin-choice-btn').forEach((b, bIdx) => {
                b.disabled = true;
                const bNum = (bIdx + 1).toString();
                if (bNum === correctAnsNum) {
                    b.classList.add('correct');
                } else if (bNum === choiceNum) {
                    b.classList.add('incorrect');
                }
            });
            
            // Append check feedback
            const feedback = document.createElement('p');
            feedback.style.marginTop = '12px';
            feedback.style.fontSize = '12px';
            feedback.style.fontWeight = 'bold';
            
            if (choiceNum === correctAnsNum) {
                feedback.style.color = 'var(--success)';
                feedback.innerHTML = `✨ 정답입니다! 오개념 극복 완료! 병해충 방제 기작을 확실하게 이해하셨습니다.`;
            } else {
                feedback.style.color = 'var(--danger)';
                feedback.innerHTML = `❌ 오답입니다. 정답은 ${correctAnsNum}번입니다. 위의 해설을 다시 한 번 확인해 주세요!`;
            }
            widget.appendChild(feedback);
        };
        choicesDiv.appendChild(btn);
    });
    
    containerEl.appendChild(widget);
}

// Regex Search Helper
function reSearch(regex, text) {
    const match = regex.exec(text);
    return match;
}

// Load Special Remedial Tab Questions
async function loadRemedialTab() {
    const container = document.getElementById('remedial-container');
    container.innerHTML = `<div class="splash-screen"><i class="xi-spinner-5 xi-spin splash-icon"></i><p>보충 처방 학습지를 생성 중입니다...</p></div>`;
    
    try {
        const response = await fetch('/api/student/remedial');
        const data = await response.json();
        
        container.innerHTML = '';
        
        if (!data.triggered || data.remedial_questions.length === 0) {
            container.innerHTML = `
                <div class="splash-screen glass-card">
                    <i class="xi-check-circle splash-icon" style="color:var(--success);"></i>
                    <h3>현재 보충 처방이 필요 없는 우수한 상태입니다!</h3>
                    <p>성적 대시보드의 정답률이 60% 이상으로 안전하게 관리되고 있습니다.</p>
                </div>
            `;
            return;
        }
        
        // Render remedial questions
        data.remedial_questions.forEach((q, idx) => {
            const card = document.createElement('div');
            card.className = 'remedial-card glass-card';
            
            // Build choices HTML
            let choicesHtml = '';
            q.options.forEach((optText, optIdx) => {
                if (!optText) return;
                const choiceNum = (optIdx + 1).toString();
                choicesHtml += `
                    <button class="choice-btn" id="remedial-btn-${idx}-${choiceNum}" onclick="solveRemedialQuestion(${idx}, ${q.correct_answer}, '${choiceNum}', '${q.subject}', '${q.question_text.replace(/'/g, "\\'")}', '${q.round}')">
                        <strong>${choiceNum})</strong> ${optText}
                    </button>
                `;
            });
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="badge" style="background:var(--warning); color:#0b0f19;">보충 처방 Q${idx + 1}</span>
                    <span class="wrong-subject" style="color:var(--warning); font-size:12px; font-weight:600;">${q.subject}</span>
                </div>
                <h3>${formatQuestionText(q.question_text)}</h3>
                <div class="choices-list">
                    ${choicesHtml}
                </div>
                <div class="remedial-feedback" id="remedial-feedback-${idx}" style="margin-top:16px; display:none;"></div>
            `;
            container.appendChild(card);
        });
        
    } catch (e) {
        console.error("Failed to load remedial tab:", e);
        container.innerHTML = `<div class="splash-screen"><i class="xi-warning splash-icon" style="color:var(--danger);"></i><p>보충 학습지를 가져오는 데 실패했습니다.</p></div>`;
    }
}

// Solve remedial question in remedial tab
async function solveRemedialQuestion(qIdx, correctAns, selectedAns, subject, questionText, roundName) {
    const feedbackDiv = document.getElementById(`remedial-feedback-${qIdx}`);
    const isCorrect = (selectedAns === correctAns.toString());
    
    // Disable all options in the card
    const cardOptions = document.querySelectorAll(`[id^="remedial-btn-${qIdx}-"]`);
    cardOptions.forEach((btn, idx) => {
        btn.disabled = true;
        const bChoiceNum = (idx + 1).toString();
        if (bChoiceNum === correctAns.toString()) {
            btn.classList.add('selected'); // Highlight correct in primary
            btn.style.borderColor = 'var(--success)';
            btn.style.color = 'var(--success)';
        } else if (bChoiceNum === selectedAns) {
            btn.style.borderColor = 'var(--danger)';
            btn.style.color = 'var(--danger)';
        }
    });
    
    // Submit answer to server to record and update stats
    try {
        await fetch('/api/student/submit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                subject: subject,
                question_text: questionText,
                selected_answer: selectedAns,
                correct_answer: correctAns.toString(),
                round_name: roundName
            })
        });
    } catch (e) {
        console.error("Failed to submit remedial answer:", e);
    }
    
    // Render feedback message
    feedbackDiv.style.display = 'block';
    if (isCorrect) {
        feedbackDiv.style.color = 'var(--success)';
        feedbackDiv.style.fontWeight = 'bold';
        feedbackDiv.innerHTML = `🎉 정답입니다! 학습자 이력에 정오답 기록이 실시간 갱신되어 반영되었습니다.`;
    } else {
        feedbackDiv.style.color = 'var(--danger)';
        feedbackDiv.style.fontWeight = 'bold';
        feedbackDiv.innerHTML = `❌ 오답입니다. 정답은 ${correctAns}번입니다. AI 튜터 방에 가서 오개념 진단을 요청하세요!`;
    }
}
