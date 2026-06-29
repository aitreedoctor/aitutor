import os
import json
import time
import urllib.request
import urllib.error
from pypdf import PdfReader

# 설정 정보
PDF_DIR = "./pdf"
TARGET_JSON_FILE = "./datapacks/tree_doctor_past.json"
ENV_FILE = "./.env"
SUBJECTS = ["수목병리학", "수목해충학", "수목생리학", "산림토양학", "수목관리학"]

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

def classify_subject_via_ai(filename, first_page_text, api_key):
    """파일명과 첫 페이지 텍스트를 기반으로 Gemini API를 사용해 과목을 자동 분류합니다."""
    print("🤖 AI가 교재의 파일명과 내용을 분석하여 과목을 자동 판별하고 있습니다...")
    
    prompt = f"""
다음 PDF 파일명과 첫 페이지의 본문 일부를 분석하여, 이 도서/자료가 아래 5가지 '나무의사' 자격시험 과목 중 어느 과목에 해당하는지 분류해 주세요.
답변은 다른 설명이나 마크다운 기호 없이, 제공된 5개 과목명 중 정확히 하나만 텍스트로 대답하세요 (예: 산림토양학).

[분류 대상 과목]:
- 수목병리학
- 수목해충학
- 수목생리학
- 산림토양학
- 수목관리학 (농약학, 생물적/비생물적 피해론, 나무외과수술, 일반관리학 등 포함)

[PDF 파일명]: {filename}
[첫 페이지 본문]:
{first_page_text[:1500]}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1
        }
    }
    
    req_data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_data = response.read().decode('utf-8')
            res_json = json.loads(res_data)
            classified = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
            # 정확한 매칭 유효성 검사
            for sub in SUBJECTS:
                if sub in classified:
                    return sub
    except Exception as e:
        print(f"⚠️ AI 과목 판별 오류: {e}")
    
    # 예외 상황 처리 (파일명 텍스트 키워드 기반 수동 대체 판별)
    lower_fn = filename.lower()
    if "토양" in lower_fn:
        return "산림토양학"
    elif "해충" in lower_fn or "벌레" in lower_fn:
        return "수목해충학"
    elif "생리" in lower_fn:
        return "수목생리학"
    elif "병리" in lower_fn or "병해" in lower_fn:
        return "수목병리학"
    elif "관리" in lower_fn or "농약" in lower_fn or "피해론" in lower_fn:
        return "수목관리학"
        
    return "수목생리학"  # 기본값

def generate_questions_from_text(text_chunk, subject, round_name, api_key):
    """추출한 텍스트 본문을 바탕으로 Gemini API를 호출해 문제를 출제합니다."""
    prompt = f"""
당신은 대한민국 '나무의사' 자격시험 전문 출제위원입니다.
아래 제공된 [교재 본문 텍스트]를 꼼꼼히 읽고 분석하여, 이 내용을 학습하고 평가하기 위한 실제 시험 수준의 5지선다형 객관식 문제를 2~4개 새로 출제해 주세요.

[과목 분류]: {subject}
[출제 요구사항]:
1. 제공된 본문 텍스트 내에 있는 핵심 이론 지식, 생리 작용 기작, 학명, 해충 특성, 토양 성분, 주요 수치 등을 바탕으로 변별력 있는 문제를 출제하세요.
2. 보기 1번부터 5번까지 구성하고 정답을 정확히 기입하세요.
3. 반드시 다음 JSON 리스트 형식으로만 답변하세요. 다른 부가 설명이나 ```json 마크다운 기호 없이 순수한 JSON 텍스트만 출력하세요:
[
  {{
    "subject": "{subject}",
    "round": "{round_name}",
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
        "contents": [{"parts": [{"text": prompt + "\n\n[교재 본문 텍스트]:\n" + text_chunk}]}],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json"
        }
    }
    
    req_data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            res_data = response.read().decode('utf-8')
            res_json = json.loads(res_data)
            text_response = res_json["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text_response)
    except Exception as e:
        print(f"❌ Gemini API 문제 생성 실패: {e}")
        return []

def main():
    print("==================================================")
    print("      PDF 교재 본문 기반 AI 문제 자동 출제기 (Auto-Classification)")
    print("==================================================")
    
    api_key = load_api_key()
    if not api_key:
        print("❌ 실행 실패: GEMINI_API_KEY 환경변수가 설정되어 있어야 합니다.")
        return

    # 1. PDF 파일 목록 확인
    if not os.path.exists(PDF_DIR):
        print(f"❌ PDF 폴더가 없습니다: {PDF_DIR}")
        return
        
    pdf_files = [f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")]
    if not pdf_files:
        print("❌ PDF 폴더 내에 PDF 파일이 없습니다.")
        return
        
    print("📚 처리할 PDF 파일들을 선택해 주세요:")
    print("💡 여러 개를 선택할 수 있습니다 (예: '1,3,5' 또는 '1-4' 또는 'all' 입력)")
    for idx, f in enumerate(pdf_files, 1):
        print(f"  {idx}) {f}")
        
    user_input = input("\n👉 선택: ").strip().lower()
    selected_indices = []
    
    if user_input == "all":
        selected_indices = list(range(len(pdf_files)))
    else:
        parts = user_input.split(",")
        for part in parts:
            part = part.strip()
            if "-" in part:
                try:
                    start, end = map(int, part.split("-"))
                    selected_indices.extend(range(start - 1, end))
                except ValueError:
                    pass
            else:
                try:
                    idx = int(part) - 1
                    if 0 <= idx < len(pdf_files):
                        selected_indices.append(idx)
                except ValueError:
                    pass
                    
    # 중복 제거 및 정렬
    selected_indices = sorted(list(set(selected_indices)))
    
    if not selected_indices:
        print("❌ 선택된 파일이 없습니다. 종료합니다.")
        return
        
    selected_pdfs = [pdf_files[i] for i in selected_indices]
    print(f"\n📂 총 {len(selected_pdfs)}개의 파일이 선택되었습니다:")
    for f in selected_pdfs:
        print(f"  - {f}")

    # 2. 과목 지정 방법 선택 (개별 지정, 일괄 지정, AI 자동 분류)
    common_subject = None
    auto_classify = False
    
    print("\n과목을 어떻게 지정하시겠습니까?")
    print("  0) AI 자동 분류 (파일명 및 첫 페이지 내용을 분석하여 AI가 자동 지정)")
    print("  1) 개별 수동 지정 (파일별로 직접 선택)")
    print("  2) 일괄 수동 지정 (선택한 모든 파일에 동일한 한 가지 과목 적용)")
    
    try:
        subj_mode = int(input("선택 (0~2): "))
    except Exception:
        subj_mode = 0

    if subj_mode == 2:
        print("\n일괄 적용할 과목을 선택하세요:")
        for idx, sub in enumerate(SUBJECTS, 1):
            print(f"  {idx}) {sub}")
        try:
            sub_choice = int(input("선택 (1~5): "))
            common_subject = SUBJECTS[sub_choice - 1]
        except Exception:
            common_subject = "수목생리학"
    elif subj_mode == 0:
        auto_classify = True

    # 3. 회차 이름 자동 입력 여부 확인
    auto_round_names = input("\n❓ 모든 파일의 시험지(회차) 이름을 기본 추천 이름으로 자동 지정하시겠습니까? (y/n): ").strip().lower()

    # 4. 공통 전체 페이지 처리 여부 확인
    common_all_pages = input("❓ 모든 파일의 '전체 페이지'를 출제 대상으로 사용하시겠습니까? (y/n): ").strip().lower()

    # 5. 파일 순차 처리 루프
    total_added_questions = 0
    
    for pdf_idx, selected_pdf in enumerate(selected_pdfs, 1):
        print(f"\n==================================================")
        print(f"📂 [{pdf_idx}/{len(selected_pdfs)}] 파일 처리 시작: {selected_pdf}")
        print(f"==================================================")
        pdf_path = os.path.join(PDF_DIR, selected_pdf)
        
        # PDF 로드 및 첫 페이지 텍스트 추출 (과목 판별용)
        try:
            reader = PdfReader(pdf_path)
            total_pages = len(reader.pages)
            print(f"📄 총 페이지 수: {total_pages}장")
            
            # 첫 페이지 본문 추출
            first_page_text = ""
            for i in range(min(2, total_pages)):  # 최대 2페이지까지 추출하여 판단력 극대화
                try:
                    text_p = reader.pages[i].extract_text()
                    if text_p:
                        first_page_text += text_p
                except Exception:
                    pass
        except Exception as e:
            print(f"❌ PDF 로딩 실패 ({selected_pdf}): {e}")
            continue

        # 과목 결정
        if auto_classify:
            subject = classify_subject_via_ai(selected_pdf, first_page_text, api_key)
            print(f"🎯 [AI 과목 분류 결과]: 이 파일은 '{subject}'로 분류되었습니다.")
        elif common_subject:
            subject = common_subject
        else:
            print(f"\n[{selected_pdf}] 과목을 선택하세요:")
            for idx, sub in enumerate(SUBJECTS, 1):
                print(f"  {idx}) {sub}")
            try:
                sub_choice = int(input("선택 (1~5): "))
                subject = SUBJECTS[sub_choice - 1]
            except Exception:
                subject = "수목생리학"
                print("'수목생리학'으로 지정되었습니다.")

        # 회차명 자동 추천 및 입력
        pdf_title = os.path.splitext(selected_pdf)[0]
        recommended_round = f"{pdf_title[:15]}_학습"
        
        if auto_round_names == 'y':
            round_name = recommended_round
            print(f"🏷️ 시험지 이름 자동 지정: {round_name}")
        else:
            round_name = input(f"🏷️ CBT에 표시할 회차 이름 (기본값: {recommended_round}): ").strip()
            if not round_name:
                round_name = recommended_round

        # 파일별 페이지 범위 결정
        if common_all_pages == 'y':
            start_page = 1
            end_page = total_pages
        else:
            print(f"출제할 페이지 범위를 입력하세요 (1 ~ {total_pages}):")
            try:
                start_page = int(input(f"  시작 페이지: "))
                end_page = int(input(f"  종료 페이지: "))
                if not (1 <= start_page <= end_page <= total_pages):
                    print("❌ 잘못된 범위 지정입니다. 이 파일은 건너뜁니다.")
                    continue
            except Exception:
                print("❌ 입력 오류로 인해 이 파일은 건너뜁니다.")
                continue

        # 텍스트 추출
        print(f"📝 {start_page}p ~ {end_page}p 텍스트 추출 중...")
        extracted_text = ""
        for page_num in range(start_page - 1, end_page):
            try:
                page_text = reader.pages[page_num].extract_text()
                if page_text:
                    extracted_text += f"\n--- [Page {page_num + 1}] ---\n" + page_text
            except Exception as e:
                pass

        if len(extracted_text.strip()) < 100:
            print("⚠️ 추출된 글자가 너무 적습니다. 스캔 이미지 PDF일 수 있습니다. 이 파일은 건너뜁니다.")
            continue

        # 4000자 단위 청크 분할
        chunk_size = 4000
        text_chunks = [extracted_text[i:i+chunk_size] for i in range(0, len(extracted_text), chunk_size)]
        print(f"   -> 본문을 {len(text_chunks)}개의 문단으로 나누어 출제를 시작합니다.")

        # Gemini API 호출 및 출제
        generated_questions = []
        for c_idx, chunk in enumerate(text_chunks, 1):
            print(f"   🤖 [{c_idx}/{len(text_chunks)}] 문단 분석 및 출제 중...")
            questions = generate_questions_from_text(chunk, subject, round_name, api_key)
            
            if questions:
                for q in questions:
                    print(f"      ✅ 출제 완료: {q['question_text'][:20]}...")
                generated_questions.extend(questions)
            else:
                print("      ❌ 출제 실패")
                
            if c_idx < len(text_chunks):
                time.sleep(5)  # 레이트 리밋 방지 대기

        if not generated_questions:
            print("⚠️ 이 파일에서는 출제된 문제가 없습니다.")
            continue

        # 데이터베이스 병합
        print(f"💾 {TARGET_JSON_FILE} 파일에 병합 중...")
        try:
            if os.path.exists(TARGET_JSON_FILE):
                with open(TARGET_JSON_FILE, "r", encoding="utf-8") as f:
                    target_data = json.load(f)
            else:
                target_data = {"pack_name": "나무의사 기출문제 팩", "questions": []}
                
            existing_qs = target_data.get("questions", [])
            existing_texts = {q["question_text"] for q in existing_qs}
            
            unique_new_qs = []
            for q in generated_questions:
                if q["question_text"] not in existing_texts:
                    unique_new_qs.append(q)
                    
            existing_qs.extend(unique_new_qs)
            target_data["questions"] = existing_qs
            
            with open(TARGET_JSON_FILE, "w", encoding="utf-8") as f:
                json.dump(target_data, f, ensure_ascii=False, indent=4)
                
            total_added_questions += len(unique_new_qs)
            print(f"💾 병합 완료! (이번 파일에서 {len(unique_new_qs)}개 문항 신규 추가됨)")
        except Exception as e:
            print(f"❌ 데이터베이스 병합 에러: {e}")

    print("\n==================================================")
    print("✨ 모든 파일의 연동 작업이 끝났습니다!")
    print(f"🎁 이번 작업으로 총 {total_added_questions}개의 문제가 추가되었습니다.")
    print("웹서버나 브라우저를 새로고침하시면 새로 추가된 회차들이 활성화됩니다.")
    print("==================================================")

if __name__ == "__main__":
    main()
