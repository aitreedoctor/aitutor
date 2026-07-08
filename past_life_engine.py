import os
import re
import json
import urllib.request
import logging

logger = logging.getLogger("PastLifeEngine")

class PastLifeEngine:
    def __init__(self):
        self.common_words = {
            "약초꾼", "거상", "호위무관", "지식인", "문인", "의병", "소설가", "학자",
            "대령", "대지주", "상인", "군관", "당신", "그대", "사람", "불씨", "등불",
            "기둥", "바람", "씨앗", "흔적", "기류", "파동", "자아", "영혼", "인물",
            "밑거름", "동지", "후손", "동반자", "수호신", "지도자", "개척자", "선구자", "조력자",
            "근원지", "발상지", "시발점", "중심지", "피해자", "가해자", "주인공", "목격자", "참가자"
        }
        self.known_names = [
            "윤도현", "이현우", "민치상", "백인엽", "이도", "윤도", "이현수", "윤대현", "윤덕재", "강정"
        ]

    def clean_name(self, name: str) -> str:
        if not name:
            return ""
        cleaned = name.strip()
        # Remove trailing common Korean postpositions, verb endings and incomplete endings
        cleaned = re.sub(r'(?:이었다|였다|이었습니다|였습니다|였|이었|입니까|입니다|이다|은|는|이|가|의|과|와|을|를)$', '', cleaned)
        return cleaned.strip()

    def is_valid_name(self, name: str) -> bool:
        cand = self.clean_name(name)
        return bool(cand and cand not in self.common_words and 2 <= len(cand) <= 4)

    def extract_name(self, story: str, default_name: str) -> str:
        if not story:
            return default_name
            
        # 0. Check if the story starts directly with a name (e.g. 홍길은..., 이도현은...)
        match = re.search(r"^['\"“‘]?([가-힣]{2,7})['\"”’]?(?:\([^)]*\))?(?:은|는|이|가|의)\s", story)
        if match and self.is_valid_name(match.group(1)):
            return self.clean_name(match.group(1))
            
        # 1. Check for specific name pattern endings (e.g. 윤도현이었습니다, 이현우였습니다, 윤도였습니다)
        match = re.search(r"['\"“‘]?([가-힣]{2,7})['\"”’]?(?:\([^)]*\))?[이|라는]\s+이름의", story)
        if match and self.is_valid_name(match.group(1)):
            return self.clean_name(match.group(1))
            
        match = re.search(r"(?:이름은|호칭은|태생의|태어난)\s+['\"“‘]?([가-힣]{2,7})['\"”’]?(?:\([^)]*\))?", story)
        if match and self.is_valid_name(match.group(1)):
            return self.clean_name(match.group(1))
            
        # 2. Scan for typical name formats ending with "이었습니다" or "였습니다" or "였다" or "이었다"
        match = re.search(r"(?:약초꾼|거상|호위무관|지식인|문인|의병|소설가|학자|대령|대지주|상인|군관)[,\s]*['\"“‘]?([가-힣]{2,7})['\"”’]?(?:\([^)]*\))?(?:였습니다|였다|이었다|이었습니다|입니까|입니다)", story)
        if match and self.is_valid_name(match.group(1)):
            return self.clean_name(match.group(1))
            
        # 3. Fallback check for any Korean name-like word preceding "이었습니다", "였습니다", "이었다" 또는 "였다"
        match = re.search(r"['\"“‘]?([가-힣]{2,7})['\"”’]?(?:\([^)]*\))?(?:였습니다|였다|이었다|이었습니다|입니까|입니다|의\s+기억|의\s+삶)", story)
        if match and self.is_valid_name(match.group(1)):
            return self.clean_name(match.group(1))
            
        # 4. Look inside story for explicit declarations
        for name in self.known_names:
            if name in story:
                return name
                
        return default_name

    def enforce_consistency(self, story: str, name: str) -> str:
        if not name or not story:
            return story
        matches = re.findall(rf"{re.escape(name)}[가-힣]*", story)
        allowed_starts = set("은는이가의을리와과에로으였이였입다고며든")
        for m in matches:
            suffix = m[len(name):]
            if not suffix:
                continue
            if suffix[0] not in allowed_starts:
                clean_suffix = suffix[1:]
                replacement = name + clean_suffix
                story = story.replace(m, replacement)
        return story

    def get_fallback_details(self, persona: str) -> tuple[str, str]:
        def get_fallback_name(p):
            if p == "거상": return "백인엽"
            if p == "호위무관": return "민치상"
            if p == "문인": return "윤도"
            return "이도"
            
        fallback_name = get_fallback_name(persona)
        fallback_story = f"""{fallback_name}은 1990년대 아날로그 감성이 흐르던 또 다른 평행세계에서, {persona}의 재능을 품고 이 자격증 분야의 선배로서 청춘을 바친 인물이었습니다. 카세트테이프 음악과 낭만이 가득하던 대학가 캠퍼스에서, 그는 밤새도록 도서관 헌책방 책장 사이에서 전공 서적을 뒤적이며 개념을 독파하고 합격을 향해 나아갔습니다. 90년대 특유의 아날로그 열정으로 개념의 뼈대를 다진 그는 훗날 많은 이들에게 합격의 이정표가 되었으며, 평행세계의 역사 속에서 성실함을 간직한 채 훌륭한 멘토이자 선배로서의 큰 자취를 남겼습니다."""
        return fallback_story, fallback_name

    def generate_past_life_details(self, name: str, persona: str) -> tuple[str, str]:
        # Load keys from environment variables
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
            
        fallback_story, fallback_name = self.get_fallback_details(persona)
        if not keys_to_try:
            logger.warning("No Gemini API keys are configured. Running fallback story.")
            return fallback_story, fallback_name

        system_instruction = "너는 평행세계(Parallel Universe)의 공명 자아와 학습 주파수를 판별하는 수호 선배 가이드다."
        
        # Define persona-specific life trajectory and death guidelines
        if persona == "약초꾼":
            life_guide = "90년대 당시 국립공원 레인저나 산림 연구원으로서 전국의 산과 숲을 누비며 아픈 나무들을 돌보고 식물과 약초 자원을 보존하기 위해 자연 속에 파묻혀 헌신한 열정적인 산림 청년 선배로서의 삶"
            death_guide = "연구 중 산속 깊은 계곡에서 악천후 속 조난된 조난자를 구조하려다 헌신적으로 추락사했거나, 자연 보호 활동 중 불의의 사고(향년 28세, 1999년)로 슬프고도 명예롭게 생을 마감함"
        elif persona == "거상":
            life_guide = "90년대 대한민국 벤처 1세대 및 농산물 무역 상사의 청년 창업 멤버로서 전국의 농가와 해외 유통망을 개척하며 한국 농업 경제의 기틀을 닦고 스마트 농업의 뼈대를 구상한 선구적인 대무역상 선배로서의 삶"
            death_guide = "평생 농업 유통망을 세우고 사회에 공헌한 뒤, 노년에 자택에서 가족들과 후배 동료들의 슬픔 속에서 병환으로 편안히 숨을 거두었거나 미래의 비전을 품은 채(향년 64세, 2029년) 삶의 여정을 마침"
        elif persona == "호위무관":
            life_guide = "90년대 경찰 특공대 출신이나 핵심 보안 전문 경호원으로서, 날카로운 직관과 강인한 신체로 주요 국가 시설이나 위태로운 인물들의 신변을 완벽히 방어해 낸 꼿꼿하고 충직한 안전 요원 선배로서의 삶"
            death_guide = "90년대 중반 대형 사고 현장이나 침입 테러 상황 속에서 무고한 시민들과 주군을 대피시키기 위해 온몸으로 위험 요소를 홀로 막아내다 장렬히 순직함(향년 29세, 1997년)"
        elif persona == "문인":
            life_guide = "90년대 학회 동인지 편집장이자 시대의 고민을 펜끝으로 써 내려간 청년 작가로서, 컴퓨터가 보편화되지 않은 시절 밤새 타자기를 치며 지문 분석과 개념 해설서의 초안을 다듬고 한글 문학의 아름다움을 전파한 공부법 멘토 선배로서의 삶"
            death_guide = "창작열을 불태우며 만성 폐질환을 앓으면서도 최종 원고의 교정지를 품에 안은 채 서재 책상 위에서 조용히 숨을 거둠(향년 57세, 2026년)"
        else:
            life_guide = "90년대 아날로그 시기라는 격변의 아픔 속에서 신념을 위해 헌신하거나 자신의 지식을 이웃과 나누었던 궤적"
            death_guide = "자신의 신념을 굳건히 지키려다 불의의 열악한 환경 속에서 숨을 거두거나, 소중한 개념 필기 노트를 품에 안고 조용히 눈을 감는 비장한 최후"
 
        user_prompt = f"""
        현생의 호칭: {name}
        선택된 선배 유형(평행세계 부캐 성향): {persona}
        
        위 정보와 1990년대 레트로 감성의 청년 선배(안경을 쓰지 않았으며 단정하고 낭만적인 90년대 대학생/직장인 서구식 캐주얼이나 정장을 정갈하게 입은 아날로그 흑백/세피아 사진 속 모습)의 외양을 기반으로, 이 사람이 평행세계의 1990년대(1993년 전후)에 누구였고 어떤 삶을 살았는지, 주 활동 지역은 어디며 어떻게 생을 마감했는지에 대한 '평행세계 자아의 스토리'를 창조해라.
        
        다음의 구조를 지키며 매우 현실적이고 설득력 있으며, 문학적이되 담백한 평전/일대기 어조로 작성해라. 불필요하고 상투적이거나 과도한 묘사(예: '단정한 서양식 정장 재킷과 셔츠, 타이를 정갈하게 차려입고 팔짱을 낀 채 부드러운 눈빛으로 정면을 응시하는' 등의 문구 복사)는 완전히 배제하고, 실제 인물의 역사를 들려주듯 현실적으로 써라:
        - 절대 규칙: 절대로 현생의 인물(예: '현생의 강정희 님', '강정희 님', '그대', '당신')에게 직접 말을 건네거나 설명하는 편지 어조로 작성하지 말아라. 오직 평행세계의 인물 그 자체를 3인칭 주인공으로 삼아, 그의 과거 행적과 기록만을 객관적이고 완성도 높은 평전/일대기 형태의 3인칭 서사로 작성해야 한다. (예: "장소는 1990년대 대학가 청년으로서 경성 혜화동 태생의... 그는..." 형식으로 바로 시작할 것)
        - 중요: 스토리 내에 '사진 속 모습', '정면을 응시하는 모습', '팔짱을 낀 모습' 등 사진의 구도나 촬영 행태를 묘사하는 메타적/인위적인 표현을 절대로 작성하지 말아라. 인물의 외양은 스토리 상황 속에 매우 자연스럽고 간결하게 녹여서 작성해라.
        
        1. 평행세계 자아의 이름과 신분/역할
           - 중요 (새로운 이름 작명 규칙 - 독립적이고 전혀 다른 이름):
             * 평행세계 자아의 이름은 현생의 호칭 '{name}'의 자음 초성이나 발음, 철자 등과 아무런 상관이 없고, 현생 인물과는 전혀 다른 별개의 인물로 느껴지도록 한국의 근대(1900년대 초반) 분위기에 어울리는 독자적인 전혀 다른 한국어 이름(예: 민치상, 백인엽, 이원, 윤정우, 임학선, 한성린 등)으로 새롭게 지어라.
             * 절대로 현생의 호칭인 '{name}'의 글자나 자음 초성을 따르거나 그것을 연상시키는 이름으로 짓지 말아라. 현생의 이름과는 발음 및 형태가 완전히 무관하고 전혀 다른 이름이어야 한다.
           - 중요 규칙 (이름의 일관성 및 절대 보존 - Highest Priority):
             * 스토리 내에서 새롭게 작명하여 주인공으로 결정한 평행세계 자아의 이름(예: '백인엽')은 전체 스토리의 모든 문단, 첫 문장부터 마지막 문장까지 단 한 글자도 변경, 확장, 축약, 수정하지 않고 정확히 동일하게 반복 사용해야 한다.
             * 절대로 작명된 이름 뒤에 다른 글자를 덧붙여 새로운 이름(예: 작명된 이름이 '백인엽'일 때 '백인엽호', '백인엽후', '백인엽우', '백인엽훈' 등)으로 임의 완성하거나 확장하여 변형하지 말아라.
             * 스토리 내의 모든 문장과 등장 위치에서 오직 동일한 그 작명된 이름으로만 주인공을 지칭해라.
           - 중요: 스토리를 서술할 때, 그 이름이 지어진 이유나 배경에 대해 설명(예: '이름은 ~이다' 등)을 절대로 본문에 기술하거나 구구절절 언급하지 말아라. 아무런 부연 설명 없이, 결정된 이름으로 바로 이야기를 시작해야 한다.
           - 중요 외양 고증: 인물의 외양이나 복장을 언급할 때는 절대로 '안경을 썼다'거나 '두루마기 한복을 입었다'고 묘사하지 말아라. 반드시 '안경을 쓰지 않은 눈빛', '90년대 아날로그 정장 및 캐주얼 차림' 등으로 현실적이고 짧게 묘사해야 하며, 사진 설명글 같은 불필요하고 진부한 묘사 문장은 완전히 지워라.
        2. 그의 구체적인 삶의 궤적 ({life_guide})
        3. 그의 고향 (경성 혜화동, 평양 서포, 혹은 강화도 포구 등 구체적인 한국 근대 공간)
        4. 어떻게 숨을 거두었는지 ({death_guide})
        
        반드시 마크다운 기호(#, *, - 등)를 일체 사용하지 말고, 줄바꿈('\\n')이 포함된 문단 형태로 작성해라. 글자 수 300~350자 내외로 확실히 종결하여 끝마치고, 절대 중간에 끊긴 불완전한 문장이나 내용으로 마무리하지 마라.
        """
        
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
                "maxOutputTokens": 1024,
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
                            text = parts[0].get("text", "").strip()
                            detected_name = self.extract_name(text, name)
                            text = self.enforce_consistency(text, detected_name)
                            logger.info(f"Dynamically generated story for {name} (Past Name: {detected_name}) using {key_name}")
                            return text, detected_name
            except Exception as e:
                logger.warning(f"Failed to generate story with key {key_name}: {e}")
                
        return fallback_story, fallback_name
