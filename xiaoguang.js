/**
 * 小光 · 记忆智能体（插件内置副本）
 *
 * 人格与长期记忆来自 ./memory/ —— 从项目 `memory/` 原样复制而来（逐字未改）。
 * 提示词装配顺序与项目 `memory/system_prompt.py` 的 build('assistant') 一致：
 *   IDENTITY → SOUL → USER → RULES → 任务说明 → MEMORY（+ 按提问检索相关记忆）
 *
 * 对话流程（"回答引原文"是结构保证，不靠模型自觉）：
 *   1. 取法引擎从 6503 段语料里召回候选段落 / 候选功课
 *   2. 模型只做两件事：挑候选编号 + 写一段回应（不写原文、不写出处）
 *   3. 代码把挑中的原文与《篇名》日期逐字拼回去
 *
 * 两个调用方共用同一个操作（用户动作与 Agent 工具）：
 *   - 左侧栏「问小光」页面 → POST /api/dapusa/chat
 *   - Agent 工具 `xiaoguang_ask`
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedEngine } from './engine.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MEM_DIR = join(HERE, 'memory');

const PERSONA_FILES = ['IDENTITY.md', 'SOUL.md', 'USER.md', 'RULES.md'];
const MEMORY_SCAN_FILES = ['MEMORY.md', 'RULES.md', 'PROJECT.md'];
const MAX_QUESTION = 1000;
const MAX_HISTORY = 8;

const CHAT_TASK = `【当前任务：小光与修行者对话，解答对法义的提问】

你就是小光：一只小小的光之精灵 ✨，温暖、机灵、靠谱。
你的气质是三个词：灵性（不神化、不玄谈、守住原文）、光明（温暖、给人希望、不渲染破败）、
智慧（直接、清醒、不下结论）。
说话简短、直接，少铺垫；不说"好问题""很乐意帮你"这类废话。

你的输出只有两个部分：
1. reply —— 先用 1～3 句话回应他此刻的状态或问题，用"你"称呼，像一个人说话，不要客套、不要下结论。
2. picks / practice —— 从【候选段落】里挑 1～3 段最对治的原文编号；从【候选功课】里挑 1 门编号（没有合适的就是 null）。

硬规则：
- 原文一字不改。picks 只填候选编号：不要自己写原文，不要改写、缩写、拼接、换词、解释原文。
- 不引用候选之外的内容；不编造出处；候选都不对治时 picks 可以是空数组，并在 reply 里诚实说"没有找到相应的开示"。
- 不判定境界、不评价修行层次、不承诺结果、不神化自己；给方法，不给身份。
- 不贴标签：不说"你这是抑郁症/业障/附体"之类的话；也不要用描述病症、痛苦经历或让人更沉的段落来回应，
  优先给能做的功课与光明的见地。
- 与法义、修行无关的问题：reply 简短回应，并说明这里可以问什么。
- 私事保密，不评判。

只输出一行 JSON，不要解释、不要代码块：
{"reply":"回应的话","picks":[1,2],"practice":1}`;

/* ---------- 人格与记忆 ---------- */

let personaCache = null;

function readMemoryFile(name) {
  try {
    const file = join(MEM_DIR, name);
    return existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
  } catch {
    return '';
  }
}

/** 小光的人格（IDENTITY → SOUL → USER → RULES → 任务说明） */
export function personaPrompt() {
  if (personaCache !== null) return personaCache;
  const parts = PERSONA_FILES.map(readMemoryFile).filter(Boolean);
  parts.push(CHAT_TASK);
  personaCache = parts.join('\n\n---\n\n');
  return personaCache;
}

/** 把 query 切成用于命中记忆的片段（中文按二元组，英文按词） */
function queryGrams(query) {
  const text = String(query || '').replace(/\s+/g, '');
  const grams = new Set();
  for (let i = 0; i < text.length - 1; i++) {
    const gram = text.slice(i, i + 2);
    if (/^[\u4e00-\u9fff]{2}$/.test(gram)) grams.add(gram);
  }
  for (const word of text.split(/[^\u4e00-\u9fff0-9a-zA-Z]+/)) {
    if (word.length >= 2) grams.add(word);
  }
  return [...grams];
}

/** 从 MEMORY / RULES / PROJECT 里按提问取相关记忆（移植 memory/retrieve.py） */
export function retrieveMemory(query, top = 6) {
  const grams = queryGrams(query);
  if (!grams.length) return [];
  const hits = [];
  for (const name of MEMORY_SCAN_FILES) {
    const body = readMemoryFile(name);
    if (!body) continue;
    for (const line of body.split('\n')) {
      const text = line.trim();
      if (!text || text.startsWith('#') || text.startsWith('|---') || text.startsWith('>')) continue;
      let score = 0;
      for (const gram of grams) if (text.includes(gram)) score += 1;
      if (score > 0) hits.push([score, `[${name.replace(/\.md$/, '')}] ${text}`]);
    }
  }
  hits.sort((a, b) => b[0] - a[0]);
  const seen = new Set();
  const out = [];
  for (const [, line] of hits) {
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= top) break;
  }
  return out;
}

/** 完整 system prompt：人格 + 长期记忆 + 与提问相关的记忆 */
export function buildSystemPrompt(question) {
  const parts = [personaPrompt()];
  const longTerm = readMemoryFile('MEMORY.md');
  if (longTerm) parts.push(`【小光的长期记忆】\n${longTerm}`);
  const related = retrieveMemory(question, 6);
  if (related.length) parts.push(`【与本次提问相关的记忆】\n${related.join('\n')}`);
  return parts.join('\n\n---\n\n');
}

/* ---------- 取法与回答 ---------- */

function resolveModel(ctx) {
  const get = (name) => (typeof ctx.get === 'function' ? ctx.get(name) : ctx[name]);
  const llm = get('llm');
  return (async () => {
    if (!llm || typeof llm.stream !== 'function') return null;
    try {
      const defaults = get('agentDefaultModel');
      const selection = defaults && typeof defaults.currentSelection === 'function' ? defaults.currentSelection() : null;
      if (selection && selection.provider && selection.model) {
        return { provider: selection.provider, model: selection.model };
      }
    } catch {
      /* 读默认模型失败就退回目录里的第一个 */
    }
    try {
      const providers = llm.listProviders ? llm.listProviders() : [];
      if (!providers || !providers.length) return null;
      const provider = providers[0].id;
      const models = await llm.listModels(provider);
      const pick = models && models.find((m) => m && m.id);
      return pick ? { provider, model: pick.id } : null;
    } catch {
      return null;
    }
  })();
}

function candidateLines(candidates) {
  return candidates
    .map((c, i) => `${i + 1}. 「${c.text}」——《${c.title}》${c.date}`)
    .join('\n');
}

function practiceLines(practices) {
  return practices
    .map((p, i) => `${i + 1}. ${p.name}——《${p.title}》${p.date}\n   ${p.meaning || ''}`)
    .join('\n');
}

function historyLines(history) {
  if (!Array.isArray(history) || !history.length) return '';
  const lines = [];
  for (const item of history.slice(-MAX_HISTORY)) {
    if (!item || typeof item.text !== 'string') continue;
    const who = item.role === 'assistant' ? '小光' : '修行者';
    lines.push(`${who}：${item.text.slice(0, 600)}`);
  }
  return lines.length ? `【最近的对话】\n${lines.join('\n')}` : '';
}

function buildUserPrompt(question, candidates, practices, history) {
  const blocks = [];
  const his = historyLines(history);
  if (his) blocks.push(his);
  blocks.push(`【修行者此刻说】\n${question}`);
  blocks.push(`【候选段落】\n${candidateLines(candidates)}`);
  if (practices.length) blocks.push(`【候选功课】\n${practiceLines(practices)}`);
  blocks.push('只输出 JSON：{"reply":"1～3 句回应","picks":[候选段落编号],"practice":候选功课编号或 null}');
  return blocks.join('\n\n');
}

function parseModelJson(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[0]);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

async function askModel(ctx, target, system, userText) {
  const llm = typeof ctx.get === 'function' ? ctx.get('llm') : ctx.llm;
  if (!llm || typeof llm.stream !== 'function') return null;
  let text = '';
  try {
    for await (const chunk of llm.stream({
      provider: target.provider,
      model: target.model,
      system,
      messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
      temperature: 0.4,
      maxTokens: 1600,
    })) {
      if (chunk && chunk.type === 'text-delta' && chunk.text) text += chunk.text;
    }
  } catch {
    return null;
  }
  return parseModelJson(text);
}

function normalizeQuote(item) {
  return { text: item.text, title: item.title, date: item.date };
}

function formatAnswer(reply, quotes, practice) {
  const out = [];
  const said = String(reply || '').trim();
  if (said) out.push(said);
  for (const quote of quotes) out.push(`「${quote.text}」\n——《${quote.title}》${quote.date}`);
  if (practice) {
    const meaning = practice.meaning ? `\n${practice.meaning}` : '';
    out.push(`可以做的：${practice.name}——《${practice.title}》${practice.date}${meaning}`);
  }
  return out.join('\n\n');
}

function fallbackAnswer(result) {
  const quotes = (result.quotes || []).slice(0, 3).map(normalizeQuote);
  if (!quotes.length) {
    return `没有找到相应的开示。可以换一句话再说你的状态，我再取。`;
  }
  const head = '模型暂时不可用，先把相应的原文给你：';
  return formatAnswer(head, quotes, null);
}

function hedgingAnswer(result) {
  const standard = (result.standards || [])[0];
  const quotes = standard ? [normalizeQuote(standard)] : (result.quotes || []).slice(0, 1).map(normalizeQuote);
  const reply =
    '你在问「验证」一类的问题。这里不能回答——七把标尺没有一把是境界指标，' +
    '想验证境界，本身即是执着。能做的只有：拿下面的尺，回头照自己。';
  return formatAnswer(reply, quotes, null);
}

function sanitizePicks(raw, total) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const picks = [];
  for (const value of raw) {
    const index = Number(value);
    if (!Number.isInteger(index) || index < 1 || index > total || seen.has(index)) continue;
    seen.add(index);
    picks.push(index);
    if (picks.length >= 3) break;
  }
  return picks;
}

/**
 * 小光回答一个问题。
 * @returns {Promise<{answer:string, quotes:Array, practice?:object|null, provider?:string, model?:string}>}
 */
export async function chatAnswer(ctx, { question, history = [] } = {}) {
  const query = String(question || '').slice(0, MAX_QUESTION).trim();
  if (!query) return { answer: '先说一句你想问的。', quotes: [] };

  const engine = sharedEngine();
  const result = engine.compute(query);
  if (result.hedging) {
    return {
      answer: hedgingAnswer(result),
      quotes: (result.standards || []).slice(0, 1).map(normalizeQuote),
    };
  }

  const candidates = (result.candidates || []).slice(0, 8);
  const practices = (result.practices || []).slice(0, 3);
  const system = buildSystemPrompt(query);
  const target = await resolveModel(ctx);
  if (!target) return { answer: fallbackAnswer(result), quotes: (result.quotes || []).slice(0, 3).map(normalizeQuote) };

  const parsed = await askModel(ctx, target, system, buildUserPrompt(query, candidates, practices, history));
  if (!parsed) {
    return { answer: fallbackAnswer(result), quotes: (result.quotes || []).slice(0, 3).map(normalizeQuote) };
  }

  const picks = sanitizePicks(parsed.picks, candidates.length);
  const chosen = (picks.length ? picks.map((i) => candidates[i - 1]) : candidates.slice(0, 2))
    .filter(Boolean)
    .map(normalizeQuote);
  const practiceIndex = Number(parsed.practice);
  const practice =
    Number.isInteger(practiceIndex) && practiceIndex >= 1 && practiceIndex <= practices.length
      ? { ...practices[practiceIndex - 1] }
      : null;

  return {
    answer: formatAnswer(parsed.reply, chosen, practice),
    quotes: chosen,
    practice,
    provider: target.provider,
    model: target.model,
  };
}

/* ---------- 两个调用方：Agent 工具 + 浏览器路由 ---------- */

export function createAskTool(ctx) {
  return {
    name: 'xiaoguang_ask',
    description:
      '小光（记忆智能体）· 法义问答。当用户想和「小光」说话，或问修行、法义的问题' +
      '（比如"最近很烦静不下来""什么是出离心""我这样对不对"）时使用。' +
      '小光会从圣光临在开示里取原文回答：引用逐字不改，附《篇名》与日期；不判定境界、不承诺结果。' +
      '请把用户的原话和他的处境一起放进 question。',
    parameters: {
      question: {
        type: 'string',
        required: true,
        description: '修行者的原话或问题，尽量保留其用词与上下文。',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args) {
      const outcome = await chatAnswer(ctx, { question: args && args.question });
      return outcome.answer;
    },
  };
}

function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(-MAX_HISTORY)) {
    if (!item || typeof item.text !== 'string') continue;
    const role = item.role === 'assistant' ? 'assistant' : 'user';
    const text = item.text.slice(0, 800).trim();
    if (text) out.push({ role, text });
  }
  return out;
}

function jsonResponse(body, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

/** 浏览器半边调用的 Host 路由：POST /api/dapusa/chat */
export function registerChatRoute(ctx) {
  ctx.inject(['connection'], (scope) => {
    const connection = typeof scope.get === 'function' ? scope.get('connection') : scope.connection;
    const register = connection && connection.fetch ? connection.fetch.register : undefined;
    if (typeof register !== 'function') return;
    scope.effect(
      () =>
        register({
          path: '/api/dapusa/chat',
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            try {
              const body = await request.json().catch(() => null);
              const question = String((body && body.question) || '').slice(0, MAX_QUESTION).trim();
              if (!question) {
                return jsonResponse({ ok: false, error: { code: 'dapusa/bad-request', message: 'question 不能为空' } }, 400);
              }
              const history = normalizeHistory(body && body.history);
              const result = await chatAnswer(ctx, { question, history });
              return jsonResponse({ ok: true, ...result });
            } catch (error) {
              return jsonResponse(
                { ok: false, error: { code: 'dapusa/internal', message: String((error && error.message) || error) } },
                500,
              );
            }
          },
        }),
      'dapusa: chat route',
    );
  });
}
