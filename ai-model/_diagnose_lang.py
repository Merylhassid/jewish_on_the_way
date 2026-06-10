# -*- coding: utf-8 -*-
# אבחון בלבד — לא משנה כלום במודל. מודד דיוק נפרד לעברית מול אנגלית על ה-Test set.
import re
from collections import Counter, defaultdict
from classifier import load_data, three_way_split, TFIDF, NaiveBayes, accuracy

def lang(t):
    has_lat = bool(re.search(r'[a-z]', t.lower()))
    has_heb = bool(re.search(r'[א-ת]', t))
    if has_lat and not has_heb: return 'english'
    if has_heb and not has_lat: return 'hebrew'
    return 'mixed'

texts, labels = load_data('data.csv')
train_t, val_t, test_t, train_l, val_l, test_l = three_way_split(texts, labels)

tfidf = TFIDF(); tfidf.fit(train_t)
model = NaiveBayes(); model.fit(tfidf.transform(train_t), train_l)

X_test = tfidf.transform(test_t)
y_pred = model.predict(X_test)

# overall
print(f"Test size: {len(test_t)} | Overall accuracy: {accuracy(test_l, y_pred):.1%}")
print(f"Test language mix: {dict(Counter(lang(t) for t in test_t))}\n")

# per-language
for L in ('hebrew', 'english', 'mixed'):
    idx = [i for i, t in enumerate(test_t) if lang(t) == L]
    if not idx: continue
    yt = [test_l[i] for i in idx]; yp = [y_pred[i] for i in idx]
    acc = sum(a == b for a, b in zip(yt, yp)) / len(idx)
    print(f"{L:8} | n={len(idx):3} | accuracy: {acc:.1%}")

# show the English misses specifically
print("\n--- English test mistakes ---")
miss = 0
for i, t in enumerate(test_t):
    if lang(t) == 'english' and y_pred[i] != test_l[i]:
        miss += 1
        print(f"  '{t}'  pred={y_pred[i]}  actual={test_l[i]}")
if miss == 0:
    print("  (none)")
