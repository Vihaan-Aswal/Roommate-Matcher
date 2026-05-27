import os

def replace_in_file(filepath, old_str, new_str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if old_str in content:
        content = content.replace(old_str, new_str)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

TESTS_DIR = r"c:\Users\vihaa\OneDrive\Desktop\Roommate Matcher\backend\tests"

# 1. tests/api/test_matching_endpoints.py
f1 = os.path.join(TESTS_DIR, "api", "test_matching_endpoints.py")
replace_in_file(f1, 
"""    db_session.add(
        Segment(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), segment_key=segment_key,
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
        )
    )""",
"""    segment = Segment(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), segment_key=segment_key,
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()""")

replace_in_file(f1, "segment_key=segment_key,", 'segment_id=segment.id,\n                phone_number="9876543210",\n                phone_last4="3210",\n                is_active=True,')

replace_in_file(f1, "admission_number=\"MR001\",", "student_id=s1.id,")
replace_in_file(f1, "admission_number=\"MR002\",", "student_id=s2.id,")
replace_in_file(f1, "has_preferences=1,\n                is_active=1,", "has_preferences=1,\n                is_active=True,")
replace_in_file(f1, """    db_session.add_all(
        [
            Student(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), admission_number="MR001",""", """    s1 = Student(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), admission_number="MR001",
        full_name="Run Student 1",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 1),
        segment_id=segment.id,
        phone_number="9876543210",
        phone_last4="3210",
        is_active=True,
    )
    s2 = Student(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), admission_number="MR002",
        full_name="Run Student 2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 2),
        segment_id=segment.id,
        phone_number="9876543210",
        phone_last4="3210",
        is_active=True,
    )
    db_session.add_all([s1, s2])
    db_session.flush()
    db_session.add_all(
        [
            PreferenceProfile(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), student_id=s1.id,""")

# We must ensure we clean up the old `Student(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), ...)` calls that were replaced manually above.
# Actually, wait. I will just completely rewrite `_seed_ready_segment_with_profiles` by reading the file and replacing the function.
