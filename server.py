import os
import json
import urllib.request
import urllib.parse
import logging
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from data_pack import DataPackLoader
from student_model import StudentModel
from prompt_orchestrator import GeminiOrchestrator

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Load .env file if exists
if os.path.exists(".env"):
    try:
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                if line.strip() and not line.startswith("#"):
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        os.environ[parts[0].strip()] = parts[1].strip()
        logger.info("Successfully loaded environment variables from .env file.")
    except Exception as e:
        logger.warning(f"Failed to load .env file: {e}")

app = FastAPI(title="AI Tutor Web Portal")


# Global variables for caching loaded data
DATAPACK_LOADER = DataPackLoader(datapacks_dir="./datapacks")
STUDENT_MODEL = StudentModel(student_id="web_student_user", student_title="대표님")

# Load past exam data pack
try:
    DATAPACK_LOADER.load_all_packs()
    logger.info("Exam data packs loaded successfully.")
except Exception as e:
    logger.error(f"Error loading exam data packs: {e}")

# Ensure static directory exists
os.makedirs("./static", exist_ok=True)

class AnswerSubmission(BaseModel):
    subject: str
    question_text: str
    selected_answer: str
    correct_answer: str
    round_name: str

class DiagnoseRequest(BaseModel):
    subject: str
    question_text: str
    options: List[str]
    selected_answer: str
    correct_answer: str
    round_name: str
    subject_accuracy: float
    remedial_trigger: bool

# Serve Frontend Index
@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = "./static/index.html"
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="static/index.html not found. Place frontend files in static/ directory.")

# API: Get List of Exams
@app.get("/api/exams")
async def get_exams():
    pack = DATAPACK_LOADER.get_pack("tree_doctor_past")
    if not pack:
        # Fallback to demo packs if scraper hasn't run yet
        pack = DATAPACK_LOADER.get_pack("tree_doctor")
        if not pack:
            return {"exams": []}
            
    # Calculate counts by round
    exam_map = {}
    for q in pack.questions:
        if q.round not in exam_map:
            exam_map[q.round] = 0
        exam_map[q.round] += 1
        
    exams_list = []
    for exam_name, count in exam_map.items():
        # Match round number (e.g. "제10회 기출" -> 10, "AI 기출문제 1회" -> 1)
        round_match = re.search(r'(\d+)\s*회', exam_name)
        round_num = int(round_match.group(1)) if round_match else 0
        exams_list.append({
            "exam_name": exam_name,
            "round_num": round_num,
            "question_count": count
        })
        
    # Sort by round number descending
    exams_list = sorted(exams_list, key=lambda x: x["round_num"], reverse=True)
    return {"exams": exams_list}

import re

# API: Get Questions for specific Exam Round
@app.get("/api/exams/{round_name}")
async def get_exam_questions(round_name: str):
    pack = DATAPACK_LOADER.get_pack("tree_doctor_past")
    if not pack:
        pack = DATAPACK_LOADER.get_pack("tree_doctor")
        if not pack:
            raise HTTPException(status_code=404, detail="Data pack not found.")
            
    # Filter questions belonging to this round
    questions = [q.model_dump() for q in pack.questions if q.round == round_name]
    
    # Sort questions. If question text starts with a number like "1. ", sort by it
    def get_q_no(q):
        match = re.match(r'^(\d+)\.', q["question_text"])
        if match:
            return int(match.group(1))
        # Fallback: group by subject order
        subjects_order = ["수목병리학", "수목해충학", "수목생리학", "산림토양학", "수목관리학"]
        try:
            return subjects_order.index(q["subject"]) * 1000
        except ValueError:
            return 9999
            
    sorted_questions = sorted(questions, key=get_q_no)
    return {"round_name": round_name, "questions": sorted_questions}

# API: Submit answer for grading and logging
@app.post("/api/student/submit")
async def submit_answer(sub: AnswerSubmission):
    res = STUDENT_MODEL.record_answer(
        subject=sub.subject,
        question_text=sub.question_text,
        selected_answer=sub.selected_answer,
        correct_answer=sub.correct_answer,
        round_name=sub.round_name
    )
    
    # Compute updated diagnostics and dashboard metrics
    dashboard_data = STUDENT_MODEL.get_dashboard_api_data()
    return {
        "is_correct": res["is_correct"],
        "correct_answer": sub.correct_answer,
        "selected_answer": sub.selected_answer,
        "dashboard": dashboard_data
    }

# API: Get Dashboard JSON metrics
@app.get("/api/student/dashboard")
async def get_dashboard():
    return STUDENT_MODEL.get_dashboard_api_data()

# API: Reset Student model (for new session test)
@app.post("/api/student/reset")
async def reset_student(request: Request):
    data = await request.json()
    title = data.get("student_title", "대표님")
    global STUDENT_MODEL
    STUDENT_MODEL = StudentModel(student_id="web_student_user", student_title=title)
    return {"status": "success", "message": f"Student session reset with title '{title}'."}

# API: Get special remedial package
@app.get("/api/student/remedial")
async def get_remedial():
    pack = DATAPACK_LOADER.get_pack("tree_doctor_past")
    if not pack:
        pack = DATAPACK_LOADER.get_pack("tree_doctor")
        if not pack:
            raise HTTPException(status_code=404, detail="Data pack not found.")
            
    remedial_pkg = STUDENT_MODEL.generate_remedial_package(pack, max_questions=5)
    return remedial_pkg

# API: Call Gemini to diagnose errors and generate twin questions
@app.post("/api/tutor/diagnose")
async def diagnose_error(req: DiagnoseRequest):
    # Set the system instruction with correct student title
    system_instruction = GeminiOrchestrator.get_system_instruction(student_title=STUDENT_MODEL.student_title)
    
    # Set the user prompt payload
    q_item = {
        "subject": req.subject,
        "round": req.round_name,
        "question_text": req.question_text,
        "options": req.options,
        "correct_answer": req.correct_answer
    }
    # 채점 결과를 하드코딩하지 않고 학생의 마킹 답안과 실제 정답을 대조하여 판단합니다.
    is_correct = (req.selected_answer == req.correct_answer)

    user_prompt = GeminiOrchestrator.get_user_prompt(
        question_item=q_item,
        student_answer=req.selected_answer,
        is_correct=is_correct,
        remedial_trigger=req.remedial_trigger,
        subject_accuracy=req.subject_accuracy
    )
    
    # Load keys from environment variables
    free_key1 = os.environ.get("GEMINI_API_KEY_FREE1") or os.environ.get("GEMINI_API_KEY")
    free_key2 = os.environ.get("GEMINI_API_KEY_FREE2")
    paid_key = os.environ.get("GEMINI_API_KEY_PAID")
    
    # Put them in order of priority (Free keys first, then Paid key as fallback)
    keys_to_try = []
    if free_key1:
        keys_to_try.append(("무료 키 1", free_key1))
    if free_key2:
        keys_to_try.append(("무료 키 2", free_key2))
    if paid_key:
        keys_to_try.append(("유료 키", paid_key))
        
    if not keys_to_try:
        logger.warning("No Gemini API keys are configured. Running fallback simulation response.")
        mock_response = get_mock_tutor_response(req, STUDENT_MODEL.student_title)
        return {"tutor_response": mock_response, "is_mocked": True}
        
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": user_prompt}
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {"text": system_instruction}
            ]
        },
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 2000
        }
    }
    
    last_error = None
    for key_name, api_key in keys_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        try:
            req_data = json.dumps(payload).encode('utf-8')
            http_req = urllib.request.Request(
                url, 
                data=req_data, 
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(http_req, timeout=30) as response:
                res_data = response.read().decode('utf-8')
                res_json = json.loads(res_data)
                
                # Extract content text from Gemini response structure
                candidates = res_json.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text = parts[0].get("text", "")
                        logger.info(f"Successfully generated tutoring response using {key_name}.")
                        return {"tutor_response": text, "is_mocked": False}
                raise Exception("Empty response structure from Gemini API.")
        except Exception as e:
            logger.warning(f"Failed to query Gemini API with {key_name}: {e}")
            last_error = e
            # Continue to next key (paid key) if available
            continue
            
    # If all keys failed
    logger.error(f"All Gemini API keys failed. Last error: {last_error}")
    friendly_error = f"""### ⚠️ AI Tutor 해설 일시적 이용 불가
현재 등록된 모든 Gemini API 키 호출에 실패했습니다. (마지막 오류: {last_error})

- **원인 및 해결**:
  1. **무료 키 한도 초과**: 분당 호출 한도 초과인 경우 약 1~2분 대기 후 다시 시도해 주세요.
  2. **유료 키 지출 한도 초과**: 유료 프로젝트인 `AITreeDOCTOR11` 프로젝트의 월별 지출 한도(Spend Cap)를 초과했을 가능성이 있습니다. AI Studio 지출 설정 페이지에서 한도를 상향해 주세요.
"""
    return {"tutor_response": friendly_error, "is_mocked": True, "error": str(last_error)}

def get_mock_tutor_response(req: DiagnoseRequest, student_title: str) -> str:
    """Generates a realistic, highly contextual mock tutoring response when API key is missing."""
    options_str = "\n".join([f"  {idx+1}) {opt}" for idx, opt in enumerate(req.options)])
    correct_opt = req.correct_answer
    selected_opt = req.selected_answer
    
    # Find matching option texts for display
    correct_text = req.options[int(correct_opt)-1] if correct_opt.isdigit() and 1<=int(correct_opt)<=5 else correct_opt
    selected_text = req.options[int(selected_opt)-1] if selected_opt.isdigit() and 1<=int(selected_opt)<=5 else selected_opt
    
    if selected_opt == correct_opt or selected_opt == "0":
        return f"""### 🎉 정답입니다!
{student_title}께서는 올바른 답인 **{correct_text}**를 정확하게 선택하셨습니다!

### ⚡ 핵심 요약 피드백
- **핵심 개념**: {correct_text}
- 해당 개념에 대해 완벽하게 이해하고 계십니다. 틀린 오답 선택지들의 함정을 잘 피해 가셨습니다.
- 관련 세부 비교 분석은 Gemini API 복구 후 정상 출제되어 제공됩니다.
"""

    return f"""### 🔍 인지적 오답 진단
{student_title}께서는 **{req.subject}** 과목의 기출문제에서 오개념이 확인되었습니다.
원본 질문: "{req.question_text[:70]}..."
학습자는 올바른 답인 **{correct_text}** 대신 **{selected_text}**를 선택하셨습니다. 이는 개념의 구조적인 차이점과 주요 예방수단의 침투 방제 메커니즘을 혼동하여 발생한 오인성 오답입니다.

### ⚡ 파레토 초압축 피드백
- **원인 ➔ 현상 ➔ 핵심 키워드**:
  * [{req.subject} 개념 혼선 ➔ 오답 항목 함정 밀착 침범 ➔ {correct_text}]
- **핵심 비교 분석**:
| 비교 항목 | 올바른 개념 ({correct_text}) | 혼동한 오답 ({selected_text}) |
| :--- | :--- | :--- |
| **핵심 기작** | 병해에 적합한 특화 예방 및 화학적 방제 | 일반 병균용 살균제 또는 물리적 차단 |
| **방제 특성** | 침투 전파 차단 및 구강 전파 차단 | 수세 증진 및 단순 청결 유지 |
| **대표 특징** | 수간주사 등으로 즉각 화학 작용 | 전신 감염 차단 효과 미미 |

### 🎯 적응형 쌍둥이 변형 문제
- **문제**: "{req.question_text[:50]}..." 의 출제 메커니즘을 적용한 변형 문항입니다. 다음 중 {correct_text}의 기작과 가장 유사한 방제 대책으로 옳은 것은?
- **보기**:
  1) 페니실린계 항생제를 사용하는 방제법
  2) 살포용 유기계 유황합제 소독
  3) 친환경 토양 피복 처리
  4) 테트라사이클린계 항생제 수간주사
  5) 기계유 유제를 통한 월동 해충 구제
  
*정답 및 해설:*
**정답: 4) 테트라사이클린계 항생제 수간주사**
*해설: {correct_text}은/는 특이성 병원체 전파에 대응하므로, 세포벽이 없어 일반 살균제에 저항성을 가지는 병해에는 테트라사이클린계 항생제의 단백질 합성 억제 수간주사가 가장 과학적이고 효과적인 대책이 됩니다.*

### 📢 AI 코칭 메세지
🚨 **{student_title}, 과락 위험이 있어요!**
현재 **{req.subject}** 과목의 정답률은 **{req.subject_accuracy * 100:.1f}%**로 과락 차단선인 60%보다 낮은 수치입니다. 이 문제는 매회 기출에 빠짐없이 나오는 빈출 오개념이므로, 위 대조 표를 머릿속에 각인하시고 오답노트 보충 문제 패키지를 꼭 차근차근 복습해 주세요!
"""

# Mount static files directory (Must be mounted last to not capture API routes)
app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    # Launch Uvicorn server on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
