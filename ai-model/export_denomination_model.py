"""
Export Denomination Model → denomination_model.json
====================================================
מאמן על כל הדאטה ומייצא לקובץ JSON שה-TypeScript יטען.
"""

import csv, math, random, json, os, re

def load_data(path):
    rows = []
    with open(path, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append((row['text'].strip(), row['label'].strip()))
    return rows

def tokenize(text):
    text = re.sub(r'חב["״]?ד', 'חב"ד', text.lower())
    return re.findall(r'[א-ת"]+|[a-z]+', text)

class TFIDF:
    def __init__(self):
        self.vocab = []
        self.idf   = {}

    def fit(self, texts):
        N  = len(texts)
        df = {}
        for text in texts:
            for word in set(tokenize(text)):
                df[word] = df.get(word, 0) + 1
        self.vocab = list(df.keys())
        self.idf   = {w: math.log(N / df[w]) for w in self.vocab}

    def transform(self, text):
        words = tokenize(text)
        n     = max(len(words), 1)
        tf    = {}
        for w in words:
            tf[w] = tf.get(w, 0) + 1/n
        vec = {}
        for w in self.vocab:
            if w in tf:
                vec[w] = tf[w] * self.idf[w]
        return vec

class NaiveBayes:
    def __init__(self):
        self.classes       = []
        self.class_probs   = {}
        self.feature_probs = {}

    def fit(self, X_vecs, y):
        self.classes = list(set(y))
        N            = len(y)
        class_counts = {c: y.count(c) for c in self.classes}
        self.class_probs = {
            c: math.log(class_counts[c] / N) for c in self.classes
        }
        word_sums  = {c: {} for c in self.classes}
        total_sums = {c: 0   for c in self.classes}
        for vec, label in zip(X_vecs, y):
            for word, score in vec.items():
                word_sums[label][word] = word_sums[label].get(word, 0) + score
                total_sums[label] += score
        vocab_size = len(set(w for vec in X_vecs for w in vec))
        self.feature_probs = {}
        for c in self.classes:
            total = total_sums[c] + vocab_size
            self.feature_probs[c] = {
                word: math.log((word_sums[c].get(word, 0) + 1) / total)
                for word in set(w for vec in X_vecs for w in vec)
            }

if __name__ == '__main__':
    base  = os.path.dirname(__file__)
    data  = load_data(os.path.join(base, 'data_denomination.csv'))

    print(f"מאמן על כל {len(data)} משפטים...")

    tfidf = TFIDF()
    tfidf.fit([t for t, _ in data])

    X = [tfidf.transform(t) for t, _ in data]
    y = [l for _, l in data]

    model = NaiveBayes()
    model.fit(X, y)

    out = {
        "vocab":         tfidf.vocab,
        "idf":           tfidf.idf,
        "classes":       model.classes,
        "class_probs":   model.class_probs,
        "feature_probs": model.feature_probs,
    }

    out_path = os.path.join(base, '..', 'backend', 'src', 'ai', 'denomination_model.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"✅ נשמר ב: {os.path.abspath(out_path)}")
    print(f"   אוצר מילים: {len(tfidf.vocab)}")
    print(f"   קטגוריות:   {model.classes}")
