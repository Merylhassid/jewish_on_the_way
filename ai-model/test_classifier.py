"""
Unit tests for the Jewish On The Way AI classifiers.
Run from the ai-model/ directory: python test_classifier.py
"""

import os
import sys
import math
import unittest

# Resolve imports from this file's directory regardless of cwd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import classifier as cat_clf
import denomination_classifier as denom_clf

_BASE = os.path.dirname(os.path.abspath(__file__))
DATA_PATH       = os.path.join(_BASE, 'data.csv')
DENOM_DATA_PATH = os.path.join(_BASE, 'data_denomination.csv')


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _build_cat_model():
    """Train the category classifier on the full dataset."""
    texts, labels = cat_clf.load_data(DATA_PATH)
    tfidf = cat_clf.TFIDF()
    tfidf.fit(texts)
    X = tfidf.transform(texts)
    model = cat_clf.NaiveBayes()
    model.fit(X, labels)
    return tfidf, model, texts, labels


def _cat_predict(tfidf, model, text):
    """Returns (category, confidence) using softmax over raw NB log-scores."""
    vec = tfidf.transform([text])[0]
    scores = {}
    for cls in model.classes:
        score = math.log(model.class_probs[cls])
        for i, val in enumerate(vec):
            if val > 0:
                score += val * math.log(model.feature_probs[cls][i])
        scores[cls] = score
    max_score = max(scores.values())
    exp_scores = {c: math.exp(s - max_score) for c, s in scores.items()}
    total = sum(exp_scores.values())
    probs = {c: v / total for c, v in exp_scores.items()}
    best = max(probs, key=probs.get)
    return best, probs[best]


def _build_denom_model():
    """Train the denomination classifier on the full dataset."""
    data = denom_clf.load_data(DENOM_DATA_PATH)
    texts  = [t for t, _ in data]
    labels = [l for _, l in data]
    tfidf = denom_clf.TFIDF()
    tfidf.fit(texts)
    X_vecs = [tfidf.transform(t) for t in texts]
    model = denom_clf.NaiveBayes()
    model.fit(X_vecs, labels)
    return tfidf, model, data


def _denom_predict(tfidf, model, text):
    """Returns (denomination, confidence)."""
    vec = tfidf.transform(text)
    pred, scores = model.predict_one(vec)
    probs = denom_clf.softmax(scores)
    return pred, probs[pred]


# ─────────────────────────────────────────────────────────────
# Held-out accuracy helpers
# ─────────────────────────────────────────────────────────────
# These train on a TRAIN split and measure on an UNSEEN TEST split,
# so the reported number is true generalization accuracy — matching the
# methodology and figure in classifier.py (~82%), not training accuracy.

def _cat_holdout_accuracy():
    """Category classifier accuracy on a held-out test split (no leakage)."""
    texts, labels = cat_clf.load_data(DATA_PATH)
    # Reuse the same 70/15/15 split used by classifier.py (seed=42).
    train_t, _val_t, test_t, train_l, _val_l, test_l = cat_clf.three_way_split(texts, labels)
    tfidf = cat_clf.TFIDF()
    tfidf.fit(train_t)                      # vocabulary learned from TRAIN only
    model = cat_clf.NaiveBayes()
    model.fit(tfidf.transform(train_t), train_l)
    preds = model.predict(tfidf.transform(test_t))
    return sum(p == t for p, t in zip(preds, test_l)) / len(test_l)


def _denom_holdout_accuracy():
    """Denomination classifier accuracy on a held-out test split (no leakage)."""
    import random
    data = list(denom_clf.load_data(DENOM_DATA_PATH))
    random.seed(42)
    random.shuffle(data)
    n_test = int(len(data) * 0.2)           # 80/20 split
    test, train = data[:n_test], data[n_test:]
    train_t = [t for t, _ in train]
    train_l = [l for _, l in train]
    tfidf = denom_clf.TFIDF()
    tfidf.fit(train_t)                       # vocabulary learned from TRAIN only
    model = denom_clf.NaiveBayes()
    model.fit([tfidf.transform(t) for t in train_t], train_l)
    correct = sum(
        1 for text, true_label in test
        if model.predict_one(tfidf.transform(text))[0] == true_label
    )
    return correct / len(test)


# ─────────────────────────────────────────────────────────────
# CLASS 1 — Category Classifier
# ─────────────────────────────────────────────────────────────

class TestCategoryClassifier(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.tfidf, cls.model, cls.texts, cls.labels = _build_cat_model()

    def test_model_loads(self):
        self.assertGreater(
            len(self.tfidf.vocab), 100,
            "Vocabulary should contain more than 100 entries",
        )

    def test_accuracy_above_threshold(self):
        # Held-out generalization accuracy (train/test split, no leakage).
        # This matches the ~82% reported in classifier.py and the project book,
        # rather than training accuracy on data the model has already seen.
        acc = _cat_holdout_accuracy()
        self.assertGreaterEqual(acc, 0.75, f"Expected held-out accuracy >= 0.75, got {acc:.2%}")

    def test_restaurant_keywords(self):
        pred, _ = _cat_predict(self.tfidf, self.model, "מסעדה כשרה בתל אביב")
        self.assertEqual(pred, 'restaurant')

    def test_synagogue_keywords(self):
        pred, _ = _cat_predict(self.tfidf, self.model, "בית כנסת")
        self.assertEqual(pred, 'synagogue')

    def test_minyan_keywords(self):
        pred, _ = _cat_predict(self.tfidf, self.model, "מניין שחרית")
        self.assertEqual(pred, 'minyan')

    def test_hosting_keywords(self):
        pred, _ = _cat_predict(self.tfidf, self.model, "הכנסת אורחים לשבת")
        self.assertEqual(pred, 'hosting')

    def test_english_restaurant(self):
        pred, _ = _cat_predict(self.tfidf, self.model, "kosher restaurant")
        self.assertEqual(pred, 'restaurant')

    def test_confidence_range(self):
        _, conf = _cat_predict(self.tfidf, self.model, "מסעדה כשרה בתל אביב")
        self.assertGreaterEqual(conf, 0.0)
        self.assertLessEqual(conf, 1.0)


# ─────────────────────────────────────────────────────────────
# CLASS 2 — Denomination Classifier
# ─────────────────────────────────────────────────────────────

class TestDenominationClassifier(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.tfidf, cls.model, cls.data = _build_denom_model()

    def test_accuracy_above_threshold(self):
        # Held-out generalization accuracy (train/test split, no leakage).
        acc = _denom_holdout_accuracy()
        self.assertGreaterEqual(acc, 0.70, f"Expected held-out accuracy >= 0.70, got {acc:.2%}")

    def test_chabad(self):
        pred, _ = _denom_predict(self.tfidf, self.model, 'חב״ד')
        self.assertEqual(pred, 'chabad')

    def test_ashkenaz(self):
        pred, _ = _denom_predict(self.tfidf, self.model, 'נוסח אשכנז')
        self.assertEqual(pred, 'ashkenaz')

    def test_sfarad(self):
        pred, _ = _denom_predict(self.tfidf, self.model, 'נוסח ספרד')
        self.assertEqual(pred, 'sfarad')

    def test_confidence_range(self):
        _, conf = _denom_predict(self.tfidf, self.model, 'חב״ד')
        self.assertGreaterEqual(conf, 0.0)
        self.assertLessEqual(conf, 1.0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
