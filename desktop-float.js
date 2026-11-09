/**
 * 小光 · 桌面浮窗（macOS 原生窗口）
 *
 * 为什么需要它：网页里的浮动小光挂在 DSH 的 Web 层（shell.overlay），
 * 窗口一最小化就跟着看不见了。桌面版小光是一个**独立进程 + 独立 AppKit 窗口**
 * （NSWindow.Level.floating），所以能浮在所有窗口最上层，DSH 最小化后仍然显示。
 * 原生端还带一个**菜单栏图标**：念一句、显示/收起、随机间隔、开机自动浮出、退出。
 *
 * 设置文件（Host 与原生端共用）：
 *   ~/.dsh/cache/dsh-dapusa/desktop-float/settings.json   { "autoStart": true, "minutes": 10 }
 * 运行状态（原生端每 4 秒写一次）：
 *   ~/.dsh/cache/dsh-dapusa/desktop-float/state.json
 * 进程记录：同一目录的 xiaoguang-float.pid（JSON：pid + 父 DSH Host pid）
 *
 * 两个调用方（同一套操作，照 user-actions 约定）：
 *   - Agent 工具 `xiaoguang_desktop`（start / stop / status / auto-on / auto-off）
 *   - 浏览器设置卡 → POST /api/dapusa/desktop-float
 */
import { existsSync, mkdirSync, readFileSync, statSync, rmSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLATFORM = process.platform;
const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, 'native', 'float.swift');
const PS_SCRIPT = join(HERE, 'native', 'float.ps1');
const QUOTES = join(HERE, 'data', 'quotes_float.json');
const CACHE_DIR = join(homedir(), '.dsh', 'cache', 'dsh-dapusa', 'desktop-float');
const BINARY = join(CACHE_DIR, 'xiaoguang-float');
const PID_FILE = join(CACHE_DIR, 'xiaoguang-float.pid');
const QUOTES_COPY = join(CACHE_DIR, 'quotes.json');
const SETTINGS_FILE = join(CACHE_DIR, 'settings.json');
const STATE_FILE = join(CACHE_DIR, 'state.json');

const DEFAULT_SETTINGS = { autoStart: true, enabled: true, minutes: 10 };

let building = null;

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readSettings() {
  const settings = { ...DEFAULT_SETTINGS };
  const raw = readJson(SETTINGS_FILE);
  if (raw && typeof raw === 'object') {
    if (typeof raw.autoStart === 'boolean') settings.autoStart = raw.autoStart;
    if (typeof raw.enabled === 'boolean') settings.enabled = raw.enabled;
    const minutes = Number(raw.minutes);
    if (Number.isFinite(minutes) && minutes > 0) settings.minutes = Math.min(minutes, 240);
  }
  return settings;
}

function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2));
  } catch {
    /* 写不了设置文件时按内存值执行 */
  }
  return next;
}

function readPidRecord() {
  const raw = readJson(PID_FILE);
  if (raw && typeof raw === 'object' && Number.isInteger(raw.pid) && raw.pid > 0) {
    return { pid: raw.pid, parent: Number.isInteger(raw.parent) ? raw.parent : 0 };
  }
  try {
    const bare = Number.parseInt(readFileSync(PID_FILE, 'utf8'), 10);
    if (Number.isInteger(bare) && bare > 0) return { pid: bare, parent: 0 };
  } catch {
    /* 没有 pid 文件 */
  }
  return null;
}

/** 返回仍在跑的桌面小光 pid；父进程已消失的旧实例会被清理 */
function runningPid() {
  const record = readPidRecord();
  if (!record) return null;
  const childAlive = isAlive(record.pid);
  const parentAlive = record.parent === 0 || isAlive(record.parent);
  if (childAlive && parentAlive) return record.pid;
  if (childAlive) {
    try { process.kill(record.pid, 'SIGTERM'); } catch { /* 已消失 */ }
  }
  try { rmSync(PID_FILE, { force: true }); } catch { /* 清理失败无妨 */ }
  return null;
}

/** macOS：按需用 swiftc 编译原生浮窗（系统没装编译工具时给出可读提示） */
function ensureDarwinRuntime() {
  if (building) return building;
  building = new Promise((resolve, reject) => {
    try {
      mkdirSync(CACHE_DIR, { recursive: true });
      if (!existsSync(SOURCE)) throw new Error('插件缺少 native/float.swift');
      if (!existsSync(QUOTES)) throw new Error('插件缺少 data/quotes_float.json');
      const probe = spawnSync('xcrun', ['--version'], { encoding: 'utf8', timeout: 30000 });
      if (probe.error || probe.status !== 0) {
        throw new Error('没有找到 Xcode 命令行工具：请在终端运行 xcode-select --install 后再试');
      }
      const stale = !existsSync(BINARY) || statSync(BINARY).mtimeMs < statSync(SOURCE).mtimeMs;
      if (stale) {
        const result = spawnSync('xcrun', ['swiftc', '-O', '-o', BINARY, SOURCE], {
          encoding: 'utf8',
          timeout: 240000,
        });
        if (result.error) throw new Error(`编译桌面小光失败：${result.error.message}`);
        if (result.status !== 0) {
          const detail = String(result.stderr || result.stdout || '').trim().slice(0, 600);
          throw new Error(`编译桌面小光失败：${detail || `swiftc 退出码 ${result.status}`}`);
        }
      }
      writeFileSync(QUOTES_COPY, readFileSync(QUOTES));
      resolve(BINARY);
    } catch (error) {
      reject(error);
    } finally {
      building = null;
    }
  });
  return building;
}

/** Windows：不需要编译，检查系统自带的 Windows PowerShell 与脚本是否存在 */
function ensureWindowsRuntime() {
  if (building) return building;
  building = new Promise((resolve, reject) => {
    try {
      mkdirSync(CACHE_DIR, { recursive: true });
      if (!existsSync(PS_SCRIPT)) throw new Error('插件缺少 native/float.ps1');
      if (!existsSync(QUOTES)) throw new Error('插件缺少 data/quotes_float.json');
      const probe = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '$PSVersionTable.PSVersion.Major'], {
        encoding: 'utf8',
        timeout: 30000,
        windowsHide: true,
      });
      if (probe.error) throw new Error('找不到 powershell.exe：Windows 需要系统自带的 Windows PowerShell 才能显示桌面小光');
      if (probe.status !== 0) {
        const detail = String(probe.stderr || probe.stdout || '').trim().slice(0, 300);
        throw new Error(`PowerShell 不可用：${detail || '请检查系统策略是否禁止运行 PowerShell 脚本'}`);
      }
      writeFileSync(QUOTES_COPY, readFileSync(QUOTES));
      resolve(PS_SCRIPT);
    } catch (error) {
      reject(error);
    } finally {
      building = null;
    }
  });
  return building;
}

function ensureRuntime() {
  if (PLATFORM === 'darwin') return ensureDarwinRuntime();
  if (PLATFORM === 'win32') return ensureWindowsRuntime();
  return Promise.reject(new Error(`桌面浮窗目前只支持 macOS 和 Windows（当前系统：${PLATFORM}）`));
}

async function start(minutes) {
  const existing = runningPid();
  if (existing) return { ...desktopFloatStatus(), running: true, pid: existing, started: false };
  const settings = writeSettings(Number.isFinite(minutes) && minutes > 0 ? { minutes: Math.min(minutes, 240) } : {});
  try {
    await ensureRuntime();
  } catch (error) {
    return { running: false, error: String((error && error.message) || error), autoStart: settings.autoStart };
  }
  let child;
  if (PLATFORM === 'win32') {
    child = spawn(
      'powershell.exe',
      [
        '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
        '-File', PS_SCRIPT,
        '-Quotes', QUOTES_COPY,
        '-Minutes', String(settings.minutes),
        '-ParentPid', String(process.pid),
        '-Settings', SETTINGS_FILE,
        '-State', STATE_FILE,
      ],
      { detached: true, windowsHide: true, stdio: 'ignore' },
    );
  } else {
    child = spawn(
      BINARY,
      [
        '--quotes', QUOTES_COPY,
        '--minutes', String(settings.minutes),
        '--parent-pid', String(process.pid),
        '--settings', SETTINGS_FILE,
        '--state', STATE_FILE,
      ],
      { detached: true, stdio: 'ignore' },
    );
  }
  child.unref();
  if (!child.pid) return { running: false, error: '桌面小光启动失败（没有进程 id）', autoStart: settings.autoStart };
  writeFileSync(PID_FILE, JSON.stringify({ pid: child.pid, parent: process.pid }));
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (!isAlive(child.pid)) {
    return { running: false, error: '桌面小光启动后立即退出了（可能是系统权限或编译产物问题）', autoStart: settings.autoStart };
  }
  return { running: true, pid: child.pid, started: true, autoStart: settings.autoStart, windowVisible: true, menuBar: true };
}

function stop() {
  const pid = runningPid();
  if (!pid) return { running: false, stopped: false };
  try { process.kill(pid, 'SIGTERM'); } catch { /* 已经退出 */ }
  if (PLATFORM === 'win32') {
    try { spawnSync('taskkill', ['/PID', String(pid), '/F', '/T'], { timeout: 15000, windowsHide: true }); } catch { /* 已退出 */ }
  }
  try { rmSync(PID_FILE, { force: true }); } catch { /* 清理失败无妨 */ }
  try { rmSync(STATE_FILE, { force: true }); } catch { /* 清理失败无妨 */ }
  return { running: false, stopped: true, pid };
}

export function desktopFloatStatus() {
  const pid = runningPid();
  const settings = readSettings();
  const state = pid ? readJson(STATE_FILE) : null;
  const matches = state && typeof state === 'object' && state.pid === pid;
  return {
    running: Boolean(pid),
    pid: pid || null,
    autoStart: settings.autoStart,
    enabled: settings.enabled,
    minutes: settings.minutes,
    windowVisible: matches ? Boolean(state.windowVisible) : Boolean(pid),
    menuBar: matches ? Boolean(state.menuBar) : Boolean(pid),
  };
}

async function act(action, minutes) {
  const requested = String(action || 'status').toLowerCase();
  if (requested === 'start') return start(minutes);
  if (requested === 'stop') return stop();
  if (requested === 'auto-on') {
    writeSettings({ autoStart: true });
    return { ...desktopFloatStatus(), autoStart: true };
  }
  if (requested === 'auto-off') {
    writeSettings({ autoStart: false });
    return { ...desktopFloatStatus(), autoStart: false };
  }
  return desktopFloatStatus();
}

/** DSH 启动（或插件重载）后调用：设置了自动浮出就把桌面小光拉起来 */
export async function autoStartIfEnabled() {
  const settings = readSettings();
  if (!settings.autoStart) return { running: false, autoStart: false };
  return start(settings.minutes);
}

function format(result, action) {
  const requested = String(action || 'status').toLowerCase();
  if (result.error) return `桌面小光没开起来：${result.error}`;
  if (requested === 'stop') {
    return result.stopped ? '已关闭桌面小光。' : '桌面小光本来就没开。';
  }
  if (requested === 'auto-on') {
    return '已开启：以后 DSH 启动会自动浮出桌面小光（菜单栏里也能关）。';
  }
  if (requested === 'auto-off') {
    return result.running
      ? '已关闭自动浮出；当前这颗桌面小光还在，需要的话再说「关掉桌面小光」。'
      : '已关闭自动浮出，桌面小光当前没开。';
  }
  if (result.running) {
    const auto = result.autoStart ? 'DSH 启动自动浮出：开' : 'DSH 启动自动浮出：关';
    return (
      `桌面小光在跑（pid ${result.pid}）：${PLATFORM === 'win32' ? 'Windows' : 'macOS'} 原生浮窗，浮在所有窗口最上层，DSH 最小化后仍显示。` +
      `菜单栏/托盘有小光图标（念一句 / 收起 / 随机间隔 / 自动浮出 / 退出）。${auto}。`
    );
  }
  return `桌面小光当前没开（DSH 启动自动浮出：${result.autoStart ? '开' : '关'}）。可以说「打开桌面小光」来启动。`;
}

/** Agent 工具：xiaoguang_desktop(start|stop|status|auto-on|auto-off) */
export function createDesktopTool() {
  return {
    name: 'xiaoguang_desktop',
    description:
      '小光的桌面浮窗（macOS 原生窗口 / Windows 原生窗口）+ 菜单栏或托盘图标：浮在所有窗口最上层，DSH 最小化后仍然显示，' +
      '每隔一段随机时间念一句短法义。支持 DSH 启动时自动浮出。' +
      '当用户说"把小光放到桌面上 / 最小化也要看到小光 / 打开桌面小光 / 关掉桌面小光 / ' +
      '以后开机自动出现 / 不要自动出现"时使用。',
    parameters: {
      action: {
        type: 'string',
        required: true,
        description: 'start 打开 / stop 关闭 / status 查看状态 / auto-on 开启 DSH 启动自动浮出 / auto-off 关闭自动浮出',
      },
      minutes: { type: 'number', required: false, description: 'start 时指定随机念诵的基准间隔（分钟，默认 10）' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args) {
      const minutes = Number(args && args.minutes);
      const result = await act(args && args.action, Number.isFinite(minutes) && minutes > 0 ? minutes : undefined);
      return format(result, args && args.action);
    },
  };
}

/** 浏览器设置卡调用：POST /api/dapusa/desktop-float { action, minutes } */
export function registerDesktopRoute(ctx) {
  ctx.inject(['connection'], (scope) => {
    const connection = typeof scope.get === 'function' ? scope.get('connection') : scope.connection;
    const register = connection && connection.fetch ? connection.fetch.register : undefined;
    if (typeof register !== 'function') return;
    scope.effect(
      () =>
        register({
          path: '/api/dapusa/desktop-float',
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            try {
              const body = await request.json().catch(() => null);
              const minutes = Number(body && body.minutes);
              const result = await act(
                body && body.action,
                Number.isFinite(minutes) && minutes > 0 ? Math.min(minutes, 240) : undefined,
              );
              return Response.json({ ok: true, result }, { headers: { 'cache-control': 'no-store' } });
            } catch (error) {
              return Response.json(
                { ok: false, error: { message: String((error && error.message) || error) } },
                { status: 500, headers: { 'cache-control': 'no-store' } },
              );
            }
          },
        }),
      'dapusa: desktop float route',
    );
  });
}
