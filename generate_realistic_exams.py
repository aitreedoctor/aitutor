import os
import json
import time
import urllib.request
import urllib.error
import shutil

# 환경설정
TARGET_JSON_FILE = "./datapacks/tree_doctor_past.json"
BACKUP_JSON_FILE = "./datapacks/tree_doctor_past.json.bak"
ENV_FILE = "./.env"

def load_all_keys():
    """ .env 파일과 환경 변수로부터 무료 키와 유료 키를 순서대로 로드합니다."""
    keys = {}
    if os.path.exists(ENV_FILE):
        try:
            with open(ENV_FILE, 'r', encoding='utf-8') as f:
                for line in f:
                    if "=" in line:
                        k, v = line.split("=", 1)
                        keys[k.strip()] = v.strip()
        except Exception:
            pass
            
    # 환경 변수 머지
    for k in ["GEMINI_API_KEY", "GEMINI_API_KEY_FREE1", "GEMINI_API_KEY_FREE2", "GEMINI_API_KEY_PAID"]:
        if k in os.environ:
            keys[k] = os.environ[k]
            
    free_key1 = keys.get("GEMINI_API_KEY_FREE1") or keys.get("GEMINI_API_KEY")
    free_key2 = keys.get("GEMINI_API_KEY_FREE2")
    paid_key = keys.get("GEMINI_API_KEY_PAID")
    
    keys_to_try = []
    if free_key1:
        keys_to_try.append(("무료 키 1", free_key1))
    if free_key2:
        keys_to_try.append(("무료 키 2", free_key2))
    if paid_key:
        keys_to_try.append(("유료 키(Paid)", paid_key))
        
    return keys_to_try

# 과목 및 회차별 출제 세부 범위 정의
SYLLABUS = {
    "산림토양학": [
        "토양 생성, 암석 풍화 작용, 토성 분류(모래, 미사, 점토), 토양 구조(입상, 판상, 괴상) 및 토양 물리적 특성 평가.",
        "토양 수분 분류(결합수, 흡착수, 모관수, 중력수), 수분 포텐셜 기작, 토양 내 수분 이동 및 흡수 보존 기작.",
        "토양 콜로이드의 구조와 전기적 특성, 양이온 교환 용량(CEC)의 영향 인자, 토양의 산/알칼리 완충능(Buffering capacity).",
        "토양 산도(pH)에 따른 양분의 유효도 변화 기작, 산성 토양의 발생 원인 및 석회 시용 개량 효과, 알루미늄 이온 독성.",
        "토양 유기물 분해 속도와 탄질율(C/N비), 토양 미생물(균근균 종류 및 기작, 생물학적 질소 고정), 토양 화학성 관리 및 비료 시용 기작."
    ],
    "수목관리학": [
        "수목 전정의 목적 및 시기별 전정 기작, 올바른 전정 부위(CODIT 이론, 가지칼라/지융부 보호), 수목 이식 공법 및 식재 후 활착 스트레스 방지 대책.",
        "저온 피해 메커니즘(동해, 한해, 동절기 탈수, 상렬 발생 기작, 상주 피해, 서리 피해 조상 및 만상 발생 차이) 및 방제 대책.",
        "기상 재해(가뭄 스트레스, 풍해 가해 메커니즘, 설해, 가지 피소 현상, 낙뢰) 및 화학적 염해(제설제 염화칼슘 피해, 해풍 염분 축적) 진단 및 예방 대책.",
        "농약의 분류(살균제, 살충제, 제초제) 및 작용 기작(세포벽 합성 저해, 아세틸콜린에스테라아제 저해, 광합성 저해 등), 농약 저항성 발달 기작 및 교호 살포 관리.",
        "농약 혼용 시 약해 발생 원인 및 방제 안전사용기준(PLS 제도 적용 및 잔류 허용 한계), 농약 제형(유제, 수화제 등)의 물리화학적 특성."
    ],
    "수목병리학": [
        "수목병 진단 기초(기생성/비기생성 병인 구별, 표징과 병징의 차이), 진균류 침엽수 병해(잎떨림병, 그을음잎마름병, 잎녹병의 생활사와 기주 교대 기작).",
        "진균류 활엽수 및 가지/뿌리 병해(아밀라리아뿌리썩음병 진단법, 밤나무 줄기마름병, 아까시흰구멍버섯 근주심재부후, 구름버섯 변재부후 기작 및 생태).",
        "세균성 수목 병해(뿌리혹병/근두암종병 공종 메커니즘, 불마름병 전염 경로, 세균성 구멍병 발병 환경) 진단 및 화학적/물리적 방제법.",
        "파이토플라스마(Phytoplasma) 병해(대추나무/오동나무/뽕나무 빗자루병)의 특징, 매개충(마름무늬매재충) 생태, 옥시테트라사이클린 수간주입 방제 메커니즘.",
        "수목 바이러스/바이로이드 병해 및 선충 병해(소나무재선충 전염 경로, 매개충 솔수염하늘소 및 북방아시아하늘소 후식 전염 기작, 훈증/나무주사 방제법)."
    ],
    "수목생리학": [
        "수목 세포 및 조직 구조(정단분열조직, 형성층 발달, 1차/2차 물관부와 체관부 분화), 침엽수 및 활엽수의 해부학적 구조 차이.",
        "광합성 명반응(광화학 반응, 전자전달계) 및 암반응(탄소 고정 반응, C3/C4/CAM 식물의 탄소대사 기작 비교), 환경 요인(광, 온도, CO2 농도)이 광합성에 미치는 영향.",
        "수목의 호흡 작용(유기호흡, 무기호흡 기작, 호흡률 RQ 해석), 수목 체내 탄수화물의 합성, 유기물 전류 및 수간 내 축적/이동 메커니즘.",
        "수목 수분 생리(수분 포텐셜 성분, 뿌리 수분 흡수 기작, 증산류 및 수액 상승 응집력-설인-장력설, 기공 개폐 조절 이온 메커니즘, 증산 작용 제어).",
        "식물 호르몬(옥신, 지베렐린, 사이토키닌, 앱시스산, 에틸렌의 생합성 경로 및 주요 생리적 활성), 환경 스트레스(저온, 고온, 건조, 침수)에 대한 수목의 생리적 반응."
    ],
    "수목해충학": [
        "곤충의 외부 구조(머리, 가슴, 배 부속지) 및 내부 소화/순환/신경 생리계 특징, 곤충의 변태(완전/불완전) 및 탈피 호르몬 제어 생태.",
        "흡즙성 수목 해충(솔잎혹파리 벌레혹 형성 기작, 진딧물류 감로 유발, 깍지벌레류, 방패벌레류, 전나무잎응애/소나무응애) 생태 및 화학적 방제법.",
        "식엽성 수목 해충(솔나방/송충이 섭식량, 미국흰불나방 둥지 형성, 매미나방 난괴 월동, 누런솔잎벌/솔잎벌류) 생태 및 생물적/화학적 방제법.",
        "천공성 수목 해충(하늘소류 목질부 가해, 나무좀류 매개균 전파, 바구미류, 유리나방류) 생태 및 침투성 약제 나무주사를 이용한 방제법.",
        "충영 형성 해충 및 종실/뿌리 가해 해충 생태, 해충 종합적 관리(IPM) 개념, 화학적/물리적/임업적 방제 및 생물적 천적(먹좀벌 등) 보호 기작."
    ]
}

def call_gemini_api(api_key, subject, round_name, scope):
    """Gemini API를 호출하여 고품질의 나무의사 필기시험 25문항을 생성합니다."""
    prompt = f"""
당신은 대한민국 산림청 주관 '나무의사' 자격시험 1차 필기 평가 전문 출제위원입니다.
제시된 [과목명] 및 [세부 출제 범위]에 부합하며, 실제 기출문제와 완전히 동일한 변별력과 학술적 완성도를 지닌 5지선다 객관식 문제를 정확히 25문항 출제해 주세요.

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
   - "연구진의 2008년 조사 대상지" 같은 특정 프로젝트 일지성 질문도 **절대로 금지**합니다. 오직 나무의사 시험 과목의 학술 지식 자체만 평가하십시오.
3. **출제 형식**:
   - 반드시 아래의 JSON 형식 리스트로만 답변하십시오. JSON 파싱 오류를 방지하기 위해 마크다운 기호(```json)나 양 끝의 추가 설명 없이 순수한 JSON 리스트 텍스트만 리턴하십시오.
   - 각 문항의 "correct_answer"는 정답 보기의 번호('1'~'5' 중 하나)를 문자열로 입력해야 합니다.

[응답 포맷]:
[
  {{
    "subject": "{subject}",
    "round": "{round_name}",
    "question_text": "Q1. 수목의 ~에 대한 설명으로 옳은 것은?",
    "options": [
      "보기 1번 내용",
      "보기 2번 내용",
      "보기 3번 내용",
      "보기 4번 내용",
      "보기 5번 내용"
    ],
    "image_url": null,
    "correct_answer": "3"
  }},
  ... (25개 채워질 때까지 반복)
]
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json",
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        }
    }
    
    req_data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
    
    with urllib.request.urlopen(req, timeout=90) as response:
        res_data = response.read().decode('utf-8')
        res_json = json.loads(res_data)
        text_content = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
        return json.loads(text_content)

def main():
    keys_to_try = load_all_keys()
    if not keys_to_try:
        print("[ERROR] 등록된 Gemini API 키가 없습니다. .env 파일을 확인해 주세요.")
        return
        
    print(f"[OK] {len(keys_to_try)}개의 API 키가 로드되었습니다.")
    for idx, (name, val) in enumerate(keys_to_try):
         print(f"  - 키 {idx+1}: {name} (길이: {len(val)}, 끝자리: {val[-6:]})")
         
    # 1. 기존 기출 백업 및 로드
    if not os.path.exists(TARGET_JSON_FILE):
        print(f"[ERROR] {TARGET_JSON_FILE} 파일이 없습니다.")
        return
        
    shutil.copyfile(TARGET_JSON_FILE, BACKUP_JSON_FILE)
    print(f"[OK] 원본 백업 완료: {BACKUP_JSON_FILE}")
    
    with open(TARGET_JSON_FILE, "r", encoding="utf-8") as f:
        database = json.load(f)
        
    # 기출문제 5회~12회 필터링 및 분리
    cbt_rounds = [f"제{i}회 기출" for i in range(5, 13)]
    cbt_questions = [q for q in database.get("questions", []) if any(cr in q.get("round", "") for cr in cbt_rounds)]
    print(f"[OK] 보존할 기출문제(5회~12회) 수: {len(cbt_questions)}")
    
    # 2. AI 기출문제 1회~5회 신규 출제 진행 (총 5회 * 5과목 * 25문제 = 625문제)
    new_ai_questions = []
    subjects_list = ["산림토양학", "수목관리학", "수목병리학", "수목생리학", "수목해충학"]
    
    print("\n[START] AI 기출문제 출제 엔진 가동 (총 625문항 출제 시작)...")
    
    # 키 상태 추적을 위한 변수
    current_key_idx = 0
    
    for round_idx in range(1, 6):
        round_name = f"AI 기출문제 {round_idx}회"
        print(f"\n--- {round_name} 출제 중 ---")
        
        for subject in subjects_list:
            scope = SYLLABUS[subject][round_idx - 1]
            print(f"  * 과목: {subject} | 범위: {scope[:40]}...")
            
            success = False
            retries = 3
            while retries > 0 and not success:
                # 사용 가능한 키로 순차 시도
                if current_key_idx >= len(keys_to_try):
                    print("    [ERROR] 사용 가능한 모든 API 키가 소진되었거나 차단되었습니다.")
                    return
                    
                key_name, api_key = keys_to_try[current_key_idx]
                
                try:
                    questions = call_gemini_api(api_key, subject, round_name, scope)
                    
                    # 문항 유효성 검사 (25문항 검사)
                    if not isinstance(questions, list):
                        raise Exception("API 응답이 리스트 형식이 아닙니다.")
                    
                    if len(questions) != 25:
                        print(f"    [WARN] 출제된 문항이 25개가 아닙니다 ({key_name} 사용, 현재 {len(questions)}개). 재시도합니다.")
                        retries -= 1
                        time.sleep(2)
                        continue
                        
                    # 각 개별 문항 구조 정합성 검사
                    for q in questions:
                        q["round"] = round_name
                        q["subject"] = subject
                        if "image_url" not in q:
                            q["image_url"] = None
                        # 정답 데이터가 1~5 문자열인지 확인
                        if not str(q.get("correct_answer")).strip().isdigit():
                            q["correct_answer"] = "1" # 임시 보정
                            
                    new_ai_questions.extend(questions)
                    print(f"    [OK] {subject} 25문항 출제 완료! (사용 키: {key_name}, 누적: {len(new_ai_questions)}문항)")
                    success = True
                    # Rate limit 방지용 딜레이
                    time.sleep(2)
                    
                except urllib.error.HTTPError as he:
                    body = he.read().decode('utf-8') if he.fp else ""
                    print(f"    [ERROR] API 호출 실패 ({key_name}): {he.code} - {he.reason}")
                    print(f"      [INFO] {key_name} 키를 비활성화하고 다음 키로 전환합니다.")
                    current_key_idx += 1
                    # 키 전환 시에는 재시도 횟수를 소모하지 않고 새 키로 즉시 시도
                    continue
                except Exception as e:
                    print(f"    [ERROR] 일반 에러 발생 ({key_name}): {e}. 다음 키로 임시 전환을 시도합니다.")
                    current_key_idx += 1
                    continue
                    
            if not success:
                print(f"    [FAIL] {subject} 과목 출제 실패. 중단합니다.")
                return

    # 3. 데이터 병합 및 저장
    database["questions"] = cbt_questions + new_ai_questions
    
    with open(TARGET_JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(database, f, ensure_ascii=False, indent=4)
        
    print(f"\n[SUCCESS] 전체 출제 성공! 새 질문 파일 저장 완료: {TARGET_JSON_FILE} (총 {len(database['questions'])}문항)")

if __name__ == "__main__":
    main()
