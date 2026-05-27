import os
import re

TESTS_DIR = r"c:\Users\vihaa\OneDrive\Desktop\Roommate Matcher\backend\tests"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # We want to replace `ModelName(` with `ModelName(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(),`
    # But only if it doesn't already have tenant_id.
    models = ["Segment", "Student", "PreferenceProfile", "Room", "MatchingRun", "RoomAssignment", "PairScore"]
    
    for model in models:
        # Pattern looks for ModelName( followed by optional whitespace and NOT 'tenant_id'
        # We need to make sure we don't match def func_Segment( or things like that.
        # \bModelName\(\s*(?!tenant_id)
        pattern = r'\b' + model + r'\(\s*(?!tenant_id)'
        replacement = model + r'(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), '
        content = re.sub(pattern, replacement, content)
        
        # In case the original had a newline right after `(`, the above replacement might add it in the same line.
        # It's fine for Python.
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk(TESTS_DIR):
    for file in files:
        if file.endswith(".py"):
            process_file(os.path.join(root, file))
