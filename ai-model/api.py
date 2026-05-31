"""
Jewish On The Way — Flask API
=============================
שרת קטן שחושף את המודל שלנו לעולם החיצון.

איך זה עובד:
  1. כשהשרת עולה — הוא טוען ומאמן את המודל מהדאטה
  2. כשמגיעה בקשה עם טקסט — הוא מסווג ומחזיר תשובה

Endpoint יחיד:
  POST /classify
  Body:  { "text": "מסעדה כשרה בפריז" }
  Response: { "category": "restaurant", "confidence": 0.85 }
"""

import sys
import os
sys.stdout.reconfigure(encoding='utf-8')

from flask import Flask, request, jsonify

# מייבאים את כל הכלים שבנינו ב-classifier.py
from classifier import load_data, TFIDF, NaiveBayes, train_test_split, tokenize
import math
from collections import defaultdict

# ══════════════════════════════════════════════════════════════
# יצירת אפליקציית Flask
# ══════════════════════════════════════════════════════════════
# Flask(__name__) יוצר שרת חדש
# זה כמו "לפתוח עסק" — עכשיו השרת קיים אבל עוד לא פתוח

app = Flask(__name__)

# ══════════════════════════════════════════════════════════════
# אימון המודל בעת הפעלת השרת
# ══════════════════════════════════════════════════════════════
# כשהשרת עולה — מיד טוענים ומאמנים את המודל.
# ככה לא צריך לאמן מחדש בכל בקשה (זה היה איטי מדי)

print("🔄 טוען ומאמן את המודל...")

# נתיב לקובץ הדאטה (באותה תיקייה)
DATA_PATH = os.path.join(os.path.dirname(__file__), 'data.csv')

# טוענים את הדאטה
texts, labels = load_data(DATA_PATH)

# מאמנים על כל הדאטה (לא רק 80% — כי לא צריך test בייצור)
tfidf = TFIDF()
tfidf.fit(texts)
X = tfidf.transform(texts)

model = NaiveBayes()
model.fit(X, labels)

print(f"✅ המודל מוכן! אומן על {len(texts)} משפטים")
print(f"✅ Vocabulary: {len(tfidf.vocab)} מילים")

# ══════════════════════════════════════════════════════════════
# פונקציה לחישוב confidence (ביטחון)
# ══════════════════════════════════════════════════════════════
# לא רק "מה הקטגוריה" — אלא "כמה המודל בטוח"
# לדוגמה: restaurant עם confidence 0.92 = בטוח מאוד
#          minyan עם confidence 0.51 = לא בטוח

def predict_with_confidence(text):
    vec = tfidf.transform([text])[0]

    scores = {}
    for cls in model.classes:
        score = math.log(model.class_probs[cls])
        for i, val in enumerate(vec):
            if val > 0:
                score += val * math.log(model.feature_probs[cls][i])
        scores[cls] = score

    # הופכים את הscores ל-softmax (הסתברויות שמסתכמות ל-1)
    # softmax: e^score / סכום כל e^scores
    max_score = max(scores.values())
    exp_scores = {cls: math.exp(s - max_score) for cls, s in scores.items()}
    total = sum(exp_scores.values())
    probs = {cls: round(v / total, 3) for cls, v in exp_scores.items()}

    best = max(probs, key=probs.get)
    return best, probs[best], probs

# ══════════════════════════════════════════════════════════════
# Endpoint — POST /classify
# ══════════════════════════════════════════════════════════════
# זה ה"דלפק" שמקבל בקשות מהאפליקציה.
# כשמגיעה בקשה עם טקסט — מסווגים ומחזירים תשובה.

EMOJI = {
    'restaurant': '🍽️',
    'synagogue':  '🕍',
    'minyan':     '🤝',
    'hosting':    '🏠',
}

@app.route('/classify', methods=['POST'])
def classify():
    # קוראים את הגוף של הבקשה
    data = request.get_json()

    if not data or 'text' not in data:
        return jsonify({'error': 'Missing "text" field'}), 400

    text = data['text'].strip()

    if not text:
        return jsonify({'error': 'Text cannot be empty'}), 400

    # מסווגים
    category, confidence, all_probs = predict_with_confidence(text)

    # מחזירים תשובה
    return jsonify({
        'text':       text,
        'category':   category,
        'emoji':      EMOJI.get(category, '❓'),
        'confidence': confidence,
        'all_scores': all_probs,
    })

# ══════════════════════════════════════════════════════════════
# Endpoint — GET /health
# ══════════════════════════════════════════════════════════════
# בדיקה שהשרת חי ועובד (שימושי לדיבוג)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status':     'ok',
        'model':      'NaiveBayes + TF-IDF',
        'vocab_size': len(tfidf.vocab),
        'trained_on': len(texts),
        'categories': model.classes,
    })

# ══════════════════════════════════════════════════════════════
# הפעלת השרת
# ══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("\n🚀 Flask API עולה על פורט 5000...")
    print("   POST http://localhost:5000/classify")
    print("   GET  http://localhost:5000/health")
    print("   לעצירה: Ctrl+C\n")
    app.run(host='0.0.0.0', port=5000, debug=False)
