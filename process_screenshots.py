import os
import json
import time
import base64
import urllib.request
import urllib.error

# 설정 정보
SCAN_TEMP_DIR = "./pdf/scan_temp"
TARGET_JSON_FILE = "./datapacks/tree_doctor_past.json"
ENV_FILE = "./.env"
SUBJECT = "수목생리학"
ROUND_NAME = "수목생리학 Ebook"

def load_api_key():
    """.env 파일 또는 환경 변수에서 API 키를 로드합니다."""
    if os.path.exists(ENV_FILE):
        try:
            with open(ENV_FILE, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        return line.split("=", 1)[1].strip()
        except Exception:
            pass
    return os.environ.get("GEMINI_API_KEY")

def process_batch(image_paths, api_key):
    """5장 내외의 이미지 배치를 하나의 Gemini API 요청으로 보내 문제를 출제합니다."""
    print(f"🤖 Gemini API 분석 중 ({len(image_paths)}장 배치)...")
    
    parts = []
    # 1. 지시사항 프롬프트 추가
    prompt = f"""
당신은 대한민국 '나무의사' 자격시험 전문 출제위원입니다.
제공된 {len(image_paths)}장의 이미지(교재 본문 텍스트 화면)를 꼼꼼히 정독하고 분석하여, 이 내용을 학습하고 평가하기 위한 실제 시험 수준의 5지선다형 객관식 문제를 총 {len(image_paths)}개 출제해 주세요 (각 페이지별 중요 개념 1개씩 출제).

[과목 분류]: {SUBJECT}
[출제 요구사항]:
1. 이미지 속 이론 지식, 생리 현상, 주요 수치, 화학 물질 명칭 등을 바탕으로 변별력 있는 문제를 출제하세요.
2. 각 문제당 보기 1번부터 5번까지 구성하고 정답을 정확히 기입하세요.
3. 반드시 다음 JSON 리스트 형식으로만 답변하세요. 다른 부가 설명이나 ```json 마크다운 기호 없이 순수한 JSON 텍스트만 출력하세요:
[
  {{
    "subject": "{SUBJECT}",
    "round": "{ROUND_NAME}",
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
    parts.append({"text": prompt})
    
    # 2. 이미지 데이터 추가
    for path in image_paths:
        try:
            with open(path, "rb") as f:
                img_data = base64.b64encode(f.read()).decode("utf-8")
                parts.append({
                    "inlineData": {
                        "mimeType": "image/png",
                        "data": img_data
                    }
                })
        except Exception as e:
            print(f"❌ 이미지 읽기 실패 ({path}): {e}")
            
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{"parts": parts}],
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
        with urllib.request.urlopen(req, timeout=60) as response:
            res_data = response.read().decode('utf-8')
            res_json = json.loads(res_data)
            text_response = res_json["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text_response)
    except Exception as e:
        print(f"❌ Gemini API 문제 출제 실패: {e}")
        return []

def main():
    print("==================================================")
    print("      캡처 이미지 기반 AI 문제 출제 및 연동기")
    print("==================================================")
    
    api_key = load_api_key()
    if not api_key:
        print("❌ 실행 실패: GEMINI_API_KEY 환경변수가 설정되어 있어야 합니다.")
        return

    # 1. scan_temp 폴더 내 이미지 검색 및 정렬
    if not os.path.exists(SCAN_TEMP_DIR):
        print(f"❌ 캡처된 파일 폴더가 없습니다: {SCAN_TEMP_DIR}")
        return
        
    png_files = [
        os.path.join(SCAN_TEMP_DIR, f) 
        for f in os.listdir(SCAN_TEMP_DIR) 
        if f.endswith(".png")
    ]
    
    # page_1, page_2, ... 순으로 정렬하기 위한 키 함수
    def get_file_num(filepath):
        basename = os.path.basename(filepath)
        num_str = "".join([c for c in basename if c.isdigit()])
        return int(num_str) if num_str else 9999
        
    png_files = sorted(png_files, key=get_file_num)
    total_images = len(png_files)
    
    if total_images == 0:
        print("❌ 폴더 내에 PNG 이미지가 없습니다.")
        return
        
    print(f"📂 총 {total_images}개의 캡처 이미지가 감지되었습니다.")
    
    # 2. 5장씩 배치 처리
    batch_size = 5
    generated_questions = []
    
    print("\n🚀 AI 문제 출제를 시작합니다 (5장 단위 배치 처리)...")
    for i in range(0, total_images, batch_size):
        batch = png_files[i : i + batch_size]
        print(f"\n👉 [{i // batch_size + 1}/{(total_images - 1) // batch_size + 1}] 배치 처리 중...")
        
        # API 호출
        questions = process_batch(batch, api_key)
        
        if questions:
            for q in questions:
                print(f"   ✅ 출제 성공: [{q['subject']}] {q['question_text'][:25]}... (정답: {q['correct_answer']}번)")
            generated_questions.extend(questions)
        else:
            print("   ❌ 이번 배치는 문제 출제에 실패했습니다.")
            
        # API 레이트 리밋 방지 대기
        if i + batch_size < total_images:
            print("⏳ API 호출 속도 조절을 위해 5초간 대기합니다...")
            time.sleep(5)

    if not generated_questions:
        print("\n❌ 출제된 문제가 없습니다. 작업을 중단합니다.")
        return

    print(f"\n🎉 총 {len(generated_questions)}개의 문제가 AI에 의해 출제되었습니다!")

    # 3. tree_doctor_past.json 로드 및 병합
    print(f"\n💾 {TARGET_JSON_FILE} 파일에 병합하는 중...")
    try:
        if os.path.exists(TARGET_JSON_FILE):
            with open(TARGET_JSON_FILE, "r", encoding="utf-8") as f:
                target_data = json.load(f)
        else:
            target_data = {
                "pack_name": "나무의사 기출문제 팩",
                "questions": []
            }
            
        # 기존 질문 목록 가져오기
        existing_qs = target_data.get("questions", [])
        
        # 중복 방지를 위한 검사 (질문 텍스트가 완전히 겹치는 항목 필터링)
        existing_texts = {q["question_text"] for q in existing_qs}
        unique_new_qs = []
        for q in generated_questions:
            if q["question_text"] not in existing_texts:
                unique_new_qs.append(q)
                
        existing_qs.extend(unique_new_qs)
        target_data["questions"] = existing_qs
        
        # 파일 저장
        with open(TARGET_JSON_FILE, "w", encoding="utf-8") as f:
            json.dump(target_data, f, ensure_ascii=False, indent=4)
            
        print(f"💾 병합 완료! 총 {len(existing_qs)}개 문항이 저장되었습니다. (새로 추가된 유니크 문항: {len(unique_new_qs)}개)")
    except Exception as e:
        print(f"❌ 결과 파일 병합 실패: {e}")
        return

    # 4. 임시 이미지 파일 정리 (사용자 확인 메시지 출력 후 안전하게 삭제)
    delete_choice = input("\n🧹 스캔에 사용된 임시 이미지 파일들을 삭제하시겠습니까? (y/n): ").strip().lower()
    if delete_choice == 'y':
        try:
            for f in png_files:
                os.remove(f)
            os.rmdir(SCAN_TEMP_DIR)
            print("🗑️ 임시 이미지 폴더가 깨끗이 삭제되었습니다.")
        except Exception as e:
            print(f"⚠️ 폴더 정리 실패: {e}")
            
    print("\n==================================================")
    print("✨ 연동 완료! 웹서버 또는 화면을 새로고침하시면")
    print(f"CBT 모의고사 선택 목록에 '{ROUND_NAME}'가 활성화됩니다.")
    print("==================================================")

if __name__ == "__main__":
    main()
