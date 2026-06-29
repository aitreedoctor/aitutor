import os
import sys
import json
from data_pack import DataPackLoader
from student_model import StudentModel
from prompt_orchestrator import GeminiOrchestrator

def run_student_simulation():
    print("=" * 60)
    print("   AI Tutor - Student Model Learning Simulation")
    print("=" * 60)
    
    # 1. Load the compiled actual data pack (890 questions)
    loader = DataPackLoader(datapacks_dir="./datapacks")
    loader.load_all_packs()
    pack = loader.get_pack("tree_doctor_past")
    
    if not pack:
        print("Error: Could not find tree_doctor_past data pack. Run scraper first.")
        return
        
    print(f"Loaded {len(pack.questions)} actual exam questions from tree_doctor_past pack.")
    
    # 2. Setup Student Model
    student = StudentModel(student_id="student_lead_2026", student_title="김대표님")
    
    # Group questions by subject to select for simulation
    questions_by_subject = {}
    for q in pack.questions:
        if q.subject not in questions_by_subject:
            questions_by_subject[q.subject] = []
        questions_by_subject[q.subject].append(q)
        
    # We will simulate attempts on 3 subjects: 수목병리학, 수목해충학, 산림토양학
    sim_subjects = ["수목병리학", "수목해충학", "산림토양학"]
    for sub in sim_subjects:
        if sub not in questions_by_subject:
            print(f"Error: No questions found for subject {sub}")
            return
            
    print("\n--- [Simulation Start] Student solves 15 questions ---")
    
    # 3. Simulate solving history:
    # A. 수목병리학 (5 attempts: 2 correct, 3 incorrect -> 40% accuracy)
    pathology_qs = questions_by_subject["수목병리학"][:5]
    pathology_answers = [
        ("Phytoplasma", True), # Correct (we mock matching answer)
        ("오답1", False),
        ("오답2", False),
        ("오답3", False),
        ("정답", True) # Correct
    ]
    
    for idx, q in enumerate(pathology_qs):
        ans_val, make_correct = pathology_answers[idx]
        selected = q.correct_answer if make_correct else "1" if q.correct_answer != "1" else "2"
        res = student.record_answer(
            subject=q.subject,
            question_text=q.question_text,
            selected_answer=selected,
            correct_answer=q.correct_answer,
            round_name=q.round
        )
        print(f"[{q.subject}] Q: {q.question_text[:35]}... -> Selected: {selected}, Correct: {q.correct_answer} ({'O' if res['is_correct'] else 'X'})")
        
    # B. 수목해충학 (5 attempts: 4 correct, 1 incorrect -> 80% accuracy)
    entomology_qs = questions_by_subject["수목해충학"][:5]
    entomology_answers = [True, True, True, False, True]
    for idx, q in enumerate(entomology_qs):
        make_correct = entomology_answers[idx]
        selected = q.correct_answer if make_correct else "1" if q.correct_answer != "1" else "2"
        res = student.record_answer(
            subject=q.subject,
            question_text=q.question_text,
            selected_answer=selected,
            correct_answer=q.correct_answer,
            round_name=q.round
        )
        print(f"[{q.subject}] Q: {q.question_text[:35]}... -> Selected: {selected}, Correct: {q.correct_answer} ({'O' if res['is_correct'] else 'X'})")

    # C. 산림토양학 (5 attempts: 1 correct, 4 incorrect -> 20% accuracy)
    soil_qs = questions_by_subject["산림토양학"][:5]
    soil_answers = [False, False, True, False, False]
    for idx, q in enumerate(soil_qs):
        make_correct = soil_answers[idx]
        selected = q.correct_answer if make_correct else "1" if q.correct_answer != "1" else "2"
        res = student.record_answer(
            subject=q.subject,
            question_text=q.question_text,
            selected_answer=selected,
            correct_answer=q.correct_answer,
            round_name=q.round
        )
        print(f"[{q.subject}] Q: {q.question_text[:35]}... -> Selected: {selected}, Correct: {q.correct_answer} ({'O' if res['is_correct'] else 'X'})")

    # 4. Check Remedial warnings and Dashboard statistics
    print("\n--- [Diagnosis] Calculating student stats and warning flags ---")
    remedial_status = student.evaluate_remedial_status(min_questions_threshold=3)
    print(f"-> Remedial Action Required: {remedial_status['is_remedial_required']}")
    print(f"-> Alert Message: {remedial_status['message']}")
    print(f"-> Performance Details: {remedial_status['details']}")
    
    # 5. Dashboard visualization data
    dashboard_data = student.get_dashboard_api_data()
    print("\n--- [Dashboard API] Exporting data for Radar & Bar Charts ---")
    print(json.dumps(dashboard_data["visualization"], indent=4, ensure_ascii=False))

    # 6. Generate Special Remedial Package (REQ-302)
    print("\n--- [Remedial Package] Building custom questions for weak subjects ---")
    remedial_pkg = student.generate_remedial_package(pack, max_questions=4)
    print(f"-> Trigger Status: {remedial_pkg['triggered']}")
    print(f"-> Message: {remedial_pkg['message']}")
    if remedial_pkg['triggered']:
        print("-> Selected Remedial Questions:")
        for idx, rq in enumerate(remedial_pkg['remedial_questions'], 1):
            print(f"   {idx}. [{rq['subject']}] {rq['question_text'][:50]}...")
            print(f"      Choices: {rq['options']}")

    # 7. Generate Gemini Prompt Payloads
    print("\n--- [Gemini Orchestrator] Generating final prompt payloads ---")
    # Retrieve system instruction with custom title '김대표님'
    system_instruction = GeminiOrchestrator.get_system_instruction(student_title=student.student_title)
    
    # Select a failed question to compile user prompt (e.g. 수목병리학 wrong attempt)
    failed_pathology_attempt = next(entry for entry in student.solving_history if entry["subject"] == "수목병리학" and not entry["is_correct"])
    
    # Look up the actual question item to get options
    failed_q_item = next(q for q in pack.questions if q.question_text == failed_pathology_attempt["question_text"])
    
    user_prompt = GeminiOrchestrator.get_user_prompt(
        question_item=failed_q_item.model_dump(),
        student_answer=failed_pathology_attempt["selected_answer"],
        is_correct=False,
        remedial_trigger=remedial_status["is_remedial_required"],
        subject_accuracy=student.get_subject_accuracies()["수목병리학"]["accuracy"]
    )
    
    print("-> System Instruction formatted successfully (Title: 김대표님).")
    print("-> Generated User Prompt payload for failed question:")
    print("=" * 60)
    print(user_prompt.strip())
    print("=" * 60)
    
    # Write to simulation output file
    os.makedirs("./simulation", exist_ok=True)
    with open("./simulation/student_session.json", "w", encoding="utf-8") as f:
        json.dump(dashboard_data, f, ensure_ascii=False, indent=4)
    print("Saved simulation metrics to ./simulation/student_session.json")

if __name__ == "__main__":
    run_student_simulation()
