import json
import os
import time
from typing import List, Dict, Any, Tuple
from data_pack import QuestionItem, DataPack

class StudentModel:
    """
    Tracks and analyzes the learner's historical data, computes subject-wise accuracies,
    monitors warning levels, and triggers personalized remedial actions.
    """
    def __init__(self, student_id: str, student_title: str = "대표님"):
        self.student_id = student_id
        self.student_title = student_title
        # solving_history format: list of dicts with keys: 
        # [subject, question_text, selected_answer, correct_answer, is_correct, timestamp, round]
        self.solving_history: List[Dict[str, Any]] = []

    def record_answer(self, subject: str, question_text: str, selected_answer: str, 
                      correct_answer: str, round_name: str = "N/A") -> Dict[str, Any]:
        """
        Records a single problem-solving event, computes correctness, and returns the result.
        """
        sel = str(selected_answer).strip().lower()
        corr = str(correct_answer).strip().lower()
        
        if "모두" in corr or corr == "모두정답" or corr == "모두 정답":
            is_correct = True
        elif "," in corr:
            corr_list = [c.strip() for c in corr.split(",")]
            is_correct = (sel in corr_list)
        else:
            is_correct = (sel == corr)
        
        entry = {
            "subject": subject,
            "question_text": question_text,
            "selected_answer": selected_answer,
            "correct_answer": correct_answer,
            "is_correct": is_correct,
            "timestamp": time.time(),
            "round": round_name
        }
        self.solving_history.append(entry)
        return entry

    def get_subject_accuracies(self) -> Dict[str, Dict[str, Any]]:
        """
        Calculates accuracy statistics grouped by subject.
        Returns:
            Dict where keys are subjects and values are Dict with 'correct', 'total', and 'accuracy' (0.0 to 1.0).
        """
        stats: Dict[str, Dict[str, Any]] = {}
        for entry in self.solving_history:
            sub = entry["subject"]
            if sub not in stats:
                stats[sub] = {"correct": 0, "total": 0}
            
            stats[sub]["total"] += 1
            if entry["is_correct"]:
                stats[sub]["correct"] += 1

        # Calculate percentages
        for sub in stats:
            total = stats[sub]["total"]
            correct = stats[sub]["correct"]
            stats[sub]["accuracy"] = correct / total if total > 0 else 0.0

        return stats

    def evaluate_remedial_status(self, min_questions_threshold: int = 2) -> Dict[str, Any]:
        """
        Triggers REQ-302 Remedial Logic. If accuracy in any subject with 
        sufficient attempts falls below 60%, is_remedial_required becomes True.
        """
        accuracies = self.get_subject_accuracies()
        remedial_subjects = []
        is_remedial_required = False
        
        for sub, stat in accuracies.items():
            # Trigger warning only if the learner has attempted a minimum number of questions
            if stat["total"] >= min_questions_threshold:
                accuracy_pct = stat["accuracy"] * 100
                if accuracy_pct < 60.0:
                    is_remedial_required = True
                    remedial_subjects.append(sub)
                    
        message = ""
        if is_remedial_required:
            message = f"위기 감지: {self.student_title}, {', '.join(remedial_subjects)} 과목의 정답률이 60% 미만입니다. 과락 위험이 있습니다!"
        else:
            message = f"상태 양호: {self.student_title}의 모든 과목 정답률이 60% 이상으로 유지되고 있습니다."

        return {
            "is_remedial_required": is_remedial_required,
            "remedial_subjects": remedial_subjects,
            "message": message,
            "details": {sub: f"{stat['accuracy']*100:.1f}%" for sub, stat in accuracies.items()}
        }

    def get_dashboard_api_data(self) -> Dict[str, Any]:
        """
        Formats performance history into standardized JSON for Radar Chart and Bar Chart APIs.
        """
        accuracies = self.get_subject_accuracies()
        
        if not accuracies:
            # Baseline subjects for 0 solved questions
            subjects = ["수목병리학", "수목해충학", "수목생리학", "산림토양학", "수목관리학"]
            accuracy_scores = [0.0] * 5
            total_attempts = [0] * 5
            correct_counts = [0] * 5
            incorrect_counts = [0] * 5
        else:
            subjects = list(accuracies.keys())
            accuracy_scores = [round(accuracies[sub]["accuracy"] * 100, 1) for sub in subjects]
            total_attempts = [accuracies[sub]["total"] for sub in subjects]
            correct_counts = [accuracies[sub]["correct"] for sub in subjects]
            incorrect_counts = [total_attempts[i] - correct_counts[i] for i in range(len(subjects))]
            
        remedial_info = self.evaluate_remedial_status()
        
        return {
            "student_id": self.student_id,
            "student_title": self.student_title,
            "total_solved_overall": len(self.solving_history),
            "remedial_status": {
                "is_remedial_required": remedial_info["is_remedial_required"],
                "remedial_subjects": remedial_info["remedial_subjects"],
                "coaching_message": remedial_info["message"]
            },
            "visualization": {
                "radar_chart_data": {
                    "labels": subjects,
                    "datasets": [
                        {
                            "label": "과목별 성취도 (%)",
                            "data": accuracy_scores
                        }
                    ]
                },
                "bar_chart_data": {
                    "labels": subjects,
                    "attempts": total_attempts,
                    "correct": correct_counts,
                    "incorrect": incorrect_counts
                }
            }
        }

    def generate_remedial_package(self, datapack: DataPack, max_questions: int = 5) -> Dict[str, Any]:
        """
        Creates a 'Special Remedial Package' [REQ-302] by filtering questions of weak subjects 
        from the active Data Pack, prioritizing questions the student got wrong or hasn't solved.
        """
        remedial_info = self.evaluate_remedial_status()
        if not remedial_info["is_remedial_required"]:
            return {
                "triggered": False,
                "remedial_questions": [],
                "message": "보충 처방이 필요하지 않은 우수한 성적입니다."
            }

        weak_subjects = set(remedial_info["remedial_subjects"])
        remedial_pool: List[QuestionItem] = []
        
        # 1. Gather all questions belonging to weak subjects from the data pack
        for q in datapack.questions:
            if q.subject in weak_subjects:
                remedial_pool.append(q)

        # 2. Sort by student's performance: prioritize questions they previously failed
        # Get set of wrong questions text
        wrong_questions = {
            entry["question_text"] for entry in self.solving_history 
            if entry["subject"] in weak_subjects and not entry["is_correct"]
        }
        solved_questions = {
            entry["question_text"] for entry in self.solving_history
        }

        # Priority: 1. Previously got wrong -> 2. Unsolved -> 3. Got right (for review)
        def sort_priority(q_item: QuestionItem) -> int:
            if q_item.question_text in wrong_questions:
                return 0
            elif q_item.question_text not in solved_questions:
                return 1
            return 2

        sorted_remedial_pool = sorted(remedial_pool, key=sort_priority)
        curated_questions = sorted_remedial_pool[:max_questions]
        
        return {
            "triggered": True,
            "remedial_subjects": list(weak_subjects),
            "remedial_questions": [q.model_dump() for q in curated_questions],
            "message": f"오답 노트를 기반으로 과락 방지 맞춤형 [스페셜 보충 처방 패키지] ({len(curated_questions)}문항)가 구성되었습니다."
        }

    def save_profile(self, directory: str = "./profiles") -> str:
        """Saves student profile history to json file."""
        os.makedirs(directory, exist_ok=True)
        filepath = os.path.join(directory, f"{self.student_id}_profile.json")
        data = {
            "student_id": self.student_id,
            "student_title": self.student_title,
            "solving_history": self.solving_history
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return filepath

    def load_profile(self, filepath: str):
        """Loads student profile history from json file."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Profile file not found: {filepath}")
            
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        self.student_id = data.get("student_id", self.student_id)
        self.student_title = data.get("student_title", self.student_title)
        self.solving_history = data.get("solving_history", [])
