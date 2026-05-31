/**
 * DenominationClassifierService
 * ==============================
 * מודל AI שני — מסווג נוסח בית כנסת מתוך טקסט חופשי.
 *
 * אותו אלגוריתם בדיוק כמו ClassifierService:
 *   TF-IDF + Naive Bayes + Softmax — מאפס, ללא ספריות.
 *
 * קטגוריות: ashkenaz | sfarad | chabad | teimanim
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// ── טיפוסים ──────────────────────────────────────────
interface DenominationModelData {
  vocab:         string[];
  idf:           Record<string, number>;
  classes:       string[];
  class_probs:   Record<string, number>;
  feature_probs: Record<string, Record<string, number>>;
}

export interface DenominationResult {
  denomination:  string | null;   // null = לא זוהה נוסח ספציפי
  confidence:    number;
  emoji:         string;
  allScores:     Record<string, number>;
}

// ── מיפוי לערכי DB ───────────────────────────────────
const DENOM_TO_DB: Record<string, string[]> = {
  ashkenaz:  ['אשכנז', 'אשכנזי', 'ליטאי', 'Ashkenazi', 'Orthodox'],
  sfarad:    ['ספרדי', 'ספרד', 'עדות המזרח', 'מרוקאי', 'הודי', 'בוכרה', 'אתיופי'],
  chabad:    ['חב"ד', 'חסידי', 'Chabad'],
  teimanim:  ['תימני', 'תימן', 'שאמי', 'בלאדי', 'ירושלמי'],
};

const DENOM_EMOJI: Record<string, string> = {
  ashkenaz:  '🎩',
  sfarad:    '🌙',
  chabad:    '🕎',
  teimanim:  '🌿',
};

const DENOM_LABEL: Record<string, string> = {
  ashkenaz:  'אשכנז',
  sfarad:    'ספרד',
  chabad:    'חב"ד',
  teimanim:  'תימן',
};

// סף ביטחון מינימלי — מתחתיו מחזירים null (לא זיהה)
const MIN_CONFIDENCE = 0.45;

@Injectable()
export class DenominationClassifierService implements OnModuleInit {
  private model: DenominationModelData;

  onModuleInit() {
    const modelPath = path.join(__dirname, 'denomination_model.json');
    const raw = fs.readFileSync(modelPath, 'utf-8');
    this.model = JSON.parse(raw);
  }

  // ── Tokenizer (עברית + אנגלית) ─────────────────────
  private tokenize(text: string): string[] {
    return (text.toLowerCase().match(/[א-ת"]+|[a-z]+/g) ?? []);
  }

  // ── TF-IDF transform ───────────────────────────────
  private tfidfTransform(text: string): Record<string, number> {
    const words = this.tokenize(text);
    const n     = Math.max(words.length, 1);
    const tf: Record<string, number> = {};
    for (const w of words) tf[w] = (tf[w] ?? 0) + 1 / n;

    const vec: Record<string, number> = {};
    for (const w of this.model.vocab) {
      if (tf[w] !== undefined) vec[w] = tf[w] * this.model.idf[w];
    }
    return vec;
  }

  // ── Softmax ────────────────────────────────────────
  private softmax(scores: Record<string, number>): Record<string, number> {
    const vals = Object.values(scores);
    const m    = Math.max(...vals);
    const exps: Record<string, number> = {};
    let   total = 0;
    for (const [k, v] of Object.entries(scores)) {
      exps[k] = Math.exp(v - m);
      total  += exps[k];
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(exps)) out[k] = Math.round(v / total * 1000) / 1000;
    return out;
  }

  // ── classify ───────────────────────────────────────
  classify(text: string): DenominationResult {
    const vec    = this.tfidfTransform(text);
    const scores: Record<string, number> = {};

    for (const cls of this.model.classes) {
      let score = this.model.class_probs[cls];
      for (const [word, tfidf] of Object.entries(vec)) {
        if (this.model.feature_probs[cls][word] !== undefined) {
          score += tfidf * this.model.feature_probs[cls][word];
        }
      }
      scores[cls] = score;
    }

    const allScores   = this.softmax(scores);
    const best        = Object.entries(allScores).sort((a, b) => b[1] - a[1])[0];
    const [denom, conf] = best;

    // אם הביטחון נמוך מדי — לא זיהינו נוסח
    if (conf < MIN_CONFIDENCE) {
      return { denomination: null, confidence: conf, emoji: '🕍', allScores };
    }

    return {
      denomination: denom,
      confidence:   conf,
      emoji:        DENOM_EMOJI[denom] ?? '🕍',
      allScores,
    };
  }

  // ── DB values לפי denomination ─────────────────────
  getDbValues(denomination: string): string[] {
    return DENOM_TO_DB[denomination] ?? [];
  }

  // ── label בעברית ───────────────────────────────────
  getHebrewLabel(denomination: string): string {
    return DENOM_LABEL[denomination] ?? denomination;
  }
}
