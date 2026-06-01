"""
Denomination Classifier — TF-IDF + Naive Bayes from scratch
============================================================
מודל AI שני שמסווג נוסח בית כנסת:
  ashkenaz | sfarad | chabad | teimanim

אותו עקרון בדיוק כמו classifier.py הראשי —
רק שהוא מאומן על נוסחים, לא קטגוריות.
"""

import csv, math, random, json, os, re

# ────────────────────────────────────────────────────────
# 1. טעינת דאטה
# ────────────────────────────────────────────────────────
def load_data(path):
    rows = []
    with open(path, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append((row['text'].strip(), row['label'].strip()))
    return rows

# ────────────────────────────────────────────────────────
# 2. Tokenizer — תומך עברית + אנגלית
# ────────────────────────────────────────────────────────
def tokenize(text):
    text = re.sub(r'חב["״]?ד', 'חב"ד', text.lower())
    return re.findall(r'[א-ת"]+|[a-z]+', text)

# ────────────────────────────────────────────────────────
# 3. TF-IDF מאפס
# ────────────────────────────────────────────────────────
class TFIDF:
    def __init__(self):
        self.vocab = []
        self.idf   = {}

    def fit(self, texts):
        """לומד את ה-IDF מכל הדאטה"""
        N = len(texts)
        df = {}  # כמה משפטים מכילים את המילה
        for text in texts:
            for word in set(tokenize(text)):
                df[word] = df.get(word, 0) + 1

        # IDF = log(N / df) — מילות נפוצות מקבלות ניקוד נמוך
        self.vocab = list(df.keys())
        self.idf   = {w: math.log(N / df[w]) for w in self.vocab}

    def transform(self, text):
        """הופך טקסט לוקטור TF-IDF"""
        words  = tokenize(text)
        n      = max(len(words), 1)
        tf     = {}
        for w in words:
            tf[w] = tf.get(w, 0) + 1/n

        vec = {}
        for w in self.vocab:
            if w in tf:
                vec[w] = tf[w] * self.idf[w]
        return vec

# ────────────────────────────────────────────────────────
# 4. Naive Bayes מאפס
# ────────────────────────────────────────────────────────
class NaiveBayes:
    def __init__(self):
        self.classes       = []
        self.class_probs   = {}
        self.feature_probs = {}

    def fit(self, X_vecs, y):
        """
        X_vecs — רשימה של וקטורי TF-IDF (dict)
        y      — תוויות (list)

        מחשב:
          class_probs   = log P(class)
          feature_probs = log P(word | class)
        """
        self.classes = list(set(y))
        N = len(y)

        # כמה פעמים מופיעה כל קטגוריה
        class_counts = {c: y.count(c) for c in self.classes}
        self.class_probs = {
            c: math.log(class_counts[c] / N)
            for c in self.classes
        }

        # לכל קטגוריה — מחשבים את סכום ניקודי ה-TF-IDF לכל מילה
        word_sums  = {c: {} for c in self.classes}
        total_sums = {c: 0   for c in self.classes}

        for vec, label in zip(X_vecs, y):
            for word, score in vec.items():
                word_sums[label][word] = word_sums[label].get(word, 0) + score
                total_sums[label] += score

        # Laplace smoothing — מונעים log(0)
        vocab_size = len(set(w for vec in X_vecs for w in vec))

        self.feature_probs = {}
        for c in self.classes:
            total = total_sums[c] + vocab_size  # smoothing
            self.feature_probs[c] = {
                word: math.log((word_sums[c].get(word, 0) + 1) / total)
                for word in set(w for vec in X_vecs for w in vec)
            }

    def predict_one(self, vec):
        """מחזיר (class, score_dict)"""
        scores = {}
        for c in self.classes:
            score = self.class_probs[c]
            for word, tfidf_score in vec.items():
                if word in self.feature_probs[c]:
                    score += tfidf_score * self.feature_probs[c][word]
            scores[c] = score

        return max(scores, key=scores.get), scores

    def predict(self, X_vecs):
        return [self.predict_one(v)[0] for v in X_vecs]

# ────────────────────────────────────────────────────────
# 5. Softmax — הופך ציונים גולמיים לאחוזים
# ────────────────────────────────────────────────────────
def softmax(scores_dict):
    vals   = list(scores_dict.values())
    m      = max(vals)
    exps   = {k: math.exp(v - m) for k, v in scores_dict.items()}
    total  = sum(exps.values())
    return {k: round(v / total, 4) for k, v in exps.items()}

# ────────────────────────────────────────────────────────
# 6. פיצול 70 / 15 / 15
# ────────────────────────────────────────────────────────
def three_way_split(data, seed=42):
    random.seed(seed)
    d = data[:]
    random.shuffle(d)
    n      = len(d)
    t_end  = int(n * 0.70)
    v_end  = int(n * 0.85)
    return d[:t_end], d[t_end:v_end], d[v_end:]

# ────────────────────────────────────────────────────────
# 7. הערכת דיוק
# ────────────────────────────────────────────────────────
def evaluate(model, tfidf, data, name):
    correct = 0
    errors  = []
    for text, true_label in data:
        vec   = tfidf.transform(text)
        pred  = model.predict_one(vec)[0]
        if pred == true_label:
            correct += 1
        else:
            errors.append((text, true_label, pred))

    acc = correct / len(data) * 100
    print(f"\n{'='*40}")
    print(f"  {name}: {correct}/{len(data)} = {acc:.1f}%")
    print(f"{'='*40}")
    if errors:
        print(f"  שגיאות ({len(errors)}):")
        for t, true, pred in errors:
            print(f"    ❌ '{t}' → אמיתי: {true} | ניחשתי: {pred}")
    return acc

# ────────────────────────────────────────────────────────
# 8. Main
# ────────────────────────────────────────────────────────
if __name__ == '__main__':
    base = os.path.dirname(__file__)
    data = load_data(os.path.join(base, 'data_denomination.csv'))

    print(f"סה\"כ דאטה: {len(data)} משפטים")

    # ─── חלוקה לסטים ───
    train, val, test = three_way_split(data)
    print(f"Train: {len(train)} | Val: {len(val)} | Test: {len(test)}")

    # ─── TF-IDF fit על Train בלבד ───
    tfidf = TFIDF()
    tfidf.fit([t for t, _ in train])
    print(f"אוצר מילים: {len(tfidf.vocab)} מילים")

    # ─── Naive Bayes ───
    X_train = [tfidf.transform(t) for t, _ in train]
    y_train = [l for _, l in train]

    model = NaiveBayes()
    model.fit(X_train, y_train)

    # ─── הערכה ───
    evaluate(model, tfidf, train, "Train")
    evaluate(model, tfidf, val,   "Validation")
    evaluate(model, tfidf, test,  "Test (honest)")

    # ─── בדיקות חיות ───
    print("\n" + "="*40)
    print("  בדיקות חיות:")
    print("="*40)
    examples = [
        "בית כנסת ספרדי בתל אביב",
        "מניין אשכנזי ירושלים",
        "חב\"ד",
        "synagogue teimanim",
        "nusach ashkenaz",
        "תפילה תימנית",
        "sephardic minyan",
        "chabad house",
        "בית כנסת מרוקאי",
        "חסידי",
    ]
    emoji = {'ashkenaz': '🎩', 'sfarad': '🌙', 'chabad': '🕎', 'teimanim': '🌿'}
    for ex in examples:
        vec    = tfidf.transform(ex)
        pred, scores = model.predict_one(vec)
        probs  = softmax(scores)
        conf   = probs[pred]
        print(f"  {emoji.get(pred,'❓')} '{ex}' → {pred} ({conf*100:.0f}%)")
