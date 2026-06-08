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
  metadata    — גרסה, תאריך, גודל דאטה, דיוק
"""

import sys
import os
import json
import random
from datetime import date

sys.stdout.reconfigure(encoding='utf-8')

from classifier import load_data, TFIDF, NaiveBayes

DATA_PATH = os.path.join(os.path.dirname(__file__), 'data.csv')

print("🔄 טוען דאטה...")
texts, labels = load_data(DATA_PATH)
dataset_size = len(texts)
print(f"✅ {dataset_size} משפטים נטענו")

# ── הערכת דיוק על holdout 20% ─────────────────────────
print("🔄 מחשב test accuracy (80/20 holdout)...")
combined = list(zip(texts, labels))
random.seed(42)
random.shuffle(combined)
split = int(len(combined) * 0.8)
train_pairs = combined[:split]
test_pairs  = combined[split:]
train_t, train_l = zip(*train_pairs)
test_t,  test_l  = zip(*test_pairs)

tfidf_eval = TFIDF()
tfidf_eval.fit(list(train_t))
X_train_eval = tfidf_eval.transform(list(train_t))
X_test_eval  = tfidf_eval.transform(list(test_t))
model_eval   = NaiveBayes()
model_eval.fit(X_train_eval, list(train_l))
preds = model_eval.predict(X_test_eval)
correct = sum(1 for t, p in zip(test_l, preds) if t == p)
test_accuracy = round(correct / len(test_l), 4)
print(f"✅ Test accuracy: {test_accuracy:.1%} ({correct}/{len(test_l)})")

# ── אימון על כל הדאטה ─────────────────────────────────
print("🔄 מחשב TF-IDF על כל הדאטה...")
tfidf = TFIDF()
tfidf.fit(texts)
X = tfidf.transform(texts)

print("🔄 מאמן Naive Bayes על כל הדאטה...")
model = NaiveBayes()
model.fit(X, labels)
print("✅ המודל אומן!")

# ── שמירת המודל כ-JSON ────────────────────────────────
model_data = {
    "metadata": {
        "version":           "1.0.0",
        "created_at":        date.today().isoformat(),
        "dataset_size":      dataset_size,
        "test_accuracy":     test_accuracy,
        "feature_mode":      "tfidf_bigram",
        "tokenizer_version": "1.0",
    },
    "vocab":         tfidf.vocab,
    "idf":           tfidf.idf,
    "class_probs":   model.class_probs,
    "feature_probs": model.feature_probs,
    "classes":       model.classes,
}

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
print(f"   🎯 test_accuracy: {test_accuracy:.1%}")
