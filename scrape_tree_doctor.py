import urllib.request
import urllib.parse
import html
import re
import json
import os
import time
import xml.etree.ElementTree as ET
import logging
from typing import Dict, List, Any, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Subject mapping dictionary
SUBJECT_MAP = {
    "병리학": "수목병리학",
    "수목병리학": "수목병리학",
    "해충학": "수목해충학",
    "수목해충학": "수목해충학",
    "생리학": "수목생리학",
    "수목생리학": "수목생리학",
    "토양학": "산림토양학",
    "산림토양학": "산림토양학",
    "관리학": "수목관리학",
    "수목관리학": "수목관리학"
}

def get_subject_by_question_no(no: int) -> str:
    """Helper to return the subject name based on question number (1-125)."""
    if 1 <= no <= 25:
        return "수목병리학"
    elif 26 <= no <= 50:
        return "수목해충학"
    elif 51 <= no <= 75:
        return "수목생리학"
    elif 76 <= no <= 100:
        return "산림토양학"
    elif 101 <= no <= 125:
        return "수목관리학"
    return "기타"

class TreeDoctorHybridScraper:
    """
    Hybrid crawler that combines official IBT XML exam papers 
    with corrected answer keys from student blogs.
    """
    def __init__(self, output_dir: str = "./datapacks"):
        self.output_dir = output_dir
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        self.circle_num_map = {'①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5'}
        os.makedirs(self.output_dir, exist_ok=True)

    def scan_category_links(self) -> List[str]:
        """Discovers all post links in the '나무의사 기출풀이' category across pages."""
        category_slug = urllib.parse.quote("나무의사 기출풀이")
        post_links = set()
        
        logger.info("Scanning blog category pages for article links...")
        # Tistory category pagination scan
        for page in range(1, 15):  # Scan up to 15 pages (usually covers 5회 to 12회)
            url = f"https://codekiller.tistory.com/category/{category_slug}?page={page}"
            req = urllib.request.Request(url, headers=self.headers)
            try:
                with urllib.request.urlopen(req) as response:
                    html_data = response.read().decode('utf-8')
                    links = re.findall(r'href=["\'](/[0-9]+)["\']', html_data)
                    
                    new_links = [l for l in links if l not in post_links]
                    if not new_links:
                        logger.info(f"No new links found on page {page}. Stopping category scan.")
                        break
                        
                    for l in new_links:
                        post_links.add(l)
                    logger.info(f"Page {page}: found {len(new_links)} new links. Total: {len(post_links)}")
                    time.sleep(0.3)  # Polite crawling
            except Exception as e:
                logger.error(f"Error scanning page {page}: {e}")
                break
                
        return sorted(list(post_links))

    def scrape_answer_keys(self, post_links: List[str]) -> Dict[Tuple[int, int], str]:
        """
        Crawls and parses correct answer keys from discovered articles.
        Returns:
            Dict mapping (round_num, question_num) -> correct_answer_digit
        """
        answers_db: Dict[Tuple[int, int], str] = {}
        logger.info(f"Scraping answer keys from {len(post_links)} blog posts...")
        
        for idx, link in enumerate(post_links, 1):
            url = f"https://codekiller.tistory.com{link}"
            req = urllib.request.Request(url, headers=self.headers)
            try:
                with urllib.request.urlopen(req) as response:
                    raw_html = response.read().decode('utf-8')
                    
                    # 1. Parse article title to determine Round, Subject and Question Range
                    title_match = re.search(r'<meta property="og:title" content="([^"]+)"', raw_html)
                    if not title_match:
                        continue
                        
                    title = html.unescape(title_match.group(1))
                    
                    # Regex matching: "제8회 수목병리학 문제풀이 1~5" or "제11회 산림토양학 문제풀이 76~80"
                    regex_pattern = r'제\s*(\d+)\s*회\s*([가-힣]+)\s*문제풀이.*?\s*(\d+)\s*~\s*(\d+)'
                    match = re.search(regex_pattern, title)
                    if not match:
                        logger.debug(f"Skipping unrelated post title: {title}")
                        continue
                        
                    round_num = int(match.group(1))
                    subj_raw = match.group(2)
                    start_q = int(match.group(3))
                    end_q = int(match.group(4))
                    
                    # Verify subject mapping
                    subject = SUBJECT_MAP.get(subj_raw)
                    if not subject:
                        logger.warning(f"Unknown subject '{subj_raw}' in title: {title}")
                        continue
                        
                    # 2. Slice body HTML to isolate the article content
                    start_match = re.search(r'<h3[^>]*>\s*\[해설\]', raw_html) or re.search(r'\[해설\]\s*제\d+회', raw_html)
                    if not start_match:
                        continue
                        
                    start_idx = start_match.start()
                    end_match = re.search(r'<(div|section)[^>]*(container_postbtn|wrap_btn|layer_post)', raw_html)
                    end_idx = len(raw_html)
                    if end_match:
                        for m in re.finditer(r'<(div|section)[^>]*(container_postbtn|wrap_btn|layer_post)', raw_html):
                            if m.start() > start_idx:
                                end_idx = m.start()
                                break
                                
                    body_html = raw_html[start_idx:end_idx]
                    
                    # Clean HTML tags and decode entities
                    cleaned = html.unescape(body_html).replace('\xa0', ' ').replace('&nbsp;', ' ')
                    cleaned = re.sub(r'<(p|br|div|h3|h2|li)[^>]*>', '\n', cleaned)
                    cleaned = re.sub(r'<[^>]+>', '', cleaned)
                    
                    lines = [line.strip() for line in cleaned.split('\n') if line.strip()]
                    
                    # 3. Parse lines to extract answers within the question range
                    current_q_num = None
                    for line in lines:
                        match_q = re.match(r'^(\d+)\.\s*(.*)', line)
                        if match_q:
                            num = int(match_q.group(1))
                            if start_q <= num <= end_q:
                                current_q_num = num
                                
                        if current_q_num and "정답" in line:
                            # Search for circled numbers
                            ans_found = False
                            for sym, digit in self.circle_num_map.items():
                                if sym in line:
                                    answers_db[(round_num, current_q_num)] = digit
                                    ans_found = True
                                    break
                            if not ans_found:
                                # Fallback to standard digit
                                digit_match = re.search(r'정답\s*:\s*(\d)', line)
                                if digit_match:
                                    answers_db[(round_num, current_q_num)] = digit_match.group(1)
                                    ans_found = True
                                    
                    logger.info(f"[{idx}/{len(post_links)}] Parsed answers for Round {round_num} {subject} ({start_q}~{end_q})")
                    time.sleep(0.4)  # Polite crawling
            except Exception as e:
                logger.error(f"Error scraping post {link}: {e}")
                
        return answers_db

    def fetch_official_exams_and_merge(self, answers_db: Dict[Tuple[int, int], str]) -> List[Dict[str, Any]]:
        """
        Retrieves official XML questions from IBT portal and merges them 
        with the correct answer keys database.
        """
        logger.info("Fetching official exam list from IBT portal...")
        intro_url = "https://namudr.kifds.or.kr/IBT/container/intro.do"
        pkg_url = "https://namudr.kifds.or.kr/IBT/container/introPkg.do"
        
        post_headers = {
            'User-Agent': self.headers['User-Agent'],
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
        }
        
        # 1. Fetch exam list
        req = urllib.request.Request(intro_url, data=urllib.parse.urlencode({}).encode('utf-8'), headers=post_headers)
        try:
            with urllib.request.urlopen(req) as response:
                res_json = json.loads(response.read().decode('utf-8'))
                exams = res_json.get("resultList", [])
        except Exception as e:
            logger.error(f"Failed to fetch exam list from intro.do: {e}")
            return []

        merged_questions: List[Dict[str, Any]] = []
        
        # 2. Iterate through exams (Rounds 5 to 11)
        for exam in exams:
            exam_name = exam.get("EXAM_TEST_NM", "")
            exam_id = exam.get("EXAM_ID", "")
            
            # Extract round number from name (e.g. "제10회 나무의사" -> 10)
            round_match = re.search(r'제\s*(\d+)\s*회', exam_name)
            if not round_match:
                continue
                
            round_num = int(round_match.group(1))
            
            # Filter rounds 5 to 11
            if not (5 <= round_num <= 11):
                logger.info(f"Skipping exam: {exam_name} (Round {round_num} is outside 5~11)")
                continue

            logger.info(f"Processing Exam: {exam_name} (ID: {exam_id}, Round: {round_num})")
            
            # Fetch PKG_PATH for exam
            pkg_data = urllib.parse.urlencode({"sExamId": exam_id}).encode('utf-8')
            pkg_req = urllib.request.Request(pkg_url, data=pkg_data, headers=post_headers)
            try:
                with urllib.request.urlopen(pkg_req) as response:
                    pkg_res = json.loads(response.read().decode('utf-8'))
                    pkg_list = pkg_res.get("resultList", [])
                    if not pkg_list:
                        continue
                    pkg_path = pkg_list[0].get("PKG_PATH", "")
            except Exception as e:
                logger.error(f"Failed to fetch PKG_PATH for exam ID {exam_id}: {e}")
                continue

            if not pkg_path:
                continue

            # 3. Download and parse XML question paper
            xml_url = f"https://namudr.kifds.or.kr/cmmn/base/loadXml.do?fileNamePhy={pkg_path}"
            logger.info(f"Downloading XML for Round {round_num} from: {xml_url}")
            
            xml_req = urllib.request.Request(xml_url, headers=self.headers)
            try:
                with urllib.request.urlopen(xml_req) as response:
                    xml_data = response.read().decode('utf-8')
                    root = ET.fromstring(xml_data)
                    
                    round_questions_count = 0
                    round_merged_count = 0
                    
                    # Parse all questions
                    for q_elem in root.findall('.//Queston'):
                        q_no = int(q_elem.attrib.get('No', 0))
                        round_questions_count += 1
                        
                        # Get answer key digit
                        correct_ans_digit = answers_db.get((round_num, q_no))
                        if not correct_ans_digit:
                            # Skip if we don't have the answer key for this question
                            continue
                            
                        # Clean question text
                        q_html = q_elem.text or ""
                        q_text = html.unescape(q_html)
                        q_text = re.sub(r'<[^>]+>', '', q_text).strip()
                        
                        # Remove subject labels prefix like "수목병리학"
                        q_text = re.sub(r'^(수목병리학|수목해충학|수목생리학|산림토양학|수목관리학|토양학|생리학|관리학|해충학|병리학)\s*', '', q_text).strip()
                        
                        # Extract choices
                        options = []
                        for ans_elem in q_elem.findall('Answer'):
                            ans_text = html.unescape(ans_elem.text or "").strip()
                            options.append(ans_text)
                            
                        options = (options + [""] * 5)[:5]
                        subject_name = get_subject_by_question_no(q_no)
                        
                        q_item = {
                            "subject": subject_name,
                            "round": f"제{round_num}회 기출",
                            "question_text": q_text,
                            "options": options,
                            "image_url": None,
                            "correct_answer": correct_ans_digit
                        }
                        
                        merged_questions.append(q_item)
                        round_merged_count += 1
                        
                    logger.info(f"Round {round_num}: parsed {round_questions_count} questions, successfully merged {round_merged_count} with answer keys.")
                    
            except Exception as e:
                logger.error(f"Error parsing XML for exam {exam_name}: {e}")
                
        return merged_questions

    def build_datapack(self):
        """Orchestrates the entire crawling, merging, and JSON-writing pipeline."""
        # 1. Discover all blog posts
        post_links = self.scan_category_links()
        if not post_links:
            logger.error("No blog post links discovered. Aborting.")
            return

        # 2. Extract answer keys
        answers_db = self.scrape_answer_keys(post_links)
        logger.info(f"Total answer keys extracted: {len(answers_db)} (round, q_no) entries.")

        # 3. Load official XMLs and merge
        merged_questions = self.fetch_official_exams_and_merge(answers_db)
        
        # 4. Save into standard data pack JSON format
        output_filepath = os.path.join(self.output_dir, "tree_doctor_past.json")
        datapack_data = {
            "pack_name": "나무의사 기출문제 팩",
            "questions": merged_questions
        }
        
        try:
            with open(output_filepath, 'w', encoding='utf-8') as f:
                json.dump(datapack_data, f, ensure_ascii=False, indent=4)
            logger.info(f"Data pack successfully compiled! Saved to: {output_filepath}")
            logger.info(f"Total questions compiled: {len(merged_questions)}")
        except Exception as e:
            logger.error(f"Failed to write data pack JSON: {e}")

if __name__ == "__main__":
    scraper = TreeDoctorHybridScraper()
    scraper.build_datapack()
