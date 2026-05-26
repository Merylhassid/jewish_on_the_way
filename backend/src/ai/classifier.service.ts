/**
 * ClassifierService
 * =================
 * מממש את אותו אלגוריתם TF-IDF + Naive Bayes שכתבנו ב-Python —
 * הפעם ב-TypeScript, על בסיס המודל השמור ב-model.json.
 *
 * כלומר: ה"מוח" נשאר אותו דבר, רק השפה השתנתה.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// ── טיפוסים ──────────────────────────────────────────────────
interface ModelData {
  vocab:         Record<string, number>;   // מילה → אינדקס
  idf:           Record<string, number>;   // מילה → ערך IDF
  class_probs:   Record<string, number>;   // קטגוריה → prior
  feature_probs: Record<string, number[]>; // קטגוריה → ערכי feature
  classes:       string[];
}

export interface ClassifyResult {
  category:   string;   // הקטגוריה שנבחרה
  confidence: number;   // כמה המודל בטוח (0–1)
  emoji:      string;   // אמוג'י לתצוגה
  allScores:  Record<string, number>; // ציון לכל קטגוריה
}

const EMOJI: Record<string, string> = {
  restaurant: '🍽️',
  synagogue:  '🕍',
  minyan:     '🤝',
  hosting:    '🏠',
};

@Injectable()
export class ClassifierService implements OnModuleInit {
  private model: ModelData;

  // ── טעינת המודל בעת הפעלת השרת ───────────────────────────
  // OnModuleInit = פועל אוטומטית כשה-module עולה
  onModuleInit() {
    const modelPath = path.join(__dirname, 'model.json');
    const raw = fs.readFileSync(modelPath, 'utf-8');
    this.model = JSON.parse(raw);
    console.log(
      `🧠 AI Classifier loaded — vocab: ${Object.keys(this.model.vocab).length} words, ` +
      `categories: ${this.model.classes.join(', ')}`
    );
  }

  // ── Tokenization ──────────────────────────────────────────
  // בדיוק אותה פונקציה כמו ב-Python:
  // שוברת משפט למילים, מסירה פיסוק, מורידה לקטנות
  private tokenize(text: string): string[] {
    return (text.toLowerCase().match(/[א-ת]+|[a-z]+/g) ?? []);
  }

  // ── TF-IDF Transform ──────────────────────────────────────
  // הופכת משפט לוקטור מספרי (TF × IDF לכל מילה)
  private transform(text: string): number[] {
    const { vocab, idf } = this.model;
    const vector = new Array(Object.keys(vocab).length).fill(0);
    const tokens = this.tokenize(text);

    if (tokens.length === 0) return vector;

    // TF = כמה פעמים המילה מופיעה / סה"כ מילים במשפט
    const tf: Record<string, number> = {};
    for (const token of tokens) {
      tf[token] = (tf[token] ?? 0) + 1 / tokens.length;
    }

    // TF-IDF = TF × IDF
    for (const [token, tfVal] of Object.entries(tf)) {
      if (vocab[token] !== undefined && idf[token] !== undefined) {
        vector[vocab[token]] = tfVal * idf[token];
      }
    }

    return vector;
  }

  // ── Naive Bayes Predict ───────────────────────────────────
  // בוחר את הקטגוריה עם הציון הגבוה ביותר
  classify(text: string): ClassifyResult {
    const { classes, class_probs, feature_probs } = this.model;
    const vector = this.transform(text);

    const rawScores: Record<string, number> = {};

    for (const cls of classes) {
      // מתחיל עם log(prior)
      let score = Math.log(class_probs[cls]);

      // מוסיף log(likelihood) לכל feature
      for (let i = 0; i < vector.length; i++) {
        if (vector[i] > 0) {
          score += vector[i] * Math.log(feature_probs[cls][i]);
        }
      }
      rawScores[cls] = score;
    }

    // Softmax — הופך scores להסתברויות שמסתכמות ל-1
    const maxScore = Math.max(...Object.values(rawScores));
    const expScores = Object.fromEntries(
      Object.entries(rawScores).map(([k, v]) => [k, Math.exp(v - maxScore)])
    );
    const total = Object.values(expScores).reduce((a, b) => a + b, 0);
    const allScores = Object.fromEntries(
      Object.entries(expScores).map(([k, v]) => [k, Math.round((v / total) * 1000) / 1000])
    );

    const category   = Object.entries(allScores).sort((a, b) => b[1] - a[1])[0][0];
    const confidence = allScores[category];

    return { category, confidence, emoji: EMOJI[category] ?? '❓', allScores };
  }
}
