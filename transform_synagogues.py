import json
import os

input_file = r'C:\Users\User\Downloads\merged_synagogues_rehovot (1).json'
output_file = r'C:\Users\User\jewish_on_the_way\backend\rabanut-scraper\synagogues_import.json'

if not os.path.exists(input_file):
    print(f'Error: Input file {input_file} not found.')
    exit(1)

with open(input_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

unique_records = {}
processed_data = []

for item in data:
    name = item.get('שם בית כנסת', '').strip()
    address = item.get('כתובת בית הכנסת', '').strip()
    
    if not name or not address:
        continue
        
    key = (name, address)
    if key in unique_records:
        continue
    
    # Description build
    desc_parts = []
    gabai_name = item.get('שם גבאי', '').strip()
    gabai_email = item.get('כתובת אי מייל גבאי ראשי', '').strip()
    rabbi_details = item.get('פרטי רב בית הכנסת', '').strip()
    
    if gabai_name: desc_parts.append(f'גבאי: {gabai_name}')
    if gabai_email: desc_parts.append(f'מייל גבאי: {gabai_email}')
    if rabbi_details: desc_parts.append(f'רב: {rabbi_details}')
    
    description = '\n'.join(desc_parts) if desc_parts else None
    
    dto = {
        'name': name,
        'address': address,
        'denomination': item.get('נוסח', '').strip(),
        'phone': item.get('נייד גבאי ראשי', '').strip(),
        'description': description,
        'destinationId': 312,
        'latitude': None,
        'longitude': None,
        'website': None,
        'notes': None
    }
    
    unique_records[key] = dto
    processed_data.append(dto)

os.makedirs(os.path.dirname(output_file), exist_ok=True)
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(processed_data, f, ensure_ascii=False, indent=2)

print(f'Total records in source: {len(data)}')
print(f'Deduplicated records: {len(processed_data)}')
print('Preview (first 3):')
print(json.dumps(processed_data[:3], ensure_ascii=False, indent=2))
