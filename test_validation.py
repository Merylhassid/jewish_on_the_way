import json
import os
import sys

# Ensure UTF-8 output
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

file_path = r'c:\Users\User\jewish_on_the_way\backend\rabanut-scraper\synagogues_import.json'

if not os.path.exists(file_path):
    print(f"Error: File not found at {file_path}")
    sys.exit(1)

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
except Exception as e:
    print(f"Error reading JSON: {e}")
    sys.exit(1)

print("=== FIRST 10 RECORDS ===")
for i, record in enumerate(data[:10]):
    name = record.get('name', 'N/A')
    address = record.get('address', 'N/A')
    phone = record.get('phone') or "MISSING"
    denom = record.get('denomination') or "MISSING"
    desc = record.get('description') or "MISSING"
    print(f"Record #{i+1}: {name} | {address} | {phone} | {denom} | {desc}")

print("\n=== ROWS WITH MISSING OPTIONAL FIELDS ===")
missing_count = 0
for i, record in enumerate(data):
    missing_fields = []
    if not record.get('phone'): missing_fields.append('phone')
    if not record.get('denomination'): missing_fields.append('denomination')
    if not record.get('description'): missing_fields.append('description')
    
    if missing_fields:
        missing_count += 1
        name = record.get('name', 'N/A')
        address = record.get('address', 'N/A')
        print(f"Record #{i+1}: {name} | {address} | MISSING: [{', '.join(missing_fields)}]")

print("\n=== SUMMARY STATISTICS ===")
print(f"Total Records: {len(data)}")
print(f"Records with missing optional fields: {missing_count}")
print(f"Records with all optional fields present: {len(data) - missing_count}")
