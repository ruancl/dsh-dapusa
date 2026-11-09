# dsh-dapusa · 大菩萨实证法义

依「圣光临在」开示（[cmsmt.holybless.net](https://cmsmt.holybless.net)）取法的 DSH 插件。**原文一字不改，不判定境界。**

## 三样东西

| 部分 | 内容 |
|---|---|
| 取法工具 | `practice_ask`：说一句当下状态 → 取法（原文逐字）/ 功课 / 检验标尺。 |
| 记忆智能体小光 | 左侧栏「问小光」页面 + `xiaoguang_ask` 工具：和修行者对话、解答法义提问。人格与长期记忆是项目 `memory/` 的逐字副本（随包 `memory/`），回答由代码把原文逐字拼回并附《篇名》日期。 |
| 学法 / 实修页 | 左侧栏入口打开的主面板页面：五面导读、七把标尺、七门功课；修行记录存本机。 |

模型全部走 DSH 自己的模型通道（`ctx.llm`），**不需要任何外部 API key**；模型不可用时自动退回纯词面检索。

## 桌面浮窗（原生窗口，DSH 最小化也显示；macOS / Windows）

网页里的小光挂在 DSH 的 Web 层，DSH 一最小化就看不见了。桌面版是**另一个独立进程 + 原生窗口**：

- **macOS**：`native/float.swift`（SwiftUI + AppKit）编译成一个 `NSWindow.Level.floating` 窗口，画的是 `assets/xiaoguang.png`，
  浮在所有普通窗口最上层、`canJoinAllSpaces`（切换桌面也都在），DSH 最小化照常显示。
- **Windows**：`native/float.ps1`（PowerShell + WinForms，**不需要编译器**）创建一个无边框、同样画 `assets/xiaoguang.png` 的
  `TopMost` 的原生窗口，同样浮在所有窗口最上层；菜单在系统托盘图标里。
- 随机念短法义、点小光改间隔、换一句、退出——都在桌面窗口里完成。
- **菜单栏/托盘图标**：念一句法义 / 显示·收起小光 / 随机间隔 / **DSH 启动时自动浮出** / 退出小光。
- **DSH 启动自动浮出**：默认开启。`settings.json` 里 `autoStart: true` 时，插件每次加载
  （DSH 启动或插件重载）会在 2.5 秒后自动把桌面小光拉起来；想关就从菜单栏或网页开关关掉。
- 打开方式：跟小光/智能体说「打开桌面小光」（工具 `xiaoguang_desktop`），
  或点网页浮动小光的设置卡 →「桌面浮窗 → 打开」；自动浮出开关在同一张卡里。
- macOS 首次打开时用 `xcrun swiftc -O` 编译到 `~/.dsh/cache/dsh-dapusa/desktop-float/xiaoguang-float`
  （本机约 2 秒；需要 Xcode Command Line Tools）。Windows 直接运行 PowerShell 脚本，无需编译。
- 生命周期：以 `--parent-pid <DSH Host pid>` 启动，DSH 退出后 5 秒内自退；
  pid 记录带父进程，DSH 重启后旧实例会被清掉、新实例由自动浮出接管，不会叠出两只。
- 设置与状态（Host 与原生端共用）：`~/.dsh/cache/dsh-dapusa/desktop-float/settings.json`（自动浮出/间隔）、
  `state.json`（每 4 秒由原生端写入：窗口是否可见、菜单栏是否就绪）。
- 限制：目前支持 macOS 与 Windows（Linux 暂不支持）；macOS 发布到插件市场时需要预编译二进制（本机是按需编译）。

## 浮动小光

一颗浮在界面右下角的小光精灵（挂在 `shell.overlay`，盖在所有栏上面、不挡操作）。
形象用用户提供的**精灵图**：白绒小精灵、大眼睛、透明翅膀、金色饰纹、头顶一颗灵珠，
背景是柔和金白光晕（`assets/xiaoguang.png` 全身，`assets/xiaoguang-avatar.webp` 头像）。
网页里给它加了轻微漂浮 + 呼吸光晕；页头/侧栏用头像；插件图标是同一张（`icon.webp`，256px）。
桌面原生浮窗（macOS / Windows）也从 `assets/xiaoguang.png` 加载同一形象，外面加光晕和轻微上下浮动。
`prefers-reduced-motion` 下动画静止。

- 每隔一段**随机时间**念一句短法义，约 26 秒后自己收起来；点小光随时打开设置。
- 间隔可设：关闭 / 3 / 5 / 10 / 20 / 30 / 60 分钟（默认 10 分钟，实际间隔在 0.6–1.4 倍之间随机）。
- 短法义池 49 段，逐字取自 `data/practice_core.json`，已用脚本核对；每次随机不重复上一句。
- 设置存本机 `localStorage`（键 `dapusa.xiaoguang.float.v1`），只影响当前浏览器。

## 目录

```
dsh-dapusa/
  package.json      # dsh.bundle + dsh.client（locale / ui-layout / ui-sidebar）
  cordis.patch.yml  # insert id: dapusa
  index.js          # Host：注册 practice_ask / xiaoguang_ask，挂 /api/dapusa/chat 路由
  engine.js         # 词面取法引擎（字符二元组 + IDF），进程内共享实例
  xiaoguang.js      # 小光：人格提示词装配 + 记忆检索 + 取法 + 模型回应 + 逐字引用保证
  client.js         # 左侧栏入口 + 主面板页面（学法 / 实修 / 问小光）+ 浮动小光
  desktop-float.js  # 桌面浮窗：编译/启动/停止原生小光 + 工具 xiaoguang_desktop + 路由
  native/float.swift # 桌面浮窗本体（SwiftUI/AppKit 原生窗口）
  data/quotes_float.json # 49 段短法义（Native 与网页共用内容源）
  memory/           # 小光人格与长期记忆（项目 memory/ 的逐字副本）
  data/             # practice_core.json（6503 段）· standards.json · practices.json
  skills/dapusa/    # 取法技能文档
  skills/xiaoguang/ # 小光技能文档
  assets/           # 小光精灵形象（全身 + 头像，webp/png）
  icon.webp         # 插件图标（精灵头像 256px）
  locale/{zh,en}.json  # 插件管理页显示用的 meta
  icon.svg
```

## 小光怎么保证「回答引原文」

不靠模型自觉，靠结构：

1. 取法引擎从 6503 段语料召回候选段落、候选功课；
2. 模型只做两件事：挑候选编号 + 写一段回应（**不许写原文、不许写出处**）；
3. 代码把挑中的原文与《篇名》日期逐字拼回。

提示词装配顺序与项目 `memory/system_prompt.py` 的 `build('assistant')` 一致：
`IDENTITY → SOUL → USER → RULES → 任务说明 → MEMORY（+ 按提问检索相关记忆）`。

`memory/` 是 2026-11-08 从项目 `memory/` 复制的快照；项目记忆更新后需重新复制（人格文件缓存，需关-开 bundle）。

> **公开仓库版**只带人格四件套（IDENTITY/SOUL/USER/RULES）；私人记忆与内部档案（MEMORY/PROJECT/CHANGELOG/ARCHITECTURE）不随公开仓库分发，插件运行时读不到会自动跳过。
`MEMORY.md` / `RULES.md` / `PROJECT.md` 每次对话按需读盘，改完立即生效；
`IDENTITY.md` / `SOUL.md` / `USER.md` / `RULES.md` 的人格部分在模块加载时缓存，改完需关-开 bundle。

两个调用方共用同一套逻辑（`chatAnswer`）：
- 左侧栏「问小光」页面 → `POST /api/dapusa/chat`
- 任何会话的 Agent → 工具 `xiaoguang_ask`

## 左侧栏入口怎么挂的

```js
// 图标进左侧栏（图标组件拿到 { size, active }）
ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
  name: 'sidebar.panellist', id: 'dsh-dapusa', order: 30,
  label: () => t('panel.title'), locale: 'dapusa',
}, SidebarIcon));

// 同一 id 指向布局的主面板
ctx.slots.inject('main', () => ctx.slots.register({
  name: 'main', key: 'dsh-dapusa', locale: 'dapusa',
}, Page));
```

左侧栏按钮由壳层渲染并调用 `ctx.layout.selectPanel(id)`；`main` 里没有同 id 的注册时选择会抛错，所以两处必须一起注册。

## 原文

页面上的七把标尺、七门功课与对话里引用的段落都是**原样数据**，与 `data/*.json`、
`data/practice_core.json` 里的 `text` 字段逐字一致（已用脚本比对）；出处为《篇名》+ 日期。

## 安装（其他用户）

**推荐：从 GitHub 直接装**

1. 打开 DSH 左侧栏 **插件** → **Add plugin**（添加插件）
2. 填 Git 地址：`github:ruancl/dsh-dapusa`
   （或 `https://github.com/ruancl/dsh-dapusa`）
3. **Install** → 等 pnpm 装完；安装会默认启用这个 bundle
4. 左侧栏出现「大菩萨实证法义」即可用；界面没刷新就重启一次 DSH

也可以让 DSH 里的智能体装：直接说「安装插件 github:ruancl/dsh-dapusa」。

**其他装法**

```bash
git clone https://github.com/ruancl/dsh-dapusa.git
# 然后插件页 Add plugin 填这个本地目录的绝对路径
```

**装之前要知道的**

- 插件装在当前 DSH profile，对所有会话生效；首次安装/升级后建议重启一次 DSH
- 模型走 DSH 自己的模型通道，**不需要任何 API key**；模型不可用时自动退化为词面检索
- **桌面浮窗（小光浮在桌面最上层）支持 macOS 和 Windows**：
  macOS 需要 Xcode Command Line Tools（首次自动用 `xcrun swiftc` 编译，约 2 秒）；
  Windows 用系统自带的 PowerShell，**不需要装任何编译工具**；
  「DSH 启动自动浮出」默认开，可在菜单栏/托盘或设置卡里关
- 公开仓库只带小光人格四件套（IDENTITY/SOUL/USER/RULES），**不带私人长期记忆**；
  想给它自己的记忆，在插件目录 `memory/MEMORY.md` 里写就行（格式照 `MEMORY.md` 条目）
- 卸载：插件页找到 `dsh-dapusa` → 关闭 / 移除

> 还没上 npm 和插件市场索引；以后会补 `npm publish` 和 Index JSON，那之后可以一键从市场装。

## 安装（本机开发）

```bash
# 插件包已 link 到 profile，改完代码：
#   1) 在插件页把 dsh-dapusa 关掉再打开（HMR 会替换 Host 模块 + 客户端模块）
#   2) 或重启 DSH 应用
```

## 验证状态

- `practice_ask`：实测取法 / 拦截验证类问题正常。
- `xiaoguang_ask`：实测正常，回答里的原文经脚本核对为语料整段逐字，出处与篇名日期一致。
- `/api/dapusa/chat`：与工具共用 `chatAnswer`；路由已注册（未认证请求返回 401），
  页面内的收发需在 GUI 点开「问小光」实测。
- 左侧栏入口 / 主面板：`cordis_inspect_query` → `Slots.listSubTree` 已在实时页面确认。
- 浮动小光：`shell.overlay` 实时确认有 id `dsh-dapusa-float`（order 40）；49 段短法义逐字核对通过。
  视觉与计时未截图验证（没有浏览器控制通道）。
- 桌面浮窗（macOS）：`xiaoguang_desktop start` 实测拉起进程；CGWindowList 核对窗口
  `layer=3`（floating，浮层）、右下角锚定、念诵时随气泡自动缩放；stop 后进程与窗口都消失。
- 自动浮出：DSH 重启后实测——桌面小光由插件自动拉起（父进程 = 新的 DSH Host pid），
  `state.json` 里 `menuBar: true`（菜单栏图标已创建）；改设置后运行中的原生端会在几秒内跟上。
  窗口/菜单栏视觉未截图验证。
- 桌面浮窗（Windows）：`native/float.ps1` 已实现（PowerShell + WinForms，无边框 TopMost + 托盘菜单 +
  眼动/眨眼/随机念诵），Host 端按平台分支（darwin 走 swiftc，win32 走 powershell.exe）；
  **本机是 macOS，无法在 Windows 上实测**，需要在 Windows 上点一次「打开」验证，报错会写到
  `~/.dsh/cache/dsh-dapusa/desktop-float/error.log` 并在设置卡里显示。

## 版权

语料公开可分发，全量随包（`data/practice_core.json`，6503 段）。引用必须逐字，出处必须可查证。
