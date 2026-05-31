"""
export_model.py
===============
מאמן את המודל ושומר אותו כקובץ JSON.

למה JSON?
  כי NestJS (TypeScript) לא יכול להריץ Python ישירות.
  אבל הוא יכול לקרוא קובץ JSON ולעשות את אותו חישוב בעצמו.

מה נשמר בJSON:
  vocab       — מילון: מילה → מספר עמודה בוקטור
  idf         — ערך IDF לכל מילה
  class_probs — הסתברות prior לכל קטגוריה
  feature_probs — ממוצע TF-IDF לכל feature בכל קטגוריה
  classes     — שמות הקטגוריות
"""

import sys
import os
import json

sys.stdout.reconfigure(encoding='utf-8')

from classifier import load_data, TFIDF, NaiveBayes

# נתיב לדאטה
DATA_PATH = os.path.join(os.path.dirname(__file__), 'data.csv')

# ── אימון ──────────────────────────────────────────────
print("🔄 טוען דאטה...")
texts, labels = load_data(DATA_PATH)
print(f"✅ {len(texts)} משפטים נטענו")

print("🔄 מחשב TF-IDF...")
tfidf = TFIDF()
tfidf.fit(texts)           # בונה vocabulary + IDF
X = tfidf.transform(texts) # הופך לוקטורים

print("🔄 מאמן Naive Bayes...")
model = NaiveBayes()
model.fit(X, labels)
print("✅ המודל אומן!")

# ── שמירת המודל כ-JSON ────────────────────────────────
# כל מה שהמודל "למד" — נשמר כמספרים ב-JSON

model_data = {
    "vocab":         tfidf.vocab,          # {"מסעדה": 0, "כשר": 1, ...}
    "idf":           tfidf.idf,            # {"מסעדה": 1.2, "כשר": 0.8, ...}
    "class_probs":   model.class_probs,    # {"restaurant": 0.25, ...}
    "feature_probs": model.feature_probs,  # {"restaurant": [0.1, 0.3, ...], ...}
    "classes":       model.classes,        # ["restaurant", "synagogue", ...]
}

# שמירה בתיקיית הבקאנד
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__),
    '..', 'backend', 'src', 'ai', 'model.json'
)
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(model_data, f, ensure_ascii=False, indent=2)

print(f"\n🎉 המודל נשמר בהצלחה!")
print(f"   📁 {os.path.abspath(OUTPUT_PATH)}")
print(f"   📊 {len(tfidf.vocab)} מילים ב-vocabulary")
print(f"   🏷️  קטגוריות: {model.classes}")
