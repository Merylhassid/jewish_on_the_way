"""
Jewish On The Way — Text Classifier
מודל סיווג טקסט מאפס — ללא שימוש בספריות ML

מה המודל עושה:
  קולט משפט חופשי מהמשתמש ומסווג אותו לאחת מ-4 קטגוריות:
  restaurant | synagogue | minyan | hosting

שלבים:
  1. טעינת דאטה מ-CSV
  2. עיבוד טקסט (tokenization)
  3. חישוב TF-IDF — הופך מילים למספרים
  4. אימון Naive Bayes — לומד מהדאטה
  5. הערכת ביצועים (Accuracy, Precision, Recall, F1)
  6. ניבוי על משפטים חדשים
"""

import csv
import math
import re
import random
from collections import defaultdict


# ══════════════════════════════════════════════════════════════
# שלב 1 — טעינת הדאטה
# ══════════════════════════════════════════════════════════════
# אנחנו קוראים את קובץ ה-CSV שיצרנו עם 300 משפטים.
# כל שורה: טקסט + תווית (restaurant / synagogue / minyan / hosting)

def load_data(filepath):
    texts, labels = [], []
    with open(filepath, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            texts.append(row['text'])
            labels.append(row['label'])
    return texts, labels


# ══════════════════════════════════════════════════════════════
# שלב 2 — עיבוד טקסט (Tokenization)
# ══════════════════════════════════════════════════════════════
# "tokenization" = פירוק משפט למילים בודדות.
# לדוגמה: "מסעדה כשרה בפריז" → ["מסעדה", "כשרה", "בפריז"]
#
# אנחנו גם:
#   - מורידים לאותיות קטנות (Kosher = kosher)
#   - מסירים פיסוק וסימנים מיוחדים
#   - שומרים רק מילים בעברית ואנגלית

def tokenize(text):
    text = text.lower()
    text = re.sub(r'חב["״]?ד', 'חבד', text)
    # [א-ת]+ = מילים בעברית  |  [a-z]+ = מילים באנגלית
    tokens = re.findall(r'[א-ת]+|[a-z]+', text)
    return tokens


BIGRAM_SEPARATOR = '__'
MIN_BIGRAM_DF = 3


def generate_features(text):
    """Creates unigram + adjacent-bigram features from the token stream."""
    tokens = tokenize(text)
    bigrams = [
        f"{tokens[i]}{BIGRAM_SEPARATOR}{tokens[i + 1]}"
        for i in range(len(tokens) - 1)
    ]
    return tokens + bigrams


# ══════════════════════════════════════════════════════════════
# שלב 3 — TF-IDF מאפס
# ══════════════════════════════════════════════════════════════
# המחשב לא מבין מילים — הוא מבין רק מספרים.
# TF-IDF הופך כל משפט לוקטור של מספרים.
#
# TF  (Term Frequency)          = כמה פעמים מילה מופיעה במשפט הזה
# IDF (Inverse Document Freq.)  = כמה "נדירה" המילה בכל הדאטה
# TF-IDF = TF × IDF
#
# דוגמה:
#   המילה "כשר" מופיעה בכל משפטי restaurant → IDF נמוך (לא נדירה)
#   המילה "מניין" מופיעה רק ב-minyan     → IDF גבוה  (נדירה ומשמעותית)

class TFIDF:
    def __init__(self):
        self.vocab = {}   # מילון: מילה → מספר עמודה בוקטור
        self.idf = {}     # ערך IDF לכל מילה
        self.n_docs = 0   # כמה משפטים יש בסך הכל בדאטה

    def fit(self, texts):
        """שלב הלמידה: בונה vocabulary ומחשב IDF מהדאטה"""
        self.n_docs = len(texts)
        doc_freq = defaultdict(int)

        for text in texts:
            # set() — כדי לא לספור מילה פעמיים באותו משפט
            features = set(generate_features(text))
            for feature in features:
                doc_freq[feature] += 1  # עוד מסמך אחד שמכיל את הפיצ'ר הזה

        # בונה את הvocabulary ומחשב IDF לכל פיצ'ר.
        # Unigrams נשמרים תמיד; bigrams נדירים מסוננים כדי לצמצם overfitting.
        kept_features = [
            (feature, df)
            for feature, df in doc_freq.items()
            if BIGRAM_SEPARATOR not in feature or df >= MIN_BIGRAM_DF
        ]
        for i, (word, df) in enumerate(kept_features):
            self.vocab[word] = i
            # IDF = log(סה"כ מסמכים ÷ מסמכים שמכילים את המילה)
            # ככל שהמילה נדירה יותר — IDF גבוה יותר — המילה "חזקה" יותר
            self.idf[word] = math.log(self.n_docs / df)

    def transform(self, texts):
        """הופך רשימת משפטים לרשימת וקטורים מספריים"""
        matrix = []
        for text in texts:
            # וקטור של אפסים בגודל המילון
            vector = [0.0] * len(self.vocab)
            features = generate_features(text)

            if len(features) == 0:
                matrix.append(vector)
                continue

            # TF = ספירת פיצ'רים מנורמלת לפי מספר הפיצ'רים במשפט
            tf = defaultdict(float)
            for feature in features:
                tf[feature] += 1.0 / len(features)

            # TF-IDF = TF × IDF — שמים את הערך בוקטור
            for feature, tf_val in tf.items():
                if feature in self.vocab:
                    idx = self.vocab[feature]
                    vector[idx] = tf_val * self.idf[feature]

            matrix.append(vector)
        return matrix


# ══════════════════════════════════════════════════════════════
# שלב 4 — Naive Bayes מאפס
# ══════════════════════════════════════════════════════════════
# Naive Bayes מבוסס על משפט בייס מהסתברות:
#   P(קטגוריה | משפט) ∝ P(קטגוריה) × P(משפט | קטגוריה)
#
# בפשטות:
#   המודל שואל: "אם המשפט הזה שייך לקטגוריה X — כמה הגיוני זה?"
#   הוא בודק את כל הקטגוריות ובוחר את הכי הגיונית.
#
# "Naive" = אנחנו מניחים שכל מילה עצמאית (הנחה פשטנית אבל עובדת טוב!)

class NaiveBayes:
    def __init__(self):
        self.class_probs = {}    # P(קטגוריה) — prior
        self.feature_probs = {}  # P(feature | קטגוריה) — likelihood
        self.classes = []

    def fit(self, X, y):
        """אימון המודל: לומד הסתברויות מהדאטה"""
        self.classes = list(set(y))
        n_samples = len(y)
        n_features = len(X[0])

        for cls in self.classes:
            # אינדקסים של כל הדוגמאות מהקטגוריה הזאת
            cls_indices = [i for i, label in enumerate(y) if label == cls]

            # Prior: אחוז הקטגוריה הזאת מכלל הדאטה
            # לדוגמה: אם 75 מתוך 300 = 0.25 (25%)
            self.class_probs[cls] = len(cls_indices) / n_samples

            # ממוצע TF-IDF לכל feature בתוך הקטגוריה
            cls_vectors = [X[i] for i in cls_indices]
            feature_means = []
            for f in range(n_features):
                mean = sum(v[f] for v in cls_vectors) / len(cls_vectors)
                # +1e-9 מונע log(0) שגורם לשגיאה מתמטית
                feature_means.append(mean + 1e-9)

            self.feature_probs[cls] = feature_means

    def predict_one(self, x):
        """מנבא קטגוריה אחת עבור וקטור אחד"""
        best_class = None
        best_score = float('-inf')

        for cls in self.classes:
            # מתחיל עם log(prior) — כמה שכיחה הקטגוריה
            score = math.log(self.class_probs[cls])

            # מוסיף log(likelihood) לכל feature שיש לו ערך
            # (log כי כפל הסתברויות קטנות → underflow מספרי)
            for i, val in enumerate(x):
                if val > 0:
                    score += val * math.log(self.feature_probs[cls][i])

            if score > best_score:
                best_score = score
                best_class = cls

        return best_class

    def predict(self, X):
        """מנבא קטגוריה לכל וקטור ברשימה"""
        return [self.predict_one(x) for x in X]


# ══════════════════════════════════════════════════════════════
# שלב 5 — הערכת ביצועים
# ══════════════════════════════════════════════════════════════
# איך נדע אם המודל טוב? מדדים:
#
# Accuracy  = מתוך כל הניחושים — כמה נכונים? (הכי פשוט)
# Precision = מתוך כל מה שניחשנו "restaurant" — כמה באמת restaurant?
# Recall    = מתוך כל ה-restaurant האמיתיים — כמה מצאנו?
# F1        = ממוצע הרמוני של Precision ו-Recall

def accuracy(y_true, y_pred):
    correct = sum(1 for t, p in zip(y_true, y_pred) if t == p)
    return correct / len(y_true)


def evaluate(y_true, y_pred, classes):
    print("\n📊 תוצאות המודל:")
    print("=" * 60)

    for cls in sorted(classes):
        tp = sum(1 for t, p in zip(y_true, y_pred) if t == cls and p == cls)
        fp = sum(1 for t, p in zip(y_true, y_pred) if t != cls and p == cls)
        fn = sum(1 for t, p in zip(y_true, y_pred) if t == cls and p != cls)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall    = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1        = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

        print(f"  {cls:12} | Precision: {precision:.2f} | Recall: {recall:.2f} | F1: {f1:.2f}")

    print("=" * 60)
    print(f"  ✅ Accuracy כללי: {accuracy(y_true, y_pred):.1%}")


# ══════════════════════════════════════════════════════════════
# שלב 6 — פיצול Train / Validation / Test
# ══════════════════════════════════════════════════════════════
# בML מקצועי יש 3 קבוצות נפרדות:
#
#   Train      (70%) — המודל לומד מזה
#   Validation (15%) — משתמשים בזה לשיפורים ותיקונים
#   Test       (15%) — נוגעים רק פעם אחת! הציון הסופי האמיתי
#
# למה חשוב?
#   אם נסתכל על Test ונוסיף דאטה לפי טעויותיו — "רימינו".
#   Test חייב להישאר "אטום" לאורך כל הפיתוח.
#
# random.seed(42) — כדי שכל הרצה תיתן אותה חלוקה (reproducible)

def three_way_split(texts, labels, val_size=0.15, test_size=0.15, seed=42):
    combined = list(zip(texts, labels))
    random.seed(seed)
    random.shuffle(combined)

    n = len(combined)
    n_test  = int(n * test_size)
    n_val   = int(n * val_size)

    test_data  = combined[:n_test]
    val_data   = combined[n_test:n_test + n_val]
    train_data = combined[n_test + n_val:]

    def unzip(data):
        t, l = zip(*data)
        return list(t), list(l)

    train_t, train_l = unzip(train_data)
    val_t,   val_l   = unzip(val_data)
    test_t,  test_l  = unzip(test_data)

    return train_t, val_t, test_t, train_l, val_l, test_l


# ══════════════════════════════════════════════════════════════
# שלב 7 — הרצה מלאה
# ══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("🚀 Jewish On The Way — Text Classifier")
    print("=" * 60)

    # טעינה
    print("\n📂 שלב 1: טוען דאטה מ-data.csv...")
    texts, labels = load_data('data.csv')
    print(f"   ✅ נטענו {len(texts)} משפטים מ-{len(set(labels))} קטגוריות")

    # פיצול ל-3 קבוצות
    print("\n✂️  שלב 2: מפצל לאימון (70%) | Validation (15%) | Test (15%)...")
    train_t, val_t, test_t, y_train, y_val, y_test = three_way_split(texts, labels)
    print(f"   ✅ Train: {len(train_t)} | Validation: {len(val_t)} | Test: {len(test_t)}")
    print(f"   ⚠️  Test set נחסם — לא נוגעים עד הסוף!")

    # TF-IDF — נלמד רק מ-Train
    print("\n🔢 שלב 3: מחשב TF-IDF (רק על Train)...")
    tfidf = TFIDF()
    tfidf.fit(train_t)                    # לומד vocabulary רק מ-Train
    X_train = tfidf.transform(train_t)
    X_val   = tfidf.transform(val_t)
    X_test  = tfidf.transform(test_t)
    print(f"   ✅ גודל vocabulary: {len(tfidf.vocab)} מילים ייחודיות")

    # אימון
    print("\n🧠 שלב 4: מאמן Naive Bayes על Train בלבד...")
    model = NaiveBayes()
    model.fit(X_train, y_train)
    print("   ✅ המודל אומן בהצלחה!")

    # הערכה על Validation (מותר לשפר לפי זה)
    print("\n📊 שלב 5: ביצועים על Validation Set (לשיפור)...")
    y_pred_val = model.predict(X_val)
    evaluate(y_val, y_pred_val, model.classes)

    # הערכה סופית על Test (פעם אחת בלבד!)
    print("\n🏆 שלב 6: ציון סופי — Test Set (לא נגענו בו!)...")
    y_pred_test = model.predict(X_test)
    evaluate(y_test, y_pred_test, model.classes)
    print("\n   ☝️  זהו הציון האמיתי של המודל — ללא הטיה!")

    # בדיקה ידנית
    print("\n🎯 שלב 7: בדיקה ידנית על משפטים חדשים לגמרי:")
    print("-" * 60)
    test_sentences = [
        "פאב כשר בדנמרק",
        "בית כנסת גדול בווארשה",
        "צריך מניין לבר מצווה",
        "family hosting us for friday night in paris",
        "kosher burger in tokyo",
        "where can i pray in berlin",
        "אני מחפש אירוח לשבת שלום",
        "תפילת שחרית מחר בבוקר",
    ]

    for sentence in test_sentences:
        vec  = tfidf.transform([sentence])
        pred = model.predict_one(vec[0])
        emoji = {'restaurant': '🍽️', 'synagogue': '🕍', 'minyan': '🤝', 'hosting': '🏠'}
        print(f"  {emoji.get(pred, '❓')} '{sentence}'")
        print(f"     → {pred}")
