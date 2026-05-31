import json
import os
import sys

file_path = r"c:\Users\User\jewish_on_the_way\backend\rabanut-scraper\synagogues_import.json"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)

print("=== FIRST 10 RECORDS ===")
for i, r in enumerate(data[:10]):
    name = r.get("name", "N/A")
    addr = r.get("address", "N/A")
    ph = r.get("phone") or "MISSING"
    dn = r.get("denomination") or "MISSING"
    ds = r.get("description") or "MISSING"
    line = f"Record #{i+1}: {name} | {addr} | {ph} | {dn} | {ds}"
    print(line.encode("ascii", "replace").decode())

print("\n=== ROWS WITH MISSING OPTIONAL FIELDS ===")
missing_count = 0
for i, r in enumerate(data):
    missing = []
    if not r.get("phone"): missing.append("phone")
    if not r.get("denomination"): missing.append("denomination")
    if not r.get("description"): missing.append("description")
    
    if missing:
        missing_count += 1
        name = r.get("name", "N/A")
        addr = r.get("address", "N/A")
        line = f"Record #{i+1}: {name} | {addr} | MISSING: {missing}"
        print(line.encode("ascii", "replace").decode())

print("\n=== SUMMARY STATISTICS ===")
print(f"Total Records: {len(data)}")
print(f"Records with missing optional fields: {missing_count}")
print(f"Records with all optional fields present: {len(data) - missing_count}")
