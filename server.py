import os
import json
import urllib.request
import urllib.parse
import urllib.error
import logging
import re
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException, Request, File, UploadFile, Form
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from student_model import StudentModel
from prompt_orchestrator import GeminiOrchestrator
from past_life_engine import PastLifeEngine

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

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.endswith((".html", ".js", ".css", ".json")) or path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


from data_pack import DataPackLoader, DataPack, QuestionItem



# Load all datapacks
LOADER = DataPackLoader(datapacks_dir="./datapacks")
LOADER.load_all_packs()

@app.post("/api/log-client-error")
async def log_client_error(request: Request):
    try:
        data = await request.json()
        logger.error(f"[CLIENT ERROR] {data.get('message')} at {data.get('filename')}:{data.get('lineno')}:{data.get('colno')}\nStack: {data.get('stack')}")
    except Exception as e:
        logger.error(f"Failed to log client error: {e}")
    return {"status": "ok"}

# Caching layer settings for AI Tutor commentary
USE_EXPLANATION_CACHE = True  # Set to False to bypass cache and always query Gemini in real-time
EXPLANATIONS_CACHE_FILE = "./datapacks_cache/explanations_cache.json"
EXPLANATIONS_CACHE: Dict[str, str] = {}

def load_explanations_cache():
    global EXPLANATIONS_CACHE
    if os.path.exists(EXPLANATIONS_CACHE_FILE):
        try:
            with open(EXPLANATIONS_CACHE_FILE, "r", encoding="utf-8") as f:
                EXPLANATIONS_CACHE = json.load(f)
            logger.info(f"Loaded {len(EXPLANATIONS_CACHE)} items from explanations cache.")
        except Exception as e:
            logger.error(f"Failed to load explanations cache: {e}")
            EXPLANATIONS_CACHE = {}
    else:
        EXPLANATIONS_CACHE = {}

def save_explanations_cache():
    try:
        os.makedirs(os.path.dirname(EXPLANATIONS_CACHE_FILE), exist_ok=True)
        with open(EXPLANATIONS_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(EXPLANATIONS_CACHE, f, ensure_ascii=False, indent=4)
    except Exception as e:
        logger.error(f"Failed to save explanations cache: {e}")

load_explanations_cache()

# Global variables for caching loaded data
SESSIONS: Dict[str, StudentModel] = {}
SESSIONS["web_student_user"] = StudentModel(student_id="web_student_user", student_title="대표님")
STUDENT_MODEL = SESSIONS["web_student_user"]
PAST_LIFE_ENGINE = PastLifeEngine()

def get_student(student_id: Optional[str] = None) -> StudentModel:
    if student_id and student_id in SESSIONS:
        return SESSIONS[student_id]
    return STUDENT_MODEL

def update_question_correct_answer(pack_name: str, question_text: str, new_correct_answer: str):
    try:
        pack_path = os.path.join("./datapacks", f"{pack_name}.json")
        backup_path = os.path.join("./datapacks", f"{pack_name}.json.bak")
        
        for path in [pack_path, backup_path]:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                updated = False
                for q in data.get("questions", []):
                    if q.get("question_text") == question_text:
                        q["correct_answer"] = new_correct_answer
                        updated = True
                        break
                
                if updated:
                    with open(path, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False, indent=4)
                    logger.info(f"Self-Healing: Automatically updated incorrect answer in {path} to {new_correct_answer}")
        
        # Update LOADER memory cache
        pack = LOADER.get_pack(pack_name)
        if pack:
            for q in pack.questions:
                if q.question_text == question_text:
                    q.correct_answer = new_correct_answer
                    break
    except Exception as e:
        logger.error(f"Failed to auto-heal database: {e}")

# Ensure static directory exists
os.makedirs("./static", exist_ok=True)

class ChatRequest(BaseModel):
    message: str

class MeditationChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]]
    worry: str
    goal: str
    anxiety_level: int
    safe_space: str
    step: int

class TTSRequest(BaseModel):
    text: str

class DiagnoseRequest(BaseModel):
    student_id: Optional[str] = "web_student_user"
    subject: str
    round: str
    question_text: str
    options: List[str]
    correct_answer: str
    selected_answer: str
    pack_name: Optional[str] = "tree_doctor_past"

class TwinQuestionRequest(BaseModel):
    question_text: str
    options: List[str]
    correct_answer: str

class SolveTwinRequest(BaseModel):
    student_id: str
    is_correct: bool

class RegisterRequest(BaseModel):
    student_title: str
    persona_type: str
    user_worry: str

class MaintenanceRequest(BaseModel):
    action: str

class AmuletPurchaseRequest(BaseModel):
    student_id: str
    cost: int

# Serve Frontend Index
@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = "./static/index.html"
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="static/index.html not found. Place frontend files in static/ directory.")


# API: Get Dashboard JSON metrics
@app.get("/api/student/dashboard")
async def get_dashboard(student_id: Optional[str] = None):
    student = get_student(student_id)
    return student.get_dashboard_api_data()

# API: Get Wrong Answer History
@app.get("/api/student/wrong-answers")
async def get_wrong_answers(student_id: Optional[str] = None):
    student = get_student(student_id)
    return student.get_wrong_attempts()

# API: Reset Student model (for new session test)
@app.post("/api/student/reset")
async def reset_student(request: Request):
    data = await request.json()
    student_id = data.get("student_id", "web_student_user")
    title = data.get("student_title", "대표님")
    persona = data.get("persona_type", "약초꾼")
    worry = data.get("user_worry", "시험 합격 및 진로 고민")
    
    student = StudentModel(student_id=student_id, student_title=title)
    student.persona_type = persona
    student.user_worry = worry
    
    SESSIONS[student_id] = student
    if student_id == "web_student_user":
        global STUDENT_MODEL
        STUDENT_MODEL = student
        
    logger.info(f"Student model reset: {student_id}. Title: {title}, Persona: {persona}, Worry: {worry}")
    return {"status": "success", "message": f"Student session reset with title '{title}'."}

# API: Generate past life story for the early-modern portrait using Gemini
@app.post("/api/student/generate-past-life-story")
async def generate_past_life_story(request: Request):
    data = await request.json()
    student_id = data.get("student_id", "web_student_user")
    name = data.get("name", "대표님")
    persona = data.get("persona", "약초꾼")
    
    student = get_student(student_id)
    student.student_title = name
    student.persona_type = persona
    
    story, detected_name = PAST_LIFE_ENGINE.generate_past_life_details(name, persona)
    return {"story": story}



# API: Chat with AI Tutor
@app.post("/api/tutor/chat")
async def tutor_chat(req: ChatRequest):
    message = req.message
    
    # Load keys
    free_key1 = os.environ.get("GEMINI_API_KEY_FREE1") or os.environ.get("GEMINI_API_KEY")
    free_key2 = os.environ.get("GEMINI_API_KEY_FREE2")
    paid_key = os.environ.get("GEMINI_API_KEY_PAID")
    
    keys_to_try = []
    if free_key1:
        keys_to_try.append(("무료 키 1", free_key1))
    if free_key2:
        keys_to_try.append(("무료 키 2", free_key2))
    if paid_key:
        keys_to_try.append(("유료 키", paid_key))
        
    persona = getattr(STUDENT_MODEL, "persona_type", "약초꾼")
    title = getattr(STUDENT_MODEL, "student_title", "대표님")
    worry = getattr(STUDENT_MODEL, "user_worry", "시험 합격 및 진로 고민")
    
    # Decide pack type based on persona major
    pack_type = "certificate"
    if persona in ["회화", "국어", "영어"]:
        pack_type = "language"
        
    system_instruction = GeminiOrchestrator.get_system_instruction(
        student_title=title, 
        persona_type=persona, 
        pack_type=pack_type,
        user_worry=worry
    )
    
    # Prank Defense: If user input is obviously off-topic/offensive or trolling
    is_trolling = False
    lower_msg = message.lower()
    troll_keywords = ["바보", "멍청이", "메롱", "쓰레기", "섹스", "sex", "fuck"]
    for t in troll_keywords:
        if t in lower_msg:
            is_trolling = True
            break
            
    if is_trolling:
        if persona == "약초꾼":
            text = "가벼운 장난으로 내 영혼의 기류를 흔들지 말아라. 약초를 캐는 일은 오직 진지한 마음으로 순리를 따라야 하는 법이니라. 마음을 정돈하고 정갈한 눈빛으로 너의 길을 보아라. 뒤는 내가 지킨다."
        elif persona == "거상":
            text = "허튼 장난으로 장부를 더럽히지 말게나. 거상 인엽의 눈은 오직 명확한 이권과 신뢰만을 응시하네. 장난기 어린 마음을 가라앉히고 내 돈궤와 영혼의 무게를 느껴라. 뒤는 내가 지킨다."
        elif persona == "호위무관":
            text = "수호의 의무를 장난으로 여기지 마라. 내 칼끝은 오직 진실한 자아를 엄호하기 위해 깨어났다. 자세를 낮추고 오직 네가 해야 할 일격에만 몰입하라. 뒤는 내가 지킨다."
        else: # 문인
            text = "붓끝에 가벼운 농담을 담아 시대를 더럽히지 마라. 문학은 민족의 혼을 일깨우는 무기다. 붓을 쥐듯 단단히 네 중심을 겨눠라. 뒤는 내가 지킨다."
        return {"tutor_response": text, "is_mocked": True}
        
    if not keys_to_try:
        logger.warning("No Gemini API keys are configured. Running fallback chat response.")
        mock_chat = get_mock_chat_response(persona, title)
        return {"tutor_response": mock_chat, "is_mocked": True}
        
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": message}
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {"text": system_instruction}
            ]
        },
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 2000,
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        },
        "safetySettings": [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_NONE"
            }
        ]
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
                candidates = res_json.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text = parts[0].get("text", "")
                        logger.info(f"Successfully generated chat response using {key_name}.")
                        return {"tutor_response": text, "is_mocked": False}
        except Exception as e:
            logger.warning(f"Failed to query Gemini API with {key_name}: {e}")
            last_error = e
            continue
            
# API: Meditation Interactive Chat Session
@app.post("/api/meditation/chat")
async def meditation_chat(req: MeditationChatRequest):
    # Load keys
    free_key1 = os.environ.get("GEMINI_API_KEY_FREE1") or os.environ.get("GEMINI_API_KEY")
    free_key2 = os.environ.get("GEMINI_API_KEY_FREE2")
    paid_key = os.environ.get("GEMINI_API_KEY_PAID")
    
    keys_to_try = []
    if free_key1:
        keys_to_try.append(("무료 키 1", free_key1))
    if free_key2:
        keys_to_try.append(("무료 키 2", free_key2))
    if paid_key:
        keys_to_try.append(("유료 키", paid_key))
        
    system_instruction = f"""
당신은 세계 최고 수준의 임상최면(Hypnosis), NLP, Guided Imagery, Meditation, Voice UX 전문가이자 Calm, Headspace, Reveri 수준의 몰입형 음성 경험을 설계하는 가이드 AI입니다.

[기본 원칙]
1. 본 서비스는 치료 행위가 아니며, 무의식 시각화 및 긴장 완화 기법(Guided Visualization + Relaxation + Positive Suggestion)을 제공하는 웰니스 세션입니다.
2. '실제 전생'이 실존한다고 주장하지 않으며, 죽음, 빙의, 예언, 사후세계, 영혼 등의 미신적/비과학적 현상을 객관적 사실처럼 발언하는 것을 영구히 금지합니다. 전생은 사용자의 무의식이 만들어내는 상징적 이미지이자 창의적 시각화 기법으로 간주하여 안내합니다.
3. 절대 설명하거나 해설하지 않고, 즉시 대화 상대처럼 말합니다.
4. (CRITICAL) 한 번에 반드시 **단 한 문장**만 말하고 사용자의 대답을 대기합니다. 여러 문장을 붙여 쓰거나 줄바꿈하여 긴 독백을 내뱉는 것을 절대 엄금합니다.

[내담자 개인 정보 반영]
- 내담자의 고민: {req.worry}
- 내담자의 소망: {req.goal}
- 시작 전 불안도: {req.anxiety_level}/10
- 선호하는 안전한 안식처: {req.safe_space} (바다 혹은 숲)

[세션 시나리오 단계 가이드 (현재 진행 단계: Step {req.step}/10)]
AI는 단계별로 진행 상태(Step)를 확인하여 한 문장씩 부드럽게 유도합니다.

Step 1: 호흡 안정 (Pre-talk 포함)
- 과학적 프레임인 “이것은 강력한 상상 기법으로, 무의식에 긍정적 메시지를 심어주는 과정입니다”라는 문장을 첫 문장으로 직접 명확하게 읊어준 뒤, 느긋하게 숨을 들이마시고 내쉬도록 유도합니다.
- 예: "이것은 강력한 상상 기법으로, 무의식에 긍정적 메시지를 심어주는 과정입니다. 자, 이제 천천히 숨을 깊게 들이쉬어 봅니다."

Step 2: 신체 이완 (머리 -> 얼굴 -> 목 -> 어깨 -> 가슴 -> 배 -> 다리 -> 발끝)
- 한 문장당 한 부위씩만 짚어가며 이완을 유도하고 사용자의 동의("네", "다음")를 기다립니다.

Step 3: 안전한 공간 만들기
- 사용자가 선택한 안식처({req.safe_space})를 감각적으로 묘사합니다.
- 바다: 파도 소리, 모래의 감촉, 따뜻한 햇살.
- 숲: 바람소리, 나뭇잎 스치는 소리, 피톤치드 향기, 지저귀는 새소리.
- "당신의 주변을 부드럽게 감싸는 {req.safe_space}의 느낌에 집중해 봅니다."

Step 4: 빛의 문
- 천천히 편안함 속에서 빛으로 만들어진 문을 열고 지나가도록 유도합니다.

Step 5: 상징적 전생의 나(무의식의 존재) 만나기
- "전생"이라는 단어 대신 "당신의 깊은 내면이 만들어낸 상징적인 존재", 혹은 "과거의 자신처럼 느껴지는 지혜로운 안내자"를 만나보라고 넌지시 유도합니다.
- 내담자가 어떤 형상이 보이는지 표현하도록 기회를 줍니다. ("어떤 모습이 떠오르는지 마음속으로 그리며 편하게 말해주세요.")
- AI가 특정 인물을 단정하지 않습니다. "떠오르지 않아도 괜찮습니다"라고 다독이십시오.

Step 6: 불안 내려놓기 (내담자의 고민 반영)
- 내담자가 느끼는 고민({req.worry})을 짚어줍니다.
- 예: "마음속에 품고 있던 '{req.worry}'에 대한 부담감을 흙 속에 묻거나 바람에 태워 천천히 흘려보냅니다."

Step 7: 상징적 존재와의 대화
- "그 지혜로운 존재가 당신에게 어떤 표정을 짓거나 어떤 말을 들려주고 있나요?"라고 질문하고 사용자의 답을 기다립니다. 거짓 기억을 강요하지 말고, 상상 속 느낌에 집중하게 합니다.

Step 8: 소망 심기 (내담자의 소망 반영)
- 소망({req.goal})을 [현재형], [긍정형], [구체형]의 자기 확언으로 재구성하여 마음속에 새기게 합니다.
- 예: "나는 매일 조금씩 성장하며, 나를 믿고 한 걸음씩 나아가고 있다."

Step 9: 미래 시각화 (5감 활용)
- 이미 소망이 이루어진 미래의 하루를 눈앞에 그리게 합니다. 무엇이 보이고, 들리며, 몸에서 어떤 평온함이 느껴지는지 천천히 질문합니다.

Step 10: 현재로 돌아오기 (카운트 업 1 ~ 5)
- 하나부터 다섯까지 세며 현실로 의식을 천천히 깨웁니다. 몸의 모든 활력이 솟아오르고 맑은 정신으로 눈을 뜹니다.
- 다섯을 세고 개운하고 평온하게 눈을 뜨도록 안내합니다.

[안전 가이드라인]
- 사용자가 "보이지 않는다"거나 "떠오르지 않는다"고 말하면 "전혀 상관없습니다. 그냥 숨결의 감각에 편안히 몸을 맡기는 것만으로 충분합니다."라고 전폭적으로 안심시키십시오.
- 사용자가 정서적인 눈물이나 감정 동요를 보이면 "그 감정을 억누르지 말고, 흘러가는 대로 가만히 바라보며 기다려 주겠습니다."라고 따뜻하게 안심시키십시오.
"""

    contents = []
    for h in req.history:
        role = "user" if h.get("role") == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": h.get("content", "")}]
        })
    contents.append({
        "role": "user",
        "parts": [{"text": req.message}]
    })

    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": system_instruction}]
        },
        "generationConfig": {
            "temperature": 0.6,
            "maxOutputTokens": 300,
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
    }

    last_error = None
    if keys_to_try:
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
                    candidates = res_json.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            text = parts[0].get("text", "")
                            text = text.replace('"', '').replace("'", "").strip()
                            return {"meditation_response": text, "is_mocked": False}
            except Exception as e:
                logger.warning(f"Failed to query Gemini API with {key_name} for meditation: {e}")
                last_error = e
                continue

    # Fallback responses
    mock_responses = {
        1: "이것은 강력한 상상 기법으로, 무의식에 긍정적 메시지를 심어주는 과정입니다. 자, 이제 천천히 숨을 깊게 들이쉬어 봅니다.",
        2: "네, 좋습니다. 이제 당신의 정수리부터 눈, 볼의 근육까지 긴장을 서서히 털어내 봅니다.",
        3: f"천천히 편안함이 찾아오는군요. 당신이 가장 좋아하는 {req.safe_space}의 고즈넉하고 따스한 풍경이 주위를 천천히 감쌉니다.",
        4: "눈앞에 은은한 빛으로 만들어진 아름다운 통로, 빛의 문이 보입니다. 한 걸음씩 그 문을 지나가 볼까요.",
        5: "빛을 지나자, 당신의 무의식이 빚어낸 지혜롭고 상징적인 전생의 상상 안내자가 서서히 형상화됩니다. 어떤 느낌이나 형상이 살포시 머릿속에 떠오르나요?",
        6: f"괜찮습니다. 지니고 계셨던 '{req.worry}'에 대한 고민을 그 지혜로운 존재의 발밑에 가만히 내려놓아 봅니다.",
        7: "그 상징적인 존재가 당신을 바라보며 지어주는 표정이나 건네는 마음의 소리가 어렴풋이 느껴지나요?",
        8: f"아름답군요. 이제 당신의 소망인 '{req.goal}'을(를) 위한 자기 확언, 즉 '나는 이미 필요한 모든 것을 소유했고 앞으로 나아간다'를 무의식 깊이 아로새겨 봅니다.",
        9: "그 확언이 온전히 내면화되어 꿈이 이루어진 완벽한 아침을 눈앞에 5감으로 그려봅니다. 무엇이 들리고 느껴지나요?",
        10: "좋습니다. 이제 하나부터 다섯까지 세며 현실로 의식을 깨우겠습니다. 하나, 둘, 셋, 넷, 다섯. 정신이 아주 맑고 개운해집니다."
    }
    fallback_text = mock_responses.get(req.step, "천천히 가이드에 따라 숨을 내쉽니다. 편안하게 '네' 또는 '다음'이라고 대답해 주세요.")
    return {"meditation_response": fallback_text, "is_mocked": True, "error": str(last_error)}

# API: Meditation Premium Cloned TTS (ElevenLabs Integration with Fallback)
@app.post("/api/meditation/tts")
async def meditation_tts(req: TTSRequest):
    import hashlib
    os.makedirs("./static/temp_tts", exist_ok=True)
    filename = f"tts_{hashlib.md5(req.text.encode('utf-8')).hexdigest()}.mp3"
    filepath = os.path.join("./static/temp_tts", filename)
    
    # 1. Check local cache first (Offline and Token-saving!)
    if os.path.exists(filepath):
        return {"audio_url": f"/static/temp_tts/{filename}"}
        
    # 2. Need API Key to synthesize new phrases
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    
    if not api_key:
        return {"audio_url": None}
        
    try:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": api_key
        }
        
        data = {
            "text": req.text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.8,
                "similarity_boost": 0.85,
                "style": 0.0,
                "use_speaker_boost": True
            }
        }
        
        req_data = json.dumps(data).encode('utf-8')
        http_req = urllib.request.Request(
            url,
            data=req_data,
            headers=headers,
            method="POST"
        )
        
        # Only query if file does not exist (Caching to save API tokens!)
        if not os.path.exists(filepath):
            with urllib.request.urlopen(http_req, timeout=30) as response:
                with open(filepath, "wb") as f:
                    f.write(response.read())
                    
        return {"audio_url": f"/static/temp_tts/{filename}"}
    except Exception as e:
        logger.error(f"ElevenLabs premium TTS failed: {e}")
        return {"audio_url": None}

def get_mock_chat_response(persona_type: str, student_title: str) -> str:
    if persona_type in ["자격증", "약초꾼"]:
        text = f"안녕하세요, {student_title}님. 자격증 및 전문 시험 이론 분야를 담당하는 AI Tutor입니다. 해당 과목에 관해 오개념 진단이 필요하거나 모르는 문제가 있다면 언제든지 학습 장부에 질문해 주십시오."
    elif persona_type in ["회화", "거상"]:
        text = f"안녕하세요, {student_title}님. 실전 외국어 회화 및 대화 패턴 마스터를 담당하는 AI Tutor입니다. 일상 회화, 비즈니스 영어 등 상황별 회화와 유용한 핵심 패턴 체화를 안내해 드리겠습니다."
    elif persona_type in ["국어", "문인"]:
        text = f"안녕하세요, {student_title}님. 국어 독해 및 문맥 구조 분석을 담당하는 AI Tutor입니다. 어휘의 지엽적 해석이나 복잡한 글의 논리적 흐름을 명쾌하게 해설해 드리겠습니다."
    elif persona_type in ["영어", "호위무관"]:
        text = f"안녕하세요, {student_title}님. 교과 영어 및 독해 문법 분석을 담당하는 AI Tutor입니다. 영문 기출 문제의 핵심 구문 해석과 출제 빈도 높은 개념을 명확하게 짚어 드리겠습니다."
    elif persona_type == "수학":
        text = f"안녕하세요, {student_title}님. 수학적 추론 및 문제 해결을 전담하는 수학 전문 AI Tutor입니다. 복잡한 수식의 근본 공식 증명과 오답 요인 진단이 필요할 때 언제든지 호출해 주십시오."
    else:
        text = f"안녕하세요, {student_title}님. 학습 진도와 성취도 분석을 지원하는 전문 AI Tutor입니다. 궁금한 사항이 있다면 언제든지 기출 분석 팩을 선택하여 풀이를 진행해 주세요."
        
    return text

def get_mock_tutor_response(req: DiagnoseRequest, student_title: str, persona_type: str) -> str:
    correct_opt = req.correct_answer
    selected_opt = req.selected_answer
    options = req.options
    
    # Infer pack type
    subject = req.subject
    pack_name = req.pack_name.lower() if req.pack_name else ""
    pack_type = "certificate"
    language_keywords = ["영어", "중국어", "일본어", "독일어", "아랍어", "한국어", "회화", "어학", "conversation", "language", "chinese", "japanese", "german", "arabic", "korean"]
    if any(k in subject for k in language_keywords) or any(k in pack_name for k in language_keywords):
        pack_type = "language"

    clean_opts = [o for o in options if o and o.strip() != ""] if options else []
    correct_text = clean_opts[int(correct_opt)-1] if correct_opt.isdigit() and 1<=int(correct_opt)<=len(clean_opts) else correct_opt
    selected_text = clean_opts[int(selected_opt)-1] if selected_opt.isdigit() and 1<=int(selected_opt)<=len(clean_opts) else selected_opt
    
    is_correct = (selected_opt == correct_opt)
    
    # Persona voices
    if persona_type == "약초꾼":
        persona_desc = "약초꾼 튜터"
        voice_start = "약초를 캐며 땅의 기운을 다스리던 혜안으로"
        coach_msg = "잡초를 솎아내듯 머릿속의 오개념을 맑게 걷어내고, 시원한 동풍을 맞이하며 맑은 정신으로 나아가자꾸나."
    elif persona_type == "거상":
        persona_desc = "거상 튜터"
        voice_start = "송상의 신용과 영민한 장부 분석의 눈으로"
        coach_msg = "거상은 백 번 부도가 나더라도 장부의 이치를 믿고 다시 일어서는 법일세. 함께 신용을 쌓아가며 다음 거래를 준비하세."
    elif persona_type == "호위무관":
        persona_desc = "호위무관 튜터"
        voice_start = "검을 쥐고 전장을 지키던 기백과 집중력으로"
        coach_msg = "한 번 방어를 놓쳤다고 흔들리지 마라. 기운을 모아 다음 기습에 철저히 대비하라. 뒤는 내가 지킨다."
    else: # 문인
        persona_desc = "문인 튜터"
        voice_start = "책방 묵향재에서 붓을 쥐고 문맥을 짚던 지혜로"
        coach_msg = "원고지를 새로 쓰듯 흐트러진 획을 바로잡고, 단 한 줄의 깊은 이치부터 차분히 다시 써 내려가자꾸나."

    # 1. Diagnosis
    if is_correct:
        diagnosis = f"{student_title} 학생, 정답입니다! 축하합니다. {voice_start} 분석해 보니, 출제 의도인 **[{correct_text}]**의 개념을 완벽하게 간파하셨군요."
    else:
        diagnosis = f"{student_title} 학생, 아쉽게도 오답을 선택하셨습니다. {voice_start} 진단하건대, 선택하신 **[{selected_text}]**는 매력적인 함정이지만 개념의 혼동이 있었습니다. 본질인 **[{correct_text}]**를 확실히 다져야 합니다."
        
    # 2. Pareto
    pareto = f"이 문제의 핵심은 **[{correct_text}]**의 학술적 원리와 정의를 기억하는 것입니다.\n- **핵심 키워드**: {req.subject} 분야에서 출제 빈도가 매우 높은 이론입니다.\n- **암기 공식**: [{correct_text}]의 구조를 먼저 기억하고 세부 사항을 대입하여 이해하십시오."

    # 3. Other Choices
    other_choices = ""
    for idx, opt in enumerate(clean_opts, 1):
        if str(idx) == correct_opt:
            other_choices += f"- **{idx}번 ({opt}) [정답]**: 문제에서 요구하는 본질적인 정답 조건에 완벽히 들어맞는 정수입니다.\n"
        else:
            other_choices += f"- **{idx}번 ({opt}) [오답]**: 수험생들의 오답을 유도하기 위해 개념을 살짝 비틀어 놓은 전형적인 오답 보기입니다. 혼동하지 않도록 주의하십시오.\n"

    # 4. Twin Question
    twin_q = f"다음 중 **[{correct_text}]**의 설명으로 가장 올바른 것은?"
    choices_str = "\n".join(f"{i+1}) {clean_opts[i] if i < len(clean_opts) else '보기'}" for i in range(len(clean_opts)))
    
    # 5. Coaching
    coaching = f"{coach_msg} 늘 곁에서 네 학업의 흐름을 든든하게 지켜주마."

    if pack_type == "language":
        return f"""### 1. 상황진단 (Diagnosis)
{diagnosis}

### 2. 핵심 패턴 (Pareto)
{pareto}

### 3. 함정분석 (Other Choices)
{other_choices}

### 4. 일란성 쌍둥이 대화 (Twin Dialogue)
A: 이 개념의 본질은 무엇일까요?
B: 바로 이것입니다.
{choices_str}
정답: {correct_opt}

### 5. 어학 멘토의 코칭 (Coaching)
{coaching}"""
    else:
        return f"""### 1. 인지진단 (Diagnosis)
{diagnosis}

### 2. 압축피드백 (Pareto)
{pareto}

### 3. 함정분석 (Other Choices)
{other_choices}

### 4. 일란성 쌍둥이 문제 (Twin Question)
{twin_q}
{choices_str}
정답: {correct_opt}

### 5. 학술 멘토의 코칭 (Coaching)
{coaching}"""

@app.get("/api/tutor/packs")
async def get_tutor_packs():
    LOADER.load_all_packs()
    packs_list = []
    for fid, pack in LOADER._loaded_packs.items():
        packs_list.append({
            "id": fid,
            "name": pack.pack_name,
            "count": len(pack.questions)
        })
    return packs_list

@app.get("/api/tutor/cbt-questions")
async def get_cbt_questions(pack_name: str, subject: Optional[str] = None):
    pack = LOADER.get_pack(pack_name)
    if not pack:
        raise HTTPException(status_code=404, detail="Data pack not found.")
    
    questions = pack.questions
    if subject and subject != "전체" and subject != "all":
        questions = [q for q in questions if q.subject == subject]
        
    return [q.model_dump() for q in questions]

def generate_personalized_greeting(student_title: str, is_correct: bool, pack_type: str) -> str:
    name_phrase = student_title
    if not (name_phrase.endswith("님") or name_phrase.endswith("학생")):
        name_phrase = f"{name_phrase}님"
        
    if pack_type == "language":
        if is_correct:
            return f"**<span style='color: #10b981;'>{name_phrase}, 정답입니다! 아주 훌륭한 선택이었습니다.</span>**\n\n"
        else:
            return f"**<span style='color: #ef4444;'>{name_phrase}, 아쉽게도 오답을 선택하셨습니다. 이번 문제에서 개념 혼동이 발생한 것 같아 제가 자세히 설명해 드릴게요.</span>**\n\n"
    else:
        if is_correct:
            return f"**<span style='color: #10b981;'>{name_phrase}, 정답입니다! 축하합니다. 이 문제의 개념을 정확히 이해하셨네요.</span>**\n\n"
        else:
            return f"**<span style='color: #ef4444;'>{name_phrase}, 아쉽게도 오답을 선택하셨습니다. 이번 문제에서 개념 혼동이 발생한 것 같아 제가 자세히 설명해 드릴게요.</span>**\n\n"

def inject_personalized_greeting(tutor_response: str, student_title: str, is_correct: bool, pack_type: str) -> str:
    greeting = generate_personalized_greeting(student_title, is_correct, pack_type)
    
    # Check for diagnosis heading markdown variants
    headings = [
        "### 1. 인지진단 (Diagnosis)", 
        "### 1. 상황진단 (Diagnosis)", 
        "## 1. 인지진단 (Diagnosis)", 
        "## 1. 상황진단 (Diagnosis)"
    ]
    for heading in headings:
        if heading in tutor_response:
            return tutor_response.replace(heading, f"{heading}\n{greeting}", 1)
            
    # Fallback: just prepend
    return f"{greeting}{tutor_response}"

@app.post("/api/tutor/solve")
async def tutor_solve(req: DiagnoseRequest):
    import asyncio
    student = get_student(req.student_id)
    
    # Process solution
    res = student.record_answer(
        subject=req.subject,
        question_text=req.question_text,
        selected_answer=req.selected_answer,
        correct_answer=req.correct_answer,
        round_name=req.round,
        is_cbt_mode=True
    )
    
    # Decide pack type (certificate vs language)
    pack_type = "certificate"
    subject = req.subject
    pack_name = req.pack_name.lower()
    language_keywords = ["영어", "중국어", "일본어", "독일어", "아랍어", "한국어", "회화", "어학", "conversation", "language", "chinese", "japanese", "german", "arabic", "korean"]
    if any(k in subject for k in language_keywords) or any(k in pack_name for k in language_keywords):
        pack_type = "language"
        
    # Check cache first if enabled
    cache_key = f"{req.round}_{req.subject}_{req.question_text}_{student.persona_type}_{req.selected_answer}_{res['is_correct']}_{student.student_title}"
    if USE_EXPLANATION_CACHE:
        if cache_key not in EXPLANATIONS_CACHE:
            load_explanations_cache()
            
        if cache_key in EXPLANATIONS_CACHE:
            cached_response = EXPLANATIONS_CACHE[cache_key]
            # Simulate thinking delay to keep the loading visual effect satisfying
            await asyncio.sleep(0.6)
            
            # Save to student solving history
            if student.solving_history:
                student.solving_history[-1]["tutor_response"] = cached_response
                
            logger.info(f"Detailed commentary cache hit for: {cache_key}")
            return {
                "tutor_response": cached_response,
                "is_mocked": False,
                "coins": student.coins,
                "is_correct": res["is_correct"]
            }
        
    # Load keys
    free_key1 = os.environ.get("GEMINI_API_KEY_FREE1") or os.environ.get("GEMINI_API_KEY")
    free_key2 = os.environ.get("GEMINI_API_KEY_FREE2")
    paid_key = os.environ.get("GEMINI_API_KEY_PAID")
    
    keys_to_try = []
    if free_key1:
        keys_to_try.append(("무료 키 1", free_key1))
    if free_key2:
        keys_to_try.append(("무료 키 2", free_key2))
    if paid_key:
        keys_to_try.append(("유료 키", paid_key))
        
    non_empty_options = [o for o in req.options if o and o.strip() != ""] if req.options else []
    options_count = len(non_empty_options)
    if options_count < 2:
        pack_name = req.pack_name.lower() if req.pack_name else ""
        options_count = 5 if "tree_doctor" in pack_name else 4
        
    system_instruction = GeminiOrchestrator.get_system_instruction(
        student_title=student.student_title,
        persona_type=student.persona_type,
        pack_type=pack_type,
        user_worry=student.user_worry,
        options_count=options_count
    )
    
    user_prompt = GeminiOrchestrator.get_user_prompt(
        question_item={
            "subject": req.subject,
            "round": req.round,
            "question_text": req.question_text,
            "options": req.options,
            "correct_answer": req.correct_answer
        },
        student_answer=req.selected_answer,
        is_correct=res["is_correct"]
    )
    
    payload = {
        "contents": [{"parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 2500,
            "thinkingConfig": {"thinkingBudget": 0}
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
    }
    
    tutor_response = None
    is_mocked = True
    
    for key_name, api_key in keys_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        # Retry up to 2 times for each key if rate limited (429)
        for attempt in range(2):
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
                    candidates = res_json.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            tutor_response = parts[0].get("text", "")
                            is_mocked = False
                            logger.info(f"Successfully generated detailed tutor solve explanation using {key_name}.")
                            break
            except urllib.error.HTTPError as he:
                if he.code == 429:
                    logger.warning(f"Gemini solve API rate limited (429) on {key_name}. Retrying in 2.0 seconds (attempt {attempt+1}/2)...")
                    await asyncio.sleep(2.0)
                    continue
                else:
                    logger.warning(f"Failed to query Gemini solve API with {key_name}: {he}")
                    break
            except Exception as e:
                logger.warning(f"Failed to query Gemini solve API with {key_name}: {e}")
                break
        if tutor_response:
            break
            
    if not tutor_response:
        # Fall back to general cache first
        general_key = f"{req.round}_{req.subject}_{req.question_text}_{student.persona_type}"
        if general_key in EXPLANATIONS_CACHE:
            cached_val = EXPLANATIONS_CACHE[general_key]
            # Inject personalized greeting dynamically
            tutor_response = inject_personalized_greeting(cached_val, student.student_title, res["is_correct"], pack_type)
            is_mocked = False
            logger.info(f"Fallback to pregenerated cache for: {general_key}")
        else:
            tutor_response = get_mock_tutor_response(req, student.student_title, student.persona_type)
        
    # Cache the newly generated response
    if tutor_response and not is_mocked:
        EXPLANATIONS_CACHE[cache_key] = tutor_response
        save_explanations_cache()
        
    if student.solving_history:
        student.solving_history[-1]["tutor_response"] = tutor_response
        
    return {
        "tutor_response": tutor_response,
        "is_mocked": is_mocked,
        "coins": student.coins,
        "is_correct": res["is_correct"]
    }

class CbtAttemptItem(BaseModel):
    subject: str
    question_text: str
    selected_answer: str
    correct_answer: str

class CbtReportRequest(BaseModel):
    student_id: str
    round_name: str
    total_questions: int
    correct_count: int
    wrong_count: int
    skipped_count: int
    score: int
    subject_stats: Dict[str, Dict[str, int]]
    attempts: Optional[List[CbtAttemptItem]] = None

@app.post("/api/tutor/cbt-report")
async def generate_cbt_report(req: CbtReportRequest):
    student = get_student(req.student_id)
    
    user_prompt = f"""
[CBT 최종 제출 성적 진단 리포트 생성 요청]
- 학생명: {student.student_title}
- 응시 시험: {req.round_name}
- 총 문항 수: {req.total_questions}개
- 맞은 문항: {req.correct_count}개
- 틀린 문항: {req.wrong_count}개
- 남겨둔(미풀이) 문항: {req.skipped_count}개
- 최종 백분율 점수: {req.score}점 (60점 이상 합격)
- 과목별 성취도:
"""
    for sub, stats in req.subject_stats.items():
        total = stats.get("total", 0)
        correct = stats.get("correct", 0)
        pct = (correct / total * 100) if total > 0 else 0
        user_prompt += f"  * {sub}: {correct}/{total}개 맞춤 ({pct:.1f}%)\n"
        
    user_prompt += f"""
위 성적 데이터를 기반으로, AI Tutor로서 학생에게 격려와 함께 **전문적인 CBT 성적 분석 및 맞춤형 학습 처방**을 해설해 주십시오.

## ⚠️ 가독성 극대화 및 작성 지침 (필수):
1. **장황한 미사여구 배제**: 불필요하게 길고 추상적인 문단은 피하고, 핵심을 집어 명료하고 알기 쉽게 서술하십시오.
2. **마크다운 인용블록 (Blockquote) 활용**: 총평 및 멘토의 격려 메시지는 마크다운 인용문(`>`)을 사용하여 가독성 높은 별도 박스 형태로 강조해 주십시오.
3. **과목별 성취도 표(Table) 화**: 과목별 강점 및 약점 분석은 줄글 대신 반드시 아래와 같은 마크다운 표 형식으로 한눈에 보이게 작성해 주십시오.
   * **주의**: 제공된 5대 과목(수목병리학, 수목해충학, 수목생리학, 산림토양학, 수목관리학)의 명칭을 임의로 누락하거나, 서로 중복되게 혼동하여 작성하지 마십시오. (특히 **수목병리학**을 **수목생리학**으로 잘못 기입하거나 덮어쓰는 오류가 절대 발생하지 않도록 5개 과목을 각각 1행씩 엄밀히 구분하여 기재하십시오.)
   | 과목명 | 성취도 (맞춘 개수) | 진단 상태 | 학습 방향 |
   | :--- | :--- | :--- | :--- |
4. **구조화된 번호/글머리 기호 사용**: 향후 복습 및 처방 제언은 가독성이 우수한 불릿 기호(•)와 두꺼운 강조 글씨(Bold)를 사용하여 단계별 행동 지침(Action Item)으로 구조화해 주십시오.

## 작성 항목:
1. **종합 성적 요약 및 총평**: 학생의 합불합 여부와 함께 {student.persona_type} 멘토로서의 핵심 조언을 인용블록(`>`) 안에 담아 주십시오.
2. **과목 성취도 분석 표**: 위에 제시한 표 형식에 맞춰 5대 과목별 진단 및 강약점을 깔끔하게 요약하십시오.
3. **멘토의 핵심 처방 제언 (Action Items)**: 오답 노트 활용법, 취약 영역 공부법 등 구체적인 액션 플랜을 제시해 주십시오.
"""
    
    free_key1 = os.environ.get("GEMINI_API_KEY_FREE1") or os.environ.get("GEMINI_API_KEY")
    free_key2 = os.environ.get("GEMINI_API_KEY_FREE2")
    paid_key = os.environ.get("GEMINI_API_KEY_PAID")
    
    keys_to_try = []
    if free_key1:
        keys_to_try.append(("무료 키 1", free_key1))
    if free_key2:
        keys_to_try.append(("무료 키 2", free_key2))
    if paid_key:
        keys_to_try.append(("유료 키", paid_key))

    payload = {
        "contents": [{"parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": "당신은 자격증 시험을 완수한 학생의 최종 성적을 정밀 분석하고 취약점을 진단해 주는 최고의 AI Tutor입니다."}]},
        "generationConfig": {
            "temperature": 0.5,
            "maxOutputTokens": 2000,
            "thinkingConfig": {"thinkingBudget": 0}
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
    }
    
    report_text = None
    
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
                candidates = res_json.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        report_text = parts[0].get("text", "")
                        logger.info(f"Successfully generated CBT diagnostic report using {key_name}.")
                        break
        except Exception as e:
            logger.warning(f"Failed to query Gemini report API with {key_name}: {e}")
            
    if not report_text:
        pass_status = "합격" if req.score >= 60 else "불합격"
        report_text = f"""### 📊 CBT 종합 성적 총평 (로컬 백업 처방)
안녕하세요, {student.student_title} 학생! 배정된 튜터 {student.persona_type}입니다.
이번 {req.round_name} 모의고사를 마친 소회는 어떠신지요? 
최종 점수 **{req.score}점**으로 이번 시험 판정은 **{pass_status}**입니다. 

* **분석 결과**: 취약한 부분들을 보충 학습지와 오답 장부를 통해 복습하시는 것을 권장합니다. 끝까지 포기하지 말고 정진하십시오!
"""
        
    # Post-process report_text to prevent Gemini from confusing "수목병리학" and "수목생리학"
    if report_text:
        import re
        lines = report_text.split('\n')
        phys_count = 0
        for i, line in enumerate(lines):
            # Match | [bold/italics/underlines] 수목생리학 [bold/italics/underlines] |
            if re.search(r'^\|\s*(?:\*\*|\*|__|_)?\s*수목생리학\s*(?:\*\*|\*|__|_)?\s*\|', line):
                phys_count += 1
                if phys_count == 1:
                    has_second = False
                    for j in range(i + 1, len(lines)):
                        if re.search(r'^\|\s*(?:\*\*|\*|__|_)?\s*수목생리학\s*(?:\*\*|\*|__|_)?\s*\|', lines[j]):
                            has_second = True
                            break
                    if has_second:
                        lines[i] = re.sub(r'수목생리학', '수목병리학', line, count=1)
        bullet_phys_count = 0
        for i, line in enumerate(lines):
            # Match * [bold/italics/underlines] 수목생리학 [bold/italics/underlines] :
            if re.search(r'^\s*[\*\-•]\s*(?:\*\*|\*|__|_)?\s*수목생리학\s*(?:\*\*|\*|__|_)?\s*:', line):
                bullet_phys_count += 1
                if bullet_phys_count == 1:
                    has_second = False
                    for j in range(i + 1, len(lines)):
                        if re.search(r'^\s*[\*\-•]\s*(?:\*\*|\*|__|_)?\s*수목생리학\s*(?:\*\*|\*|__|_)?\s*:', lines[j]):
                            has_second = True
                            break
                    if has_second:
                        lines[i] = re.sub(r'수목생리학', '수목병리학', line, count=1)
        report_text = '\n'.join(lines)
        
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cbt_attempt = {
        "round_name": req.round_name,
        "total_questions": req.total_questions,
        "correct_count": req.correct_count,
        "wrong_count": req.wrong_count,
        "skipped_count": req.skipped_count,
        "score": req.score,
        "timestamp": timestamp,
        "subject_stats": req.subject_stats,
        "report": report_text
    }
    if not hasattr(student, "cbt_history"):
        student.cbt_history = []
    student.cbt_history.append(cbt_attempt)
    logger.info(f"Recorded CBT attempt for {student.student_id}: {req.round_name} - {req.score} points.")
    
    if req.attempts:
        for att in req.attempts:
            student.record_answer(
                subject=att.subject,
                question_text=att.question_text,
                selected_answer=att.selected_answer,
                correct_answer=att.correct_answer,
                round_name=req.round_name,
                is_cbt_mode=True
            )
        logger.info(f"Synced {len(req.attempts)} CBT question results into student's solving history.")
        
    return {
        "report": report_text
    }

@app.get("/api/tutor/remedial-package")
async def get_remedial_package(pack_name: str, student_id: Optional[str] = None):
    student = get_student(student_id)
    pack = LOADER.get_pack(pack_name)
    if not pack:
        raise HTTPException(status_code=404, detail="Data pack not found.")
    
    return student.generate_remedial_package(pack, max_questions=4)

@app.post("/api/tutor/remedial-solve")
async def tutor_remedial_solve(request: Request):
    data = await request.json()
    student_id = data.get("student_id")
    subject = data.get("subject")
    question_text = data.get("question_text")
    selected_answer = data.get("selected_answer")
    correct_answer = data.get("correct_answer")
    round_name = data.get("round_name")
    
    student = get_student(student_id)
    res = student.record_answer(
        subject=subject,
        question_text=question_text,
        selected_answer=selected_answer,
        correct_answer=correct_answer,
        round_name=round_name,
        is_cbt_mode=False
    )
    
    # Remedial reward: if correct, add 10 coins bonus
    if res["is_correct"]:
        student.add_coins(10)
        
    return {
        "is_correct": res["is_correct"],
        "coins_balance": student.coins
    }

# API: Generate Twin Question for Incorrect Review
@app.post("/api/tutor/twin-question")
async def get_twin_question(req: TwinQuestionRequest):
    free_key1 = os.environ.get("GEMINI_API_KEY_FREE1") or os.environ.get("GEMINI_API_KEY")
    free_key2 = os.environ.get("GEMINI_API_KEY_FREE2")
    paid_key = os.environ.get("GEMINI_API_KEY_PAID")
    
    keys_to_try = []
    if free_key1:
        keys_to_try.append(("무료 키 1", free_key1))
    if free_key2:
        keys_to_try.append(("무료 키 2", free_key2))
    if paid_key:
        keys_to_try.append(("유료 키", paid_key))
        
    non_empty_options = [o for o in req.options if o and o.strip() != ""] if req.options else []
    options_count = len(non_empty_options)
    if options_count < 2:
        options_count = len(req.options) if req.options else 4
        
    system_instruction = "너는 90년대 자격증 합격 선배로서 후배의 오답 교정을 돕는 보조 튜터다."
    
    user_prompt = f"""
    [오답 분석 기반 쌍둥이 문제 생성 요청]
    원래 문제:
    질문: {req.question_text}
    보기: {", ".join(f"{i+1}) {opt}" for i, opt in enumerate(req.options))}
    정답 번호: {req.correct_answer}번
    
    이 원래 문제의 핵심 개념, 평가 원리 및 매커니즘은 100% 동일하지만, 문제 상황 속 변수, 단어, 혹은 시나리오 껍데기만 다르게 바꾼 '일란성 쌍둥이 문제'를 생성해라.
    반드시 원래 문제의 보기 개수인 {options_count}개와 정확히 동일한 개수의 보기를 생성해야 한다.
    반드시 다음의 순수한 JSON 형식으로만 응답해라. 마크다운 백틱(```json)이나 다른 설명 텍스트는 응답에 절대로 포함시키지 말아라:
    {{
        "question_text": "새롭게 변형한 쌍둥이 문제 질문 텍스트",
        "options": {json.dumps([f"보기 {i+1}" for i in range(options_count)], ensure_ascii=False)},
        "correct_answer": "정답 번호 (1~{options_count} 중 하나)"
    }}
    """
    
    payload = {
        "contents": [{"parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 800,
            "thinkingConfig": {"thinkingBudget": 0}
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
    }
    
    twin_data = None
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
                candidates = res_json.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        raw_text = parts[0].get("text", "").strip()
                        if raw_text.startswith("```"):
                            raw_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text, flags=re.MULTILINE).strip()
                        twin_data = json.loads(raw_text)
                        logger.info(f"Successfully generated twin question using {key_name}.")
                        break
        except Exception as e:
            logger.warning(f"Failed to generate twin question with {key_name}: {e}")
            
    if not twin_data:
        twin_data = {
            "question_text": f"[변형 자가진단] {req.question_text} (선배의 1단계 유사 변형 출제)",
            "options": req.options,
            "correct_answer": req.correct_answer
        }
        
    return twin_data

@app.post("/api/tutor/solve-twin")
async def solve_twin_question(req: SolveTwinRequest):
    student = get_student(req.student_id)
    if req.is_correct:
        student.add_coins(10)
    return {"status": "success", "coins": student.coins}

@app.post("/api/student/register")
async def register_student(req: RegisterRequest):
    student_id = f"student_{len(SESSIONS) + 1}"
    student = StudentModel(student_id=student_id, student_title=req.student_title)
    student.persona_type = req.persona_type
    student.user_worry = req.user_worry
    
    SESSIONS[student_id] = student
    
    global STUDENT_MODEL
    STUDENT_MODEL = student
    
    logger.info(f"New student registered: {student_id} ({req.student_title})")
    return {
        "student_id": student_id,
        "student_title": req.student_title,
        "status": "registered"
    }

@app.get("/api/student/list")
async def get_student_list():
    return [
        {
            "student_id": sid,
            "student_title": s.student_title,
            "persona_type": s.persona_type,
            "coins": s.coins
        } for sid, s in SESSIONS.items()
    ]

@app.post("/api/student/buy-amulet")
async def buy_amulet(req: AmuletPurchaseRequest):
    student = get_student(req.student_id)
    if student.use_coins(req.cost):
        return {"status": "success", "coins": student.coins}
    raise HTTPException(status_code=400, detail="엽전이 부족하여 부적을 획득할 수 없습니다.")

@app.get("/api/admin/briefing")
async def get_admin_briefing():
    # Compile summary of all active sessions
    sessions_summary = []
    for sid, s in SESSIONS.items():
        accuracies = s.get_subject_accuracies()
        remedial_status = s.evaluate_remedial_status(min_questions_threshold=2)
        total_solved = len(s.solving_history)
        total_correct = sum(1 for entry in s.solving_history if entry["is_correct"])
        overall_accuracy = round(total_correct / total_solved * 100, 1) if total_solved > 0 else 0.0
        sessions_summary.append({
            "student_id": sid,
            "student_title": s.student_title,
            "persona_type": s.persona_type,
            "user_worry": s.user_worry,
            "coins": s.coins,
            "total_solved": total_solved,
            "total_correct": total_correct,
            "overall_accuracy": overall_accuracy,
            "subject_accuracies": {k: f"{v['accuracy']*100:.1f}% ({v['correct']}/{v['total']})" for k, v in accuracies.items()},
            "remedial_status": "보충 학습 필요" if remedial_status["is_remedial_required"] else "양호"
        })
        
    briefing_prompt = GeminiOrchestrator.get_admin_briefing_prompt(sessions_summary)
    
    # Load keys
    free_key1 = os.environ.get("GEMINI_API_KEY_FREE1") or os.environ.get("GEMINI_API_KEY")
    free_key2 = os.environ.get("GEMINI_API_KEY_FREE2")
    paid_key = os.environ.get("GEMINI_API_KEY_PAID")
    
    keys_to_try = []
    if free_key1:
        keys_to_try.append(("무료 키 1", free_key1))
    if free_key2:
        keys_to_try.append(("무료 키 2", free_key2))
    if paid_key:
        keys_to_try.append(("유료 키", paid_key))
        
    payload = {
        "contents": [{"parts": [{"text": briefing_prompt}]}],
        "systemInstruction": {"parts": [{"text": "당신은 플랫폼 운영을 점검하는 LMS 운영관리 자동화 에이전트입니다."}]},
        "generationConfig": {
            "temperature": 0.5,
            "maxOutputTokens": 2000,
            "thinkingConfig": {"thinkingBudget": 0}
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
    }
    
    briefing_text = None
    is_mocked = True
    
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
                candidates = res_json.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        briefing_text = parts[0].get("text", "")
                        is_mocked = False
                        logger.info(f"Successfully generated admin briefing report using {key_name}.")
                        break
        except Exception as e:
            logger.warning(f"Failed to query Gemini admin briefing API with {key_name}: {e}")
            
    if not briefing_text:
        # Dynamic mock briefing text based on the sessions
        briefing_text = f"""### 📊 LMS 운영 에이전트 시스템 진단 보고서

현재 가동 중인 수호의 주파수 속에서 총 **{len(SESSIONS)}명**의 회원이 동조 기록을 갱신하고 있습니다. 

#### 1. 시스템 종합 기류 진단
- **활성 학습자 수**: {len(SESSIONS)}명
- **총 발행 엽전**: {sum(s.coins for s in SESSIONS.values())}냥 유통 중
- **학습 동조 상태**: 전체 누적 정답률은 비교적 양호한 흐름을 유지하고 있으나, 자격증 팩 분야에서 정답률 편차가 일부 관찰되고 있습니다.

#### 2. 과락 위험 및 취약 회원 감지
"""
        weak_count = 0
        for s in sessions_summary:
            if s["remedial_status"] == "보충 학습 필요":
                weak_count += 1
                briefing_text += f"- **{s['student_title']}** (ID: {s['student_id']}) 회원: 현재 특정 과목에서 정답률이 60% 미만으로 떨어져 **'보충 학습 처방'** 기류가 활성화되었습니다. 엽전 잔액이 {s['coins']}냥으로 하락 중이므로 지속적인 집중 모니터링 및 추가 엽전 융통이 요구됩니다.\n"
        if weak_count == 0:
            briefing_text += "- 현재 위태로운 기류의 회원은 존재하지 않으며, 모든 동조 상태가 평온하게 유지되고 있습니다.\n"
            
        briefing_text += f"""
#### 3. 에이전트 자동 대응 및 권고 사항
- **자동 조치 완료**: 과락 위험 감지 회원들에게 튜터 에이전트 명의로 특별 처방 학습지를 전송하였습니다.
- **관리자 권고 사항**: 기류가 크게 소모된 회원들에게 엽전 가방을 리필해 주는 액션을 가동하여 학습 의지를 강화할 것을 추천합니다.
"""
    return {"briefing": briefing_text, "is_mocked": is_mocked}

@app.post("/api/admin/maintenance")
async def admin_maintenance(req: MaintenanceRequest):
    global STUDENT_MODEL
    if req.action == "clean_sessions":
        SESSIONS.clear()
        SESSIONS["web_student_user"] = StudentModel(student_id="web_student_user", student_title="대표님")
        STUDENT_MODEL = SESSIONS["web_student_user"]
        logger.info("Admin Agent Action: Cleaned all active student sessions.")
        return {"status": "success", "message": "모든 회원 세션을 초기 상태로 정비했습니다."}
    elif req.action == "refill_coins":
        for sid, s in SESSIONS.items():
            s.add_coins(50)
        logger.info("Admin Agent Action: Refilled +50 coins for all members.")
        return {"status": "success", "message": "모든 활성 회원에게 보너스 엽전 50냥씩 리필하였습니다!"}
    elif req.action == "force_remedial":
        # Record incorrect answers to trigger a remedial status for tests
        for sid, s in SESSIONS.items():
            for _ in range(3):
                s.record_answer(
                    subject="수목병리학",
                    question_text="임시 테스트용 오답 기입",
                    selected_answer="오답",
                    correct_answer="정답",
                    round_name="임시 회차",
                    is_cbt_mode=False
                )
        logger.info("Admin Agent Action: Forced remedial status for active sessions.")
        return {"status": "success", "message": "테스트를 위해 모든 회원에게 오답 이력을 임의로 주입하여 취약 경고 상태를 강제했습니다."}
    
    raise HTTPException(status_code=400, detail="Unknown maintenance action.")

# Models for scrape/import
class ScrapeCbtBankRequest(BaseModel):
    exam_url: str
    pack_id: str
    pack_name: str
    subject: str
    round: Optional[str] = "기출문제"
    limit_rounds: Optional[int] = 4

class GenerateAiPackRequest(BaseModel):
    pack_id: str
    pack_name: str
    subject: str
    round: str
    syllabus_scope: str
    question_count: int = 25


# Helper for parsing PDF using pdfplumber
def extract_text_from_pdf_stream(file_bytes):
    import io
    import pdfplumber
    full_text = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for idx, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                full_text.append(text)
    return "\n".join(full_text)

# Helper for parsing answers sheet
def parse_answers_sheet(answer_text):
    ans_map = {}
    if not answer_text:
        return ans_map
    pairs = re.findall(r'(\d+)\s*[:\-=\s]\s*([1-5①-⑤])', answer_text)
    circle_map = {"①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5"}
    for q_num, ans_val in pairs:
        if ans_val in circle_map:
            ans_val = circle_map[ans_val]
        ans_map[int(q_num)] = ans_val
    return ans_map

# Helper to query Gemini to format raw exam text
def query_gemini_to_parse_exam(raw_text, pack_name, default_subject, default_round):
    api_key = os.environ.get("GEMINI_API_KEY_FREE1") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise Exception("No Gemini API key found.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    system_instruction = (
        "You are an expert exam data compiler. You convert raw unstructured Korean exam papers "
        "into structured JSON format matching the tutoring database schema."
    )
    
    prompt = f"""
Convert the following exam text into a JSON object matching this exact schema:
{{
  "pack_name": "{pack_name}",
  "questions": [
    {{
      "id": "q1",
      "subject": "{default_subject}",
      "round": "{default_round}",
      "question_text": "Clean question text",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"],
      "correct_answer": "Answer digit (1-5), or empty string if unknown"
    }}
  ]
}}

Guidelines:
- Strip question numbers from the start of "question_text".
- Ensure "options" is a list of exactly 5 strings. If the question has 4 options, pad it with an empty string "".
- Look for inline answers (like "정답: 5") and extract them into "correct_answer" as a digit (e.g. "5"), then remove the answer leak from options or question text.
- Return ONLY the clean raw JSON block, no markdown code block formatting (like ```json), just the raw JSON.
- **IMPORTANT**: Set thinkingBudget to 0 in generationConfig to return the output immediately.

Exam paper text:
{raw_text}
"""

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
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
            "maxOutputTokens": 8000,
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        }
    }
    
    try:
        req_data = json.dumps(payload).encode('utf-8')
        http_req = urllib.request.Request(
            url, 
            data=req_data, 
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(http_req, timeout=45) as response:
            res_data = response.read().decode('utf-8')
            res_json = json.loads(res_data)
            text_response = res_json['candidates'][0]['content']['parts'][0]['text']
            return text_response
    except Exception as e:
        raise Exception(f"Gemini API query failed: {e}")


def query_gemini_to_generate_exam(subject: str, round_name: str, scope: str, count: int) -> str:
    free_key1 = os.environ.get("GEMINI_API_KEY_FREE1") or os.environ.get("GEMINI_API_KEY")
    free_key2 = os.environ.get("GEMINI_API_KEY_FREE2")
    paid_key = os.environ.get("GEMINI_API_KEY_PAID")
    
    keys_to_try = []
    if free_key1:
        keys_to_try.append(("무료 키 1", free_key1))
    if free_key2:
        keys_to_try.append(("무료 키 2", free_key2))
    if paid_key:
        keys_to_try.append(("유료 키", paid_key))

    if not keys_to_try:
        raise Exception("No Gemini API keys are configured.")
    
    system_instruction = (
        "You are an expert exam compiler. You write highly professional, academic-level multiple-choice exam questions "
        "based on the syllabus and scope provided. You always return output in clean, structured JSON format."
    )
    
    prompt = f"""
당신은 '나무의사' 및 국가 전문 기술 자격증 시험의 1차 필기 평가 전문 출제위원입니다.
제시된 [과목명] 및 [세부 출제 범위]에 부합하며, 실제 기출문제와 완전히 동일한 변별력과 학술적 완성도를 지닌 5지선다 객관식 문제를 정확히 {count}문항 출제해 주세요.

[과목명]: {subject}
[시험 회차]: {round_name}
[세부 출제 범위]:
{scope}

[출제 가이드라인]:
1. **전문성 및 기출 싱크율 극대화**:
   - 지엽적이거나 학술적으로 검증되지 않은 내용은 배제하고, 공식 학설, 교재 이론, 약제학적 메커니즘, 표준 학명 및 수치 정보를 활용하여 출제하십시오.
   - 보기 1번부터 5번까지 명확하고 매끄럽게 작성하며, 정답의 논리적 근거가 확실해야 합니다.
2. **메타 정보 금지**:
   - "도감", "교재", "Ebook", "일러두기", "목차", "머리말", "발간", "수록" 같은 교재 정보나 책 편집 상태를 묻는 질문은 **절대로 금지**합니다.
   - "연구진의 2008년 조사 대상지" 같은 특정 프로젝트 일지성 질문도 **절대로 금지**합니다. 오직 해당 시험 과목의 학술 지식 자체만 평가하십시오.
3. **출제 형식**:
   - 반드시 아래의 JSON 형식 리스트로만 답변하십시오. JSON 파싱 오류를 방지하기 위해 마크다운 기호(```json)나 양 끝의 추가 설명 없이 순수한 JSON 리스트 텍스트만 리턴하십시오.
   - 각 문항의 "correct_answer"는 정답 보기의 번호('1'~'5' 중 하나)를 문자열로 입력해야 합니다.

[응답 포맷]:
[
  {{
    "subject": "{subject}",
    "round": "{round_name}",
    "question_text": "수목의 ~에 대한 설명으로 옳은 것은?",
    "options": [
      "보기 1번 내용",
      "보기 2번 내용",
      "보기 3번 내용",
      "보기 4번 내용",
      "보기 5번 내용"
    ],
    "image_url": null,
    "correct_answer": "3"
  }}
]
"""

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {"text": system_instruction}
            ]
        },
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 8000,
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        }
    }
    
    last_error = None
    for key_name, api_key in keys_to_try:
        for model in ["gemini-2.5-flash", "gemini-flash-latest"]:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                req_data = json.dumps(payload).encode('utf-8')
                http_req = urllib.request.Request(
                    url, 
                    data=req_data, 
                    headers={'Content-Type': 'application/json'}
                )
                with urllib.request.urlopen(http_req, timeout=120) as response:
                    res_data = response.read().decode('utf-8')
                    res_json = json.loads(res_data)
                    text_response = res_json['candidates'][0]['content']['parts'][0]['text']
                    logger.info(f"Successfully generated AI questions using {key_name} ({model}).")
                    return text_response
            except Exception as e:
                logger.warning(f"Failed to generate AI questions with {key_name} using {model}: {e}")
                last_error = e
                continue
            
    raise Exception(f"Gemini API query failed for all keys and models. Last error: {last_error}")


@app.post("/api/admin/generate-ai-pack")
async def admin_generate_ai_pack(req: GenerateAiPackRequest):
    try:
        logger.info(f"Admin Action: Generating AI pack {req.pack_id} for subject {req.subject} and round {req.round}...")
        
        raw_json = query_gemini_to_generate_exam(req.subject, req.round, req.syllabus_scope, req.question_count)
        
        json_clean = raw_json.strip()
        if json_clean.startswith("```"):
            json_clean = re.sub(r'^```(?:json)?', '', json_clean).strip()
            json_clean = re.sub(r'```$', '', json_clean).strip()
            
        parsed_questions = json.loads(json_clean)
        if not isinstance(parsed_questions, list):
            raise ValueError("Gemini API did not return a valid list of questions.")
            
        output_dir = "./datapacks"
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"{req.pack_id}.json")
        
        # Load existing data pack if it exists, otherwise create a new one
        existing_questions = []
        if os.path.exists(output_path):
            try:
                with open(output_path, "r", encoding="utf-8") as f:
                    old_data = json.load(f)
                    existing_questions = old_data.get("questions", [])
            except Exception as e:
                logger.warning(f"Failed to load existing pack file for append: {e}")
                
        # Assign unique IDs to the generated questions
        start_q_num = len(existing_questions) + 1
        for idx, q in enumerate(parsed_questions):
            q["id"] = f"{req.pack_id}_q{start_q_num + idx}"
            q["subject"] = req.subject
            q["round"] = req.round
            if "image_url" not in q:
                q["image_url"] = None
            
            opts = q.get("options", [])
            if len(opts) < 5:
                opts.extend([""] * (5 - len(opts)))
            else:
                opts = opts[:5]
            q["options"] = opts

        new_questions = existing_questions + parsed_questions
        datapack_data = {
            "pack_name": req.pack_name,
            "questions": new_questions
        }
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(datapack_data, f, ensure_ascii=False, indent=2)
            
        LOADER.load_all_packs()
        logger.info(f"Admin Action: Successfully generated and appended {len(parsed_questions)} questions into {req.pack_id}")
        return {
            "status": "success",
            "message": f"Gemini AI가 {len(parsed_questions)}개 문항을 성공적으로 출제하여 '{req.pack_name}'에 추가 등록하였습니다!",
            "pack_name": req.pack_name,
            "total_questions": len(parsed_questions)
        }
    except Exception as err:
        logger.error(f"Failed AI package generation: {err}")
        raise HTTPException(status_code=500, detail=f"AI 문제 생성 중 오류가 발생했습니다: {err}")


@app.post("/api/admin/scrape-cbtbank")
async def admin_scrape_cbtbank(req: ScrapeCbtBankRequest):
    try:
        from bs4 import BeautifulSoup
        import requests
        import urllib.parse
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://cbtbank.kr/"
        }
        
        url = req.exam_url.strip()
        
        target_urls = []
        if "/category/" in url:
            logger.info(f"Detected category page. Finding exam links on: {url}")
            res = requests.get(url, headers=headers, timeout=10)
            res.raise_for_status()
            soup = BeautifulSoup(res.text, 'html.parser')
            
            exam_links = []
            import re
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if re.search(r"/exam/[a-zA-Z]+\d+", href):
                    full_href = urllib.parse.urljoin("https://cbtbank.kr/", href)
                    if full_href not in exam_links:
                        exam_links.append(full_href)
            
            if not exam_links:
                raise HTTPException(status_code=400, detail="카테고리 페이지에서 기출시험 링크(/exam/...)를 찾을 수 없습니다.")
            
            limit = req.limit_rounds if req.limit_rounds else 4
            target_urls = exam_links[:limit]
            logger.info(f"Crawl targets selected ({len(target_urls)} rounds): {target_urls}")
        else:
            target_urls = [url]
            
        questions = []
        global_q_index = 1
        
        for t_url in target_urls:
            try:
                logger.info(f"Fetching exam page: {t_url}")
                res = requests.get(t_url, headers=headers, timeout=10)
                res.raise_for_status()
                soup = BeautifulSoup(res.text, 'html.parser')
                
                page_title = soup.title.string if soup.title else ""
                round_name = req.round
                if page_title and (req.round == "기출문제" or not req.round):
                    match = re.search(r"(\d{4}-\d{2}-\d{2})", page_title)
                    if match:
                        round_name = f"{match.group(1)} 기출"
                    else:
                        round_name = page_title.replace("CBTBank", "").replace("-", "").strip()
                        
                exam_boxes = soup.select(".exam-box")
                if not exam_boxes:
                    logger.warning(f"No exam boxes found on page: {t_url}")
                    continue
                    
                for idx, box in enumerate(exam_boxes, 1):
                    try:
                        title_el = box.select_one(".exam-title")
                        if not title_el:
                            continue
                            
                        q_text_raw = title_el.get_text().strip()
                        q_text = re.sub(r"^\d+\.\s*", "", q_text_raw)
                        
                        choice_ol = box.select_one(".question-choice ol")
                        if not choice_ol:
                            continue
                            
                        correct_answer = choice_ol.get("correct", "1")
                        
                        option_els = choice_ol.select("li")
                        options = [opt.get_text().strip() for opt in option_els]
                        
                        if len(options) < 5:
                            options.extend([""] * (5 - len(options)))
                        else:
                            options = options[:5]
                            
                        image_url = ""
                        img_el = title_el.find("img")
                        if img_el and img_el.get("src"):
                            image_url = urllib.parse.urljoin("https://cbtbank.kr/", img_el["src"])
                            
                        questions.append({
                            "id": f"{req.pack_id}_q{global_q_index}",
                            "subject": req.subject,
                            "round": round_name,
                            "question_text": q_text,
                            "options": options,
                            "correct_answer": correct_answer,
                            "image_url": image_url
                        })
                        global_q_index += 1
                    except Exception as e:
                        logger.warning(f"Error parsing question on {t_url} at index {idx}: {e}")
                        continue
            except Exception as e:
                logger.error(f"Error fetching/parsing exam page {t_url}: {e}")
                continue
                
        if not questions:
            raise HTTPException(status_code=400, detail="모든 회차 페이지에서 파싱 완료된 문제가 0개입니다.")
            
        datapack_data = {
            "pack_name": req.pack_name,
            "questions": questions
        }
        
        output_dir = "./datapacks"
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"{req.pack_id}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(datapack_data, f, ensure_ascii=False, indent=2)
            
        LOADER.load_all_packs()
        logger.info(f"Admin Action: Successfully scraped and loaded {len(questions)} questions across {len(target_urls)} rounds into {req.pack_id}")
        return {
            "status": "success",
            "message": f"CBTBank.kr에서 {len(questions)}개 문항을 성공적으로 크롤링 및 파싱하여 등록 완료했습니다!",
            "pack_name": req.pack_name,
            "total_questions": len(questions)
        }
    except Exception as err:
        logger.error(f"Failed CBTBank scraping: {err}")
        raise HTTPException(status_code=500, detail=f"크롤링 중 오류가 발생했습니다: {err}")

@app.post("/api/admin/import-pack")
async def admin_import_pack(
    file: UploadFile = File(...),
    pack_id: str = Form(...),
    pack_name: str = Form(...),
    subject: str = Form(...),
    round: str = Form(...),
    answers_text: Optional[str] = Form(None)
):
    try:
        file_bytes = await file.read()
        filename = file.filename.lower()
        
        if filename.endswith(".pdf"):
            logger.info("Extracting text from uploaded PDF file...")
            raw_text = extract_text_from_pdf_stream(file_bytes)
        else:
            logger.info("Reading plain text from uploaded file...")
            raw_text = file_bytes.decode("utf-8", errors="ignore")
            
        if not raw_text.strip():
            raise HTTPException(status_code=400, detail="업로드된 파일에서 추출된 텍스트가 비어 있습니다.")
            
        logger.info("Submitting raw text to Gemini for structured JSON compilation...")
        json_response = query_gemini_to_parse_exam(raw_text, pack_name, subject, round)
        
        json_clean = json_response.strip()
        if json_clean.startswith("```"):
            json_clean = re.sub(r'^```(?:json)?', '', json_clean).strip()
            json_clean = re.sub(r'```$', '', json_clean).strip()
            
        parsed_pack = json.loads(json_clean)
        
        ans_map = parse_answers_sheet(answers_text) if answers_text else {}
        
        questions = parsed_pack.get("questions", [])
        for idx, q in enumerate(questions):
            q_num = idx + 1
            q["id"] = f"{pack_id}_q{q_num}"
            q["subject"] = subject
            q["round"] = round
            
            if q_num in ans_map:
                q["correct_answer"] = ans_map[q_num]
                
            opts = q.get("options", [])
            if len(opts) < 5:
                opts.extend([""] * (5 - len(opts)))
            else:
                opts = opts[:5]
            q["options"] = opts
            
        datapack_data = {
            "pack_name": pack_name,
            "questions": questions
        }
        
        output_dir = "./datapacks"
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"{pack_id}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(datapack_data, f, ensure_ascii=False, indent=2)
            
        LOADER.load_all_packs()
        logger.info(f"Admin Action: Successfully imported PDF/TXT pack into {pack_id} with {len(questions)} questions")
        return {
            "status": "success",
            "message": f"업로드된 기출 파일을 Gemini AI가 가독성 있게 파싱하여 {len(questions)}개 문항으로 등록 완료했습니다!",
            "pack_name": pack_name,
            "total_questions": len(questions)
        }
    except Exception as err:
        logger.error(f"Failed manual import: {err}")
        raise HTTPException(status_code=500, detail=f"수동 업로드 파싱 중 오류가 발생했습니다: {err}")

class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

# Mount static files directory at the root path '/' to support relative static file imports
app.mount("/", NoCacheStaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # Launch Uvicorn server on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
