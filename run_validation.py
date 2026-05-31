import json, os, sys
try:
    with open(r"c:\Users\User\jewish_on_the_way\backend\rabanut-scraper\synagogues_import.json", "r", encoding="utf-8") as f: data = json.load(f)
    print("=== FIRST 10 RECORDS ===")
    for i, r in enumerate(data[:10]):
        p, dn, ds = r.get("phone") or "MISSING", r.get("denomination") or "MISSING", r.get("description") or "MISSING"
        print(f"Record #{i+1}: {r.get(\"name\")} | {r.get(\"address\")} | {p} | {dn} | {ds}".encode("ascii", "replace").decode())
    print("\n=== ROWS WITH MISSING OPTIONAL FIELDS ===")
    m_at = 0
    for i, r in enumerate(data):
        if m:
            m_at += 1
            print(f"Record #{i+1}: {r.get(\"name\")} | {r.get(\"address\")} | MISSING: {m}".encode("ascii", "replace").decode())
    print(f"\n=== SUMMARY STATISTICS ===\nTotal Records: {len(data)}\nMissing: {m_at}\nComplete: {len(data)-m_at}")
except Exception as e: print(f"Error: {e}")
