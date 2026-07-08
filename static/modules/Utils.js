// Utility Functions

import { SCIENTIFIC_NAMES_DICT } from './Config.js';

export function translateScientificNames(text) {
    if (!text) return '';
    let result = String(text);
    
    // Sort keys by length descending to prevent partial replacement
    const sortedKeys = Object.keys(SCIENTIFIC_NAMES_DICT).sort((a, b) => b.length - a.length);
    
    const replacements = [];
    let tokenIndex = 0;
    
    for (const key of sortedKeys) {
        const val = SCIENTIFIC_NAMES_DICT[key];
        const regexStr = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const escapedVal = val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Match the key, ignoring case, but only if not followed by the translation in parentheses
        const regex = new RegExp(`(?:<i>|<em>)?${regexStr}(?:</i>|</em>)?(?!\\s*\\(${escapedVal}\\))`, 'gi');
        
        result = result.replace(regex, (match) => {
            const token = `___SCINAMETOKEN_${tokenIndex}___`;
            replacements.push({
                token: token,
                value: `${match} (${val})`
            });
            tokenIndex++;
            return token;
        });
    }
    
    // Restore tokens
    for (const r of replacements) {
        result = result.replace(r.token, r.value);
    }
    
    return result;
}

// Safe markdown parser wrapper to prevent crashes if Marked CDN fails
export function safeMarkedParse(text) {
    const translatedText = translateScientificNames(text);
    if (typeof marked !== 'undefined' && marked && marked.parse) {
        try {
            return marked.parse(translatedText);
        } catch(e) {
            console.error("Marked parse error:", e);
        }
    }
    // Fallback simple markdown-to-html conversion for basic paragraphs
    return String(translatedText)
        .replace(/### (.*)/g, '<h3>$1</h3>')
        .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br/>');
}

// Post-processes generated markdown HTML container to apply custom section styles and icons
export function postProcessMarkdownHTML(container) {
    if (!container) return;
    container.querySelectorAll('h2, h3').forEach(h3 => {
        const text = h3.innerText.trim();
        let iconClass = "xi-info-o";
        if (text.includes("상황진단") || text.includes("인지진단") || text.includes("분석")) {
            iconClass = "xi-align-justify";
            h3.style.borderColor = "#ff5252";
            h3.style.background = "linear-gradient(90deg, rgba(255, 82, 82, 0.15) 0%, rgba(255, 82, 82, 0.02) 100%)";
            h3.style.color = "#ff8a80";
        } else if (text.includes("압축피드백") || text.includes("핵심 패턴") || text.includes("Pareto")) {
            iconClass = "xi-key";
            h3.style.borderColor = "#4caf50";
            h3.style.background = "linear-gradient(90deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.02) 100%)";
            h3.style.color = "#a5d6a7";
        } else if (text.includes("함정분석") || text.includes("Other Choices")) {
            iconClass = "xi-help-o";
            h3.style.borderColor = "#ff9800";
            h3.style.background = "linear-gradient(90deg, rgba(255, 152, 0, 0.15) 0%, rgba(255, 152, 0, 0.02) 100%)";
            h3.style.color = "#ffcc80";
        } else if (text.includes("코칭") || text.includes("공명") || text.includes("동조") || text.includes("홀딩") || text.includes("진동") || text.includes("Coaching")) {
            iconClass = "xi-emoticon-smiley-o";
            h3.style.borderColor = "var(--primary)";
            h3.style.background = "linear-gradient(90deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.02) 100%)";
            h3.style.color = "var(--primary)";
        }
        h3.innerHTML = `<i class="${iconClass}" style="margin-right: 8px;"></i> ${text}`;
    });
}

// Format question text with html safety and support for bogey box
export function formatQuestionText(text) {
    if (!text) return '';
    
    let translated = translateScientificNames(text);
    
    // Escape HTML tags to prevent broken rendering of brackets
    let escaped = translated
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
        
    // Restore basic formatting tags so they render properly as HTML
    escaped = escaped
        .replace(/&lt;i&gt;/g, '<i>')
        .replace(/&lt;\/i&gt;/g, '</i>')
        .replace(/&lt;em&gt;/g, '<em>')
        .replace(/&lt;\/em&gt;/g, '</em>');
        
    // Format custom bogey tag placeholders
    escaped = escaped
        .replace(/\[BOGEY_START\]/g, '<div class="cbt-bogey-box">')
        .replace(/\[BOGEY_END\]/g, '</div>');
        
    // Replace newlines with <br>
    return escaped.replace(/\n/g, '<br>');
}

export function showFloatingCoinToast(text, isCorrect = true) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '100px';
    toast.style.right = '40px';
    toast.style.background = isCorrect ? 'rgba(212, 175, 55, 0.95)' : 'rgba(239, 68, 68, 0.95)';
    toast.style.color = '#fff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '30px';
    toast.style.fontFamily = "'Noto Sans KR', sans-serif";
    toast.style.fontWeight = 'bold';
    toast.style.fontSize = '14px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.innerHTML = `<i class="xi-wallet"></i> ${text}`;
    
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
