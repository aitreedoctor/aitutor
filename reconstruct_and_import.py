import os
import re
import json
import shutil
import time
import urllib.request
import urllib.error

# 1. Setup paths
src_txt = r"D:\aitreedoctor_mvp_v1.1\참고자료\cbtbank\9급_국가직_공무원_건축계획_2025-04-05.txt"
src_img_dir = r"D:\aitreedoctor_mvp_v1.1\참고자료\cbtbank\images\9급_국가직_공무원_건축계획_2025-04-05"
dest_img_dir = r"d:\AITutor\static\images\9급_국가직_공무원_건축계획_2025-04-05"
dest_json = r"d:\AITutor\datapacks\civil_architect_2025_04_05.json"

print("Copying images to static folder...")
os.makedirs(dest_img_dir, exist_ok=True)
if os.path.exists(src_img_dir):
    for f in os.listdir(src_img_dir):
        shutil.copy(os.path.join(src_img_dir, f), os.path.join(dest_img_dir, f))
    print("Images copied successfully.")
else:
    print("Warning: Source image directory not found.")

# Load API keys from .env
api_keys = []
if os.path.exists(".env"):
    with open(".env", "r", encoding="utf-8") as env_f:
        for line in env_f:
            if "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip()
                if k in ["GEMINI_API_KEY_FREE1", "GEMINI_API_KEY_FREE2", "GEMINI_API_KEY_PAID", "GEMINI_API_KEY"]:
                    api_keys.append((k, v))
# Remove duplicates while preserving order
api_keys = list(dict.fromkeys(api_keys))
if not api_keys:
    print("Error: No API keys found in .env")
    exit(1)

def query_gemini_reconstruct(q_text, explanation, has_option_images, key_name, api_key, model_name):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    
    system_instruction = (
        "You are an expert civil service exam compiler. You take raw question text and explanation text, "
        "and reconstruct the correct multiple-choice options (4 choices) and identify the correct answer."
    )
    
    if has_option_images:
        prompt = f"""
이 문제는 각 보기(1번~4번)가 그림 파일로 되어 있어, 텍스트 형태의 보기가 필요하지 않고 그림 경로를 그대로 유지해야 합니다.
대신 해설을 분석하여 몇 번 보기가 정답인지 정확히 가려내어 correct_answer 필드에 번호(1~4 중 하나)를 할당해 주십시오.

[질문]:
{q_text}

[해설]:
{explanation}

반드시 아래 JSON 형식으로만 응답해 주십시오. 추가 설명이나 마크다운 기호 없이 순수한 JSON 객체여야 합니다.
{{
  "correct_answer": "정답 번호 (1~4 중 문자열)"
}}
"""
    else:
        prompt = f"""
이 문제는 텍스트 보기가 누락되어 있습니다. 질문과 해설을 분석하여, 해설에 언급된 정답 및 오답 키워드를 바탕으로 실제 시험에 출제되었을 법한 자연스러운 4지선다형 객관식 보기들을 복원하고 정답 번호를 매겨 주십시오.

[질문]:
{q_text}

[해설]:
{explanation}

[작성 가이드라인]:
1. 보기는 총 4개(1번부터 4번까지)여야 하며, 해설의 정답 내용과 완벽히 일치하는 정답 보기 1개와 매끄러운 오답 보기 3개로 구성하십시오.
2. 각 보기는 짧고 전문적인 용어로 구성되어야 합니다.
3. correct_answer는 정답 보기의 번호 ('1' ~ '4' 중 하나)여야 합니다.

반드시 아래 JSON 형식으로만 응답해 주십시오. 추가 설명이나 마크다운 기호 없이 순수한 JSON 객체여야 합니다.
{{
  "options": [
    "1번 보기 내용",
    "2번 보기 내용",
    "3번 보기 내용",
    "4번 보기 내용"
  ],
  "correct_answer": "정답 번호 (1~4 중 문자열)"
}}
"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 2048,
            "thinkingConfig": {"thinkingBudget": 0}
        }
    }
    
    req_data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
    
    with urllib.request.urlopen(req, timeout=60) as response:
        res_data = response.read().decode('utf-8')
        res_json = json.loads(res_data)
        return res_json['candidates'][0]['content']['parts'][0]['text']

def get_reconstruction_with_fallback(q_text, explanation, has_option_images):
    max_attempts = 5
    for attempt in range(max_attempts):
        for key_name, api_key in api_keys:
            for model_name in ["gemini-flash-lite-latest", "gemini-flash-latest"]:
                try:
                    res_text = query_gemini_reconstruct(q_text, explanation, has_option_images, key_name, api_key, model_name)
                    # Clean json output
                    res_text = res_text.strip()
                    if res_text.startswith("```"):
                        res_text = re.sub(r'^```(?:json)?', '', res_text).strip()
                        res_text = re.sub(r'```$', '', res_text).strip()
                    data = json.loads(res_text)
                    time.sleep(3) # Small delay after success to prevent 429
                    return data
                except urllib.error.HTTPError as he:
                    if he.code == 429:
                        print(f"Rate limit hit on {key_name} with {model_name} (Attempt {attempt+1}/{max_attempts}). Waiting 5 seconds...")
                        time.sleep(5)
                    else:
                        print(f"HTTP error {he.code} on {key_name} with {model_name}: {he}")
                        time.sleep(2)
                except Exception as e:
                    print(f"Failed using key {key_name} with {model_name}: {e}")
                    time.sleep(2)
    raise Exception("All attempts failed.")

# Parse the file
print(f"Reading file: {src_txt}")
with open(src_txt, "r", encoding="utf-8") as f:
    content = f.read()

blocks = re.split(r'\n(?=\d+\.\s*\d+\.)', content)
metadata = blocks[0]
q_blocks = blocks[1:]

questions_list = []

for idx, block in enumerate(q_blocks):
    q_num = idx + 1
    lines = [l.strip() for l in block.strip().split('\n') if l.strip()]
    if not lines:
        continue
        
    q_header = lines[0]
    # Clean leading question number
    q_text = re.sub(r'^\d+\.\s*\d+\.\s*', '', q_header)
    
    # Rest of the lines are explanation
    explanation = "\n".join(lines[1:])
    
    print(f"\nProcessing Q{q_num}...")
    
    # Check if option images exist: wc20250405m{q_num}b1.gif to wc20250405m{q_num}b4.gif
    has_option_images = True
    for opt_idx in range(1, 5):
        opt_img_name = f"wc20250405m{q_num}b{opt_idx}.gif"
        if not os.path.exists(os.path.join(dest_img_dir, opt_img_name)):
            has_option_images = False
            break
            
    # Check if question image exists: wc20250405m{q_num}.gif
    q_img_name = f"wc20250405m{q_num}.gif"
    q_image_url = None
    if os.path.exists(os.path.join(dest_img_dir, q_img_name)):
        q_image_url = f"/static/images/9급_국가직_공무원_건축계획_2025-04-05/{q_img_name}"
        print(f"  - Found question image: {q_image_url}")

    try:
        recon = get_reconstruction_with_fallback(q_text, explanation, has_option_images)
        correct_ans = recon.get("correct_answer", "1")
        
        if has_option_images:
            options = [
                f"/static/images/9급_국가직_공무원_건축계획_2025-04-05/wc20250405m{q_num}b1.gif",
                f"/static/images/9급_국가직_공무원_건축계획_2025-04-05/wc20250405m{q_num}b2.gif",
                f"/static/images/9급_국가직_공무원_건축계획_2025-04-05/wc20250405m{q_num}b3.gif",
                f"/static/images/9급_국가직_공무원_건축계획_2025-04-05/wc20250405m{q_num}b4.gif",
                ""
            ]
            print(f"  - Option images mapped. Correct Answer: {correct_ans}")
        else:
            raw_options = recon.get("options", [])
            options = []
            for ro in raw_options:
                options.append(ro)
            # Pad options to exactly 5 elements
            if len(options) < 5:
                options.extend([""] * (5 - len(options)))
            else:
                options = options[:5]
            print(f"  - Options reconstructed: {options}. Correct Answer: {correct_ans}")
            
        question_item = {
            "id": f"civil_architect_2025_04_05_q{q_num}",
            "subject": "9급 국가직 공무원 건축계획",
            "round": "2025-04-05",
            "question_text": q_text,
            "options": options,
            "image_url": q_image_url,
            "correct_answer": correct_ans
        }
        questions_list.append(question_item)
    except Exception as e:
        print(f"Error processing Q{q_num}: {e}")
        # Add placeholder
        questions_list.append({
            "id": f"civil_architect_2025_04_05_q{q_num}",
            "subject": "9급 국가직 공무원 건축계획",
            "round": "2025-04-05",
            "question_text": q_text,
            "options": ["", "", "", "", ""],
            "image_url": q_image_url,
            "correct_answer": "1"
        })

output_data = {
    "pack_name": "9급 국가직 공무원 건축계획 (2025-04-05)",
    "questions": questions_list
}

with open(dest_json, "w", encoding="utf-8") as out_f:
    json.dump(output_data, out_f, ensure_ascii=False, indent=2)
    
print(f"\nSuccessfully compiled all {len(questions_list)} questions into {dest_json}!")
