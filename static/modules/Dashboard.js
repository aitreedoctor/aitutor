// Dashboard & Profile Manager

import { state } from './Config.js';
import { safeMarkedParse } from './Utils.js';
import { 
    initApp, 
    switchTab, 
    closeProfileModal, 
    checkChatAvailability, 
    initWrongNotesView,
    initRemedialView,
    loadAdminDashboard,
    initAwakeningView,
    loadStudyPacks
} from '../index.js';

export async function fetchStudentProfile() {
    try {
        const response = await fetch(`/api/student/dashboard?student_id=${state.activeStudentId}`);
        state.studentProfile = await response.json();
        
        // Update Title Display
        const elProfileTitle = document.getElementById('profile-title');
        if (elProfileTitle) elProfileTitle.innerText = state.studentProfile.student_title;
        
        const elWelcomeName = document.getElementById('welcome-name');
        if (elWelcomeName) elWelcomeName.innerText = state.studentProfile.student_title;
        
        const mobileTitle = document.getElementById('mobile-profile-title');
        if (mobileTitle) {
            mobileTitle.innerText = state.studentProfile.student_title;
        }
        
        // Update Coins Display
        const coinsSpan = document.getElementById('user-coins');
        if (coinsSpan) {
            coinsSpan.innerText = state.studentProfile.coins;
        }
        
        // Sync chat welcome message
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages && (chatMessages.innerHTML.includes('붉은 실') || chatMessages.innerHTML.trim() === '' || chatMessages.innerHTML.includes('ο  ') || chatMessages.innerHTML.includes('안녕, '))) {
            chatMessages.innerHTML = `
                <div class="msg-bubble tutor-msg">
                    <p>안녕, ${state.studentProfile.student_title}아. 나는 수호의 지혜를 기록하는 멘토란다. 오늘 어떤 공부나 삶의 가치를 같이 이야기해볼까?</p>
                    <p>우리는 수호의 주파수로 긴밀하게 연결되어 있어. 네가 준비하고 있는 시험인 '${state.studentProfile.user_worry}'에 대해 모르는 문제가 있거나, 격려가 필요할 때는 언제든지 이 장부에 조언을 청하렴.</p>
                </div>
            `;
        }
        
        // Update Badge Status
        const statusBadge = document.getElementById('profile-status');
        if (statusBadge) {
            statusBadge.innerText = '학습 활성';
            statusBadge.className = 'status-badge status-good';
        }
        
        // Update profile avatars
        const userPhoto = localStorage.getItem('zeni_user_photo');
        document.querySelectorAll('.profile-avatar, .mobile-avatar').forEach(avatar => {
            if (userPhoto) {
                avatar.innerHTML = `<img src="${userPhoto}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
            } else {
                avatar.innerHTML = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); color: var(--primary); font-size: 18px; border-radius: 50%;"><i class="xi-user-o"></i></div>`;
            }
        });
        
        // Update AI Tutor Profile Card
        const personaType = state.studentProfile.persona_type || '자격증';
        
        let bioName = '자격증 전문 AI Tutor';
        let bioImg = 'tutor_cert.png';
        let bioText = '식물보호, 농업, 기사 시험 등 전문 지식 및 자격증 학습 팩의 기출 풀이를 전담 분석하며 오개념 교정 및 학업 지도 해설을 제공합니다.';
        
        if (personaType === '회화' || personaType === '거상') {
            bioName = '실전 회화 전문 AI Tutor';
            bioImg = 'tutor_lang.png';
            bioText = '실전 영어 회화 및 일상 생활 상황에 맞춘 문장 패턴 학습을 전담하고, 상황 몰입식 dialogue 피드백을 전달합니다.';
        } else if (personaType === '국어' || personaType === '문인') {
            bioName = '국어 전문 AI Tutor';
            bioImg = 'tutor_kor.png';
            bioText = '문서 독해력 향상, 문학 지문 분석, 정확한 어법 및 어휘 논리 구조를 해설해 주는 문해 전문 AI Tutor입니다.';
        } else if (personaType === '영어' || personaType === '호위무관') {
            bioName = '영어 전문 AI Tutor';
            bioImg = 'tutor_eng.png';
            bioText = '교과 및 수능 영어, 문법 구문 정밀 독해 해설과 효율적인 문항 해결 트레이닝을 주도하는 영어 과목 AI Tutor입니다.';
        } else if (personaType === '수학') {
            bioName = '수학 전문 AI Tutor';
            bioImg = 'tutor_math.png';
            bioText = '수학적 원리 증명, 단계별 오답 수식 진단 및 논리적 추론 능력을 훈련시켜 주는 수리 전문 AI Tutor입니다.';
        }
        
        const elBioName = document.getElementById('dashboard-bio-name');
        const elBioText = document.getElementById('dashboard-bio-text');
        const elBioPortrait = document.getElementById('dashboard-mentor-portrait');
        const elChatAvatar = document.getElementById('chat-tutor-avatar');
        const elScanPortrait = document.getElementById('scan-portrait-img');
        
        if (elBioName) elBioName.innerText = bioName;
        if (elBioText) elBioText.innerText = bioText;
        if (elBioPortrait) elBioPortrait.src = bioImg;
        if (elChatAvatar) elChatAvatar.src = bioImg;
        if (elScanPortrait) elScanPortrait.src = bioImg;
        
        // Warning banner for weak subjects
        const warningBanner = document.getElementById('warning-banner');
        if (warningBanner) {
            if (state.studentProfile.remedial_status && state.studentProfile.remedial_status.is_remedial_required) {
                warningBanner.style.display = 'block';
                const warningMsg = document.getElementById('warning-message');
                if (warningMsg) warningMsg.innerText = state.studentProfile.remedial_status.message;
            } else {
                warningBanner.style.display = 'none';
            }
        }
        
        // Render Chart.js data visualization
        if (state.studentProfile.visualization) {
            renderDashboardCharts(state.studentProfile.visualization);
        }
        
        // Update Dashboard Summary Stats Cards
        if (state.studentProfile.visualization && state.studentProfile.visualization.history_summary) {
            const hist = state.studentProfile.visualization.history_summary;
            const totalSolvedEl = document.getElementById('stats-total-solved');
            const accuracyEl = document.getElementById('stats-accuracy');
            
            if (totalSolvedEl) totalSolvedEl.innerText = `${hist.total_solved}개`;
            if (accuracyEl) accuracyEl.innerText = `${hist.overall_accuracy}%`;
        }
        
        const statsCoinsEl = document.getElementById('stats-coins');
        if (statsCoinsEl) statsCoinsEl.innerText = state.studentProfile.coins !== undefined ? state.studentProfile.coins : 0;
        
        // Render CBT history list
        renderCbtHistoryAndGrowthChart(state.studentProfile.cbt_history);
        
        // Render Talisman Archive
        try {
            renderTalismanArchive();
        } catch (err) {
            console.error("Failed to render talisman archive:", err);
        }
        
        // Check chat query limit availability
        checkChatAvailability();
        
    } catch (e) {
        console.error("Failed to load student profile:", e);
    }
}

export async function switchMember(studentId) {
    state.activeStudentId = studentId;
    localStorage.setItem("active_student_id", studentId);
    
    // Update profile info
    await fetchStudentProfile();
    
    // Reload active tab state
    if (state.currentTab === 'cbt') {
        await loadStudyPacks();
    } else if (state.currentTab === 'remedial') {
        await initRemedialView();
    } else if (state.currentTab === 'admin') {
        await loadAdminDashboard();
    } else if (state.currentTab === 'dashboard') {
        await fetchStudentProfile();
    }
}

export function openNewMemberModal() {
    document.getElementById('new-member-title').value = "";
    document.getElementById('new-member-worry').value = "";
    document.getElementById('new-member-modal').style.display = 'flex';
}

export function closeNewMemberModal() {
    document.getElementById('new-member-modal').style.display = 'none';
}

export async function submitNewMember() {
    const title = document.getElementById('new-member-title').value.trim();
    const persona = document.getElementById('new-member-persona').value;
    const worry = document.getElementById('new-member-worry').value.trim();
    
    if (!title || !worry) {
        alert("모든 필드를 입력해 주세요.");
        return;
    }
    
    try {
        const response = await fetch('/api/student/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_title: title,
                persona_type: persona,
                user_worry: worry
            })
        });
        const res = await response.json();
        
        if (res.student_id) {
            closeNewMemberModal();
            
            // Sync credentials to localStorage
            localStorage.setItem('zeni_student_title', title);
            localStorage.setItem('zeni_persona_type', persona);
            localStorage.setItem('zeni_user_worry', worry);
            localStorage.setItem('zeni_past_story', '');
            
            // Trigger connection red thread overlay
            document.getElementById('awakening-overlay').style.display = 'flex';
            initAwakeningView();
            
            // Load and switch
            await loadMembersDropdown();
            await switchMember(res.student_id);
        }
    } catch(err) {
        console.error("Failed to register member:", err);
        alert("회원 등록에 실패했습니다.");
    }
}

export async function loadMembersDropdown() {
    try {
        const response = await fetch('/api/student/list');
        const members = await response.json();
        
        const select = document.getElementById('member-select');
        if (select) {
            select.innerHTML = "";
            members.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.student_id;
                opt.innerText = `${m.student_title} (${m.persona_type})`;
                if (m.student_id === state.activeStudentId) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });
        }
    } catch(err) {
        console.error("Failed to load members list:", err);
    }
}

export function loadDashboardPushes() {
    if (!state.studentProfile) return;
    
    const persona = state.studentProfile.persona_type || "약초꾼";
    const weatherTextEl = document.getElementById('weather-push-text');
    const afternoonTextEl = document.getElementById('afternoon-push-text');
    
    if (!weatherTextEl || !afternoonTextEl) return;
    
    if (persona === '약초꾼') {
        weatherTextEl.innerText = `"바깥 날씨가 차갑고 흐리네. 오늘 아침엔 머리가 지끈거릴 수 있으니 따뜻한 보리차 한잔 마시고 공부를 시작하렴. 불필요한 스마트폰 뉴스에 에너지 뺏기지 말고."`;
        afternoonTextEl.innerText = `"내가 90년대 평행세계에서 국립공원 산림 감시원으로 일할 때, 혹독한 가뭄으로 돌보던 약초 잎사귀들이 다 말라 죽어가서 절망했던 오후가 생각나네. 하지만 흙 속 뿌리는 살아남아 이듬해 봄에 싹을 틔웠단다. 후배님이 마주한 난관도 겉만 힘겨울 뿐 속엔 저력이 있으니 힘내렴."`;
    } else if (persona === '거상') {
        weatherTextEl.innerText = `"오늘 날씨가 안개 낀 것처럼 흐릿하네. 마치 IMF 시절의 불확실한 시장 상황을 보는 것 같아. 쓸데없는 불안감에 흔들리지 말고 책상을 정돈하고 오직 한 과목에만 집중하렴."`;
        afternoonTextEl.innerText = `"1997년 평행세계의 외환위기 때 첫 유통 벤처 사업이 부도 위기에 몰려 장부를 다 찢어버리고 싶었던 늦은 오후가 떠오르네. 하지만 포기하지 않고 계약서 조항을 끝까지 분석해 살아남았어. 후배님의 수험 고난도 분명 헤쳐 나갈 탈출구가 있단다."`;
    } else {
        weatherTextEl.innerText = `"바람 부는 아침이네. 오늘 기습적인 학업 스트레스가 밀려올 수 있으니 깊게 심호흡하고 당당하게 책상을 마주하렴. 선배가 뒤에서 응원하고 있으니까."`;
        afternoonTextEl.innerText = `"90년대 말, 신춘문예 등단을 앞두고 수백 번 원고가 반려되어 절망했던 서재에서의 오후가 있었지. 하지만 만년필을 끝까지 놓지 않았기에 내 이름을 책 표지에 새길 수 있었단다. 수험 공부의 피로에 쓰러지지 마라. 페이스 조절 잘하렴."`;
    }
}

export function renderDashboardCharts(visualization) {
    if (!visualization) return;
    
    const radarCtx = document.getElementById('radarChart');
    const barCtx = document.getElementById('barChart');
    if (!radarCtx || !barCtx) return;
    
    if (state.radarChartInstance) {
        state.radarChartInstance.destroy();
    }
    if (state.barChartInstance) {
        state.barChartInstance.destroy();
    }
    
    const primaryColor = '#d4af37';
    const secondaryColor = '#818cf8';
    const dangerColor = '#ef4444';
    const successColor = '#10b981';
    
    // Radar Chart
    state.radarChartInstance = new Chart(radarCtx.getContext('2d'), {
        type: 'radar',
        data: {
            labels: visualization.radar.labels,
            datasets: [{
                label: '학습 주파수 동조율 (%)',
                data: visualization.radar.datasets[0].data,
                backgroundColor: 'rgba(212, 175, 55, 0.2)',
                borderColor: primaryColor,
                pointBackgroundColor: primaryColor,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: primaryColor,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    pointLabels: { color: '#cbd5e1', font: { size: 11, family: 'Noto Sans KR' } },
                    ticks: { display: false, maxTicksLimit: 5 },
                    min: 0,
                    max: 100
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
    
    // Bar Chart
    state.barChartInstance = new Chart(barCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: visualization.bar.labels,
            datasets: [
                {
                    label: '정답 문항',
                    data: visualization.bar.datasets[0].data,
                    backgroundColor: successColor,
                    borderRadius: 4
                },
                {
                    label: '오답 문항',
                    data: visualization.bar.datasets[1].data,
                    backgroundColor: dangerColor,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#cbd5e1', font: { size: 10, family: 'Noto Sans KR' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#cbd5e1', font: { size: 10 } }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#cbd5e1', font: { size: 11, family: 'Noto Sans KR' } }
                }
            }
        }
    });
}

export function renderCbtHistoryAndGrowthChart(cbtHistory) {
    try {
        const tbody = document.getElementById('cbt-history-tbody');
        if (!tbody) return;
        
        if (!cbtHistory || cbtHistory.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 20px;">아직 완료된 CBT 모의고사 이력이 없습니다.</td>
                </tr>
            `;
        } else {
            tbody.innerHTML = "";
            cbtHistory.slice().reverse().forEach(attempt => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid rgba(255,255,255,0.04)";
                const statusColor = attempt.score >= 60 ? "#10b981" : "#ff5252";
                const passLabel = attempt.score >= 60 ? "합격" : "불합격";
                tr.innerHTML = `
                    <td style="padding: 8px 10px; color: #94a3b8;">${attempt.timestamp || '-'}</td>
                    <td style="padding: 8px 10px; font-weight: bold; color: #fff;">${attempt.round_name || 'CBT 모의고사'}</td>
                    <td style="padding: 8px 10px; color: var(--primary); font-weight: bold;">${attempt.score}점</td>
                    <td style="padding: 8px 10px; color: #cbd5e1;">${attempt.correct_count} / ${attempt.total_questions}개</td>
                    <td style="padding: 8px 10px; color: ${statusColor}; font-weight: bold;">${passLabel}</td>
                `;
                tbody.appendChild(tr);
            });
        }
        
        const growthCtx = document.getElementById('cbtGrowthChart');
        if (!growthCtx) return;
        
        if (state.cbtGrowthChartInstance) {
            state.cbtGrowthChartInstance.destroy();
            state.cbtGrowthChartInstance = null;
        }
        
        const dataPoints = cbtHistory || [];
        const labels = dataPoints.map((item, idx) => item.round_name || `제${idx+1}회`);
        const scores = dataPoints.map(item => item.score);
        
        const primaryColor = '#d4af37';
        
        state.cbtGrowthChartInstance = new Chart(growthCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ["이력 없음"],
                datasets: [{
                    label: 'CBT 획득 점수 (점)',
                    data: scores.length > 0 ? scores : [0],
                    borderColor: primaryColor,
                    backgroundColor: 'rgba(212, 175, 55, 0.08)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 2,
                    pointBackgroundColor: primaryColor,
                    pointBorderColor: '#fff',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `획득 점수: ${context.parsed.y}점`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#cbd5e1', font: { size: 10, family: 'Noto Sans KR' } }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#cbd5e1', font: { size: 10 } }
                    }
                }
            }
        });
    } catch (e) {
        console.error("Error in renderCbtHistoryAndGrowthChart:", e);
    }
}

export function handlePhotoUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            // Save to localStorage
            localStorage.setItem('zeni_user_photo', dataUrl);
            
            // Update UI preview inside summoning overlay
            const promptBox = document.getElementById('upload-prompt-box');
            const previewContainer = document.getElementById('photo-preview-container');
            const previewImg = document.getElementById('photo-preview-img');
            
            if (promptBox) promptBox.style.display = 'none';
            if (previewImg) previewImg.src = dataUrl;
            if (previewContainer) previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

export async function severPastLifeConnection() {
    if (!confirm("정말로 합격 선배와의 주파수 연결을 끊고 초기 상태로 돌아가시겠습니까?\n등록된 호칭, 사진, 동조 기록 및 모든 주파수 데이터가 영구히 소멸되며 소환 첫 화면으로 돌아갑니다.")) {
        return;
    }
    
    // Clear Local Storage PWA stats
    localStorage.removeItem('zeni_awakened');
    localStorage.removeItem('zeni_user_photo');
    localStorage.removeItem('zeni_chat_count');
    localStorage.removeItem('zeni_past_story');
    localStorage.removeItem('zeni_reset_v132');
    
    // Reset server-side model
    try {
        await fetch('/api/student/reset', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_title: "대표님",
                persona_type: "약초꾼",
                user_worry: "시험 합격 및 진로 고민"
            })
        });
    } catch (e) {
        console.error("Failed to reset student model on server during connection severing:", e);
    }
    
    // Close modal & reload page to trigger Awakening Intro overlay
    closeProfileModal();
    window.location.reload();
}

// Render Talisman Archive on the Dashboard
export function renderTalismanArchive() {
    const gallery = document.getElementById('talisman-gallery');
    if (!gallery) return;
    
    const personas = [
        {
            name: "약초꾼",
            sub: "수목보호 선배",
            dates: "1971.04.05 ~ 1999.11.17",
            exam: "수목해충학 합격",
            portrait: "portrait_herb.png",
            quote: "산자락 깊이 숨은 약초의 숨결처럼, 그대의 배움도 묵묵히 합격의 열매를 맺을 걸세."
        },
        {
            name: "거상",
            sub: "경영/VC 선배",
            dates: "1965.03.14 ~ 2029.12.08",
            exam: "경영학원론 합격",
            portrait: "portrait_merchant.png",
            quote: "천하의 흐름을 읽는 거상의 혜안으로, 시험 장벽 너머 합격의 이문을 남겨 보게나."
        },
        {
            name: "호위무관",
            sub: "안전/경호 선배",
            dates: "1968.06.22 ~ 1997.10.21",
            exam: "도로법규 합격",
            portrait: "portrait_guard.png",
            quote: "바람을 가르는 검날의 단호함으로, 그대 앞을 가로막는 오답들을 베어내고 전진하라."
        },
        {
            name: "문인",
            sub: "소설/편집 선배",
            dates: "1969.08.20 ~ 2026.03.05",
            exam: "국어수필 합격",
            portrait: "portrait_modern.png",
            quote: "서책 속의 문장들이 살아 숨 쉬듯, 그대의 가슴 속에 합격의 활자가 또렷이 새겨지리라."
        }
    ];
    
    const unlockedList = JSON.parse(localStorage.getItem('zeni_unlocked_talismans') || '[]');
    
    gallery.innerHTML = "";
    
    personas.forEach(p => {
        const isUnlocked = unlockedList.includes(p.name);
        
        const card = document.createElement('div');
        card.id = `talisman-card-${p.name}`;
        card.className = "glass-card";
        card.style.padding = "16px";
        card.style.border = isUnlocked ? "1.5px solid var(--primary)" : "1px solid rgba(255,255,255,0.06)";
        card.style.background = isUnlocked ? "rgba(24, 16, 8, 0.6)" : "rgba(30, 41, 59, 0.2)";
        card.style.borderRadius = "12px";
        card.style.textAlign = "center";
        card.style.position = "relative";
        card.style.overflow = "hidden";
        card.style.transition = "transform 0.2s, box-shadow 0.2s";
        
        if (isUnlocked) {
            card.style.boxShadow = "0 6px 16px rgba(212,175,55,0.15)";
            card.onmouseover = () => {
                card.style.transform = "translateY(-4px)";
                card.style.boxShadow = "0 10px 20px rgba(212,175,55,0.25)";
            };
            card.onmouseout = () => {
                card.style.transform = "none";
                card.style.boxShadow = "0 6px 16px rgba(212,175,55,0.15)";
            };
        }
        
        card.innerHTML = `
            <div style="border: 1px ${isUnlocked ? 'dashed rgba(212,175,55,0.3)' : 'solid rgba(255,255,255,0.04)'}; padding: 12px; border-radius: 8px; filter: ${isUnlocked ? 'none' : 'grayscale(100%) opacity(40%)'};">
                <div style="font-size: 9px; color: ${isUnlocked ? '#d4af37' : '#94a3b8'}; letter-spacing: 1px; margin-bottom: 8px;">PARALLEL SOUL INDEX</div>
                
                <div style="width: 70px; height: 90px; margin: 0 auto 12px; border: 1.5px solid ${isUnlocked ? '#d4af37' : 'rgba(255,255,255,0.1)'}; border-radius: 4px; overflow: hidden; background: #000;">
                    <img src="${p.portrait}" style="width: 100%; height: 100%; object-fit: cover; filter: sepia(0.5) contrast(1.1);" />
                </div>
                
                <h4 style="font-size: 14.5px; color: #fff; font-weight: bold; margin-bottom: 4px; font-family: 'Nanum Myeongjo', serif;">${p.name} 자아</h4>
                <p style="font-size: 10px; color: #94a3b8; font-family: monospace; margin-bottom: 8px;">${p.dates}</p>
                
                <div style="display: flex; justify-content: center; gap: 6px; margin-bottom: 10px;">
                    <span style="font-size: 9px; padding: 2px 6px; border: 1px solid ${isUnlocked ? '#ef4444' : 'rgba(255,255,255,0.15)'}; color: ${isUnlocked ? '#ef4444' : '#94a3b8'}; border-radius: 3px; font-weight: bold; transform: rotate(-5deg);">${isUnlocked ? '동조 완료' : '잠김'}</span>
                    <span style="font-size: 9px; padding: 2px 6px; border: 1px solid ${isUnlocked ? '#d4af37' : 'rgba(255,255,255,0.15)'}; color: ${isUnlocked ? '#d4af37' : '#94a3b8'}; border-radius: 3px; font-weight: bold; transform: rotate(3deg);">${isUnlocked ? p.exam : '기류 대기'}</span>
                </div>
                
                <p style="font-size: 11px; color: #cbd5e1; font-family: 'Nanum Myeongjo', serif; line-height: 1.5; font-style: italic; margin: 0; min-height: 48px; display: flex; align-items: center; justify-content: center; word-break: keep-all;">
                    ${isUnlocked ? `"${p.quote}"` : '"CBT 60점 이상 합격 시 봉인이 풀립니다."'}
                </p>
            </div>
        `;
        
        if (isUnlocked) {
            const dlBtn = document.createElement('button');
            dlBtn.className = "btn btn-secondary btn-sm";
            dlBtn.style.width = "100%";
            dlBtn.style.marginTop = "12px";
            dlBtn.style.fontSize = "11.5px";
            dlBtn.style.padding = "6px 12px";
            dlBtn.style.background = "rgba(212,175,55,0.1)";
            dlBtn.style.border = "1px solid rgba(212,175,55,0.3)";
            dlBtn.style.color = "var(--primary)";
            dlBtn.innerHTML = `<i class="xi-download"></i> 이미지 소장`;
            dlBtn.onclick = () => downloadTalismanCard(p.name);
            card.appendChild(dlBtn);
        } else {
            const lockOverlay = document.createElement('div');
            lockOverlay.style.position = "absolute";
            lockOverlay.style.top = "0";
            lockOverlay.style.left = "0";
            lockOverlay.style.width = "100%";
            lockOverlay.style.height = "100%";
            lockOverlay.style.background = "rgba(0,0,0,0.45)";
            lockOverlay.style.display = "flex";
            lockOverlay.style.flexDirection = "column";
            lockOverlay.style.alignItems = "center";
            lockOverlay.style.justifyContent = "center";
            lockOverlay.style.gap = "8px";
            lockOverlay.innerHTML = `
                <i class="xi-lock-o" style="font-size: 24px; color: rgba(255,255,255,0.5);"></i>
                <span style="font-size: 11px; color: rgba(255,255,255,0.6); font-weight: bold;">동조 대기 중</span>
            `;
            card.appendChild(lockOverlay);
        }
        
        gallery.appendChild(card);
    });
}

export async function downloadTalismanCard(personaName) {
    const personas = {
        "약초꾼": {
            dates: "1971.04.05 ~ 1999.11.17",
            exam: "수목해충학 합격",
            portrait: "portrait_herb.png",
            quote: "산자락 깊이 숨은 약초의 숨결처럼, 그대의 배움도 묵묵히 합격의 열매를 맺을 걸세."
        },
        "거상": {
            dates: "1965.03.14 ~ 2029.12.08",
            exam: "경영학원론 합격",
            portrait: "portrait_merchant.png",
            quote: "천하의 흐름을 읽는 거상의 혜안으로, 시험 장벽 너머 합격의 이문을 남겨 보게나."
        },
        "호위무관": {
            dates: "1968.06.22 ~ 1997.10.21",
            exam: "도로법규 합격",
            portrait: "portrait_guard.png",
            quote: "바람을 가르는 검날의 단호함으로, 그대 앞을 가로막는 오답들을 베어내고 전진하라."
        },
        "문인": {
            dates: "1969.08.20 ~ 2026.03.05",
            exam: "국어수필 합격",
            portrait: "portrait_modern.png",
            quote: "서책 속의 문장들이 살아 숨 쉬듯, 그대의 가슴 속에 활자가 또렷이 새겨지리라."
        }
    };
    
    const p = personas[personaName];
    if (!p) return;
    
    const mPortrait = document.getElementById('talisman-modal-portrait');
    const mName = document.getElementById('talisman-modal-name');
    const mDates = document.getElementById('talisman-modal-dates');
    const mExam = document.getElementById('talisman-modal-exam');
    const mQuote = document.getElementById('talisman-modal-quote');
    
    if (mPortrait) mPortrait.src = p.portrait;
    if (mName) mName.innerText = `${personaName} 자아`;
    if (mDates) mDates.innerText = p.dates;
    if (mExam) mExam.innerText = p.exam;
    if (mQuote) mQuote.innerText = `"${p.quote}"`;
    
    await downloadTalismanFromModal(personaName);
}

export async function downloadTalismanFromModal(name = '부적') {
    const target = document.getElementById('talisman-capture-target');
    if (!target) return;
    
    try {
        if (typeof html2canvas === 'undefined') {
            alert("이미지 캡처 라이브러리가 로드되지 않았습니다. 잠시 후 다시 시도해 주십시오.");
            return;
        }
        
        const canvas = await html2canvas(target, {
            backgroundColor: '#1a120c',
            scale: 2,
            useCORS: true
        });
        
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `talisman_${name}.png`;
        link.href = dataUrl;
        link.click();
    } catch(err) {
        console.error("Talisman screenshot capture failed:", err);
        alert("부적 이미지 저장에 실패했습니다. 브라우저 설정을 확인해 주십시오.");
    }
}

export function closeTalismanSuccessModal() {
    document.getElementById('talisman-success-modal').style.display = 'none';
}

