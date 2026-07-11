// Administrator Panel & Library Pack Catalog Manager

import { state } from './Config.js';
import { safeMarkedParse, showFloatingCoinToast } from './Utils.js';

export async function loadAdminDashboard() {
    await fetchAdminBriefing();
    await loadAdminMembersTable();
    updateImportPackageDropdown();
    await loadAdminSourcePhotosGallery();
    await loadAdminFeedbacks();
}

async function loadAdminSourcePhotosGallery() {
    const gridEl = document.getElementById('admin-source-photos-grid');
    if (!gridEl) return;
    
    gridEl.innerHTML = `<div style="padding: 10px; color: var(--text-secondary);"><i class="xi-spinner-3 xi-spin"></i> 원본 시험지 로드 중...</div>`;
    
    try {
        const res = await fetch('/api/tutor/subjective/questions?pack_name=' + encodeURIComponent('나무의사_실기_필답형_사진복원_기출_팩') + '&t=' + Date.now());
        const data = await res.json();
        if (data.processed_images && data.processed_images.length > 0) {
            gridEl.innerHTML = "";
            data.processed_images.forEach(imgName => {
                const imgPath = `/past_photos/${imgName}`;
                const img = document.createElement('img');
                img.src = imgPath;
                img.alt = imgName;
                img.style.height = "90px";
                img.style.borderRadius = "4px";
                img.style.cursor = "zoom-in";
                img.style.border = "1.5px solid rgba(255,255,255,0.15)";
                img.style.transition = "transform 0.15s ease";
                img.onmouseover = () => { img.style.transform = "scale(1.05)"; img.style.borderColor = "var(--primary)"; };
                img.onmouseout = () => { img.style.transform = "scale(1)"; img.style.borderColor = "rgba(255,255,255,0.15)"; };
                img.onclick = () => window.openPhotoLightbox(imgPath);
                gridEl.appendChild(img);
            });
        } else {
            gridEl.innerHTML = `<div style="padding: 10px; color: var(--text-secondary);">원본 시험지가 없습니다.</div>`;
        }
    } catch(err) {
        console.error("Failed to load admin source photos:", err);
        gridEl.innerHTML = `<div style="padding: 10px; color: var(--text-secondary);">로드 실패</div>`;
    }
}

async function fetchAdminBriefing() {
    const container = document.getElementById('admin-briefing-content');
    if (container) {
        container.innerHTML = `<i class="xi-spinner-3 xi-spin"></i> 플랫폼 학습 주파수 감시 장부 분석 중...`;
    }
    
    try {
        const response = await fetch('/api/admin/briefing');
        const res = await response.json();
        if (container) {
            container.innerHTML = safeMarkedParse(res.briefing);
        }
    } catch(err) {
        console.error("Failed to load admin briefing:", err);
        if (container) container.innerText = "운영 보고서 갱신에 실패했습니다.";
    }
}

async function loadAdminMembersTable() {
    const tbody = document.getElementById('admin-members-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;"><i class="xi-spinner-3 xi-spin"></i> 대장 조회 중...</td></tr>`;
    
    try {
        const response = await fetch('/api/student/list');
        const members = await response.json();
        
        tbody.innerHTML = "";
        for (let m of members) {
            const dResponse = await fetch(`/api/student/dashboard?student_id=${m.student_id}`);
            const details = await dResponse.json();
            const hist = details.visualization.history_summary;
            
            const row = document.createElement('tr');
            row.style.borderBottom = "1px solid rgba(255,255,255,0.04)";
            row.innerHTML = `
                <td style="padding: 10px 8px; color: var(--text-secondary);">${m.student_id}</td>
                <td style="padding: 10px 8px; font-weight: bold; color: #fff;">${m.student_title}</td>
                <td style="padding: 10px 8px;"><span class="status-badge" style="background: rgba(212,175,55,0.1); color: var(--primary);">${m.persona_type}</span></td>
                <td style="padding: 10px 8px; color: var(--primary); font-weight: bold;">🪙 ${m.coins}냥</td>
                <td style="padding: 10px 8px;">${hist.total_solved}문항</td>
                <td style="padding: 10px 8px; color: ${hist.overall_accuracy >= 60 ? 'var(--success)' : 'var(--danger)'}; font-weight: bold;">
                    ${hist.overall_accuracy}% (${hist.total_correct}/${hist.total_solved})
                </td>
                <td style="padding: 10px 8px;">
                    <span class="status-badge ${details.remedial_status.is_remedial_required ? 'status-warning' : 'status-good'}">
                        ${details.remedial_status.is_remedial_required ? '처방지 배포됨' : '정상 기류'}
                    </span>
                </td>
            `;
            tbody.appendChild(row);
        }
        
        if (members.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-secondary);">현재 가동 중인 회원 세션이 없습니다.</td></tr>`;
        }
    } catch(err) {
        console.error("Failed to load admin members table:", err);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--danger);">통계 자료 대장 로드에 실패했습니다.</td></tr>`;
    }
}

export async function executeAdminAction(action) {
    if (!confirm(`운영 조치 [${action}]을(를) 가동하시겠습니까?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin/maintenance', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: action })
        });
        const res = await response.json();
        alert(res.message);
        
        await window.loadMembersDropdown();
        await window.switchMember(state.activeStudentId);
    } catch(err) {
        console.error("Failed to execute admin action:", err);
        alert("액션 가동에 실패했습니다.");
    }
}

// Library Catalog Actions
export async function fetchLibraryPacks() {
    try {
        const response = await fetch('/api/tutor/packs');
        const packs = await response.json();
        state.allLibraryPacks = packs;
        renderLibraryCards();
    } catch (err) {
        console.error("Failed to fetch library packs:", err);
    }
}

export function renderLibraryCards() {
    const container = document.getElementById('library-grid-container');
    if (!container) return;
    container.innerHTML = "";
    
    const searchVal = document.getElementById('library-search-input').value.toLowerCase().trim();
    
    state.allLibraryPacks.forEach(p => {
        let category = "자격증";
        let tutorType = "자격증 전문 AI Tutor";
        let tutorImg = "tutor_cert.png";
        
        if (state.selectedLibraryCategory !== "전체" && category !== state.selectedLibraryCategory) {
            return;
        }
        
        if (searchVal && !p.name.toLowerCase().includes(searchVal)) {
            return;
        }
        
        const card = document.createElement('div');
        card.className = 'glass-card library-pack-card';
        card.style.padding = '20px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';
        card.style.minHeight = '180px';
        card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
        card.style.borderRadius = '12px';
        card.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        
        card.onmouseover = () => {
            card.style.transform = 'translateY(-4px)';
            card.style.boxShadow = '0 8px 24px rgba(212,175,55,0.12)';
        };
        card.onmouseout = () => {
            card.style.transform = 'none';
            card.style.boxShadow = 'none';
        };
        
        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <span style="font-size: 11px; font-weight: bold; color: var(--primary); background: rgba(212,175,55,0.1); padding: 4px 8px; border-radius: 12px;">${category === "자격증" ? "자격증 CBT" : (category === "외국어" ? "글로벌 외국어" : "수능/학업")}</span>
                    <span style="font-size: 12px; color: var(--text-secondary);"><i class="xi-paper-o"></i> ${p.count}문항</span>
                </div>
                <h4 style="font-size: 15px; font-weight: bold; color: #fff; margin-bottom: 12px; line-height: 1.4; font-family: 'Noto Sans KR', sans-serif;">${p.name}</h4>
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 16px;">
                    <img src="${tutorImg}" style="width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid var(--primary);" />
                    <span style="font-size: 12px; color: var(--text-secondary);">${tutorType} 배정</span>
                </div>
            </div>
            <button class="btn btn-warning" onclick="showPackDetail('${p.id}')" style="width: 100%; padding: 10px; font-weight: bold; font-size: 12.5px; border-radius: 8px; cursor: pointer; transition: all 0.3s ease;">
                <i class="xi-eye"></i> 상세보기 및 시작
            </button>
        `;
        container.appendChild(card);
    });
}

export function filterLibraryCategory(categoryName) {
    state.selectedLibraryCategory = categoryName;
    
    const filterButtons = document.querySelectorAll('#library-category-filters button');
    filterButtons.forEach(btn => {
        if (btn.innerText.includes(categoryName === '자격증' ? '자격증' : (categoryName === '외국어' ? '외국어' : (categoryName === '학업' ? '학업' : '전체')))) {
            btn.className = "btn btn-warning btn-sm filter-btn active";
        } else {
            btn.className = "btn btn-secondary btn-sm filter-btn";
        }
    });
    
    renderLibraryCards();
}

export function filterLibrarySearch() {
    renderLibraryCards();
}

export async function activatePackFromLibrary(packId) {
    await window.changeStudyPack(packId);
    showFloatingCoinToast("🪙 학습 팩이 성공적으로 활성화되었습니다!", true);
    window.switchTab('cbt');
}

export function showPackDetail(packId) {
    const p = state.allLibraryPacks.find(item => item.id === packId);
    if (!p) return;
    
    const modalName = document.getElementById('detail-modal-pack-name');
    const modalTutorImg = document.getElementById('detail-modal-tutor-img');
    const modalTutorName = document.getElementById('detail-modal-tutor-name');
    const modalIntroText = document.getElementById('detail-modal-intro-text');
    const modalCount = document.getElementById('detail-modal-question-count');
    const btnActivate = document.getElementById('btn-activate-pack-from-detail');
    
    if (modalName) modalName.innerText = p.name;
    if (modalCount) modalCount.innerText = `${p.count.toLocaleString()}문항`;
    
    let tutorName = "자격증 전문 AI Tutor";
    let tutorImg = "tutor_cert.png";
    let introText = "본 패키지는 자격증 취득을 위한 학습 내용과 기출문항을 체계적으로 훈련할 수 있는 전문 학습 팩입니다.";
    
    const idLower = p.id.toLowerCase();
    
    if (idLower.includes("tree_doctor")) {
        tutorName = "자격증 전문 AI Tutor";
        tutorImg = "tutor_cert.png";
        introText = "나무의사 자격증 취득을 위해 수목병리학, 수목해충학, 수목생리학, 산림토양학 및 농약학 등 총 5개 분야의 기출 및 AI 복원 예상 문제를 정밀 분석 훈련할 수 있는 특화 학습 팩입니다.";
    } else if (idLower.includes("plant_protection")) {
        tutorName = "자격증 전문 AI Tutor";
        tutorImg = "tutor_cert.png";
        introText = "식물보호기사 자격증 합격을 위해 식물병리학, 농림해충학, 잡초방제학, 농약학 및 재배학원론 기출문항을 집중 학습하는 패키지입니다.";
    } else if (idLower.includes("driver")) {
        tutorName = "자격증 전문 AI Tutor";
        tutorImg = "tutor_cert.png";
        introText = "도로교통법규, 보행자 보호 의무, 표지판 식별 등 운전면허 학과 필기 시험에 출제되는 모든 문항을 빠르게 훈련하고 검증하는 코스입니다.";
    } else if (idLower.includes("pilot")) {
        tutorName = "자격증 전문 AI Tutor";
        tutorImg = "tutor_cert.png";
        introText = "항공기상, 비행이론, 항공법규 등 조종면허 자격 취득을 위해 항공 지식 및 비행 시뮬레이션 기초 지문을 완벽하게 분석하는 고급 기출 팩입니다.";
    }
    
    if (modalTutorName) modalTutorName.innerText = tutorName;
    if (modalTutorImg) modalTutorImg.src = tutorImg;
    if (modalIntroText) modalIntroText.innerText = introText;
    
    const typeSel = document.getElementById('detail-modal-type-selection');
    if (typeSel) {
        if (idLower.includes('tree_doctor') || idLower.includes('plant_protection')) {
            typeSel.style.display = 'block';
        } else {
            typeSel.style.display = 'none';
        }
    }

    if (btnActivate) {
        btnActivate.onclick = async function() {
            let selectedMode = 'all';
            const radios = document.getElementsByName('detail-pack-type');
            for (let r of radios) {
                if (r.checked) {
                    selectedMode = r.value;
                    break;
                }
            }
            localStorage.setItem('active_question_mode', selectedMode);
            await activatePackFromLibrary(packId);
            closePackDetailModal();
        };
    }
    
    document.getElementById('pack-detail-modal').style.display = 'flex';
}

export function closePackDetailModal() {
    document.getElementById('pack-detail-modal').style.display = 'none';
}

let currentImporterMode = 'manual';

export function switchImporterTab(mode) {
    currentImporterMode = mode;
    
    const btnManual = document.getElementById('tab-btn-manual');
    const btnAuto = document.getElementById('tab-btn-auto');
    const btnAi = document.getElementById('tab-btn-ai');
    const btnHarvest = document.getElementById('tab-btn-harvest');
    
    const paneManual = document.getElementById('importer-pane-manual');
    const paneAuto = document.getElementById('importer-pane-auto');
    const paneAi = document.getElementById('importer-pane-ai');
    const paneHarvest = document.getElementById('importer-pane-harvest');
    
    // Reset all buttons
    [btnManual, btnAuto, btnAi, btnHarvest].forEach(btn => {
        if (btn) {
            btn.className = "btn btn-sm";
            btn.style.background = "rgba(255,255,255,0.03)";
            btn.style.color = "#94a3b8";
            btn.style.borderColor = "rgba(255,255,255,0.06)";
        }
    });
    
    // Hide all panes
    [paneManual, paneAuto, paneAi, paneHarvest].forEach(pane => {
        if (pane) pane.style.display = 'none';
    });
    
    if (mode === 'manual') {
        if (btnManual) {
            btnManual.className = "btn btn-sm active";
            btnManual.style.background = "";
            btnManual.style.color = "";
            btnManual.style.borderColor = "";
        }
        if (paneManual) paneManual.style.display = 'block';
    } else if (mode === 'auto') {
        if (btnAuto) {
            btnAuto.className = "btn btn-sm active";
            btnAuto.style.background = "";
            btnAuto.style.color = "";
            btnAuto.style.borderColor = "";
        }
        if (paneAuto) paneAuto.style.display = 'block';
    } else if (mode === 'ai') {
        if (btnAi) {
            btnAi.className = "btn btn-sm active";
            btnAi.style.background = "";
            btnAi.style.color = "";
            btnAi.style.borderColor = "";
        }
        if (paneAi) paneAi.style.display = 'block';
    } else if (mode === 'harvest') {
        if (btnHarvest) {
            btnHarvest.className = "btn btn-sm active";
            btnHarvest.style.background = "";
            btnHarvest.style.color = "";
            btnHarvest.style.borderColor = "";
        }
        if (paneHarvest) paneHarvest.style.display = 'block';
    }
    updateImportPackageDropdown();
}

export function handleImportFileSelect(input) {
    const fileNameSpan = document.getElementById('import-file-name');
    if (fileNameSpan && input.files && input.files[0]) {
        fileNameSpan.innerText = `선택된 파일: ${input.files[0].name} (${(input.files[0].size / 1024).toFixed(1)} KB)`;
        fileNameSpan.style.color = "var(--primary)";
    }
}

export async function submitImportOrScrape() {
    const packIdInput = document.getElementById('import-pack-id');
    const packNameInput = document.getElementById('import-pack-name');
    const subjectInput = document.getElementById('import-pack-subject');
    const roundInput = document.getElementById('import-pack-round');
    const statusLog = document.getElementById('import-status-log');
    
    const packId = packIdInput ? packIdInput.value.trim() : "";
    const packName = packNameInput ? packNameInput.value.trim() : "";
    const subject = subjectInput ? subjectInput.value.trim() : "";
    const round = roundInput ? roundInput.value.trim() : "";
    
    if (!packId || !packName || !subject || !round) {
        alert("기본 필드(패키지 ID, 패키지 이름, 대표 과목명, 기출 시험 회차명)를 모두 채워주십시오.");
        return;
    }
    
    const idRegex = /^[a-z0-9_]+$/;
    if (!idRegex.test(packId)) {
        alert("패키지 파일 ID는 영문 소문자, 숫자, 언더바(_)만 사용할 수 있습니다. 공백이나 한글, 대문자는 금지됩니다.");
        return;
    }
    
    if (statusLog) {
        statusLog.style.display = 'block';
        statusLog.innerHTML = "";
    }
    
    const appendLog = (msg, type = 'info') => {
        if (!statusLog) return;
        const color = type === 'error' ? '#f87171' : type === 'success' ? '#34d399' : '#818cf8';
        statusLog.innerHTML += `<div style="color: ${color}; margin-bottom: 4px;">[${new Date().toLocaleTimeString()}] ${msg}</div>`;
        statusLog.scrollTop = statusLog.scrollHeight;
    };
    
    if (currentImporterMode === 'manual') {
        const fileInput = document.getElementById('import-file-input');
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            alert("로컬 PDF 또는 TXT 시험 파일을 선택해 주십시오.");
            return;
        }
        
        const file = fileInput.files[0];
        const answersText = document.getElementById('import-answers-text') ? document.getElementById('import-answers-text').value.trim() : "";
        
        appendLog(`[수동 파일 업로드 가동] 파일: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        appendLog("백엔드 서버로 파일 전송 및 텍스트 추출 중...");
        
        const formData = new FormData();
        formData.append("file", file);
        formData.append("pack_id", packId);
        formData.append("pack_name", packName);
        formData.append("subject", subject);
        formData.append("round", round);
        if (answersText) {
            formData.append("answers_text", answersText);
        }
        
        try {
            const response = await fetch('/api/admin/import-pack', {
                method: 'POST',
                body: formData
            });
            const res = await response.json();
            if (response.ok) {
                appendLog(`[성공] ${res.message}`, 'success');
                appendLog("인메모리 데이터 팩 갱신 완료. 학습방에 즉각 반영되었습니다.", 'success');
                showFloatingCoinToast(30);
                
                if (fileInput) fileInput.value = "";
                const fnSpan = document.getElementById('import-file-name');
                if (fnSpan) {
                    fnSpan.innerText = "클릭하여 기출문제 파일 업로드...";
                    fnSpan.style.color = "";
                }
                if (document.getElementById('import-answers-text')) document.getElementById('import-answers-text').value = "";
                
                await window.loadStudyPacks();
                await fetchAdminBriefing();
            } else {
                appendLog(`[실패] ${res.detail || "파싱에 실패했습니다."}`, 'error');
            }
        } catch(err) {
            appendLog(`[서버 통신 에러] ${err}`, 'error');
        }
    } else if (currentImporterMode === 'auto') {
        const urlInput = document.getElementById('import-scrape-url');
        const url = urlInput ? urlInput.value.trim() : "";
        if (!url) {
            alert("CBTBank.kr 시험 URL을 기입해 주십시오.");
            return;
        }
        
        appendLog(`[자동 크롤러 가동] 주소: ${url}`);
        appendLog("CBTBank.kr 웹 문서 다운로드 및 BeautifulSoup 파싱 분석 시작...");
        
        try {
            const response = await fetch('/api/admin/scrape-cbtbank', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    exam_url: url,
                    pack_id: packId,
                    pack_name: packName,
                    subject: subject,
                    round: round
                })
            });
            const res = await response.json();
            if (response.ok) {
                appendLog(`[성공] ${res.message}`, 'success');
                appendLog(`기출 팩 명칭: ${res.pack_name} (총 ${res.total_questions}문항 로딩됨)`, 'success');
                showFloatingCoinToast(50);
                
                if (urlInput) urlInput.value = "";
                
                await window.loadStudyPacks();
                await fetchAdminBriefing();
            } else {
                appendLog(`[실패] ${res.detail || "크롤링 또는 파싱에 실패했습니다."}`, 'error');
            }
        } catch(err) {
            appendLog(`[서버 통신 에러] ${err}`, 'error');
        }
    } else if (currentImporterMode === 'ai') {
        const scopeInput = document.getElementById('import-ai-scope');
        const countSelect = document.getElementById('import-ai-count');
        const aiTypeInput = document.querySelector('input[name="import-ai-type"]:checked');
        const isSubjective = aiTypeInput ? (aiTypeInput.value === 'subjective') : false;
        
        const scope = (scopeInput && scopeInput.value.trim()) ? scopeInput.value.trim() : "해당 과목의 전체 국가 표준 출제 기준 및 핵심 기출 연계 범위 전반";
        const count = countSelect ? parseInt(countSelect.value) : 25;
        
        appendLog(`[AI 출제 위원 가동] 과목: ${subject} | 회차: ${round} | 유형: ${isSubjective ? '2차 실기 서술형' : '1차 객관식 CBT'}`);
        appendLog(`출제 범위 분석 및 문항 생성 중 (요청 문항 수: ${count}개)...`);
        appendLog("Gemini API 호출 및 학술 정합성 체크 실행 중 (최대 1~2분 정도 소요될 수 있습니다)...");
        
        try {
            const response = await fetch('/api/admin/generate-ai-pack', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    pack_id: packId,
                    pack_name: packName,
                    subject: subject,
                    round: round,
                    syllabus_scope: scope,
                    question_count: count,
                    is_subjective: isSubjective
                })
            });
            const res = await response.json();
            if (response.ok) {
                appendLog(`[출제 성공] ${res.message}`, 'success');
                showFloatingCoinToast(50);
                
                if (scopeInput) scopeInput.value = "";
                
                if (isSubjective) {
                    if (typeof window.loadSubjectivePacks === 'function') {
                        await window.loadSubjectivePacks();
                    }
                } else {
                    await window.loadStudyPacks();
                }
                await fetchAdminBriefing();
            } else {
                appendLog(`[출제 실패] ${res.detail || "AI 문제 생성에 실패했습니다."}`, 'error');
            }
        } catch(err) {
            appendLog(`[서버 통신 에러] ${err}`, 'error');
        }
    } else if (currentImporterMode === 'harvest') {
        const harvestUrlInput = document.getElementById('import-harvest-url');
        const url = harvestUrlInput ? harvestUrlInput.value.trim() : "";
        if (!url) {
            alert("유튜브 또는 블로그 URL을 입력해 주십시오.");
            return;
        }
        
        appendLog(`[실기 기출 수확 에이전트 가동] 대상 URL: ${url}`);
        appendLog("유튜브 자막(Transcript) 또는 블로그 본문 텍스트 추출 중...");
        appendLog("Gemini 2.5를 통해 실기 기출문제 분석 및 키워드 채점 사전 빌드 중 (최대 1~2분 소요)...");
        
        try {
            const response = await fetch('/api/admin/harvest-subjective', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    url: url,
                    pack_name: packName,
                    default_subject: subject
                })
            });
            const res = await response.json();
            if (response.ok) {
                appendLog(`[수확 성공] ${res.message}`, 'success');
                appendLog(`실기 팩 명칭: ${res.pack_name} (총 ${res.total_questions}문항 탑재)`, 'success');
                showFloatingCoinToast(50);
                
                if (harvestUrlInput) harvestUrlInput.value = "";
                
                // Reload subjective packs list
                if (typeof window.loadSubjectivePacks === 'function') {
                    await window.loadSubjectivePacks();
                }
                await fetchAdminBriefing();
            } else {
                appendLog(`[수확 실패] ${res.detail || "파싱에 실패했습니다."}`, 'error');
            }
        } catch(err) {
            appendLog(`[서버 통신 에러] ${err}`, 'error');
        }
    }
}

window.setAiScopePreset = function(text) {
    const scopeInput = document.getElementById('import-ai-scope');
    if (scopeInput) {
        scopeInput.value = text;
    }
};

let selectedPackageId = null;

window.selectImportPackage = function(data) {
    const idInput = document.getElementById('import-pack-id');
    const nameInput = document.getElementById('import-pack-name');
    const subjectInput = document.getElementById('import-pack-subject');
    const roundInput = document.getElementById('import-pack-round');
    
    if (!data) {
        // "New Package" selected
        selectedPackageId = null;
        [idInput, nameInput, subjectInput, roundInput].forEach(inp => {
            if (inp) {
                inp.value = "";
                inp.removeAttribute('readonly');
                inp.style.opacity = '1';
                inp.style.background = 'rgba(0,0,0,0.25)';
            }
        });
    } else {
        selectedPackageId = data.id;
        if (idInput) idInput.value = data.id;
        if (nameInput) nameInput.value = data.name;
        if (subjectInput) subjectInput.value = data.subject;
        if (roundInput) roundInput.value = data.round;
        
        [idInput, nameInput, subjectInput, roundInput].forEach(inp => {
            if (inp) {
                inp.setAttribute('readonly', 'true');
                inp.style.opacity = '0.7';
                inp.style.background = 'rgba(255,255,255,0.03)';
            }
        });
    }
    
    // Refresh chips to update selected highlights
    renderImportPackageOptions(window.filteredImportPacksList || window.currentImportPacksList || []);
};

export function updateImportPackageDropdown() {
    const container = document.getElementById('import-package-chips-container');
    if (!container) return;
    
    const aiTypeInput = document.querySelector('input[name="import-ai-type"]:checked');
    const isSubjectiveMode = (currentImporterMode === 'harvest') || 
                             (currentImporterMode === 'ai' && aiTypeInput && aiTypeInput.value === 'subjective');
                             
    const packs = isSubjectiveMode ? (window.subjectivePacks || []) : (window.studyPacks || []);
    
    // Store packs globally for filter matching
    window.currentImportPacksList = packs;
    window.filteredImportPacksList = null;
    
    // Reset selected package when switching tabs/modes
    selectedPackageId = null;
    window.selectImportPackage(null);
    
    // Clear search query text
    const searchInput = document.getElementById('import-package-search');
    if (searchInput) searchInput.value = "";
    
    renderImportPackageOptions(packs);
}

export function renderImportPackageOptions(packs) {
    const container = document.getElementById('import-package-chips-container');
    if (!container) return;
    
    container.innerHTML = "";
    
    // Always render "Create New" chip first
    const newChip = document.createElement('button');
    newChip.type = "button";
    newChip.className = "btn btn-sm";
    
    if (selectedPackageId === null) {
        newChip.style.background = "var(--primary)";
        newChip.style.borderColor = "var(--primary)";
        newChip.style.color = "#fff";
        newChip.style.boxShadow = "0 0 10px rgba(129, 140, 248, 0.4)";
    } else {
        newChip.style.background = "rgba(255, 255, 255, 0.05)";
        newChip.style.borderColor = "rgba(255, 255, 255, 0.1)";
        newChip.style.color = "#94a3b8";
    }
    newChip.style.padding = "6px 14px";
    newChip.style.borderRadius = "20px";
    newChip.style.fontSize = "12px";
    newChip.style.cursor = "pointer";
    newChip.style.borderWidth = "1px";
    newChip.style.borderStyle = "solid";
    newChip.innerText = "➕ [새로운 패키지 직접 입력 생성]";
    newChip.onclick = () => selectImportPackage(null);
    container.appendChild(newChip);
    
    // Render packs
    packs.forEach(p => {
        const id = p.id || "";
        const name = p.name || "";
        const firstWord = name.split(" ")[0] || "기타";
        
        const data = {
            id: id,
            name: name,
            subject: p.subject || firstWord,
            round: p.round || "추가 출제"
        };
        
        const chip = document.createElement('button');
        chip.type = "button";
        chip.className = "btn btn-sm";
        
        if (selectedPackageId === id) {
            chip.style.background = "rgba(129, 140, 248, 0.25)";
            chip.style.borderColor = "var(--primary)";
            chip.style.color = "#fff";
            chip.style.boxShadow = "0 0 8px rgba(129, 140, 248, 0.3)";
        } else {
            chip.style.background = "rgba(255, 255, 255, 0.03)";
            chip.style.borderColor = "rgba(255, 255, 255, 0.08)";
            chip.style.color = "#cbd5e1";
        }
        chip.style.padding = "6px 14px";
        chip.style.borderRadius = "20px";
        chip.style.fontSize = "12px";
        chip.style.cursor = "pointer";
        chip.style.borderWidth = "1px";
        chip.style.borderStyle = "solid";
        chip.innerText = `${name} (${id})`;
        chip.onclick = () => selectImportPackage(data);
        container.appendChild(chip);
    });
}

export function filterImportPackages(query) {
    const term = query.toLowerCase().replace(/\s+/g, '');
    const packs = window.currentImportPacksList || [];
    
    const filtered = packs.filter(p => {
        const name = (p.name || "").toLowerCase().replace(/\s+/g, '');
        const id = (p.id || "").toLowerCase().replace(/\s+/g, '');
        return name.includes(term) || id.includes(term);
    });
    
    window.filteredImportPacksList = filtered;
    renderImportPackageOptions(filtered);
}

window.updateImportPackageDropdown = updateImportPackageDropdown;
window.filterImportPackages = filterImportPackages;

window.handleImportPackageSelectionChange = function(val) {
    const idInput = document.getElementById('import-pack-id');
    const nameInput = document.getElementById('import-pack-name');
    const subjectInput = document.getElementById('import-pack-subject');
    const roundInput = document.getElementById('import-pack-round');
    
    if (val === 'new') {
        [idInput, nameInput, subjectInput, roundInput].forEach(inp => {
            if (inp) {
                inp.value = "";
                inp.removeAttribute('readonly');
                inp.style.opacity = '1';
                inp.style.background = 'rgba(0,0,0,0.25)';
            }
        });
    } else {
        try {
            const data = JSON.parse(val);
            if (idInput) idInput.value = data.id;
            if (nameInput) nameInput.value = data.name;
            if (subjectInput) subjectInput.value = data.subject;
            if (roundInput) roundInput.value = data.round;
            
            [idInput, nameInput, subjectInput, roundInput].forEach(inp => {
                if (inp) {
                    inp.setAttribute('readonly', 'true');
                    inp.style.opacity = '0.7';
                    inp.style.background = 'rgba(255,255,255,0.03)';
                }
            });
        } catch(e) {
            console.error(e);
        }
    }
};

export async function loadAdminFeedbacks() {
    const tbody = document.getElementById('admin-feedbacks-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-secondary);"><i class="xi-spinner-3 xi-spin"></i> 제보 내역을 불러오는 중...</td></tr>`;
    
    try {
        const res = await fetch('/api/admin/feedbacks?t=' + Date.now());
        const feedbacks = await res.json();
        
        if (!feedbacks || feedbacks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-secondary);">접수된 의견/버그 제보가 없습니다.</td></tr>`;
            return;
        }
        
        tbody.innerHTML = "";
        feedbacks.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
            
            const dateStr = item.timestamp ? item.timestamp.split('T')[0] + ' ' + (item.timestamp.split('T')[1] ? item.timestamp.split('T')[1].substring(0, 5) : '') : '-';
            
            let catColor = "rgba(129, 140, 248, 0.15)";
            let catText = "var(--primary)";
            if (item.category === "버그" || item.category === "오류") {
                catColor = "rgba(239, 68, 68, 0.15)";
                catText = "#ef4444";
            } else if (item.category === "제안") {
                catColor = "rgba(16, 185, 129, 0.15)";
                catText = "#10b981";
            }
            
            let statusColor = "rgba(156, 163, 175, 0.15)";
            let statusText = "#9ca3af";
            if (item.status === "접수완료") {
                statusColor = "rgba(59, 130, 246, 0.15)";
                statusText = "#3b82f6";
            } else if (item.status === "조치중") {
                statusColor = "rgba(245, 158, 11, 0.15)";
                statusText = "#f59e0b";
            } else if (item.status === "조치완료") {
                statusColor = "rgba(16, 185, 129, 0.15)";
                statusText = "#10b981";
            } else if (item.status === "보류") {
                statusColor = "rgba(107, 114, 128, 0.25)";
                statusText = "#9ca3af";
            }
            
            const categoryBadge = `<span style="padding: 2px 6px; border-radius: 4px; background: ${catColor}; color: ${catText}; font-size: 11px; font-weight: bold;">${item.category || '기타'}</span>`;
            const statusBadge = `<span style="padding: 2px 6px; border-radius: 4px; background: ${statusColor}; color: ${statusText}; font-size: 11px; font-weight: bold;">${item.status || '접수완료'}</span>`;
            
            const statusSelect = `
                <select onchange="updateFeedbackStatus('${item.id || ''}', this.value)" style="padding: 3px 6px; font-size: 11.5px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; outline: none;">
                    <option value="접수완료" ${item.status === '접수완료' ? 'selected' : ''}>접수완료</option>
                    <option value="조치중" ${item.status === '조치중' ? 'selected' : ''}>조치중</option>
                    <option value="조치완료" ${item.status === '조치완료' ? 'selected' : ''}>조치완료</option>
                    <option value="보류" ${item.status === '보류' ? 'selected' : ''}>보류</option>
                </select>
            `;
            
            tr.innerHTML = `
                <td style="padding: 10px 8px; color: var(--text-secondary); font-family: monospace;">${dateStr}</td>
                <td style="padding: 10px 8px; font-weight: bold;">${item.name || '대표님'}</td>
                <td style="padding: 10px 8px;">${categoryBadge}</td>
                <td style="padding: 10px 8px; word-break: break-all; max-width: 320px; line-height: 1.4;">${item.content || ''}</td>
                <td style="padding: 10px 8px;">${statusBadge}</td>
                <td style="padding: 10px 8px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    ${statusSelect}
                    <button class="btn btn-secondary btn-sm" onclick="deleteFeedback('${item.id || ''}')" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 3px 8px; font-size: 11px;">삭제</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(err) {
        console.error("Failed to load feedbacks:", err);
        tbody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #ef4444;">제보 내역 로드 중 오류가 발생했습니다.</td></tr>`;
    }
}

export async function updateFeedbackStatus(id, newStatus) {
    if (!id) {
        alert("해당 제보 항목의 ID가 없어 상태 변경을 진행할 수 없습니다. (구버전 데이터)");
        return;
    }
    try {
        const res = await fetch('/api/admin/feedback/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, status: newStatus })
        });
        if (res.ok) {
            showFloatingCoinToast(0, "상태가 성공적으로 변경되었습니다.");
            loadAdminFeedbacks();
        } else {
            alert("상태 변경 실패했습니다.");
        }
    } catch (e) {
        console.error("Failed updating feedback status:", e);
        alert("상태 변경 요청 중 오류가 발생했습니다.");
    }
}

export async function deleteFeedback(id) {
    if (!id) {
        alert("해당 제보 항목의 ID가 없어 삭제를 진행할 수 없습니다. (구버전 데이터)");
        return;
    }
    if (!confirm("해당 제보 내역을 완전히 삭제하시겠습니까?")) return;
    try {
        const res = await fetch('/api/admin/feedback/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });
        if (res.ok) {
            showFloatingCoinToast(0, "제보 내역이 삭제되었습니다.");
            loadAdminFeedbacks();
        } else {
            alert("삭제 실패했습니다.");
        }
    } catch (e) {
        console.error("Failed deleting feedback:", e);
        alert("삭제 요청 중 오류가 발생했습니다.");
    }
}

window.loadAdminFeedbacks = loadAdminFeedbacks;
window.updateFeedbackStatus = updateFeedbackStatus;
window.deleteFeedback = deleteFeedback;


