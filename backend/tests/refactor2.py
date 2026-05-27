import os

TESTS_DIR = r"c:\Users\vihaa\OneDrive\Desktop\Roommate Matcher\backend\tests"
f1 = os.path.join(TESTS_DIR, "api", "test_phase1_endpoints.py")

with open(f1, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update _seed_student
content = content.replace("""def _seed_student(db_session: Session, admission_number: str = "ADM200") -> None:
    db_session.add(
        Segment(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), segment_key="M_1st_year_AC_2",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
        )
    )
    db_session.add(
        Student(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), admission_number=admission_number,
            full_name="API Student",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
            dob=date(2005, 1, 1),
            segment_key="M_1st_year_AC_2",
        )
    )
    db_session.commit()""", """def _seed_student(db_session: Session, admission_number: str = "ADM200") -> Student:
    segment = Segment(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), segment_key="M_1st_year_AC_2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()
    student = Student(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), admission_number=admission_number,
        full_name="API Student",
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
    db_session.add(student)
    db_session.commit()
    return student""")

# Update tests that call _seed_student
content = content.replace("_seed_student(db_session, admission_number=\"ADM202\")", "student = _seed_student(db_session, admission_number=\"ADM202\")")
content = content.replace("_seed_student(db_session, admission_number=\"ADM206\")", "student = _seed_student(db_session, admission_number=\"ADM206\")")
content = content.replace("_seed_student(db_session, admission_number=\"ADM230\")", "student = _seed_student(db_session, admission_number=\"ADM230\")")
content = content.replace("_seed_student(db_session, admission_number=\"ADM240\")", "student = _seed_student(db_session, admission_number=\"ADM240\")")
content = content.replace("_seed_student(db_session, admission_number=\"ADM250\")", "student = _seed_student(db_session, admission_number=\"ADM250\")")

# For the other students added manually in test_segment_status_endpoint_returns_impossible etc:
# Replace `segment_key="M_1st_year_AC_2",` with `segment_id=student.segment_id, phone_number="9876543210", phone_last4="3210", is_active=True,`
import re
content = re.sub(
    r'segment_key="M_1st_year_AC_2",\s*\)', 
    r'segment_id=student.segment_id,\n                phone_number="9876543210",\n                phone_last4="3210",\n                is_active=True,\n            )', 
    content
)

# For PreferenceProfiles
content = re.sub(
    r'PreferenceProfile\(\s*admission_number="([^"]+)",\s*has_preferences=1,\s*is_active=1,\s*\)',
    r'PreferenceProfile(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), student_id=student.id, has_preferences=1, is_active=True)',
    content
)

# For the single Room(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), ...) instantiation
content = content.replace(
    'db_session.add(Room(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), room_id="A-900", segment_key="M_1st_year_AC_2", capacity=2, source="uploaded"))',
    'db_session.add(Room(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), room_id="A-900", segment_id=student.segment_id, capacity=2, source="uploaded", is_active=True))'
)

with open(f1, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated test_phase1_endpoints.py")
