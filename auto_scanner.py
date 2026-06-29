import os
import json
import time
import base64
import ctypes
import urllib.request
from PIL import ImageGrab
import winsound  # Windows 경고음용

# 1. 설정 정보
OUTPUT_JSON_FILE = "./datapacks/ebook_extracted.json"
ENV_FILE = "./.env"
VK_RIGHT = 0x27  # 오른쪽 방향키 가상 키 코드

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

def press_right_arrow():
    """오른쪽 방향키 입력을 시뮬레이션하여 다음 페이지로 넘깁니다."""
    ctypes.windll.user32.keybd_event(VK_RIGHT, 0, 0, 0)      # Key Down
    time.sleep(0.05)
    ctypes.windll.user32.keybd_event(VK_RIGHT, 0, 2, 0)      # Key Up

def extract_questions_from_image(image_path, subject, api_key, mode):
    """캡처한 이미지를 Gemini API로 보내 문제를 추출하거나 새로 출제합니다."""
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
            "responseMimeType": "application/json"
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
    except Exception as e:
        print(f"❌ 분석 실패: {e}")
        return []

def main():
    print("==================================================")
    print("      나무의사 Ebook 자동 연속 스캐너 (Auto Scanner)")
    print("==================================================")
    
    api_key = load_api_key()
    if not api_key:
        print("❌ 실행 실패: GEMINI_API_KEY 환경변수가 설정되어 있어야 합니다.")
        return

    # 1. 스캔 장수 입력
    try:
        pages_to_scan = int(input("👉 연속 스캔할 페이지 수를 입력하세요 (예: 10): "))
        if pages_to_scan <= 0:
            print("1장 이상 입력해야 합니다. 종료합니다.")
            return
    except Exception:
        print("올바른 숫자가 아닙니다.")
        return

    # 2. 작업 모드 선택
    print("\n작업 모드를 선택하세요:")
    print("  1) 문제 추출 모드 (연습문제/기출문제 페이지만 연속 스캔할 때)")
    print("  2) 본문 출제 모드 (이론 본문 페이지만 연속 스캔하여 문제를 자동 생성할 때)")
    try:
        mode = int(input("선택 (1 또는 2): "))
        if mode not in [1, 2]:
            mode = 1
    except Exception:
        mode = 1

    # 3. 과목 선택
    subjects = ["수목병리학", "수목해충학", "수목생리학", "산림토양학", "수목관리학"]
    print("\n분류할 과목을 선택하세요:")
    for idx, sub in enumerate(subjects, 1):
        print(f"  {idx}) {sub}")
    
    try:
        sub_choice = int(input("선택 (1~5): "))
        subject = subjects[sub_choice - 1]
    except Exception:
        subject = "수목생리학"

    # 기존 문제 로드
    existing_questions = []
    if os.path.exists(OUTPUT_JSON_FILE):
        try:
            with open(OUTPUT_JSON_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                existing_questions = data.get("questions", [])
        except Exception:
            pass

    print("\n--------------------------------------------------")
    print("📢 준비 사항:")
    print("1. YES24 웹뷰어를 화면 전체로 띄우고 시작 페이지를 맞춰 두세요.")
    print("2. 엔터를 누르면 5초 카운트다운이 시작됩니다.")
    print("3. 카운트다운 동안 웹뷰어 브라우저 화면을 꼭 클릭(활성화)해 주세요.")
    print("4. 스캔 시작 후에는 마우스나 키보드를 만지지 말고 가만히 대기해 주세요.")
    print("--------------------------------------------------")
    input("시작하려면 [Enter]를 누르세요...")

    # 카운트다운
    for i in range(5, 0, -1):
        print(f"⌛ {i}...")
        winsound.Beep(600, 150)
        time.sleep(1)

    print("\n🚀 자동 스캔을 시작합니다! 마우스를 건드리지 마세요.")
    winsound.Beep(1200, 500)

    # 캡처 루프
    captured_files = []
    os.makedirs("./pdf/scan_temp", exist_ok=True)
    
    for page_idx in range(1, pages_to_scan + 1):
        print(f"📸 [{page_idx}/{pages_to_scan}] 캡처 중...")
        
        # 1. 화면 캡처
        temp_path = f"./pdf/scan_temp/page_{page_idx}.png"
        try:
            img = ImageGrab.grab()
            img.save(temp_path)
            captured_files.append(temp_path)
        except Exception as e:
            print(f"❌ 캡처 실패: {e}")
            break
            
        # 2. 다음 페이지로 넘기기 (마지막 페이지가 아닌 경우에만)
        if page_idx < pages_to_scan:
            press_right_arrow()
            time.sleep(1.8)  # 웹 페이지가 넘어가는 시간 동안 대기 (네트워크 환경에 맞춰 조절 가능)

    # 스캔 완료 경고음
    for _ in range(3):
        winsound.Beep(1000, 200)
        time.sleep(0.1)

    print("\n✅ [1단계] 화면 캡처 완료!")
    print("이제 웹뷰어 창을 닫거나 컴퓨터를 다른 일에 쓰셔도 됩니다.")
    print("AI가 캡처된 파일들을 하나씩 해독하여 문제팩을 생성하기 시작합니다...")
    print("--------------------------------------------------")

    # AI 문제 분석 루프
    new_questions_count = 0
    for idx, img_path in enumerate(captured_files, 1):
        print(f"🤖 [{idx}/{len(captured_files)}] 분석 중: {img_path}")
        questions = extract_questions_from_image(img_path, subject, api_key, mode)
        
        if questions:
            for q in questions:
                print(f"  ✅ 등록: [{q['subject']}] {q['question_text'][:25]}... (정답: {q['correct_answer']}번)")
            existing_questions.extend(questions)
            new_questions_count += len(questions)
            
            # 실시간으로 파일 누적 저장
            datapack = {
                "pack_name": "YES24 Ebook 추출 문제팩",
                "questions": existing_questions
            }
            with open(OUTPUT_JSON_FILE, "w", encoding="utf-8") as f:
                json.dump(datapack, f, ensure_ascii=False, indent=4)
        else:
            print("  ❌ 이 페이지에서는 문제를 등록하지 못했습니다.")

    # 임시 폴더 삭제
    try:
        for f in captured_files:
            os.remove(f)
        os.rmdir("./pdf/scan_temp")
    except Exception:
        pass

    print("\n==================================================")
    print(f"🎉 모든 작업이 완료되었습니다!")
    print(f"- 새로 등록된 문제: {new_questions_count}개")
    print(f"- 누적 총 문제 수: {len(existing_questions)}개")
    print(f"💾 저장 경로: {OUTPUT_JSON_FILE}")
    print("웹 페이지를 새로고침하면 CBT 메뉴에서 모의고사를 푸실 수 있습니다!")
    print("==================================================")

if __name__ == "__main__":
    main()
