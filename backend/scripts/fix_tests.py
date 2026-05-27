import glob
import re

for path in glob.glob('backend/tests/ingestion/*.py'):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Rooms
    text = text.replace('source="uploaded")', 'source="uploaded", is_active=True)')
    text = text.replace("source='uploaded')", "source='uploaded', is_active=True)")

    # Students
    text = re.sub(r'dob=date\((.*?)\),\s*segment_key="([A-Za-z0-9_]+)"', r'dob=date(\1), segment_id=existing.id if "existing" in locals() or "existing" in globals() else 1, phone_number="1234567890", phone_last4="7890"', text)
    text = re.sub(r'dob=date\((.*?)\),\s*segment_key=\'([A-Za-z0-9_]+)\'', r'dob=date(\1), segment_id=existing.id if "existing" in locals() or "existing" in globals() else 1, phone_number="1234567890", phone_last4="7890"', text)

    # Missing phones in CSVs
    if 'test_student_csv.py' in path:
        text = text.replace(',dob\\n', ',dob,phone_number\\n')
        text = text.replace(',2005-01-01\\n', ',2005-01-01,123456789\\n')
        text = text.replace(',2005-02-02\\n', ',2005-02-02,123456789\\n')
        text = text.replace(',2005-03-03\\n', ',2005-03-03,123456789\\n')
        text = text.replace(',2005-04-04\\n', ',2005-04-04,123456789\\n')
        text = text.replace(',2005-05-05\\n', ',2005-05-05,123456789\\n')
        text = text.replace(',2005-06-06\\n', ',2005-06-06,123456789\\n')
        text = text.replace(',2005-07-07\\n', ',2005-07-07,123456789\\n')
        text = text.replace(',2003-05-10,', ',2003-05-10,123456789,')
        text = text.replace(',2005-03-03,', ',2005-03-03,123456789,')
        

    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
