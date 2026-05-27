import glob
import re

print("Fixing segment tenant_ids...")
for path in glob.glob('backend/tests/**/*.py', recursive=True):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            text = f.read()

        # Add tenant_id=... workspace_id=... to Segment(...) and Room(...) if not there
        # For Segments: we can match `Segment(` and check if tenant_id is inside.
        # But easier: text = text.replace("Segment(segment_key=", "Segment(tenant_id=__import__('uuid').uuid4(), workspace_id=__import__('uuid').uuid4(), segment_key=")
        text = text.replace("Segment(segment_key=", "Segment(tenant_id=__import__('uuid').uuid4(), workspace_id=__import__('uuid').uuid4(), segment_key=")
        text = text.replace('Segment(segment_key=', 'Segment(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), segment_key=')

        # PreferenceProfile constructor with admission_number
        text = text.replace('PreferenceProfile(admission_number=', 'PreferenceProfile(student_id=__import__("uuid").uuid4(), admission_number=')
        # Wait, PreferenceProfile no longer HAS admission_number. So:
        text = text.replace('PreferenceProfile(admission_number="ADM1",', 'PreferenceProfile(student_id=__import__("uuid").uuid4(),')
        text = text.replace('PreferenceProfile(admission_number="ADM2",', 'PreferenceProfile(student_id=__import__("uuid").uuid4(),')
        text = text.replace('PreferenceProfile(admission_number=', 'PreferenceProfile(student_id=__import__("uuid").uuid4(), student_id_legacy_match=') # Just use a dummy
        
        # Room(..., source=...) -> wait, I already fixed room. What about `tenant_id` on Room?
        text = text.replace('Room(room_id=', 'Room(tenant_id=__import__("uuid").uuid4(), workspace_id=__import__("uuid").uuid4(), room_id=')
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
    except Exception as e:
        print(f"Error on {path}: {e}")
