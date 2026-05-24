#!/usr/bin/env python3
"""
OCR synagogue table images and convert to JSON for backend import.
Usage: python ocr_synagogues.py <image_folder> <output_json>
"""

import sys
import json
import os
import re
from pathlib import Path

try:
    import pytesseract
    from PIL import Image
except ImportError:
    print("ERROR: Missing dependencies. Install with:")
    print("  pip install pytesseract pillow")
    print("\nAlso install tesseract binary from: https://github.com/UB-Mannheim/tesseract/wiki")
    sys.exit(1)


def extract_text_from_image(image_path: str) -> str:
    """Extract Hebrew text from image using Tesseract OCR."""
    try:
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img, lang='heb+eng')
        return text
    except Exception as e:
        print(f"Warning: Failed to OCR {image_path}: {e}")
        return ""


def parse_table_rows(text: str) -> list:
    """Parse synagogue rows from OCR text (basic extraction)."""
    rows = []
    # This is a placeholder — real parsing depends on table structure
    # For now, split by newlines and try to identify rows
    lines = text.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line or len(line) < 5:
            continue
        # Very basic heuristic: if line has @ it's likely an email
        if '@' in line or 'בית' in line or 'כנסת' in line:
            rows.append(line)
    
    return rows


def build_import_row(name: str, address: str = "", phone: str = "", email: str = "", 
                     gabai: str = "", denomination: str = "") -> dict:
    """Build a single import row matching the DTO structure."""
    description_parts = []
    
    if gabai:
        description_parts.append(f"גבאי: {gabai}")
    if email:
        description_parts.append(f"אימייל גבאי: {email}")
    
    return {
        "name": name.strip(),
        "destinationId": 312,
        "address": address.strip() if address else "",
        "latitude": None,
        "longitude": None,
        "phone": phone.strip() if phone else None,
        "website": None,
        "denomination": denomination.strip() if denomination else None,
        "description": "\n".join(description_parts) if description_parts else None,
        "notes": None
    }


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <image_folder> [output_json]")
        print(f"Example: {sys.argv[0]} ./synrehovot ./synagogues_import.json")
        sys.exit(1)
    
    image_folder = Path(sys.argv[1])
    output_json = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("synagogues_import.json")
    
    if not image_folder.exists():
        print(f"ERROR: Folder not found: {image_folder}")
        sys.exit(1)
    
    print(f"Scanning {image_folder} for images...")
    image_files = list(image_folder.glob("*.png")) + list(image_folder.glob("*.jpg")) + list(image_folder.glob("*.jpeg"))
    
    if not image_files:
        print(f"ERROR: No PNG/JPG files found in {image_folder}")
        sys.exit(1)
    
    print(f"Found {len(image_files)} images. Starting OCR...\n")
    
    all_rows = []
    for img_file in sorted(image_files):
        print(f"Processing: {img_file.name}")
        text = extract_text_from_image(str(img_file))
        rows = parse_table_rows(text)
        print(f"  → Extracted {len(rows)} potential rows")
        all_rows.extend(rows)
    
    # Build import JSON
    import_data = []
    seen = set()  # Track (name, address) to deduplicate
    
    for row_text in all_rows:
        # Very basic parsing — you'll need to improve this based on actual format
        parts = [p.strip() for p in row_text.split('|') if p.strip()]
        
        if len(parts) < 2:
            continue
        
        name = parts[0] if parts else ""
        address = parts[1] if len(parts) > 1 else ""
        phone = parts[2] if len(parts) > 2 else ""
        gabai = parts[3] if len(parts) > 3 else ""
        email = parts[4] if len(parts) > 4 else ""
        
        # Deduplicate
        key = (name, address)
        if key in seen:
            continue
        seen.add(key)
        
        # Build and append
        import_row = build_import_row(name, address, phone, email, gabai)
        import_data.append(import_row)
    
    # Write JSON
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(import_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ Wrote {len(import_data)} synagogues to {output_json}")
    print(f"  Total rows: {len(import_data)}")


if __name__ == "__main__":
    main()
