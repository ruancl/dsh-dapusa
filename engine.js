/**
 * engine.js — 大菩萨实证法义 · 取法引擎（JS 移植）
 *
 * 与仓库 practice/retrieve.py 同源：字符二元组 + IDF 召回。
 * 语义重排交给调用方（Host 用 ctx.llm），这里只做确定性的词面部分。
 *
 * 铁律：所有引用逐字取自 data/practice_core.json，本文件不改写任何原文。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, 'data');

export const FACET_NAME = {
  '根': '根 · 出离心',
  '行': '行 · 宽恕与慈悲',
  '观': '观 · 觉察与静心',
  '指': '指 · 见地与觉性',
  '验': '验 · 检验',
};

const TIER_ORDER = { C: 0, B: 1, A: 2 };

const ROUTE = {
  '根': ['出离', '迷茫', '没有方向', '方向感', '放下', '执着', '贪', '舍不得', '轮回',
        '无常', '厌世', '人间', '放不下', '欲望', '名利', '恐惧死亡', '怕死'],
  '行': ['恨', '怨', '原谅', '宽恕', '愤怒', '生气', '委屈', '自责', '羞耻',
        '冷漠', '麻木', '爱', '慈悲', '放不过', '愧疚', '讨厌', '嫉妒'],
  '观': ['烦躁', '焦虑', '静不下来', '心里很乱', '心乱', '很乱', '妄念', '杂念', '走神',
        '专注', '觉察', '觉知', '观察', '打坐', '禅修', '呼吸', '昏沉', '散乱', '失眠', '念头'],
  '指': ['空', '无我', '觉性', '光明', '自性', '见性', '开悟', '证悟', '佛性',
        '境界', '光', '梦', '中阴', '如来'],
  '验': ['怀疑', '不信', '验证', '真假', '标准', '进步', '走偏', '着魔', '退转',
        '是不是', '有没有', '怎么知道', '懈怠', '提不起劲', '没动力', '退失', '厌倦'],
};

const HUMILITY = ['开悟', '证悟', '成就', '到了', '境界', '几地', '果位', '见性', '明心',
                  '是不是真的', '有没有进步', '到哪一层'];

const STOP = new Set(`我的 我很 我很 最近 还是 就是 觉得 每天 现在 时候 一个 这个 那个
我们 你们 他们 什么 怎么 可以 能够 因为 所以 但是 而且 已经 一下 一点
自己 知道 感觉 其实 好像 有点 非常 特别 的话 这样 那样 不是 没有
一直 总是 起来 出来 过来 下来 心情 状态 问题 请问 帮我 看看`.split(/\s+/).filter(Boolean));

const ASKER = /^\s*(学生\d*|学生|法师|问|网友|居士|提问)/;
const TEACH = /^\s*(老师：|我告诉|我跟你|你们要|你要|记住|注意|听好)/;

const KEEP1 = new Set([...'爱恨空光梦苦乐心性觉知观照死生']);
const CJK = /[\u4e00-\u9fff]/;

function tokens(text) {
  const out = [];
  let buf = '';
  for (const ch of text.replace(/\s+/g, '')) {
    if (CJK.test(ch)) {
      if (buf) { out.push(buf); buf = ''; }
      out.push(ch);
    } else if (/[0-9a-zA-Z]/.test(ch)) {
      buf += ch;
    } else if (buf) { out.push(buf); buf = ''; }
  }
  if (buf) out.push(buf);
  return out;
}

function bigrams(text) {
  const toks = tokens(text);
  const grams = [];
  for (let i = 0; i < toks.length - 1; i++) {
    if (toks[i].length === 1 && toks[i + 1].length === 1) grams.push(toks[i] + toks[i + 1]);
  }
  for (const t of toks) {
    if (t.length > 1) grams.push(t);
    else if (KEEP1.has(t)) grams.push(t);
  }
  return grams;
}

export class Engine {
  /**
   * @param {{maxTier?: 'A'|'B'|'C'}} opts
   */
  constructor({ maxTier = 'A' } = {}) {
    const raw = JSON.parse(readFileSync(join(DATA, 'practice_core.json'), 'utf8'));
    const limit = TIER_ORDER[maxTier] ?? 2;
    this.items = raw.items.filter((x) => (TIER_ORDER[x.tier] ?? 2) <= limit);
    this.N = this.items.length;
    this.standards = JSON.parse(readFileSync(join(DATA, 'standards.json'), 'utf8')).items;
    this.practices = JSON.parse(readFileSync(join(DATA, 'practices.json'), 'utf8')).items;

    this.post = new Map();
    this.df = new Map();
    this.doclen = [];
    this.items.forEach((it, i) => {
      const g = bigrams(it.text);
      const cnt = new Map();
      for (const x of g) cnt.set(x, (cnt.get(x) || 0) + 1);
      this.doclen.push(Math.max(g.length, 1));
      for (const [x, c] of cnt) {
        if (!this.post.has(x)) this.post.set(x, []);
        this.post.get(x).push([i, c]);
        this.df.set(x, (this.df.get(x) || 0) + 1);
      }
    });
  }

  idf(g) {
    const d = this.df.get(g) || 0;
    return d ? Math.log(1 + (this.N - d + 0.5) / (d + 0.5)) : 0;
  }

  route(q) {
    const scores = new Map();
    for (const [facet, words] of Object.entries(ROUTE)) {
      let s = 0;
      for (const w of words) if (q.includes(w)) s += 1 + (w.length >= 2 ? 0.6 : 0);
      if (s) scores.set(facet, s);
    }
    return [...scores.entries()].sort((a, b) => b[1] - a[1]);
  }

  search(q) {
    const qg = [...new Set(bigrams(q).filter((g) => !STOP.has(g) && this.df.has(g)))];
    if (!qg.length) return [];
    const totalW = qg.reduce((s, g) => s + this.idf(g), 0) || 1;
    const fac = new Map(this.route(q));

    const acc = new Map();
    const cover = new Map();
    for (const g of qg) {
      const w = this.idf(g);
      for (const [i, c] of this.post.get(g) || []) {
        acc.set(i, (acc.get(i) || 0) + w * (1 + Math.log(c)));
        cover.set(i, (cover.get(i) || 0) + w);
      }
    }

    const docs = [];
    for (const [i, s] of acc) {
      const it = this.items[i];
      const cov = (cover.get(i) || 0) / totalW;
      const norm = 1 / Math.sqrt(this.doclen[i]);
      let boost = 1 + Math.min(cov, 1) * 1.2;
      if (fac.has(it.facet)) boost *= 1 + Math.min(fac.get(it.facet), 4) * 0.15;
      if (it.dim === 'qa' || it.dim === 'test') boost *= 1.12;
      if (ASKER.test(it.text)) boost *= 0.45;
      if (TEACH.test(it.text)) boost *= 1.15;
      docs.push([s * norm * boost * (0.35 + 0.65 * cov), i]);
    }
    docs.sort((a, b) => b[0] - a[0]);
    return docs;
  }

  candidates(q, n = 18) {
    const seen = new Set();
    const out = [];
    for (const [, i] of this.search(q)) {
      const it = this.items[i];
      if (seen.has(it.text)) continue;
      seen.add(it.text);
      out.push(it);
      if (out.length >= n) break;
    }
    return out;
  }

  matchPractices(q, facets, limit = 2) {
    const top = facets[0]?.[0];
    const scored = this.practices.map((p) => {
      let s = 0;
      for (const w of ['放松', '柔软', '观心', '禅修', '心咒', '善事', '读法', '义工']) {
        if (q.includes(w) && p.text.includes(w)) s += 1;
      }
      if (p.kind === 'daily') s += 0.3;
      if (top === '观' && ['一小时禅修', '睡前观心', '松弛入观'].includes(p.name)) s += 0.8;
      if (top === '行' && ['每日小善', '一小时义工', '心咒'].includes(p.name)) s += 0.8;
      if (top === '验' && p.name === '心咒') s += 0.5;
      return [s, p];
    });
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, limit).map((x) => x[1]);
  }

  matchStandard(facets, limit = 1) {
    const top = facets[0]?.[0];
    const pref = {
      '根': ['出离心'],
      '行': ['慈悲的程度'],
      '观': ['柔软与放松', '心地四相'],
      '指': ['心地四相', '无私与清白'],
      '验': ['无私无愧的良心', '虔诚心纯度'],
    }[top] || [];
    let out = this.standards.filter((s) => pref.includes(s.name));
    if (!out.length) out = this.standards.filter((s) => s.name === '心地四相');
    if (!out.length) out = this.standards.slice(0, 1);
    return out.slice(0, limit);
  }

  /** 不用模型也能出一份完整结果 */
  compute(q) {
    const fac = this.route(q);
    const cands = this.candidates(q);
    return {
      query: q,
      locate: fac.slice(0, 3).map(([facet, score]) => ({ facet, name: FACET_NAME[facet], score })),
      candidates: cands,
      quotes: cands.slice(0, 3),
      practices: this.matchPractices(q, fac, 2),
      standards: this.matchStandard(fac, 1),
      hedging: HUMILITY.some((w) => q.includes(w)),
    };
  }
}

/** 进程内共享的引擎实例：Host 的各个入口（practice_ask / 小光对话）共用一份索引 */
let sharedInstance = null;
export function sharedEngine() {
  if (!sharedInstance) sharedInstance = new Engine({ maxTier: 'A' });
  return sharedInstance;
}
