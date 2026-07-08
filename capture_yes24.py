import os
import json
import time
import base64
import urllib.request
from PIL import ImageGrab

# 1. 설정 정보
OUTPUT_JSON_FILE = "./datapacks/ebook_extracted.json"
ENV_FILE = "./.env"

def load_api_key():
    """환경 변수 및 .env 파일에서 API 키를 로드합니다."""
    if os.path.exists(ENV_FILE):
        try:
            with open(ENV_FILE, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        return line.split("=", 1)[1].strip()
        except Exception:
            pass
            
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key.strip()
    return None

def save_api_key_to_env(api_key):
    """입력받은 API 키를 .env 파일에 저장합니다."""
    try:
        with open(ENV_FILE, "w", encoding="utf-8") as f:
            f.write(f"GEMINI_API_KEY={api_key}\n")
        print(f"💾 API 키가 {ENV_FILE} 파일에 저장되었습니다.")
    except Exception as e:
        print(f"⚠️ .env 파일 저장 실패: {e}")

def capture_screen():
    """화면 전체를 캡처하여 저장합니다."""
    os.makedirs("./pdf", exist_ok=True)
    temp_path = "./pdf/temp_capture.png"
    
    print("\n[캡처 대기] 3초 뒤에 화면을 캡처합니다. 뷰어 창을 활성화해 주세요...")
    for i in range(3, 0, -1):
        print(f"⌛ {i}...")
        time.sleep(1)
        
    try:
        img = ImageGrab.grab()
        img.save(temp_path)
        print("📸 화면 캡처 완료!")
        return temp_path
    except Exception as e:
        print(f"❌ 캡처 실패: {e}")
        return None

def extract_questions_from_image(image_path, subject, api_key, mode):
    """캡처한 이미지를 Gemini API로 보내 문제를 추출하거나 새로 출제합니다."""
    print("🤖 Gemini API를 통해 이미지 분석 중...")
    
    try:
        with open(image_path, "rb") as f:
            image_base64 = base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        print(f"이미지 인코딩 실패: {e}")
        return []

    # 모드에 따른 프롬프트 분기
    if mode == 1:
        # 1. 기존 문제 추출 모드
        prompt = f"""
이 이미지(교재 화면)에서 '나무의사' 시험과 관련된 기존 객관식 문제(질문, 5개 보기, 정답)를 찾아서 텍스트로 똑같이 복사하여 추출해 주세요.

[과목 분류]: {subject}
[출제 요구사항]:
1. 캡처 이미지 내에 존재하는 문제를 지문, 보기 1~5번까지 한 글자도 빠짐없이 텍스트로 인식해 추출하세요.
2. 문제의 올바른 정답을 분석하여 함께 기입하세요 (1~5 중 하나).
3. 반드시 다음 JSON 리스트 형식으로만 답변하세요. 다른 부가 설명이나 ```json 마크다운 기호 없이 순수한 JSON 텍스트만 출력하세요:
[
  {{
    "subject": "{subject}",
    "round": "Ebook 추출 문제",
    "question_text": "문제 질문 내용",
    "options": [
      "보기 1번 내용",
      "보기 2번 내용",
      "보기 3번 내용",
      "보기 4번 내용",
      "보기 5번 내용"
    ],
    "image_url": null,
    "correct_answer": "정답 번호 (1~5 중 하나를 문자열로 입력, 예: '3')"
  }}
]
"""
    else:
        # 2. 본문 기반 신규 출제 모드
        prompt = f"""
당신은 대한민국 '나무의사' 자격시험 전문 출제위원입니다.
제공된 이미지(교재 본문 텍스트 화면)의 내용을 정독하고 분석하여, 이 이론적 내용을 학습하고 평가하기 위한 실제 시험 수준의 5지선다형 객관식 문제를 1~2개 새로 출제해 주세요.

[과목 분류]: {subject}
[출제 요구사항]:
1. 이미지 속에 포함된 이론 지식, 학명, 수치, 작용 기작 등을 바탕으로 고난이도 객관식 문제를 만드세요.
2. 보기 1번부터 5번까지 그럴싸한 오답 함정을 포함하여 만드세요.
3. 반드시 다음 JSON 리스트 형식으로만 답변하세요. 다른 부가 설명이나 ```json 마크다운 기호 없이 순수한 JSON 텍스트만 출력하세요:
[
  {{
    "subject": "{subject}",
    "round": "Ebook 본문 기반 출제",
    "question_text": "출제한 문제 질문 내용",
    "options": [
      "보기 1번 내용",
      "보기 2번 내용",
      "보기 3번 내용",
      "보기 4번 내용",
      "보기 5번 내용"
    ],
    "image_url": null,
    "correct_answer": "정답 번호 (1~5 중 하나를 문자열로 입력, 예: '3')"
  }}
]
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": "image/png",
                            "data": image_base64
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json",
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        }
    }
    
    req_data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url, 
        data=req_data, 
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            res_data = response.read().decode('utf-8')
            res_json = json.loads(res_data)
            text_response = res_json["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text_response)
    except urllib.error.HTTPError as he:
        if he.code == 401:
            print("\n❌ API 키 인증 실패 (HTTP 401 Unauthorized)")
            print("현재 사용 중인 API 키가 만료되었거나 올바르지 않습니다.")
        else:
            print(f"\n❌ API 서버 에러 (HTTP {he.code}): {he.reason}")
        return []
    except Exception as e:
        print(f"\n❌ Gemini API 분석 실패: {e}")
        return []

def main():
    print("==================================================")
    print("      YES24 Ebook 화면 캡처 & 문제 자동 등록기")
    print("==================================================")
    
    api_key = load_api_key()
    
    if not api_key:
        print("❌ 실행 실패: GEMINI_API_KEY 환경변수가 설정되어 있어야 합니다.")
        return

    # 작동 모드 선택
    print("작업 모드를 선택하세요:")
    print("  1) 문제 추출 모드 (화면에 표시된 기존 문제를 똑같이 읽어와 등록)")
    print("  2) 본문 출제 모드 (화면의 본문/이론 내용을 바탕으로 AI가 새 문제를 출제)")
    try:
        mode = int(input("선택 (1 또는 2): "))
        if mode not in [1, 2]:
            mode = 1
    except Exception:
        mode = 1

    # 과목 선택
    subjects = ["수목병리학", "수목해충학", "수목생리학", "산림토양학", "수목관리학"]
    print("\n분류할 과목을 선택하세요:")
    for idx, sub in enumerate(subjects, 1):
        print(f"  {idx}) {sub}")
    
    try:
        sub_choice = int(input("선택 (1~5): "))
        subject = subjects[sub_choice - 1]
    except Exception:
        print("잘못된 입력입니다. '수목생리학'으로 기본 설정합니다.")
        subject = "수목생리학"

    # 기존 문제 로드
    existing_questions = []
    if os.path.exists(OUTPUT_JSON_FILE):
        try:
            with open(OUTPUT_JSON_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                existing_questions = data.get("questions", [])
                print(f"\n기존에 추출된 문항 수: {len(existing_questions)}개")
        except Exception:
            pass

    while True:
        print("\n[Enter]를 누르면 캡처 대기가 시작됩니다. (종료하려면 q 입력 후 Enter): ")
        choice = input().strip().lower()
        if choice == 'q':
            break
            
        image_path = capture_screen()
        if not image_path:
            continue
            
        questions = extract_questions_from_image(image_path, subject, api_key, mode)
        if questions:
            for q in questions:
                print(f"  ✅ 등록 성공: [{q['subject']}] {q['question_text'][:25]}... (정답: {q['correct_answer']}번)")
            existing_questions.extend(questions)
            
            datapack = {
                "pack_name": "YES24 Ebook 추출 문제팩",
                "questions": existing_questions
            }
            with open(OUTPUT_JSON_FILE, "w", encoding="utf-8") as f:
                json.dump(datapack, f, ensure_ascii=False, indent=4)
                
            print(f"💾 총 {len(existing_questions)}개 문항이 {OUTPUT_JSON_FILE} 에 누적 저장되었습니다.")
        else:
            print("❌ 작업 실패: 캡처 영역 안에 텍스트가 부족하거나 분석에 실패했습니다.")
            
            change_key = input("🔑 API 키를 변경하시겠습니까? (y/n): ").strip().lower()
            if change_key == 'y':
                new_key = input("🔑 새 Gemini API 키(AIzaSy...): ").strip()
                if new_key:
                    api_key = new_key
                    save_api_key_to_env(api_key)

    print("\n작업이 완료되었습니다. 웹 서버를 새로고침하면 CBT 메뉴에서 'YES24 Ebook 추출 문제팩'을 푸실 수 있습니다!")

if __name__ == "__main__":
    main()
