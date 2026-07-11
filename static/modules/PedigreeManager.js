// Premium Study Room & Pedigree Course Manager

import { state } from './Config.js';
import { formatQuestionText } from './Utils.js';

let pedigreeQuestions = [];
let currentPedigreeIndex = 0;
let userPedigreeAnswers = {};
let activeRoundName = "";
let correctCount = 0;

export async function startPedigreeCourse(roundName) {
    activeRoundName = roundName;
    pedigreeQuestions = [];
    currentPedigreeIndex = 0;
    userPedigreeAnswers = {};
    correctCount = 0;
    
    // Switch to tab
    if (window.switchTab) {
        window.switchTab('pedigree');
    }
    
    // Set loading state
    const questionTextEl = document.getElementById('pedigree-question-text');
    if (questionTextEl) {
        questionTextEl.innerHTML = `<div style="text-align: center; padding: 40px;"><i class="xi-spinner-3 xi-spin" style="font-size: 30px; color: #d4af37;"></i><br/><br/>선배들의 오답 이력을 분석하여 비급 모의고사를 출제하고 있습니다...</div>`;
    }
    
    // Clear choices
    document.getElementById('pedigree-options-container').innerHTML = "";
    document.getElementById('pedigree-cheatsheet-btn').style.display = 'none';
    document.getElementById('pedigree-next-btn').style.display = 'none';
    document.getElementById('pedigree-feedback-box').style.display = 'none';
    
    // Update Senior Avatar & Persona based on student profile
    const persona = state.studentProfile ? state.studentProfile.persona_type : "약초꾼";
    
    const avatars = {
        "약초꾼": "portrait_modern.png",
        "거상": "portrait_classic.png",
        "호위무관": "portrait_modern.png",
        "문인": "portrait_classic.png"
    };
    
    const imgEl = document.querySelector('#pedigree-senior-avatar img');
    if (imgEl) {
        imgEl.src = avatars[persona] || "portrait_modern.png";
    }
    
    const seniorTitleEl = document.getElementById('pedigree-senior-title');
    if (seniorTitleEl) {
        seniorTitleEl.innerText = `${persona} 선배의 밀착 지도`;
    }
    
    // Subject badge
    const subjectEl = document.getElementById('pedigree-subject-badge');
    if (subjectEl) {
        subjectEl.innerText = `과목: ${state.selectedWorryText || '전체 과목'}`;
    }

    try {
        const response = await fetch('/api/tutor/generate-pedigree', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_id: state.activeStudentId,
                pack_id: roundName
            })
        });
        const res = await response.json();
        if (res.status === "success") {
            pedigreeQuestions = res.questions;
            renderPedigreeQuestion();
        } else {
            alert("비급 족보 생성에 실패했습니다: " + (res.message || "알 수 없는 오류"));
        }
    } catch(err) {
        console.error("Failed to generate pedigree course:", err);
        alert("비급 족보 스터디 룸 로드에 실패했습니다. 다시 시도해 주십시오.");
    }
}

export function renderPedigreeQuestion() {
    if (pedigreeQuestions.length === 0) return;
    
    const q = pedigreeQuestions[currentPedigreeIndex];
    if (!q) return;
    
    // Progress
    document.getElementById('pedigree-progress-text').innerText = `${currentPedigreeIndex + 1} / 10 문항`;
    document.getElementById('pedigree-progress-bar').style.width = `${(currentPedigreeIndex + 1) * 10}%`;
    
    // Category & text
    const catEl = document.getElementById('pedigree-question-category');
    if (catEl) {
        catEl.innerText = q.is_ai_generated ? "🔥 AI 엄선 예상" : "📖 역대 빈출 기출";
        catEl.style.background = q.is_ai_generated ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)";
        catEl.style.borderColor = q.is_ai_generated ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)";
    }
    
    const textEl = document.getElementById('pedigree-question-text');
    if (textEl) {
        textEl.innerHTML = `<span style="color: #d4af37; font-weight: bold; margin-right: 8px;">Q ${currentPedigreeIndex + 1}.</span>` + formatQuestionText(q.question_text);
    }
    
    // Options
    const container = document.getElementById('pedigree-options-container');
    container.innerHTML = "";
    
    const options = q.options || [];
    options.forEach((optText, index) => {
        if (!optText || optText.trim() === "") return;
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.style.cssText = `
            width: 100%;
            text-align: left;
            padding: 12px 16px;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px;
            color: #e2e8f0;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 8px;
        `;
        
        btn.innerHTML = `<span class="choice-num" style="width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); font-size: 12px; font-weight: bold; color: #fff;">${index + 1}</span> <span>${optText}</span>`;
        btn.onclick = () => selectPedigreeChoice(index + 1, btn);
        container.appendChild(btn);
    });
    
    // Cheat Sheet hint
    const cheatsheetBtn = document.getElementById('pedigree-cheatsheet-btn');
    if (cheatsheetBtn) cheatsheetBtn.style.display = 'flex';
    
    const cheatsheetContent = document.getElementById('pedigree-cheatsheet-content');
    if (cheatsheetContent) {
        cheatsheetContent.innerHTML = q.summary_hint || "선배의 비급 요약 노트가 존재하지 않습니다.";
    }
    
    // Next button
    const nextBtn = document.getElementById('pedigree-next-btn');
    if (nextBtn) {
        nextBtn.style.display = 'none';
        nextBtn.disabled = true;
    }
    
    // Hide feedback
    document.getElementById('pedigree-feedback-box').style.display = 'none';
}

export function selectPedigreeChoice(choiceIndex, btnElement) {
    if (userPedigreeAnswers[currentPedigreeIndex] !== undefined) return;
    
    const q = pedigreeQuestions[currentPedigreeIndex];
    userPedigreeAnswers[currentPedigreeIndex] = choiceIndex;
    
    const correctVal = parseInt(q.correct_answer);
    const isCorrect = (choiceIndex === correctVal);
    
    if (isCorrect) correctCount++;
    
    const optionsContainer = document.getElementById('pedigree-options-container');
    const buttons = optionsContainer.querySelectorAll('button');
    buttons.forEach((btn, idx) => {
        btn.style.cursor = 'default';
        const num = idx + 1;
        const bubble = btn.querySelector('.choice-num');
        
        if (num === correctVal) {
            btn.style.background = 'rgba(16, 185, 129, 0.15)';
            btn.style.borderColor = '#10b981';
            btn.style.color = '#fff';
            if (bubble) {
                bubble.style.background = '#10b981';
                bubble.style.color = '#000';
            }
        } else if (num === choiceIndex && !isCorrect) {
            btn.style.background = 'rgba(239, 68, 68, 0.15)';
            btn.style.borderColor = '#ef4444';
            btn.style.color = '#fff';
            if (bubble) {
                bubble.style.background = '#ef4444';
                bubble.style.color = '#fff';
            }
        } else {
            btn.style.opacity = '0.5';
        }
    });
    
    const feedbackBox = document.getElementById('pedigree-feedback-box');
    const feedbackTitle = document.getElementById('pedigree-feedback-title');
    const feedbackDesc = document.getElementById('pedigree-feedback-desc');
    
    if (feedbackBox && feedbackTitle && feedbackDesc) {
        feedbackBox.style.display = 'block';
        if (isCorrect) {
            feedbackTitle.innerHTML = `<span style="color: #10b981;"><i class="xi-check-circle"></i> 정답입니다!</span>`;
            feedbackDesc.innerText = `선배의 비서가 빛을 발했군요. 다음 문제로 넘어가 집중 학습을 계속하십시오.`;
        } else {
            feedbackTitle.innerHTML = `<span style="color: #ef4444;"><i class="xi-close-circle"></i> 오답입니다. (정답: ${correctVal}번)</span>`;
            feedbackDesc.innerText = `오개념 요약 비법서(📖)를 한 번 더 정독하여 관련 공식과 생리학적 원리를 다시 암기하십시오.`;
        }
    }
    
    const nextBtn = document.getElementById('pedigree-next-btn');
    if (nextBtn) {
        nextBtn.style.display = 'block';
        nextBtn.disabled = false;
    }
}

export function nextPedigreeQuestion() {
    currentPedigreeIndex++;
    if (currentPedigreeIndex < 10) {
        renderPedigreeQuestion();
    } else {
        finishPedigreeCourse();
    }
}

export function toggleSummaryCheatSheet() {
    const panel = document.getElementById('pedigree-cheatsheet-panel');
    if (!panel) return;
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        const cheatsheetBtn = document.getElementById('pedigree-cheatsheet-btn');
        if (cheatsheetBtn) {
            cheatsheetBtn.querySelector('span').innerText = '요약 비법서 닫기 (📖)';
        }
    } else {
        panel.style.display = 'none';
        const cheatsheetBtn = document.getElementById('pedigree-cheatsheet-btn');
        if (cheatsheetBtn) {
            cheatsheetBtn.querySelector('span').innerText = '요약 비법서 열기 (📖)';
        }
    }
}

async function finishPedigreeCourse() {
    const score = correctCount * 10;
    const passed = (score >= 80);
    
    const container = document.getElementById('pedigree-options-container');
    const questionTextEl = document.getElementById('pedigree-question-text');
    
    document.getElementById('pedigree-progress-text').innerText = `10 / 10 완주`;
    document.getElementById('pedigree-progress-bar').style.width = `100%`;
    document.getElementById('pedigree-cheatsheet-btn').style.display = 'none';
    document.getElementById('pedigree-next-btn').style.display = 'none';
    document.getElementById('pedigree-feedback-box').style.display = 'none';
    
    const cheatsheetPanel = document.getElementById('pedigree-cheatsheet-panel');
    if (cheatsheetPanel) cheatsheetPanel.style.display = 'none';
    
    if (passed) {
        questionTextEl.innerHTML = `
            <div style="text-align: center; padding: 40px 10px;">
                <div style="font-size: 55px; color: #d4af37; margin-bottom: 20px; animation: pulse 2s infinite;"><i class="xi-crown"></i></div>
                <h3 style="color: #fff; font-size: 20px; font-weight: bold; margin-bottom: 10px;">비급 족보 최종 합격 달성!</h3>
                <p style="font-size: 14px; color: #cbd5e1; max-width: 450px; margin: 0 auto 24px auto; line-height: 1.6;">
                    축하합니다! 총 10문항 중 **${correctCount}개**를 맞추어 최종 점수 **${score}점**으로 합격 커트라인(80점)을 돌파했습니다.
                    선배의 합격 기세가 가득 담긴 동조 인장(격려 엽서)을 발급해 드립니다.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button class="btn btn-warning" onclick="window.triggerPedigreeTalismanModal()" style="padding: 12px 24px; font-weight: bold; background: #d4af37; border: none; color: #000; border-radius: 8px; cursor: pointer;">
                        <i class="xi-gift"></i> 합격 기념 엽서 발급받기
                    </button>
                    <button class="btn btn-secondary" onclick="window.switchTab('dashboard')" style="padding: 12px 20px; border-radius: 8px; background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15);">
                        학습 대시보드로 돌아가기
                    </button>
                </div>
            </div>
        `;
        container.innerHTML = "";
    } else {
        questionTextEl.innerHTML = `
            <div style="text-align: center; padding: 40px 10px;">
                <div style="font-size: 50px; color: #ef4444; margin-bottom: 20px;"><i class="xi-error-o"></i></div>
                <h3 style="color: #fff; font-size: 19px; font-weight: bold; margin-bottom: 10px;">합격 점수 미달</h3>
                <p style="font-size: 14px; color: #cbd5e1; max-width: 420px; margin: 0 auto 24px auto; line-height: 1.6;">
                    아쉽게도 **${score}점**으로 커트라인(80점)을 넘지 못했습니다. 
                    요약 비법서(📖) 내용을 조금 더 꼼꼼히 확인하고 다시 도전해 보십시오.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button class="btn btn-warning" onclick="window.startPedigreeCourse('${activeRoundName}')" style="padding: 12px 24px; font-weight: bold; background: #d4af37; border: none; color: #000; border-radius: 8px; cursor: pointer;">
                        <i class="xi-redo"></i> 비급 족보 재도전
                    </button>
                    <button class="btn btn-secondary" onclick="window.switchTab('dashboard')" style="padding: 12px 20px; border-radius: 8px; background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15);">
                        포기하고 대시보드로
                    </button>
                </div>
            </div>
        `;
        container.innerHTML = "";
    }
}
