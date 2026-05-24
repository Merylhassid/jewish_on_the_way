import json
import os
import sys

file_path = r'c:\Users\User\jewish_on_the_way\backend\rabanut-scraper\synagogues_import.json'

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print('=== FIRST 10 RECORDS ===')
for i, r in enumerate(data[:10]):
    name = r.get('name', 'N/A')
    addr = r.get('address', 'N/A')
    ph = r.get('phone') or 'MISSING'
    dn = r.get('denomination') or 'MISSING'
    ds = r.get('description') or 'MISSING'
    line = f'Record #{i+1}: {name} | {addr} | {ph} | {dn} | {ds}'
    print(line.encode('ascii', 'replace').decode())

print('\n=== ROWS WITH MISSING OPTIONAL FIELDS ===')
m_c = 0
for i, r in enumerate(data):
    m = []
    if not r.get('phone'): m.append('phone')
    if not r.get('denomination'): m.append('denomination')
    if not r.get('description'): m.append('description')
    if m:
        m_c += 1
        name = r.get('name', 'N/A')
        addr = r.get('address', 'N/A')
        line = f'Record #{i+1}: {name} | {addr} | MISSING: {m}'
        print(line.encode('ascii', 'replace').decode())

print('\n=== SUMMARY STATISTICS ===')
print(f'Total Records: {len(data)}')
print(f'Records with missing optional fields: {m_c}')
print(f'Records with all optional fields present: {len(data) - m_c}')
