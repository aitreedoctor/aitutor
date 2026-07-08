import os
import re
import json

datapacks_dir = "./datapacks"

categories_to_merge = {
    "plant_protection": {
        "master_filename": "plant_protection.json",
        "master_name": "식물보호산업기사 기출 팩",
        "pattern": r"^plant_protection_.*\.json$"
    },
    "tree_doctor_past": {
        "master_filename": "tree_doctor_past.json",
        "master_name": "나무의사 기출문제 팩",
        "pattern": r"^tree_doctor_past_.*\.json$"
    },
    "realtor_1": {
        "master_filename": "realtor_1.json",
        "master_name": "공인중개사 1차 기출 팩",
        "pattern": r"^realtor_1_.*\.json$"
    },
    "realtor_2": {
        "master_filename": "realtor_2.json",
        "master_name": "공인중개사 2차 기출 팩",
        "pattern": r"^realtor_2_.*\.json$"
    }
}

for cat_key, cat_info in categories_to_merge.items():
    print(f"\nProcessing merge for category: {cat_key}...")
    master_path = os.path.join(datapacks_dir, cat_info["master_filename"])
    
    merged_questions = []
    
    # Locate all subpack files
    subpack_files = []
    for f in os.listdir(datapacks_dir):
        if re.match(cat_info["pattern"], f):
            subpack_files.append(f)
            
    if not subpack_files:
        print(f"  No subpack files found matching pattern. Skipping.")
        continue
        
    print(f"  Found {len(subpack_files)} subpack files to merge.")
    
    for f in sorted(subpack_files):
        sub_path = os.path.join(datapacks_dir, f)
        try:
            with open(sub_path, "r", encoding="utf-8") as sub_f:
                data = json.load(sub_f)
                
            sub_name = data.get("pack_name", "")
            # Extract suffix (e.g. "농약학" from "식물보호산업기사 기출 팩 - 농약학")
            suffix = ""
            dash_idx = sub_name.indexOf(" - ") if hasattr(sub_name, "indexOf") else sub_name.find(" - ")
            if dash_idx != -1:
                suffix = sub_name[dash_idx + 3:].strip()
            else:
                # Fallback to filename suffix
                suffix = f.replace(cat_key + "_", "").replace(".json", "")
                
            print(f"    Merging {f} (Suffix: {suffix})...")
            
            sub_questions = data.get("questions", [])
            for q in sub_questions:
                # Update round attribute of questions to match the suffix
                q["round"] = suffix
                merged_questions.append(q)
                
        except Exception as e:
            print(f"    Error reading {f}: {e}")
            
    if merged_questions:
        # Save to master pack
        master_data = {
            "pack_name": cat_info["master_name"],
            "questions": merged_questions
        }
        with open(master_path, "w", encoding="utf-8") as master_f:
            json.dump(master_data, master_f, ensure_ascii=False, indent=2)
        print(f"  Successfully merged {len(merged_questions)} questions into master pack: {master_path}")
        
        # Delete subpack files to clean up directory
        for f in subpack_files:
            sub_path = os.path.join(datapacks_dir, f)
            try:
                os.remove(sub_path)
                print(f"    Deleted split file: {f}")
            except Exception as e:
                print(f"    Failed to delete {f}: {e}")
    else:
        print("  No questions gathered. Master pack not updated.")

print("\nAll merges completed!")
