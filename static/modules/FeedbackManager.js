// AI Explanation & Remedial Feedback Manager

import { state } from './Config.js';
import { 
    safeMarkedParse, 
    postProcessMarkdownHTML, 
    showFloatingCoinToast 
} from './Utils.js';


export function renderFeedbackContent(feedbackText) {
    const container = document.getElementById('cbt-feedback-content');
    if (!container) return;
    
    if (!feedbackText) {
        container.innerHTML = "해설 내용을 로드할 수 없습니다. 다시 시도해 주세요.";
        return;
    }
    
    let mainText = String(feedbackText);
    let twinQuestionText = "";
    
    try {
        let twinStartIdx = mainText.search(/#+\s*4\.\s*일란성\s*(?:쌍둥이|대화)/);
        if (twinStartIdx === -1) {
            twinStartIdx = mainText.search(/4\.\s*일란성\s*(?:쌍둥이|대화)/);
        }
        
        if (twinStartIdx !== -1) {
            const remainingText = mainText.substring(twinStartIdx);
            const nextHeadingMatch = remainingText.match(/\n#+\s*\d/);
            
            if (nextHeadingMatch) {
                const nextHeadingIdx = nextHeadingMatch.index;
                const nextHeadingAbsoluteIdx = twinStartIdx + nextHeadingIdx;
                
                twinQuestionText = mainText.substring(twinStartIdx, nextHeadingAbsoluteIdx);
                mainText = mainText.substring(0, twinStartIdx) + "\n" + mainText.substring(nextHeadingAbsoluteIdx);
            } else {
                mainText = feedbackText.substring(0, twinStartIdx);
                twinQuestionText = feedbackText.substring(twinStartIdx);
            }
        }
        
        container.innerHTML = safeMarkedParse(mainText);
        postProcessMarkdownHTML(container);
        
        if (twinQuestionText) {
            try {
                const widgetHtml = parseTwinQuestionMarkup(twinQuestionText);
                if (widgetHtml) {
                    container.appendChild(widgetHtml);
                }
            } catch(widgetErr) {
                console.error("Widget rendering error:", widgetErr);
                const rawDiv = document.createElement('div');
                rawDiv.innerHTML = safeMarkedParse(twinQuestionText);
                container.appendChild(rawDiv);
            }
        }
    } catch(e) {
        console.error("Markdown rendering error:", e);
        container.innerHTML = mainText; // Fallback to raw text
    }
}

export function parseTwinQuestionMarkup(markup) {
    if (!markup) return null;
    const lines = markup.split('\n');
    let questionTitle = "";
    let options = [];
    let correctAnswer = "";
    
    let titleStarted = false;
    for (let l of lines) {
        l = l.trim();
        if (!l) continue;
        
        if (l.match(/^#+\s*4\.\s*일란성/) || l.includes("4. 일란성")) {
            titleStarted = true;
            continue;
        }
        
        // Match option line: "1) text", "1. text", "[1] text", "① text" (Require closing punctuation to prevent false positives from sentence digits)
        const optMatch = l.match(/^\s*[\(\[]?\s*([1-5])\s*[\)\.\]]\s*(.*)/) || l.match(/^\s*([①-⑤])\s*(.*)/);
        const isAnsLine = l.startsWith("정답:") || l.includes("정답 :") || l.startsWith("정답 ");
        
        if (titleStarted && !optMatch && !isAnsLine) {
            // It's part of the question title
            questionTitle += l + " ";
        } else if (optMatch && !isAnsLine) {
            // It's an option!
            let optNum = optMatch[1];
            let optText = optMatch[2].trim();
            // Normalise circle numbers
            if (optNum === "①") optNum = "1";
            else if (optNum === "②") optNum = "2";
            else if (optNum === "③") optNum = "3";
            else if (optNum === "④") optNum = "4";
            else if (optNum === "⑤") optNum = "5";
            
            // Check and extract inline answer leaks
            const inlineAnsRegex = /\s*(?:\[|\()?정답\s*[:\s]\s*([1-5①-⑤])(?:\]|\))?/g;
            let m;
            while ((m = inlineAnsRegex.exec(optText)) !== null) {
                let ansVal = m[1];
                if (ansVal === "①") ansVal = "1";
                else if (ansVal === "②") ansVal = "2";
                else if (ansVal === "③") ansVal = "3";
                else if (ansVal === "④") ansVal = "4";
                else if (ansVal === "⑤") ansVal = "5";
                correctAnswer = ansVal;
            }
            optText = optText.replace(inlineAnsRegex, "").trim();
            
            options.push({ num: optNum, text: optText });
        } else if (isAnsLine) {
            const match = l.match(/\d/);
            if (match) {
                correctAnswer = match[0];
            } else {
                const circleMatch = l.match(/[①-⑤]/);
                if (circleMatch) {
                    const circleMap = {"①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5"};
                    correctAnswer = circleMap[circleMatch[0]];
                }
            }
        }
    }
    
    // Sort options by number
    options.sort((a, b) => parseInt(a.num) - parseInt(b.num));
    
    // Fallback parsing for non-prefixed lists (exactly 5 trailing lines before the answer)
    if (options.length === 0 && questionTitle) {
        let bodyLines = [];
        let titleFound = false;
        for (let l of lines) {
            l = l.trim();
            if (!l) continue;
            if (l.match(/^#+\s*4\.\s*일란성/) || l.includes("4. 일란성")) {
                titleFound = true;
                continue;
            }
            if (titleFound) {
                if (l.startsWith("정답:") || l.includes("정답 :") || l.startsWith("정답 ")) {
                    const match = l.match(/\d/);
                    if (match) correctAnswer = match[0];
                    break;
                }
                bodyLines.push(l);
            }
        }
        if (bodyLines.length >= 5) {
            const optLines = bodyLines.slice(-5);
            const titleLines = bodyLines.slice(0, -5);
            questionTitle = titleLines.join(" ");
            options = optLines.map((opt, idx) => {
                let optText = opt.trim();
                const inlineAnsRegex = /\s*(?:\[|\()?정답\s*[:\s]\s*([1-5①-⑤])(?:\]|\))?/g;
                let m;
                while ((m = inlineAnsRegex.exec(optText)) !== null) {
                    let ansVal = m[1];
                    if (ansVal === "①") ansVal = "1";
                    else if (ansVal === "②") ansVal = "2";
                    else if (ansVal === "③") ansVal = "3";
                    else if (ansVal === "④") ansVal = "4";
                    else if (ansVal === "⑤") ansVal = "5";
                    correctAnswer = ansVal;
                }
                optText = optText.replace(inlineAnsRegex, "").trim();
                return { num: String(idx + 1), text: optText };
            });
        }
    }
    
    // Debug logging
    fetch('/api/log-client-error', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            message: `[PARSER DEBUG] title="${questionTitle}", opts=${options.length}, ans="${correctAnswer}", markup="${markup.substring(0, 500).replace(/"/g, '\\"')}"`,
            filename: 'index.js',
            lineno: 4035,
            colno: 1,
            stack: ''
        })
    });
    
    if (!questionTitle || options.length < 2 || !correctAnswer) {
        const div = document.createElement('div');
        div.className = "twin-fallback-container";
        
        const cleanLines = lines.filter(l => !l.trim().startsWith("정답:") && !l.trim().includes("정답 :") && !l.trim().startsWith("정답 "));
        div.innerHTML = safeMarkedParse(cleanLines.join('\n'));
        
        if (correctAnswer) {
            const answerBtn = document.createElement('button');
            answerBtn.className = "show-twin-answer-btn";
            answerBtn.innerText = "🔑 정답 확인하기";
            answerBtn.style.cssText = "background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; margin-top: 10px; transition: all 0.2s;";
            
            const resultMsg = document.createElement('div');
            resultMsg.style.cssText = "margin-top: 10px; font-weight: bold; color: var(--primary); font-size: 13.5px; padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 4px; border-left: 3px solid var(--primary); display: none;";
            resultMsg.innerHTML = `<i class="xi-info-o"></i> 이 쌍둥이 문제의 정답은 <strong>[${correctAnswer}번]</strong> 입니다.`;
            
            answerBtn.onclick = () => {
                resultMsg.style.display = "block";
                answerBtn.style.display = "none";
            };
            div.appendChild(answerBtn);
            div.appendChild(resultMsg);
        }
        return div;
    }
    
    const widget = document.createElement('div');
    widget.className = "twin-widget";
    
    widget.innerHTML = `
        <h4><i class="xi-code-fork"></i> 일란성 쌍둥이 개념 확인 문제</h4>
        <p style="margin-bottom: 12px; line-height: 1.6; font-size: 13.5px; color: #fff;">${questionTitle}</p>
        <div class="twin-choices" id="twin-choices-${state.currentCbtIndex}"></div>
        <div class="twin-result-message" style="margin-top: 12px; min-height: 24px; display: flex; align-items: center; gap: 6px;"></div>
    `;
    
    const choicesDiv = widget.querySelector(`.twin-choices`);
    options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.className = "twin-choice-btn";
        btn.innerText = `${opt.num}) ${opt.text}`;
        btn.onclick = () => {
            try {
                choicesDiv.querySelectorAll('button').forEach(b => b.disabled = true);
                const resultMsgDiv = widget.querySelector('.twin-result-message');
                
                if (opt.num === correctAnswer) {
                    btn.classList.add('correct');
                    showFloatingCoinToast("🪙 보너스 엽전 +5냥 획득!", true);
                    addBonusCoinsOnServer(5);
                    if (resultMsgDiv) {
                        resultMsgDiv.innerHTML = `<span style="color: #10b981; font-weight: bold; font-size: 13.5px;"><i class="xi-check-circle"></i> 정답입니다! (정답: ${correctAnswer}번)</span>`;
                    }
                } else {
                    btn.classList.add('incorrect');
                    choicesDiv.querySelectorAll('button').forEach(b => {
                        if (b.innerText.startsWith(`${correctAnswer})`)) {
                            b.classList.add('correct');
                        }
                    });
                    showFloatingCoinToast("오답입니다. 올바른 지혜를 확인하세요.", false);
                    if (resultMsgDiv) {
                        resultMsgDiv.innerHTML = `<span style="color: #ef4444; font-weight: bold; font-size: 13.5px;"><i class="xi-close-circle"></i> 오답입니다. (정답: ${correctAnswer}번)</span>`;
                    }
                }
            } catch(e) {
                console.error("Error in twin choice click handler:", e);
            }
        };
        choicesDiv.appendChild(btn);
    });
    
    return widget;
}

export async function addBonusCoinsOnServer(amount) {
    try {
        await fetch('/api/tutor/remedial-solve', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_id: state.activeStudentId,
                subject: "보너스",
                score: 100, // mock score to get payout
                coins_reward: amount
            })
        });
    } catch(err) {
        console.error("Failed to add bonus coins:", err);
    }
}
