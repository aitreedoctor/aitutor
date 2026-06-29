import os
import json
import logging
import time
from typing import List, Dict, Any, Optional
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

class IBTCrawler:
    """
    A robust Selenium crawler for dynamic IBT (Internet Based Testing) web scraping
    supporting login session preservation and dropdown control.
    """
    def __init__(self, headless: bool = True, session_dir: str = "./sessions"):
        self.headless = headless
        self.session_dir = session_dir
        self.driver: Optional[webdriver.Chrome] = None
        os.makedirs(self.session_dir, exist_ok=True)

    def __enter__(self):
        self.start_driver()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.quit_driver()

    def start_driver(self):
        """Initializes the Selenium Chrome WebDriver with production-ready options."""
        if self.driver:
            return

        chrome_options = Options()
        if self.headless:
            chrome_options.add_argument("--headless=new")
        
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        try:
            # Attempt to use standard driver initialization.
            # In production, webdriver_manager can be used: Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(options=chrome_options)
            logger.info("WebDriver successfully initialized.")
        except WebDriverException as e:
            logger.error(f"Failed to start WebDriver. Ensure Chrome and ChromeDriver are installed. Error: {e}")
            raise e

    def quit_driver(self):
        """Safely terminates the WebDriver session."""
        if self.driver:
            try:
                self.driver.quit()
                logger.info("WebDriver session closed.")
            except Exception as e:
                logger.warning(f"Error while quitting driver: {e}")
            finally:
                self.driver = None

    def save_session_cookies(self, filename: str = "cookies.json"):
        """Saves current browser cookies to preserve the logged-in session."""
        if not self.driver:
            raise RuntimeError("Driver is not running.")
        
        filepath = os.path.join(self.session_dir, filename)
        try:
            cookies = self.driver.get_cookies()
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(cookies, f, indent=4)
            logger.info(f"Session cookies saved successfully to {filepath}.")
        except IOError as e:
            logger.error(f"Failed to save cookies to file: {e}")

    def load_session_cookies(self, domain_url: str, filename: str = "cookies.json") -> bool:
        """Loads and injects saved cookies into the WebDriver session to bypass login."""
        if not self.driver:
            raise RuntimeError("Driver is not running.")
            
        filepath = os.path.join(self.session_dir, filename)
        if not os.path.exists(filepath):
            logger.warning(f"No session cookies file found at {filepath}.")
            return False

        try:
            # Must navigate to the domain first before injecting cookies for that domain
            self.driver.get(domain_url)
            time.sleep(2)  # Allow page to load briefly
            
            with open(filepath, 'r', encoding='utf-8') as f:
                cookies = json.load(f)
                
            for cookie in cookies:
                # Selenium get_cookies includes 'expiry' which can sometimes cause errors if set in the past
                if 'expiry' in cookie:
                    cookie['expiry'] = int(cookie['expiry'])
                try:
                    self.driver.add_cookie(cookie)
                except Exception as e:
                    logger.debug(f"Failed to add individual cookie: {cookie.get('name')}. Error: {e}")
            
            # Refresh to apply cookies
            self.driver.refresh()
            logger.info("Session cookies injected and page refreshed.")
            return True
        except Exception as e:
            logger.error(f"Failed to load or inject cookies: {e}")
            return False

    def perform_login(self, login_url: str, username_id: str, password_id: str, submit_btn_id: str, 
                      username_val: str, password_val: str, verification_selector: str, timeout: int = 15) -> bool:
        """Performs form-based login and saves the session on success."""
        if not self.driver:
            self.start_driver()

        try:
            logger.info(f"Navigating to login page: {login_url}")
            self.driver.get(login_url)
            
            wait = WebDriverWait(self.driver, timeout)
            
            # Locate input fields and submit button
            username_field = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, username_id)))
            password_field = self.driver.find_element(By.CSS_SELECTOR, password_id)
            submit_btn = self.driver.find_element(By.CSS_SELECTOR, submit_btn_id)
            
            # Enter credentials
            username_field.clear()
            username_field.send_keys(username_val)
            password_field.clear()
            password_field.send_keys(password_val)
            
            # Submit form
            submit_btn.click()
            
            # Verify login success by checking for presence of dashboard/logged-in selector
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, verification_selector)))
            logger.info("Login successful. Saving cookies...")
            self.save_session_cookies()
            return True
            
        except TimeoutException:
            logger.error("Login attempt timed out. Verification selector not found.")
            return False
        except NoSuchElementException as e:
            logger.error(f"Failed to locate login form elements: {e}")
            return False
        except Exception as e:
            logger.error(f"An unexpected error occurred during login: {e}")
            return False

    def select_dropdown_option(self, dropdown_selector: By, identifier: str, option_value_or_text: str, 
                               by_text: bool = True, timeout: int = 10) -> bool:
        """
        Interacts with dropdown selectors (either standard HTML <select> or custom div-based lists)
        to navigate between exam subjects or rounds.
        """
        if not self.driver:
            raise RuntimeError("Driver is not running.")

        try:
            wait = WebDriverWait(self.driver, timeout)
            element = wait.until(EC.element_to_be_clickable((dropdown_selector, identifier)))
            
            # Handle standard HTML Select dropdowns
            if element.tag_name == "select":
                select = Select(element)
                if by_text:
                    select.select_by_visible_text(option_value_or_text)
                else:
                    select.select_by_value(option_value_or_text)
                logger.info(f"Selected option '{option_value_or_text}' from standard select.")
            else:
                # Handle custom div-based dropdowns (e.g., Bootstrap, React-Select)
                element.click()  # Click to open dropdown list
                time.sleep(0.5)
                # Find options within dropdown
                options_xpath = f"//div[contains(@class, 'option') or contains(text(), '{option_value_or_text}')]"
                option_el = wait.until(EC.element_to_be_clickable((By.XPATH, options_xpath)))
                option_el.click()
                logger.info(f"Selected option '{option_value_or_text}' from custom dropdown.")
                
            return True
        except Exception as e:
            logger.error(f"Failed to select dropdown option '{option_value_or_text}': {e}")
            return False

    def scrape_ibt_questions(self, target_url: str, container_selector: str, timeout: int = 20) -> List[Dict[str, Any]]:
        """
        Scrapes question items from the dynamic IBT interface.
        Extracts content using standardized schema keys.
        """
        if not self.driver:
            raise RuntimeError("Driver is not running.")

        logger.info(f"Accessing IBT target URL: {target_url}")
        self.driver.get(target_url)
        
        questions_data = []
        try:
            wait = WebDriverWait(self.driver, timeout)
            # Wait until the container holding questions is loaded
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, container_selector)))
            
            # Sub-elements parsing - custom to target IBT layout
            # Let's locate question blocks (e.g., div.question-card, tr.question-row)
            # Below is a robust parsing parser skeleton that handles common classes
            question_elements = self.driver.find_elements(By.CSS_SELECTOR, f"{container_selector} .question-card, {container_selector} .question-item")
            
            # Fallback if specific classes aren't found: grab direct children
            if not question_elements:
                question_elements = self.driver.find_elements(By.CSS_SELECTOR, f"{container_selector} > div")
                
            logger.info(f"Found {len(question_elements)} potential question elements.")
            
            for idx, el in enumerate(question_elements, 1):
                try:
                    # 1. Extract Question Text
                    q_text = ""
                    for text_class in [".question-text", ".title", "h3", "p"]:
                        try:
                            q_text = el.find_element(By.CSS_SELECTOR, text_class).text.strip()
                            if q_text:
                                break
                        except NoSuchElementException:
                            continue
                    
                    if not q_text:
                        # Fallback to general text content excluding options
                        q_text = el.text.split("\n")[0]
                    
                    # 2. Extract Options (Multiple Choice 1~5)
                    options = []
                    option_els = el.find_elements(By.CSS_SELECTOR, ".option-item, .choice, li, label")
                    for opt in option_els:
                        opt_txt = opt.text.strip()
                        if opt_txt:
                            options.append(opt_txt)
                    
                    # Pad options to length of 5 if less choices exist, or slice to 5
                    options = (options + [""] * 5)[:5]
                    
                    # 3. Extract Image URL (if any illustration is attached)
                    image_url = ""
                    try:
                        img_el = el.find_element(By.CSS_SELECTOR, "img")
                        image_url = img_el.get_attribute("src") or ""
                    except NoSuchElementException:
                        pass
                    
                    # 4. Extract Correct Answer (usually hidden in data attribute or input value)
                    correct_answer = "1"  # Default fallback
                    for attr in ["data-correct", "data-answer", "value"]:
                        try:
                            # Check input radio values or data attributes
                            answer_input = el.find_element(By.CSS_SELECTOR, "input[type='radio'][data-correct='true'], .correct-answer")
                            correct_answer = answer_input.get_attribute(attr) or answer_input.text.strip()
                            if correct_answer:
                                break
                        except NoSuchElementException:
                            continue
                            
                    # Build standardized question item
                    question_item = {
                        "subject": self.driver.title or "General",
                        "round": "Mock-Round",
                        "question_text": q_text,
                        "options": options,
                        "image_url": image_url,
                        "correct_answer": correct_answer
                    }
                    questions_data.append(question_item)
                    
                except Exception as ex:
                    logger.warning(f"Error parsing individual question element at index {idx}: {ex}")
                    continue
                    
        except TimeoutException:
            logger.error("Timeout waiting for question container to load.")
        except Exception as e:
            logger.error(f"Error during question scraping: {e}")
            
        return questions_data

if __name__ == "__main__":
    # Self-test code
    print("Testing IBTCrawler initialization...")
    try:
        with IBTCrawler(headless=True) as crawler:
            print("Crawler successfully setup in with-block context!")
    except Exception as e:
        print(f"Driver start failed, which is expected if Chrome is not installed in this container: {e}")
