// CBT & OMR Manager

import { state } from './Config.js';
import { 
    showFloatingCoinToast, 
    translateScientificNames, 
    formatQuestionText, 
    safeMarkedParse 
} from './Utils.js';

import { renderFeedbackContent } from './FeedbackManager.js';

export function filterCbtQuestions(subject) {
    state.currentCbtIndex = 0;
    renderCbtQuestion();
}

export function renderCbtQuestion() {
    if (state.cbtQuestions.length === 0) {
        document.getElementById('cbt-question-subject').innerText = "-";
        document.getElementById('cbt-question-round').innerText = "-";
        document.getElementById('cbt-question-body').innerHTML = "선택한 과목의 기출문제가 존재하지 않습니다.";
        document.getElementById('cbt-choices-container').innerHTML = "";
        return;
    }
    
    // Check if a filter is active
    const filterVal = document.getElementById('subject-filter-select').value;
    let activeQuestions = state.cbtQuestions;
    if (filterVal !== "전체") {
        activeQuestions = state.cbtQuestions.filter(q => q.subject === filterVal);
    }
    
    if (state.currentCbtIndex >= activeQuestions.length) {
        state.currentCbtIndex = 0;
    }
    
    const q = activeQuestions[state.currentCbtIndex];
    if (!q) return;
    
    // Find absolute index in original list
    const originalIdx = state.cbtQuestions.indexOf(q);
    
    document.getElementById('cbt-question-subject').innerText = q.subject;
    document.getElementById('cbt-question-round').innerText = q.round;
    
    let bodyHtml = `<span style="color: var(--primary); font-weight: bold; margin-right: 8px;">Q ${originalIdx + 1}.</span>` + formatQuestionText(q.question_text);
    if (q.image_url) {
        bodyHtml += `<div style="margin-top: 15px; margin-bottom: 15px;"><img src="${q.image_url}" alt="Question Diagram" style="max-width: 100%; max-height: 250px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: #fff; padding: 6px;" /></div>`;
    }
    document.getElementById('cbt-question-body').innerHTML = bodyHtml;
    
    const container = document.getElementById('cbt-choices-container');
    container.innerHTML = "";
    
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
    
    displayOptions.forEach((optText, idx) => {
        const btn = document.createElement('button');
        btn.className = "btn btn-secondary";
        btn.style.textAlign = "left";
        btn.style.padding = "12px 16px";
        btn.style.fontSize = "13.5px";
        btn.style.width = "100%";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.gap = "10px";
        
        const displayText = optText ? translateScientificNames(optText) : `선택지 ${idx+1}`;
        btn.innerHTML = `<span style="font-weight: bold; color: var(--primary);">${idx+1})</span> ${displayText}`;
        
        const selected = state.userCbtAnswers[originalIdx];
        if (selected === String(idx+1)) {
            btn.className = "btn btn-primary";
        }
        
        btn.onclick = () => selectCbtChoice(String(idx+1), originalIdx);
        container.appendChild(btn);
    });
    
    // OMR highlight
    document.querySelectorAll('.omr-row').forEach(row => {
        row.classList.remove('active-row');
    });
    const activeRow = document.getElementById(`omr-row-${originalIdx}`);
    if (activeRow) {
        activeRow.classList.add('active-row');
        activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    const feedbackCard = document.getElementById('cbt-feedback-card');
    if (state.cbtSolvedFeedbacks[originalIdx]) {
        feedbackCard.style.display = 'block';
        
        const isCorrect = (state.userCbtAnswers[originalIdx] === q.correct_answer);
        if (isCorrect) {
            feedbackCard.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            feedbackCard.style.boxShadow = '0 8px 32px 0 rgba(16, 185, 129, 0.15)';
        } else {
            feedbackCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            feedbackCard.style.boxShadow = '0 8px 32px 0 rgba(239, 68, 68, 0.15)';
        }
        
        renderFeedbackContent(state.cbtSolvedFeedbacks[originalIdx]);
    } else {
        feedbackCard.style.display = 'none';
    }
}

export function selectCbtChoice(choiceVal, originalIdx) {
    state.userCbtAnswers[originalIdx] = choiceVal;
    
    // Switch active question to the one that was just answered
    state.currentCbtIndex = originalIdx;
    
    document.querySelectorAll(`#omr-row-${originalIdx} .omr-choice`).forEach(bubble => {
        if (bubble.getAttribute('data-val') === choiceVal) {
            bubble.classList.add('marked');
        } else {
            bubble.classList.remove('marked');
        }
    });
    
    updateOmrProgress();
    renderCbtQuestion();
}

export function prevCbtQuestion() {
    const filterVal = document.getElementById('subject-filter-select').value;
    let activeQuestions = state.cbtQuestions;
    if (filterVal !== "전체") {
        activeQuestions = state.cbtQuestions.filter(q => q.subject === filterVal);
    }
    
    if (state.currentCbtIndex > 0) {
        state.currentCbtIndex--;
        renderCbtQuestion();
    } else {
        showFloatingCoinToast("첫 번째 문항입니다.", false);
    }
}

export function nextCbtQuestion() {
    const filterVal = document.getElementById('subject-filter-select').value;
    let activeQuestions = state.cbtQuestions;
    if (filterVal !== "전체") {
        activeQuestions = state.cbtQuestions.filter(q => q.subject === filterVal);
    }
    
    if (state.currentCbtIndex < activeQuestions.length - 1) {
        state.currentCbtIndex++;
        renderCbtQuestion();
    } else {
        showFloatingCoinToast("마지막 문항입니다.", false);
    }
}

export function generateOmrBubbles() {
    const container = document.getElementById('omr-bubbles-container');
    if (!container) return;
    
    container.innerHTML = "";
    
    state.cbtQuestions.forEach((q, idx) => {
        const row = document.createElement('div');
        row.className = "omr-row";
        row.id = `omr-row-${idx}`;
        row.onclick = () => {
            state.currentCbtIndex = idx;
            renderCbtQuestion();
        };
        
        let validOptionsCount = q.options ? q.options.filter(o => o && o.trim() !== "").length : 0;
        if (validOptionsCount === 0) {
            const hasFiveOptions = state.cbtQuestions.some(quest => quest.options && quest.options.length >= 5 && quest.options[4] && quest.options[4].trim() !== "");
            validOptionsCount = hasFiveOptions ? 5 : 4;
        }
        let choicesHtml = "";
        for (let i = 1; i <= validOptionsCount; i++) {
            choicesHtml += `<span class="omr-choice" data-val="${i}">${i}</span>`;
        }
        
        row.innerHTML = `
            <span class="q-num">${idx+1}</span>
            <div class="omr-choices">
                ${choicesHtml}
            </div>
        `;
        
        row.querySelectorAll('.omr-choice').forEach(bubble => {
            bubble.onclick = (e) => {
                e.stopPropagation();
                selectCbtChoice(bubble.getAttribute('data-val'), idx);
            };
        });
        
        container.appendChild(row);
    });
    
    updateOmrProgress();
}

export function updateOmrProgress() {
    const solvedCount = Object.keys(state.userCbtAnswers).length;
    document.getElementById('omr-progress-text').innerText = `${solvedCount} / ${state.cbtQuestions.length}`;
}

export function toggleMobileOmr() {
    const omr = document.querySelector('.omr-card');
    if (omr) {
        state.isMobileOmrOpen = !state.isMobileOmrOpen;
        if (state.isMobileOmrOpen) {
            omr.classList.add('show');
        } else {
            omr.classList.remove('show');
        }
    }
}

export async function submitCbtAnswer() {
    if (state.cbtQuestions.length === 0) return;
    
    const filterVal = document.getElementById('subject-filter-select').value;
    let activeQuestions = state.cbtQuestions;
    if (filterVal !== "전체") {
        activeQuestions = state.cbtQuestions.filter(q => q.subject === filterVal);
    }
    
    const q = activeQuestions[state.currentCbtIndex];
    if (!q) return;
    
    const originalIdx = state.cbtQuestions.indexOf(q);
    const selected = state.userCbtAnswers[originalIdx];
    if (!selected) {
        alert("답안을 먼저 선택해 주세요.");
        return;
    }
    
    const studyPackSelect = document.getElementById('study-pack-select');
    const packName = studyPackSelect ? studyPackSelect.value : 'tree_doctor_past';
    
    const submitBtn = document.getElementById('btn-submit-cbt');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="xi-spinner-3 xi-spin"></i> Thinking...`;
    
    try {
        const response = await fetch('/api/tutor/solve', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_id: state.activeStudentId,
                subject: q.subject,
                round: q.round,
                question_text: q.question_text,
                options: q.options,
                correct_answer: q.correct_answer,
                selected_answer: selected,
                pack_name: packName
            })
        });
        const res = await response.json();
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="xi-check"></i> AI Tutor 답안 확인 및 해설`;
        
        document.getElementById('user-coins').innerText = res.coins;
        state.cbtSolvedFeedbacks[originalIdx] = res.tutor_response;
        
        if (res.is_correct) {
            showFloatingCoinToast("🪙 정답 환급 완료 (+1냥)", true);
            const row = document.getElementById(`omr-row-${originalIdx}`);
            if (row) {
                row.style.background = 'rgba(16, 185, 129, 0.1)';
                row.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            }
        } else {
            showFloatingCoinToast("🪙 오답 엽전 차감 (-1냥)", false);
            const row = document.getElementById(`omr-row-${originalIdx}`);
            if (row) {
                row.style.background = 'rgba(239, 68, 68, 0.1)';
                row.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }
        }
        
        const feedbackCard = document.getElementById('cbt-feedback-card');
        feedbackCard.style.display = 'block';
        if (res.is_correct) {
            feedbackCard.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            feedbackCard.style.boxShadow = '0 8px 32px 0 rgba(16, 185, 129, 0.15)';
        } else {
            feedbackCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            feedbackCard.style.boxShadow = '0 8px 32px 0 rgba(239, 68, 68, 0.15)';
        }
        renderFeedbackContent(res.tutor_response);
        
        // Smooth scroll to the feedback card so the user sees the explanation immediately
        setTimeout(() => {
            feedbackCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        
        await window.fetchStudentProfile();
        
    } catch(err) {
        console.error("Failed to submit CBT answer:", err);
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="xi-check"></i> AI Tutor 답안 확인 및 해설`;
    }
}

export async function gradeCbtExam() {
    const totalQs = state.cbtQuestions.length;
    if (totalQs === 0) return;
    
    const solvedCount = Object.keys(state.userCbtAnswers).length;
    if (solvedCount < 10) {
        alert(`최소 10문제 이상 해결하고 채점을 요청해 주세요. (현재 ${solvedCount}/${totalQs} 문제 해결)`);
        return;
    }
    
    if (!confirm("정말로 답안을 최종 제출하시겠습니까?")) {
        return;
    }
    
    // 1. Calculate Stats
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    const subjectStats = {};
    
    state.cbtQuestions.forEach((q, idx) => {
        const userAns = state.userCbtAnswers[idx];
        const correctAns = q.correct_answer;
        
        if (!subjectStats[q.subject]) {
            subjectStats[q.subject] = { total: 0, correct: 0 };
        }
        subjectStats[q.subject].total++;
        
        if (!userAns) {
            skippedCount++;
        } else if (userAns === correctAns) {
            correctCount++;
            subjectStats[q.subject].correct++;
        } else {
            wrongCount++;
        }
    });
    
    const score = Math.round((correctCount / totalQs) * 100);
    const passStatus = score >= 60 ? "합격 (Pass)" : "불합격 (Fail)";
    const passColor = score >= 60 ? "#10b981" : "#ff5252";
    
    // 2. Identify Strengths and Weaknesses
    let maxSub = "-", maxPct = -1;
    let minSub = "-", minPct = 101;
    
    for (const [sub, stats] of Object.entries(subjectStats)) {
        const pct = Math.round((stats.correct / stats.total) * 100);
        if (pct > maxPct) {
            maxPct = pct;
            maxSub = `${sub} (${pct}%)`;
        }
        if (pct < minPct) {
            minPct = pct;
            minSub = `${sub} (${pct}%)`;
        }
    }
    
    document.getElementById('cbt-report-strength-subject').innerText = maxSub;
    document.getElementById('cbt-report-weakness-subject').innerText = minSub;
    
    // 3. Populate Static Summary in Report Modal
    document.getElementById('cbt-report-score').innerText = `${score}점`;
    document.getElementById('cbt-report-correct').innerText = `${correctCount} / ${totalQs}개`;
    
    const passFailEl = document.getElementById('cbt-report-pass-fail');
    passFailEl.innerText = passStatus;
    passFailEl.style.color = passColor;
    
    // 5. Control Amulet Button visibility based on score
    const amuletBtn = document.getElementById('btn-cbt-report-amulet');
    if (score >= 60) {
        amuletBtn.style.display = "inline-block";
    } else {
        amuletBtn.style.display = "none";
    }
    
    // 6. Show Modal & Loader FIRST so Chart.js can measure canvas dimensions correctly
    document.getElementById('cbt-report-modal').style.display = "flex";
    document.getElementById('cbt-report-ai-loading').style.display = "flex";
    document.getElementById('cbt-report-ai-content').style.display = "none";
    
    // 4. Render Chart.js Horizontal Bar Chart AFTER showing modal
    if (state.cbtReportChartInstance) {
        state.cbtReportChartInstance.destroy();
        state.cbtReportChartInstance = null;
    }
    
    const labels = Object.keys(subjectStats);
    const dataValues = labels.map(sub => {
        const stats = subjectStats[sub];
        return Math.round((stats.correct / stats.total) * 100);
    });
    
    const backgroundColors = dataValues.map(val => val >= 60 ? 'rgba(212, 175, 55, 0.7)' : 'rgba(239, 68, 68, 0.7)');
    const borderColors = dataValues.map(val => val >= 60 ? 'rgba(212, 175, 55, 1)' : 'rgba(239, 68, 68, 1)');
    
    const ctx = document.getElementById('cbt-report-chart').getContext('2d');
    
    const passLinePlugin = {
        id: 'passLine',
        afterDraw(chart) {
            const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
            ctx.save();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            const xPos = x.getPixelForValue(60);
            ctx.beginPath();
            ctx.moveTo(xPos, top);
            ctx.lineTo(xPos, bottom);
            ctx.stroke();
            
            ctx.fillStyle = '#ef4444';
            ctx.font = '10px Noto Sans KR, sans-serif';
            ctx.fillText('합격선 (60%)', xPos + 5, top + 15);
            ctx.restore();
        }
    };
    
    const valueLabelPlugin = {
        id: 'valueLabel',
        afterDatasetsDraw(chart) {
            const { ctx, data } = chart;
            ctx.save();
            ctx.font = 'bold 10px Noto Sans KR, sans-serif';
            ctx.fillStyle = '#cbd5e1';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            
            chart.getDatasetMeta(0).data.forEach((bar, index) => {
                const val = data.datasets[0].data[index];
                const yPos = bar.y;
                const xPos = Math.max(bar.x, bar.base || 0) + 6;
                ctx.fillText(`${val}%`, xPos, yPos);
            });
            ctx.restore();
        }
    };
    
    state.cbtReportChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1,
                barThickness: 16
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `정답률: ${context.parsed.x}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#e2e8f0', font: { size: 11 } }
                }
            }
        },
        plugins: [passLinePlugin, valueLabelPlugin]
    });
    
    // 7. Query Backend for AI Diagnosis Report
    try {
        const attempts = [];
        state.cbtQuestions.forEach((q, idx) => {
            const userAns = state.userCbtAnswers[idx] || "";
            attempts.push({
                subject: q.subject,
                question_text: q.question_text,
                selected_answer: userAns,
                correct_answer: q.correct_answer
            });
        });

        const roundName = state.cbtQuestions[0] ? state.cbtQuestions[0].round : "CBT 모의고사";
        const response = await fetch('/api/tutor/cbt-report', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_id: state.activeStudentId,
                round_name: roundName,
                total_questions: totalQs,
                correct_count: correctCount,
                wrong_count: wrongCount,
                skipped_count: skippedCount,
                score: score,
                subject_stats: subjectStats,
                attempts: attempts
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            try {
                document.getElementById('cbt-report-ai-content').innerHTML = safeMarkedParse(data.report);
            } catch (err) {
                console.error("Failed to parse AI report markdown:", err);
                document.getElementById('cbt-report-ai-content').innerHTML = `<p>${data.report || '리포트 로드에 실패했습니다.'}</p>`;
            }
            
            // Guarantee loader is hidden and content container is visible
            document.getElementById('cbt-report-ai-loading').style.display = "none";
            document.getElementById('cbt-report-ai-content').style.display = "block";
            
            try {
                // Instantly refresh dashboard metrics and coin balances
                await window.fetchStudentProfile();
            } catch (err) {
                console.error("Failed to refresh student profile:", err);
            }
        } else {
            throw new Error("Failed to load AI report.");
        }
    } catch(err) {
        console.error("CBT report error:", err);
        document.getElementById('cbt-report-ai-loading').style.display = "none";
        document.getElementById('cbt-report-ai-content').innerHTML = `
            <div style="color:#ff5252; font-size:12px;">
                <i class="xi-warning"></i> AI 튜터 진단 리포트를 가져오지 못했습니다. 네트워크 상태를 확인해 주세요.
            </div>
        `;
        document.getElementById('cbt-report-ai-content').style.display = "block";
    }
}

export function closeCbtReportModal() {
    document.getElementById('cbt-report-modal').style.display = "none";
}

export async function triggerAmuletFromReport() {
    closeCbtReportModal();
    
    // Unlock the talisman for the current active persona!
    const currentPersona = localStorage.getItem('zeni_persona_type') || '약초꾼';
    const unlockedList = JSON.parse(localStorage.getItem('zeni_unlocked_talismans') || '[]');
    if (!unlockedList.includes(currentPersona)) {
        unlockedList.push(currentPersona);
        localStorage.setItem('zeni_unlocked_talismans', JSON.stringify(unlockedList));
    }
    
    // Open the Talisman Success Modal
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
    
    const p = personas[currentPersona] || personas["약초꾼"];
    
    const mPortrait = document.getElementById('talisman-modal-portrait');
    const mName = document.getElementById('talisman-modal-name');
    const mDates = document.getElementById('talisman-modal-dates');
    const mExam = document.getElementById('talisman-modal-exam');
    const mQuote = document.getElementById('talisman-modal-quote');
    
    if (mPortrait) mPortrait.src = p.portrait;
    if (mName) mName.innerText = `${currentPersona} 자아`;
    if (mDates) mDates.innerText = p.dates;
    if (mExam) mExam.innerText = p.exam;
    if (mQuote) mQuote.innerText = `"${p.quote}"`;
    
    const successModal = document.getElementById('talisman-success-modal');
    if (successModal) successModal.style.display = 'flex';
    
    // Refresh student profile and talisman grid
    await window.fetchStudentProfile();
}
