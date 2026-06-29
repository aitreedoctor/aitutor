import os
import json
import logging
from typing import List, Dict, Optional
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)

class QuestionItem(BaseModel):
    """
    Standard schema for a single question item in the tutoring system.
    """
    subject: str = Field(..., description="과목명 (예: 수목병리학, 식물방제학)")
    round: str = Field(..., description="시험 회차 (예: 2025년 1회)")
    question_text: str = Field(..., description="문제 질문 내용")
    options: List[str] = Field(..., description="보기 1~5번 리스트 (반드시 5개 항목)")
    image_url: Optional[str] = Field(None, description="첨부 이미지 URL (있는 경우)")
    correct_answer: str = Field(..., description="정답 항목 (예: '1' 또는 보기 텍스트)")

    # Validate that option list contains exactly 5 elements
    def __init__(self, **data):
        super().__init__(**data)
        if len(self.options) != 5:
            # Pad or truncate options to ensure exactly 5 elements
            if len(self.options) < 5:
                self.options.extend([""] * (5 - len(self.options)))
            else:
                self.options = self.options[:5]

class DataPack(BaseModel):
    """
    Represents a pluggable Data Pack containing multiple questions.
    """
    pack_name: str = Field(..., description="데이터 팩 이름 (예: 나무의사 팩)")
    questions: List[QuestionItem] = Field(default_factory=list, description="문제 리스트")

class DataPackLoader:
    """
    Handles dynamic binding of data packs from a specified directory.
    Enables loose coupling between the tutoring logic and domain content.
    """
    def __init__(self, datapacks_dir: str = "./datapacks"):
        self.datapacks_dir = datapacks_dir
        self._loaded_packs: Dict[str, DataPack] = {}
        
    def load_all_packs(self) -> Dict[str, DataPack]:
        """Scans the datapacks directory and loads all valid JSON data packs."""
        if not os.path.exists(self.datapacks_dir):
            logger.warning(f"Datapacks directory not found: {self.datapacks_dir}. Creating empty directory.")
            os.makedirs(self.datapacks_dir, exist_ok=True)
            return {}

        self._loaded_packs.clear()
        for filename in os.listdir(self.datapacks_dir):
            if filename.endswith(".json"):
                pack_name = os.path.splitext(filename)[0]
                filepath = os.path.join(self.datapacks_dir, filename)
                try:
                    pack = self.load_pack_file(filepath)
                    self._loaded_packs[pack_name] = pack
                    logger.info(f"Successfully loaded and validated data pack: {pack_name} ({len(pack.questions)} questions)")
                except Exception as e:
                    logger.error(f"Failed to load data pack '{filename}': {e}")
                    
        return self._loaded_packs

    def load_pack_file(self, filepath: str) -> DataPack:
        """Loads and validates a single data pack file."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")
            
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # Validate using Pydantic
        try:
            return DataPack.model_validate(data)
        except ValidationError as ve:
            logger.error(f"Validation error in file {filepath}: {ve}")
            raise ve

    def get_pack(self, pack_name: str) -> Optional[DataPack]:
        """Retrieves a loaded data pack by its identifier name."""
        # If not loaded yet, try scanning the directory
        if not self._loaded_packs:
            self.load_all_packs()
        return self._loaded_packs.get(pack_name)

    def write_mock_datapack(self, pack_name: str) -> str:
        """Helper method to write a mock JSON data pack for testing and development."""
        os.makedirs(self.datapacks_dir, exist_ok=True)
        filepath = os.path.join(self.datapacks_dir, f"{pack_name}.json")
        
        mock_data = {
            "pack_name": f"{pack_name} 팩",
            "questions": [
                {
                    "subject": "수목병리학",
                    "round": "2025년 1회",
                    "question_text": "오동나무 빗자루병(Witches' broom)의 병원체로 옳은 것은?",
                    "options": [
                        "Phytoplasma",
                        "Fungi",
                        "Bacteria",
                        "Virus",
                        "Viroid"
                    ],
                    "image_url": "https://example.com/witches_broom.jpg",
                    "correct_answer": "Phytoplasma"
                },
                {
                    "subject": "수목병리학",
                    "round": "2025년 1회",
                    "question_text": "소나무 재선충(Pine wilt nematode)의 매개충으로 옳은 것은?",
                    "options": [
                        "솔수염하늘소",
                        "북방아시아하늘소",
                        "소나무좀",
                        "솔나방",
                        "광릉긴나무좀"
                    ],
                    "image_url": None,
                    "correct_answer": "솔수염하늘소"
                },
                {
                    "subject": "식물방제학",
                    "round": "2025년 1회",
                    "question_text": "다음 중 석회유황합제 제조 시 주원료가 아닌 것은?",
                    "options": [
                        "생석회(CaO)",
                        "황황가루(S)",
                        "물(H2O)",
                        "유산동(CuSO4)",
                        "설폰화유"
                    ],
                    "image_url": None,
                    "correct_answer": "유산동(CuSO4)"
                }
            ]
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(mock_data, f, ensure_ascii=False, indent=4)
        logger.info(f"Created mock data pack file at: {filepath}")
        return filepath
