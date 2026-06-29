import os
import sys
import json
import random
from data_pack import DataPackLoader
from student_model import StudentModel

# Append current working directory to path
sys.path.append(os.getcwd())

def run_random_solving_simulation():
    print("=" * 60)
    print("   AI Tutor - Full Random Solving Simulation (890 Questions)")
    print("=" * 60)
    
    # 1. Load the actual data pack
    loader = DataPackLoader(datapacks_dir="./datapacks")
    loader.load_all_packs()
    pack = loader.get_pack("tree_doctor_past")
    
    if not pack:
        print("Error: Could not find tree_doctor_past data pack.")
        return
        
    print(f"Loaded {len(pack.questions)} questions.")
    
    # Shuffle all questions to simulate random study order
    questions = list(pack.questions)
    random.shuffle(questions)
    
    # 2. Instantiate Student Model
    student = StudentModel(student_id="random_student_999", student_title="박대표님")
    
    # Define subject accuracy probabilities to simulate user strength/weakness profile
    # 병리학: 52% (과락 위험), 해충학: 72% (합격), 생리학: 82% (우수), 토양학: 45% (과락 위험), 관리학: 63% (경계 합격)
    subject_profiles = {
        "수목병리학": 0.52,
        "수목해충학": 0.72,
        "수목생리학": 0.82,
        "산림토양학": 0.45,
        "수목관리학": 0.63,
        "기타": 0.60
    }
    
    print("\nSimulating student 박대표님 solving all 890 questions...")
    
    # 3. Solve all questions
    correct_count = 0
    incorrect_count = 0
    
    for q in questions:
        prob = subject_profiles.get(q.subject, 0.60)
        # Determine if correct based on student profile probability
        is_correct = random.random() < prob
        
        selected_answer = q.correct_answer if is_correct else "1" if q.correct_answer != "1" else "2"
        
        res = student.record_answer(
            subject=q.subject,
            question_text=q.question_text,
            selected_answer=selected_answer,
            correct_answer=q.correct_answer,
            round_name=q.round
        )
        
        if res["is_correct"]:
            correct_count += 1
        else:
            incorrect_count += 1
            
    print(f"Simulation completed: solved {len(questions)} questions.")
    print(f"Total Correct: {correct_count}, Total Incorrect: {incorrect_count} (Overall Accuracy: {correct_count/len(questions)*100:.1f}%)")
    
    # 4. Diagnostics Evaluation
    print("\n--- [Final Diagnosis Summary] ---")
    remedial_status = student.evaluate_remedial_status(min_questions_threshold=10)
    print(f"Remedial required? {remedial_status['is_remedial_required']}")
    print(f"Message: {remedial_status['message']}")
    
    print("\nSubject-wise Final Accuracies:")
    for subj, detail_pct in remedial_status["details"].items():
        # Get count stats
        stats = student.get_subject_accuracies()[subj]
        print(f"  - {subj}: {detail_pct} (Solved: {stats['total']}, Correct: {stats['correct']}, Incorrect: {stats['total'] - stats['correct']})")
        
    # 5. Generate a Special Remedial Package (REQ-302)
    print("\n--- [Remedial Package Generation for 박대표님] ---")
    remedial_pkg = student.generate_remedial_package(pack, max_questions=5)
    print(f"Remedial Package Triggered: {remedial_pkg['triggered']}")
    print(f"Message: {remedial_pkg['message']}")
    if remedial_pkg['triggered']:
        print("Curated Review Questions (First 3 in package):")
        for idx, rq in enumerate(remedial_pkg['remedial_questions'][:3], 1):
            print(f"   {idx}. [{rq['subject']} - {rq['round']}] {rq['question_text'][:60]}...")
            print(f"      Choices: {rq['options']}")
            
    # 6. Save results
    os.makedirs("./simulation", exist_ok=True)
    with open("./simulation/random_solving_session.json", "w", encoding="utf-8") as f:
        json.dump(student.get_dashboard_api_data(), f, ensure_ascii=False, indent=4)
    print("\nSaved full simulation metrics to ./simulation/random_solving_session.json")

if __name__ == "__main__":
    run_random_solving_simulation()
