#!/usr/bin/env node
/**
 * 生成/更新插件市场索引（Plugin Market Index format 1）。
 *
 * 用法：
 *   node scripts/make-market-index.mjs                 # 用当前 HEAD 与 package.json version
 *   node scripts/make-market-index.mjs --commit <sha>  # 指定要安装的代码 commit
 *   node scripts/make-market-index.mjs --timestamp 1794000000
 *
 * 发布新版本流程：改代码 → 提交 → node scripts/make-market-index.mjs → 提交 market/index.json → push。
 * 索引里 pin 的 commit 是「代码 commit」，所以先提交代码、再生成索引。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const REPO = 'https://github.com/ruancl/dsh-dapusa';

const argv = process.argv.slice(2);
const flag = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};

const commit = flag('--commit') || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const publishTimestamp = flag('--timestamp') ? Number(flag('--timestamp')) : Math.floor(Date.now() / 1000);

if (!/^[0-9a-f]{40}$/.test(commit)) {
  console.error('commit 必须是 40 位小写十六进制 SHA');
  process.exit(1);
}

const title = { en: 'Mahayana Bodhisattva Realization', zh: '大菩萨实证法义' };
const description = {
  en: 'Dharma Q&A drawn verbatim from the Holy Light teachings, a memory agent named Xiao Guang, a floating companion, and a desktop always-on-top light sprite.',
  zh: '依圣光临在开示取法：法义问答逐字引用原文、记忆智能体小光、网页浮动小光与桌面置顶精灵。',
};

const index = {
  format: 1,
  title,
  description,
  metadata: {
    categories: { dharma: { title: { en: 'Dharma', zh: '修行' } } },
    labels: {
      agent: { title: { en: 'Agent', zh: '智能体' } },
      desktop: { title: { en: 'Desktop', zh: '桌面' } },
    },
  },
  plugins: [
    {
      name: pkg.name,
      title,
      description: {
        en: 'Dharma Q&A with verbatim quotes, a memory agent, a floating Xiao Guang and a macOS/Windows always-on-top desktop sprite.',
        zh: '法义问答（原文逐字引用）+ 记忆智能体小光 + 网页浮动小光 + macOS/Windows 桌面置顶精灵。',
      },
      icon: 'icon.webp',
      author: 'ruancl',
      homepage: REPO,
      repository: { url: REPO },
      metadata: {
        category: 'dharma',
        keywords: ['dsh', 'dharma', 'buddhism', 'xiaoguang', '小光', '法义'],
        labels: ['agent', 'desktop'],
      },
      versions: [
        {
          version: pkg.version,
          publishTimestamp,
          source: { type: 'git', url: REPO, commit },
          engines: { dsh: '>=0.2.0-rc.1 <0.3.0' },
        },
      ],
    },
  ],
};

mkdirSync(join(ROOT, 'market'), { recursive: true });
writeFileSync(join(ROOT, 'market', 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`market/index.json: ${pkg.name}@${pkg.version} -> ${commit.slice(0, 7)}`);
