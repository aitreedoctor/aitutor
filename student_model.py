from typing import Dict, Any, List, Optional

class StudentModel:
    """
    Manages the student profile state including identity title, persona type, worry/wish,
    solving history, and reward coins for gamified learning.
    """
    def __init__(self, student_id: str, student_title: str = "대표님"):
        self.student_id = student_id
        self.student_title = student_title
        self.persona_type = "약초꾼"
        self.user_worry = "시험 합격 및 진로 고민"
        self.solving_history: List[Dict[str, Any]] = []
        self.coins: int = 100  # Default initial coin supply
        self.cbt_history: List[Dict[str, Any]] = []

    def record_answer(self, subject: str, question_text: str, selected_answer: str, 
                      correct_answer: str, round_name: str, is_cbt_mode: bool = True) -> Dict[str, Any]:
        """
        Records a single question solving attempt. Deducts 1 coin per attempt and 
        refunds 1 coin back if the answer is correct in CBT mode.
        """
        is_correct = (selected_answer == correct_answer)
        
        if is_cbt_mode:
            # Deduct 1 coin for attempt
            self.coins = max(0, self.coins - 1)
            # Refund 1 coin if correct
            if is_correct:
                self.coins += 1
                
        attempt = {
            "subject": subject,
            "question_text": question_text,
            "selected_answer": selected_answer,
            "correct_answer": correct_answer,
            "round_name": round_name,
            "is_correct": is_correct,
            "tutor_response": ""
        }
        self.solving_history.append(attempt)
        
        return {
            "is_correct": is_correct,
            "coins_balance": self.coins
        }

    def get_wrong_attempts(self) -> List[Dict[str, Any]]:
        """Returns all attempts where the student answered incorrectly."""
        return [entry for entry in self.solving_history if not entry["is_correct"]]

    def add_coins(self, amount: int) -> int:
        """Adds coins to the student's balance."""
        self.coins += amount
        return self.coins

    def use_coins(self, amount: int) -> bool:
        """Deducts coins from the student's balance if sufficient funds are available."""
        if self.coins >= amount:
            self.coins -= amount
            return True
        return False

    def get_subject_accuracies(self) -> Dict[str, Dict[str, Any]]:
        """
        Calculates solving counts and accuracies grouped by subject.
        """
        standard_subjects = ["수목병리학", "수목해충학", "수목생리학", "산림토양학", "수목관리학"]
        stats = {subj: {"correct": 0, "total": 0, "accuracy": 0.0} for subj in standard_subjects}
        
        for entry in self.solving_history:
            subj = entry["subject"]
            if subj not in stats:
                stats[subj] = {"correct": 0, "total": 0, "accuracy": 0.0}
            
            stats[subj]["total"] += 1
            if entry["is_correct"]:
                stats[subj]["correct"] += 1
                
        for subj in stats:
            total = stats[subj]["total"]
            if total > 0:
                stats[subj]["accuracy"] = stats[subj]["correct"] / total
            else:
                stats[subj]["accuracy"] = 0.0
                
        return stats

    def evaluate_remedial_status(self, min_questions_threshold: int = 3) -> Dict[str, Any]:
        """
        Checks if any subject has an accuracy below 60% after solving at least min_questions_threshold questions.
        """
        accuracies = self.get_subject_accuracies()
        is_remedial_required = False
        weak_subjects = []
        details = {}
        
        for subj, stat in accuracies.items():
            details[subj] = f"{stat['accuracy'] * 100:.1f}%"
            if stat["total"] >= min_questions_threshold and stat["accuracy"] < 0.60:
                is_remedial_required = True
                weak_subjects.append(subj)
                
        if is_remedial_required:
            message = f"경고: 특정 과목({', '.join(weak_subjects)})의 성취도가 60% 미만입니다. 과락 방지를 위해 특별 처방 문제를 해결하세요!"
        else:
            message = "모든 과목의 성취도가 양호합니다. 이 주파수를 유지하세요."
            
        return {
            "is_remedial_required": is_remedial_required,
            "message": message,
            "details": details
        }

    def generate_remedial_package(self, pack: Any, max_questions: int = 4) -> Dict[str, Any]:
        """
        Filters weak subjects and selects unsolved (or random) questions from the pack.
        """
        accuracies = self.get_subject_accuracies()
        weak_subjects = [subj for subj, stat in accuracies.items() if stat["accuracy"] < 0.60]
        
        if not weak_subjects:
            return {
                "triggered": False,
                "message": "모든 과목의 성취도가 60% 이상이므로 보충 학습이 필요하지 않습니다.",
                "remedial_questions": []
            }
            
        # Collect questions from pack matching weak subjects
        candidate_qs = []
        solved_texts = {entry["question_text"] for entry in self.solving_history}
        
        # Sort questions to prefer unsolved ones first
        for q in pack.questions:
            if q.subject in weak_subjects:
                candidate_qs.append(q)
                
        # Separate into unsolved and solved
        unsolved_qs = [q for q in candidate_qs if q.question_text not in solved_texts]
        solved_weak_qs = [q for q in candidate_qs if q.question_text in solved_texts]
        
        selected_qs = unsolved_qs[:max_questions]
        if len(selected_qs) < max_questions:
            # Pad with already solved weak questions if needed
            needed = max_questions - len(selected_qs)
            selected_qs.extend(solved_weak_qs[:needed])
            
        remedial_questions = []
        for q in selected_qs:
            remedial_questions.append({
                "subject": q.subject,
                "round": q.round,
                "question_text": q.question_text,
                "options": q.options,
                "correct_answer": q.correct_answer,
                "image_url": q.image_url
            })
            
        return {
            "triggered": True,
            "message": f"성취도 60% 미만인 과목({', '.join(weak_subjects)})에 대한 특별 처방 문제 {len(remedial_questions)}문항이 생성되었습니다.",
            "remedial_questions": remedial_questions
        }

    def get_dashboard_api_data(self) -> Dict[str, Any]:
        """
        Formats performance profile data and Chart.js visualization configs.
        """
        accuracies = self.get_subject_accuracies()
        subjects = sorted(list(accuracies.keys()))
        
        # Format Radar & Bar chart datasets
        radar_data = {
            "labels": subjects,
            "datasets": [
                {
                    "label": "학습 주파수 동조율 (%)",
                    "data": [round(accuracies[s]["accuracy"] * 100, 1) for s in subjects]
                }
            ]
        }
        
        bar_data = {
            "labels": subjects,
            "datasets": [
                {
                    "label": "정답 문항",
                    "data": [accuracies[s]["correct"] for s in subjects]
                },
                {
                    "label": "오답 문항",
                    "data": [accuracies[s]["total"] - accuracies[s]["correct"] for s in subjects]
                }
            ]
        }
        
        total_attempts = len(self.solving_history)
        total_correct = sum(1 for entry in self.solving_history if entry["is_correct"])
        overall_accuracy = (total_correct / total_attempts) if total_attempts > 0 else 0.0
        
        visualization = {
            "radar": radar_data,
            "bar": bar_data,
            "history_summary": {
                "total_solved": total_attempts,
                "total_correct": total_correct,
                "overall_accuracy": round(overall_accuracy * 100, 1)
            }
        }
        
        return {
            "student_id": self.student_id,
            "student_title": self.student_title,
            "persona_type": self.persona_type,
            "user_worry": self.user_worry,
            "coins": self.coins,
            "remedial_status": self.evaluate_remedial_status(min_questions_threshold=3),
            "visualization": visualization,
            "cbt_history": getattr(self, "cbt_history", [])
        }
