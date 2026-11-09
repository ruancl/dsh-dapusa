/**
 * dsh-dapusa — 大菩萨实证法义（Host 半边）
 *
 * 两个工具：
 *   practice_ask   输入一句当下状态，返回取法（原文，逐字）/ 功课 / 检验标尺。
 *   xiaoguang_ask  小光（记忆智能体）与修行者对话，解答法义提问；
 *                  人格与记忆来自随包的 ./memory/，回答逐字引用原文并附出处。
 *   xiaoguang_desktop  小光的桌面浮窗（macOS 原生窗口，浮在最上层，DSH 最小化后仍显示）。
 *
 * 另外注册浏览器路由：
 *   POST /api/dapusa/chat           左侧栏「问小光」页面
 *   POST /api/dapusa/desktop-float  浮动小光设置卡里的「桌面浮窗」开关
 * 语义重排走 Harness 自己的模型通道（ctx.llm），不需要任何外部 API key。
 * 模型不可用时自动降级为纯词面检索，工具照常可用。
 */
import { sharedEngine } from './engine.js';
import { createAskTool, registerChatRoute } from './xiaoguang.js';
import { autoStartIfEnabled, createDesktopTool, registerDesktopRoute } from './desktop-float.js';

function engine() {
  return sharedEngine();
}

const RERANK_PROMPT = `你是"取法"助手。修行者描述了他当下的状态，下面是从圣光临在开示中召回的候选段落。

任务：**只做挑选，不做任何改写**。

挑选标准（按重要性）：
1. 能直接对治或点破他当下的状态
2. 优先"可以拿去做"的见地或方法，而不是别人的故事
3. 排除：学生提问、第三人称叙述、与状态无关的内容
4. 宁可少选，不可硬凑

候选段落：
{cands}

只输出 JSON，不要任何解释文字：
{"picks":[编号],"why":"一句话说明"}

picks 最多 3 个，至少 1 个；编号必须来自上面。`;

async function resolveModel(ctx, config) {
  if (config.provider && config.model) return { provider: config.provider, model: config.model };
  const llm = ctx.get ? ctx.get('llm') : ctx.llm;
  if (!llm || typeof llm.listProviders !== 'function') return null;
  try {
    const providers = llm.listProviders();
    if (!providers?.length) return null;
    const provider = config.provider || providers[0].id;
    if (config.model) return { provider, model: config.model };
    const models = await llm.listModels(provider);
    const pick = models?.find((m) => m.id) || null;
    return pick ? { provider, model: pick.id } : null;
  } catch {
    return null;
  }
}

async function rerank(ctx, config, question, candidates) {
  if (config.rerank === false || !candidates.length) return null;
  const llm = ctx.get ? ctx.get('llm') : ctx.llm;
  if (!llm || typeof llm.stream !== 'function') return null;
  const target = await resolveModel(ctx, config);
  if (!target) return null;

  const lines = candidates.map((c, i) => `${i + 1}: ${c.text}`).join('\n');
  let text = '';
  try {
    for await (const chunk of llm.stream({
      provider: target.provider,
      model: target.model,
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: RERANK_PROMPT.replace('{cands}', lines) }],
      }],
    })) {
      if (chunk?.type === 'text-delta' && chunk.text) text += chunk.text;
    }
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const obj = JSON.parse(m[0]);
    const idx = (obj.picks || [])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= candidates.length)
      .slice(0, 3);
    if (!idx.length) return null;
    return { picks: idx.map((n) => candidates[n - 1]), why: String(obj.why || '') };
  } catch {
    return null;
  }
}

function format(question, result, rerankInfo) {
  const out = [];
  out.push(`问：${question}`);
  if (result.locate.length) {
    out.push(`定位（仅供参考）：更靠近「${result.locate[0].name}」这一面。`);
  }

  const quotes = rerankInfo ? rerankInfo.picks : result.quotes;
  if (quotes.length) {
    out.push('', '【取法】（原文，一字未改）');
    for (const q of quotes) out.push(`「${q.text}」\n——《${q.title}》${q.date}`);
  } else {
    out.push('', '【取法】没有找到相应的开示。');
  }

  if (result.practices.length) {
    out.push('', '【功课】');
    for (const p of result.practices) {
      out.push(`· ${p.name} ——《${p.title}》${p.date}\n  ${p.meaning}`);
    }
  }

  if (result.standards.length) {
    for (const s of result.standards) {
      out.push('', `【标尺·${s.name}】`, `「${s.text}」——《${s.title}》${s.date}`,
        `这把尺照的是：${s.meaning}`, '此刻的心，符合这把尺吗？');
    }
  }

  if (result.hedging) {
    out.push('', '【提醒】你在问「验证」类的问题。这里不能回答。',
      '七把标尺没有一把是境界指标——想验证境界，本身即是执着。能做的只有：拿上面的尺，回头照自己。');
  }
  return out.join('\n');
}

export function apply(ctx, config = {}) {
  const tool = {
    name: 'practice_ask',
    description:
      '大菩萨实证法义·取法。当用户描述当下的修行状态、障碍、烦恼（烦躁、放不下、静不下来、' +
      '怀疑、懈怠等），或问"我这样对不对""我到了哪一层"时使用。从圣光临在开示中取原文，' +
      '并给出可做的功课与检验标尺。原文逐字不改，不判定境界、不承诺结果。',
    parameters: {
      question: {
        type: 'string',
        required: true,
        description: '修行者描述当下状态的原话，尽量保留其用词。',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args) {
      const question = String(args.question || '').slice(0, 200).trim();
      if (!question) return '请先写一句当下的状态。';

      const e = engine();
      const result = e.compute(question);
      const info = await rerank(ctx, config, question, result.candidates);
      return format(question, result, info);
    },
  };

  if (ctx.tools && typeof ctx.tools.register === 'function') {
    ctx.effect(() => ctx.tools.register(tool));
    // 小光：同一个回答逻辑，Agent 工具 + 浏览器页面两个调用方
    const askTool = createAskTool(ctx);
    ctx.effect(() => ctx.tools.register(askTool));
    const desktopTool = createDesktopTool();
    ctx.effect(() => ctx.tools.register(desktopTool));
  }

  registerChatRoute(ctx);
  registerDesktopRoute(ctx);

  // DSH 启动（以及插件热重载）后：如果开着「自动浮出」，把桌面小光拉起来
  ctx.effect(() => {
    const timer = setTimeout(() => {
      Promise.resolve(autoStartIfEnabled()).catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, 'dapusa: desktop float autostart');
}

export const inject = ['tools'];
