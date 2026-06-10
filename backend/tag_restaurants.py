# -*- coding: utf-8 -*-
"""
תיוג מסעדות בעזרת Claude Haiku — שלב זול ובטוח.

מה הוא עושה:
  - מושך מה-DB את כל המסעדות שאין להן tags (שם + עיר + סוג).
  - שולח אותן ל-Claude Haiku באצוות של 25.
  - מקבל tags מאוצר מילים סגור בלבד (כל tag לא חוקי נזרק).
  - כותב חזרה ל-DB ב-merge בטוח (רק מוסיף, לא מוחק).
  - עוקב אחרי העלות בזמן אמת ועוצר אוטומטית אם מתקרבים ל-MAX_COST_USD.

הרצה:
  pip install anthropic psycopg2-binary
  $env:ANTHROPIC_API_KEY="sk-ant-..."   (PowerShell)
  python tag_restaurants.py
"""

import os
import json
import sys
import psycopg2
from anthropic import Anthropic

# ── הגדרות ────────────────────────────────────────────────
DB_URL = "postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require"
MODEL = "claude-opus-4-8"   # מודל חזק — מכיר יותר מסעדות אלמוניות
BATCH_SIZE = 25
MAX_COST_USD = 4.5          # בלם בטיחות — עוצר אם חורגים
INPUT_PRICE = 5.0 / 1_000_000
OUTPUT_PRICE = 25.0 / 1_000_000
PROCESS_ALL = False         # False = רק לא מתויגות. True = גם מעשיר קיימות.

# אוצר המילים הסגור — חייב להיות זהה ל-food-relations.ts
VALID_TAGS = {
    "chicken", "grill", "shawarma", "burger", "steak", "fast-food",
    "pizza", "pasta", "italian", "cafe", "coffee", "bakery", "ice-cream",
    "breakfast", "bagel", "dessert", "sushi", "fish", "asian", "falafel",
    "street-food", "hummus", "salad", "healthy", "vegan", "noodles",
    "sandwich", "deli", "soup", "mexican", "takeaway",
}

SYSTEM_PROMPT = f"""You are a kosher-restaurant cuisine tagger for a Jewish travel app.
For each restaurant you receive (id, name, city, kosher type), output the food-category tags that you are CONFIDENT apply, based on the restaurant name and your knowledge of it.

STRICT RULES:
- Use ONLY these exact tags (anything else is ignored): {", ".join(sorted(VALID_TAGS))}.
- Only output a tag if you are genuinely confident. If you don't recognize the place and the name gives no clear signal, return an EMPTY list for it. Never guess. Never invent.
- A meat restaurant with no specific dish signal -> usually [] (do NOT blindly add "grill"). Only tag what the name/your knowledge supports.
- Known chains: use your knowledge (e.g. McDonald's -> burger,fast-food ; Aroma -> cafe,coffee ; Biga -> bakery,cafe).

Respond ONLY with a single JSON object mapping each id (as a string) to an array of tags. No markdown, no prose.
Example: {{"123": ["pizza","italian"], "124": [], "125": ["grill","steak"]}}"""


def fetch_rows(conn):
    where = "" if PROCESS_ALL else "WHERE (r.tags IS NULL OR array_length(r.tags,1) IS NULL)"
    sql = f"""SELECT r.id, r.name, COALESCE(d.city,''), COALESCE(r.restaurant_type,'')
              FROM restaurants r LEFT JOIN destinations d ON d.id = r."destinationId"
              {where} ORDER BY r.id"""
    with conn.cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


def tag_batch(client, rows):
    lines = [f'{rid} | {name} | {city} | {rtype}' for (rid, name, city, rtype) in rows]
    user = "Tag these restaurants:\n" + "\n".join(lines)
    resp = client.messages.create(
        model=MODEL, max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user}],
    )
    text = resp.content[0].text.strip()
    # ניקוי גדרות קוד אם יש
    if text.startswith("```"):
        text = text.split("```")[1].lstrip("json").strip()
    data = json.loads(text)
    cost = resp.usage.input_tokens * INPUT_PRICE + resp.usage.output_tokens * OUTPUT_PRICE
    return data, cost


def apply_tags(conn, updates):
    # updates: list of (id, [tags])
    with conn.cursor() as cur:
        for rid, tags in updates:
            cur.execute(
                """UPDATE restaurants AS r
                   SET tags = (SELECT array_agg(DISTINCT x) FROM unnest(coalesce(r.tags,'{}') || %s::text[]) x)
                   WHERE r.id = %s""",
                (tags, rid),
            )
    conn.commit()


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: set ANTHROPIC_API_KEY first")
        sys.exit(1)

    client = Anthropic()
    conn = psycopg2.connect(DB_URL)
    rows = fetch_rows(conn)
    print(f"Restaurants to process: {len(rows)}")

    total_cost = 0.0
    tagged_count = 0
    processed = 0

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        try:
            data, cost = tag_batch(client, batch)
        except Exception as e:
            print(f"  batch {i//BATCH_SIZE} failed: {e} — skipping")
            continue

        total_cost += cost
        updates = []
        for (rid, name, city, rtype) in batch:
            tags = data.get(str(rid), [])
            tags = [t for t in tags if t in VALID_TAGS]  # שומר רק תגים חוקיים
            if tags:
                updates.append((rid, tags))
        if updates:
            apply_tags(conn, updates)
            tagged_count += len(updates)

        processed += len(batch)
        print(f"  processed {processed}/{len(rows)} | tagged so far {tagged_count} | cost ${total_cost:.3f}")

        if total_cost >= MAX_COST_USD:
            print(f"\nSTOPPED: hit cost cap ${MAX_COST_USD}. Processed {processed}/{len(rows)}.")
            break

    conn.close()
    print(f"\nDONE. Tagged {tagged_count} restaurants. Total cost: ${total_cost:.3f}")


if __name__ == "__main__":
    main()
