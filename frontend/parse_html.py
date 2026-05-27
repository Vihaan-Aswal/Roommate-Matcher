import re

log_path = r"C:\Users\vihaa\.gemini\antigravity\brain\3cab8e58-d6cd-46ed-b0ed-2256a9c601be\.system_generated\tasks\task-673.log"

with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "Page HTML:"
start_idx = content.find(start_marker)

if start_idx != -1:
    html = content[start_idx + len(start_marker):]
    
    # Find all h3 text
    print("--- HEADINGS ---")
    h3_matches = re.findall(r'<h3[^>]*>(.*?)</h3>', html, re.DOTALL)
    for m in h3_matches:
        print(m.strip())
        
    print("\n--- TEST IDs ---")
    testid_matches = re.findall(r'data-testid="([^"]+)"[^>]*>.*?<p[^>]*>(.*?)</p>', html, re.DOTALL)
    for m in testid_matches:
        print(f"{m[0]}: {m[1].strip()}")
        
    print("\n--- INLINE ALERTS ---")
    alert_matches = re.findall(r'role="alert"[^>]*>(.*?)</div>', html, re.DOTALL)
    for m in alert_matches:
        # Strip internal tags
        clean_alert = re.sub(r'<[^>]+>', ' ', m).strip()
        print(f"ALERT: {clean_alert}")
else:
    print("HTML not found in log")
