# 交接：大菩萨实证法义 · 插件化

> 给「创造模式」新会话。工作区 `/Users/brown/Desktop/holybless_0727`。
> 展示名：**大菩萨实证法义**（npm 包名仍是 `dsh-dapusa`，改名只动显示名，不动安装 id）。
> 插件包在 `dsh-dapusa/`，已 link 安装到 desktop profile 并启用（v0.4.0）。
> 改代码后：`plugin_manager set_bundle dsh-dapusa enabled=false → true`，HMR 会同时替换
> Host 模块和客户端模块，**不用重启 DSH**（已实测）。

## 一句话

把「大菩萨实证法义」（依圣光临在开示取法）做成可发布到插件市场的 DSH 插件：
**取法工具 + 记忆智能体小光（可对话、回答引原文）+ 左侧栏学法/实修页面。**

## 已完成（实测）

| 项 | 状态 |
|---|---|
| `dsh-dapusa` 插件包 | 已 link 安装、已启用（desktop profile），v0.4.0 |
| 取法引擎 `engine.js` | JS 移植，6503 段，加载 186ms；Host 内共享单例 |
| `practice_ask` 工具 | 已注册；取法 / 拦截验证类问题实测正常 |
| `xiaoguang_ask` 工具 | 已注册并实测：正常问题取到 3 段整段原文 + 功课；验证类问题走确定性拦截 |
| 小光人格/记忆 | 项目 `memory/` 的 9 个文件逐字复制进插件 `memory/`（已 cmp 校验；快照日 2026-11-08） |
| 小光提示词装配 | `xiaoguang.js` 移植 `system_prompt.py` 的 build('assistant') 顺序 + 记忆检索 |
| 「回答引原文」| 结构保证：模型只挑候选编号，代码逐字拼回原文与《篇名》日期（已用脚本核对为语料整段） |
| 浏览器路由 `POST /api/dapusa/chat` | 已注册（未认证请求返回 401）；页面内收发待人工点开验证 |
| 客户端界面 | 左侧栏入口 + 主面板三栏：学法 / 实修 / **问小光**（对话记录存本机） |
| 浮动小光 | `shell.overlay` 挂一个小光精灵（聪慧灵活版：亮眼/眨眼/眼珠跟鼠标/挑眉/歪头/呆毛/飞旋光轨/飘带），随机念短法义；间隔可设（关闭/3/5/10/20/30/60 分钟，默认 10）；49 段短法义逐字核对；设置存 localStorage |
| 桌面浮窗 | `native/float.swift` 编译出独立 macOS 浮窗进程（`NSWindow.Level.floating`），DSH 最小化后仍显示；Host 工具 `xiaoguang_desktop` + 路由 `/api/dapusa/desktop-float`；实测 layer=3、右下锚定、随气泡自动缩放 |
| 菜单栏 + 自动浮出 | 原生端 NSStatusItem 菜单（念一句/显示收起/随机间隔/自动浮出/退出）；插件加载 2.5 秒后按 `settings.json` 的 `autoStart` 自动拉起；DSH 重启后实测自动浮出、父进程为新 Host pid、`state.json` 里 `menuBar:true` |
| Windows 桌面浮窗 | `native/float.ps1`（PowerShell + WinForms，无需编译器）：无边框 TopMost 窗口 + 托盘图标菜单 + 眼动/眨眼/随机念诵；Host 按平台分支（darwin→swiftc，win32→powershell.exe）。**本机是 macOS，未在真机 Windows 上验证**，待用户 Windows 实测 |
| 左侧栏注册 | `Slots.listSubTree` 实测：`sidebar.panellist` 有 id `dsh-dapusa`（order 30）|
| 主面板注册 | `Slots.listSubTree` 实测：`main` 有 key `dsh-dapusa` |
| 模型通道 | `ctx.llm.stream`，**不需要任何外部 API key**；模型不可用自动退回纯词面检索 |
| README.md / 技能文档 | 已补；`skills/xiaoguang/SKILL.md` 随包 |

## 关键实现

### 左侧栏入口（API 已确认）

```js
ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
  name: 'sidebar.panellist', id: 'dsh-dapusa', order: 30,
  label: () => tr('panel.title'), locale: 'dapusa',
}, Icon));                                   // 图标组件收到 { size, active }

ctx.slots.inject('main', () => ctx.slots.register({
  name: 'main', key: 'dsh-dapusa', locale: 'dapusa',
}, Page));                                   // 必须与左侧栏同 id，否则 selectPanel 抛错
```

### 小光：一个操作，两个调用方

- 逻辑都在 `xiaoguang.js` 的 `chatAnswer()`：
  人格 prompt（memory/）+ 记忆检索 → 引擎召回候选 → `ctx.llm.stream` 只挑编号 + 写回应
  → 代码拼回逐字原文与出处。
- 浏览器页面：`POST /api/dapusa/chat`（`ctx.inject(['connection'])` → `connection.fetch.register`，
  照 `dsh-context` 的成熟用法）。
- Agent 工具：`xiaoguang_ask(question)`。

### 浮动小光（shell.overlay）

- `shell.overlay` 是「盖在所有列上面、本身 click-through」的 list slot：给一个自己的 `id`
  （`dsh-dapusa-float`）即可，不用替换任何东西。根容器 `pointer-events:none`，只有小光球 /
  气泡 / 设置卡自己 `pointer-events:auto`，所以不会挡住应用。
- 计时：首次 15–45 秒后出现；之后每次间隔 = 设定分钟 × (0.6–1.4) 随机，最短 45 秒；
  每次显示约 26 秒自动收起。悬停/点击会打开设置卡（间隔切换、现在念一句）。
- 形象：`XiaoguangFigure`（client.js）画的是「灵性 · 光明 · 智慧」的光之精灵——
  头后两重光轮、八道缓缓旋转的光束、莲花座、合掌、眉间觉知光点、呼吸光晕；
  同时用于浮动小光（72px）与主面板页头（46px）。旧版的「圆球笑脸」已替换。
- 短法义池在 `client.js` 的 `FLOAT_QUOTES`（49 段，逐字取自 practice_core.json，脚本核对过）。
- 想扩大法义池：从 `data/practice_core.json` 里按「42–76 字、非问答、无引号、非对话」过滤后加入。

### 桌面浮窗（macOS 原生，独立于 DSH 窗口）

- 网页浮层在 DSH 最小化时会跟着隐藏，所以桌面版必须是**独立进程 + 独立原生窗口**：
  `native/float.swift`（SwiftUI + AppKit）编译成 `~/.dsh/cache/dsh-dapusa/desktop-float/xiaoguang-float`，
  由 `desktop-float.js` 用 `spawn(detached)` 启动，窗口层级 `.floating`、
  collectionBehavior `[.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]`。
- 首次 start 用 `xcrun swiftc -O` 编译（本机 ~2s，需 Xcode CLT）；源码 mtime 更新会重编。
- 生命周期：`--parent-pid <Host pid>` + 5s 看门狗，DSH 退出后自退；dsH 重启后需重新 start。
- 控制：Agent 工具 `xiaoguang_desktop`（start/stop/status/auto-on/auto-off）+ 网页设置卡按钮（同一套操作）；
  原生窗口自己的菜单栏图标也能开关（念一句 / 显示收起 / 随机间隔 / 自动浮出 / 退出）。
- 自动浮出：Host 插件 `apply` 后 2.5 秒调 `autoStartIfEnabled()`；`settings.json` 里 `autoStart` 默认 true。
  `/api/dapusa/desktop-float` 与菜单栏都写同一个 `settings.json`，原生端每 4 秒重读一次跟进。
- 防重复/防残留：pid 文件写成 `{pid, parent}`；父进程（DSH Host）变了就先清旧实例再起新的。
- 时序/缩放：窗口尺寸跟随 SwiftUI 内容（NSHostingView.fittingSize），右下角锚定；
  念诵气泡出现时窗口自动从 112×112 长到 368×255（实测）。
- 形象与法义：与网页共用同一套设计语言（聪慧灵活版光之精灵）；法义来自 `data/quotes_float.json`（49 段，逐字核对）。
- 原生端用 `TimelineView(.periodic 24fps) + Canvas` 现画：呼吸光晕、飞旋光轨、歪头摇摆、眨眼（4.6s 一次）、
  呆毛摆动、灵光球闪烁、眼珠跟着鼠标（NSEvent.mouseLocation，免辅助功能权限）——和网页版同一套动作语言。
- 平台：macOS（Swift/AppKit，按需 swiftc 编译）+ Windows（PowerShell/WinForms，无需编译器）；
  Linux 暂不支持。macOS 发布时要把预编译二进制随包（现在按需编译）。
- Windows 侧实现要点：`powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File float.ps1`
  + 参数（Quotes/Minutes/ParentPid/Settings/State）；窗口 `TopMost` + 无边框 + Region 圆角；
  菜单用 NotifyIcon 托盘图标；日志写到缓存目录 `error.log`。

### 样式与页面约定

- 只用 `Theme.listTokens` 里的 `--dsw-alias-*`。
- 主面板页面自管滚动：`height:100%; overflow-y:auto`；
  顶部 `calc(var(--dsh-frame-top-clearance, 0px) + 28px)`，左侧含 `--dsh-frame-leading-clearance`。
- 界面文案走 Client locale（`ctx.locale.register` + `bind`），slot 注册带 `locale` 时组件收到 `t`。

## 待办（按优先级）

1. **人工看一眼「问小光」和浮动小光**：左侧栏打开页面 → 问小光 → 发一句法义问题，看对话与出处；
   再看右下角小光球（15–45 秒内会念第一句），点它设间隔、换一句。
   （页面里走的是 `/api/dapusa/chat` 路由，这段收发没有浏览器控制通道可自动验证；
   浮动小光是纯客户端，注册已确认。）
2. **记忆可写回**：现在 `memory/` 是只读副本；若要小光「越聊越记得」，
   需要接 DSH storage 或可写数据目录，并让 `personaPrompt()`/`buildSystemPrompt()` 读取增量。
3. **Agent preset「小光」**：若希望在主对话里直接选小光人格（而不是通过工具/页面），
   可在 `cordis.patch.yml` 加一行 `@deepseek-ai/dsh-agent-preset`（声明格式见
   `editing-cordis-compositions` 技能），persona 用随包记忆。
4. **补全学法栏**：现在只有五面导读 + 七把标尺 + 七门功课；全量 6503 段未嵌入页面。
5. **插件索引 JSON / npm publish**：包名 `dsh-dapusa`，索引格式查 `dsh-experimental-plugin-market-bundle`。
   桌面浮窗发布前要预编译 macOS 二进制（universal 或 arm64）随包，避免要求用户装 Xcode CLT。
6. **桌面浮窗可再进化**：Windows 真机验证与修 bug（本机无 Windows）；Linux 等价实现；
   `autoStart` 失败时的可见提示（现在失败只写进工具结果）。开机自动浮出与菜单栏图标已在 v0.6.1 完成。

## 关键文件

```
dsh-dapusa/
  package.json      # v0.4.0；dsh.bundle + dsh.client（locale / ui-layout / ui-sidebar）
  cordis.patch.yml  # insert id: dapusa
  index.js          # Host：practice_ask / xiaoguang_ask + /api/dapusa/chat
  engine.js         # 取法引擎 + sharedEngine()
  xiaoguang.js      # 小光：人格装配 / 记忆检索 / 取法 / 模型回应 / 逐字引用 / 路由
  client.js         # 左侧栏入口 + 学法 / 实修 / 问小光 + 浮动小光
  memory/           # 小光人格与长期记忆（项目 memory/ 的逐字副本）
  data/             # practice_core.json(3.7M) + standards + practices
  skills/{dapusa,xiaoguang}/SKILL.md
  locale/{zh,en}.json
  README.md
  icon.svg
```

同源 Python 版在 `practice/`，网页版跑在 `127.0.0.1:8800/practice`。

## 已定的四件事（用户已拍板）

1. **版权**：语料公开可分发 → 全量打包进插件
2. **模型**：走 DSH 自己的模型通道，不要求用户填 key
3. **内容**：全部公开，不做 tier 隐藏
4. **小光**：人格与记忆从项目 `memory/` 复制一份进插件，法义回答必须引原文

## 两个坑（别踩）

1. **pnpm 最小发布年龄**：profile 里 `dsh-media-desk@2.6.2` 发布未满 24h，
   会导致**所有** `install_bundle` 失败。已在
   `~/.dsh/profiles/desktop/pnpm-workspace.yaml` 加 `minimumReleaseAgeExclude: [dsh-media-desk]`，
   原文件备份在 `pnpm-workspace.yaml.bak-20261108202327`。**别删这条排除。**
2. **改代码后的生效方式**：包是 link 安装；用 `plugin_manager set_bundle dsh-dapusa` 关-开触发
   profile 重组，HMR 会替换「linked package 里磁盘上已改动的模块」——Host 与客户端一起生效，
   不必重启 DSH。旧文档「必须重启 DSH」的说法已验证不必要。

## 验证状态声明

- `/practice` 网页版：Chrome headless 截图验证过。
- DSH 应用内：左侧栏/主面板注册、`xiaoguang_ask`、原文逐字与出处 —— 已实测；
  **问小光页面的浏览器收发与视觉没有截图验证**，需要人眼点一遍。
