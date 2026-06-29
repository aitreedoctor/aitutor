import json
import os
import shutil

def reconstruct():
    source_file = "d:/AITutor/datapacks/tree_doctor_past.json"
    backup_file = "d:/AITutor/datapacks/tree_doctor_past.json.bak"
    
    if not os.path.exists(source_file):
        print(f"Error: Source file {source_file} not found.")
        return
        
    # Create a backup
    shutil.copyfile(source_file, backup_file)
    print(f"Backup created at: {backup_file}")
    
    with open(source_file, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    questions = data.get("questions", [])
    print(f"Original questions count: {len(questions)}")
    
    cbt_rounds = [f"제{i}회 기출" for i in range(5, 13)]
    
    cbt_questions = []
    non_cbt_questions = []
    
    for q in questions:
        r = q.get("round", "")
        # Normalize and find CBT rounds
        is_cbt = False
        for cbt_r in cbt_rounds:
            if cbt_r in r:
                is_cbt = True
                q["round"] = cbt_r # Normalize to exact round name
                break
        if is_cbt:
            cbt_questions.append(q)
        else:
            non_cbt_questions.append(q)
            
    print(f"CBT questions (5회~12회): {len(cbt_questions)}")
    print(f"Non-CBT questions to process: {len(non_cbt_questions)}")
    
    # Normalize subjects for non-CBT
    for q in non_cbt_questions:
        s = q.get("subject", "")
        if s == "산림생태지도_학습":
            q["subject"] = "산림토양학"
            
    # Group non-CBT by subject
    by_subject = {}
    subjects = ["산림토양학", "수목관리학", "수목병리학", "수목생리학", "수목해충학"]
    for s in subjects:
        by_subject[s] = []
        
    for q in non_cbt_questions:
        s = q.get("subject")
        if s in by_subject:
            by_subject[s].append(q)
        else:
            # Skip or print if there are unexpected subjects
            print(f"Warning: question with unexpected subject '{s}' ignored: {q.get('question_text')[:30]}...")
            
    # Prioritize "비생물적 피해" (abiotic damage) in 수목관리학
    abiotic_keywords = ["비생물", "기상", "대기오염", "공해", "산불", "상해", "동해", "한해", "풍해", "수해", "설해", "우박", "벼락", "염해", "염독", "가뭄", "건조", "피해론", "피해"]
    
    def is_abiotic(q_item):
        text = q_item.get("question_text", "").lower()
        rnd = q_item.get("round", "").lower()
        return any(k in text or k in rnd for k in abiotic_keywords)
        
    # Sort 수목관리학: abiotic first (0), others second (1)
    by_subject["수목관리학"].sort(key=lambda x: 0 if is_abiotic(x) else 1)
    
    # Count matching prioritized abiotic questions
    num_prioritized = sum(1 for q in by_subject["수목관리학"] if is_abiotic(q))
    print(f"Prioritized '비생물적 피해' related questions in 수목관리학: {num_prioritized}")
    
    # Determine max complete sets we can make
    min_qs = min(len(by_subject[s]) for s in subjects)
    max_sets = min_qs // 25
    print(f"Minimum questions in a subject list: {min_qs}")
    print(f"Constructing {max_sets} complete sets of 'AI 기출문제' (125 questions each)")
    
    ai_questions = []
    for set_idx in range(1, max_sets + 1):
        round_name = f"AI 기출문제 {set_idx}회"
        print(f"  -> Building {round_name}...")
        for s in subjects:
            # Extract 25 questions
            for _ in range(25):
                q = by_subject[s].pop(0)
                q["round"] = round_name
                ai_questions.append(q)
                
    # Combine back CBT and AI questions
    new_questions = cbt_questions + ai_questions
    print(f"New dataset questions count: {len(new_questions)}")
    
    # Update data structure and save
    data["questions"] = new_questions
    
    with open(source_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        
    print(f"Successfully reconstructed and wrote data pack to {source_file}")

if __name__ == "__main__":
    reconstruct()
