"""
retrain.py
==========
Reads verified positive search examples from the SearchFeedback DB table,
deduplicates against data.csv, appends new rows, and re-exports model.json.

Two positive signals used:
  1. clickedRestaurantName IS NOT NULL
       User searched → saw restaurant list → clicked a result.
       Click = AI understood the query correctly. Label: "restaurant".

  2. detectedKeyword IN ('restaurant','synagogue','minyan','hosting')
       search.controller.ts saves a row with the detected category whenever
       a search resolves to a destination (destination found = good signal).
       clickedRestaurantName IS NULL filters out Type-1 restaurant rows.

Run from ai-model/:
  python retrain.py
"""

import os
import sys
import csv
import subprocess

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, 'data.csv')
ENV_PATH  = os.path.join(BASE_DIR, '..', 'backend', '.env')

VALID_CATEGORIES = {'restaurant', 'synagogue', 'minyan', 'hosting'}

# ── 1. Load .env ──────────────────────────────────────────────

def load_env(path: str) -> dict:
    env = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, val = line.partition('=')
            env[key.strip()] = val.strip()
    return env


if not os.path.exists(ENV_PATH):
    print(f"❌  .env not found at {os.path.abspath(ENV_PATH)}")
    print("    Copy backend/.env.example → backend/.env and fill in DB credentials.")
    sys.exit(1)

env = load_env(ENV_PATH)

db_host = env.get('DB_HOST', '')
db_port = int(env.get('DB_PORT', '5432'))
db_name = env.get('DB_NAME', 'neondb')
db_user = env.get('DB_USER', 'neondb_owner')
db_pass = env.get('DB_PASS', '')

if not db_host or not db_pass:
    print("❌  DB_HOST or DB_PASS missing from backend/.env")
    sys.exit(1)

# ── 2. Connect ────────────────────────────────────────────────

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("❌  psycopg2 not installed.")
    print("    Run: pip install psycopg2-binary")
    sys.exit(1)

print(f"🔌  Connecting to {db_host}…")
try:
    conn = psycopg2.connect(
        host=db_host,
        port=db_port,
        dbname=db_name,
        user=db_user,
        password=db_pass,
        sslmode='require',
    )
except Exception as exc:
    print(f"❌  DB connection failed: {exc}")
    sys.exit(1)

print("✅  Connected\n")
cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

# ── 3. Query positive feedback rows ──────────────────────────

new_examples: list[tuple[str, str]] = []

# Signal 1 — user clicked a restaurant result
cur.execute("""
    SELECT query
    FROM   search_feedback
    WHERE  "clickedRestaurantName" IS NOT NULL
      AND  query IS NOT NULL
      AND  LENGTH(TRIM(query)) > 2
""")
click_rows = cur.fetchall()
for row in click_rows:
    new_examples.append((row['query'].strip(), 'restaurant'))

print(f"📥  Click-confirmed restaurant searches : {len(click_rows)}")

# Signal 2 — main classifier saved category when destination was found
cur.execute("""
    SELECT query, "detectedKeyword" AS category
    FROM   search_feedback
    WHERE  "detectedKeyword" IN ('restaurant', 'synagogue', 'minyan', 'hosting')
      AND  "clickedRestaurantName" IS NULL
      AND  query IS NOT NULL
      AND  LENGTH(TRIM(query)) > 2
""")
dest_rows = cur.fetchall()
for row in dest_rows:
    cat = row['category']
    if cat in VALID_CATEGORIES:
        new_examples.append((row['query'].strip(), cat))

print(f"📥  Destination-confirmed category searches: {len(dest_rows)}")

conn.close()

total_raw = len(new_examples)
print(f"\n📊  Total raw feedback rows fetched: {total_raw}")

# ── 4. Load existing data.csv ─────────────────────────────────

existing_rows: list[tuple[str, str]] = []
existing_texts: set[str] = set()

with open(DATA_PATH, encoding='utf-8', newline='') as f:
    reader = csv.DictReader(f)
    for row in reader:
        text = row['text'].strip()
        existing_rows.append((text, row['label']))
        existing_texts.add(text.lower())

before_count = len(existing_rows)
print(f"📄  Existing examples in data.csv       : {before_count}")

# ── 5. Deduplicate ────────────────────────────────────────────

added: list[tuple[str, str]] = []
seen_keys: set[str] = set()

for text, label in new_examples:
    key = text.lower()
    if key not in existing_texts and key not in seen_keys:
        added.append((text, label))
        seen_keys.add(key)

dupes = total_raw - len(added)
print(f"🔁  Duplicates skipped                  : {dupes}")
print(f"✨  New unique examples to add          : {len(added)}")

if not added:
    print("\n⚠️   No new examples — data.csv is already up to date. Skipping retrain.")
    sys.exit(0)

# ── 6. Measure accuracy BEFORE ───────────────────────────────

sys.path.insert(0, BASE_DIR)
from classifier import TFIDF, NaiveBayes, accuracy  # noqa: E402


def measure_accuracy(rows: list[tuple[str, str]]) -> float:
    texts  = [r[0] for r in rows]
    labels = [r[1] for r in rows]
    tfidf = TFIDF()
    tfidf.fit(texts)
    X = tfidf.transform(texts)
    model = NaiveBayes()
    model.fit(X, labels)
    preds = model.predict(X)
    return accuracy(labels, preds)


print(f"\n📈  Measuring accuracy before retraining…")
acc_before = measure_accuracy(existing_rows)
print(f"    Before ({before_count:,} examples): {acc_before:.1%}")

# ── 7. Append new rows to data.csv ───────────────────────────

with open(DATA_PATH, 'a', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    for text, label in added:
        writer.writerow([text, label])

after_count = before_count + len(added)
print(f"\n💾  data.csv updated: {before_count:,} → {after_count:,} rows")

# breakdown by category
from collections import Counter  # noqa: E402
by_cat = Counter(label for _, label in added)
for cat, n in sorted(by_cat.items()):
    print(f"    + {n:3d}  {cat}")

# ── 8. Measure accuracy AFTER ────────────────────────────────

print(f"\n📈  Measuring accuracy after retraining…")
acc_after = measure_accuracy(existing_rows + added)
print(f"    After  ({after_count:,} examples): {acc_after:.1%}")

# ── 9. Re-export model.json ──────────────────────────────────

print(f"\n🔄  Running export_model.py…")
result = subprocess.run(
    [sys.executable, os.path.join(BASE_DIR, 'export_model.py')],
    capture_output=True,
    text=True,
    encoding='utf-8',
)
if result.returncode != 0:
    print("❌  export_model.py failed:")
    print(result.stderr)
    sys.exit(1)

# Print only the summary lines from export output
for line in result.stdout.splitlines():
    if any(marker in line for marker in ['✅', '🎉', '📊', '🏷']):
        print(f"    {line.strip()}")

# ── 10. Final report ─────────────────────────────────────────

delta = acc_after - acc_before
delta_str = f"+{delta:.1%}" if delta >= 0 else f"{delta:.1%}"

print()
print("=" * 52)
print("✅  Retraining pipeline complete!")
print(f"   Training examples : {before_count:,} → {after_count:,}  (+{len(added)})")
print(f"   In-sample accuracy: {acc_before:.1%} → {acc_after:.1%}  ({delta_str})")
print(f"   model.json        : updated in backend/src/ai/")
print("=" * 52)
print()
print("ℹ️   In-sample accuracy measures fit, not generalisation.")
print("    A small drop after adding new data is normal and expected")
print("    (more variety = less overfitting to original examples).")
