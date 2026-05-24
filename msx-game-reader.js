// MSX Game Reader - WebUSB dumper
//
// 対象: VID=0x1125 / PID=0xAC01 (ASCII / Sunrise 製 MSX Game Reader)
// このスクリプトは観測された USB 通信に基づき独立に再実装されたものです。

const VENDOR_ID  = 0x1125;
const PRODUCT_ID = 0xac01;

const CMD = Object.freeze({
  GetSlotStatus: 0x01,
  MemoryRead:    0x02,
  MemoryWrite:   0x03,
  IORead:        0x04,
  IOWrite:       0x05,
});

const EP_IN  = 0x82 & 0x0f; // WebUSB の transferIn は EP番号(下位4bit)を渡す
const EP_OUT = 0x02 & 0x0f;

// ============================================================
// i18n
// ============================================================

/**
 * 言語判定：
 * 1. URL `?lang=ja|en` が最優先
 * 2. なければ navigator.languages の優先順で最初にマッチした方
 *    （ja/en どちらも優先リストに無ければ en にフォールバック）
 */
function detectLocale() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl === 'ja' || fromUrl === 'en') return fromUrl;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
  for (const lang of langs) {
    const lc = (lang || '').toLowerCase();
    if (lc.startsWith('en')) return 'en';
    if (lc.startsWith('ja')) return 'ja';
  }
  return 'en';
}

const LOCALE = detectLocale();

const T = {
  ja: {
    'app.subtitle': 'MSX Game Reader を使って、実カートリッジから ROM イメージをダンプします。',
    'status.disconnected': '未接続',
    'status.connected_prefix': '接続中',
    'status.lost': '切断されました',
    'status.no_webusb': 'このブラウザは WebUSB をサポートしていません（Chrome / Edge / Opera を使ってください）',
    'db.notLoaded': 'DB: 未ロード',
    'db.loading': 'DB: ロード中…',
    'db.loaded': 'DB: {0} entries ✓',
    'db.failed': 'DB: ロード失敗',
    'btn.connect': 'Connect',
    'btn.disconnect': 'Disconnect',
    'btn.reset': 'Reset device',
    'btn.connect': '🔌 Connect',
    'btn.autoDump': '📀 自動マッパー判定 + ダンプ',
    'section.connect': '<span class="step-num">STEP 1</span> デバイスを接続',
    'btn.download': '↓ Download',
    'btn.showHex': 'Show hex preview',
    'btn.hideHex': 'Hide hex preview',
    'section.autoDump': '<span class="step-num">STEP 2</span> カートリッジを自動ダンプ',
    'autoDump.maxScan': '最大スキャン:',
    'autoDump.hint': '（実 ROM が小さければ自動的に早期停止）',
    'section.lastResult': '直近のダンプ結果',
    'result.empty': 'まだダンプしていません。上の「自動マッパー判定 + ダンプ」ボタンを押してください。',
    'result.unknownTitle': '(未知の ROM)',
    'result.unknownSubtitle': 'SHA-1 が openMSX softwaredb にありません',
    'field.mapper': 'マッパー (判定結果)',
    'field.mapperDb': 'マッパー (DB の期待値)',
    'field.size': 'サイズ',
    'field.timeSpeed': '時間 / 速度',
    'field.trim': 'トリム',
    'field.romHeader': 'ROM ヘッダ',
    'header.notFound': '(「AB」シグネチャなし)',
    'mapperDb.ok': '✓',
    'mapperDb.mismatch': '⚠ 検出と DB が不一致 (バイナリは DB と一致しているのでダンプ自体は正しい)',
    'section.history': 'このセッションのダンプ履歴',
    'history.col.num': '#',
    'history.col.title': 'タイトル',
    'history.col.mapper': 'マッパー',
    'history.col.size': 'サイズ',
    'history.col.db': 'DB',
    'history.tooltipDl': '再ダウンロード',
    'history.unknown': '(未知)',
    'section.advanced': '🛠 Advanced（個別テスト・プレーン dump・マッパー判定）',
    'advanced.connectivity': '疎通テスト',
    'advanced.plainDump': 'プレーン ROM 専用ダンプ（マッパー無しカートリッジのみ）',
    'advanced.chunkSize': 'チャンクサイズ:',
    'advanced.detectOnly': 'マッパー判定のみ実行',
    'advanced.detectBtn': 'マッパー種別を判定（ダンプはしない）',
    'btn.dumpCart32': 'カートリッジ領域 (32KB: 0x4000–0xBFFF)',
    'btn.dumpFull64': 'メモリ全域 (64KB)',
    'section.log': '📜 Log',
    'browser.notice': '<b>ブラウザ:</b> WebUSB API が必要です。<b>Chrome / Edge / Opera</b> など Chromium 系ブラウザでお使いください（Safari / Firefox は非対応）。',
    'winusb.notice': '<b>Windows:</b> デバイス選択肢に出ない場合は WinUSB ドライバを当ててください → <a href="./install-winusb.html">インストールガイド</a>',
    'winusb.link': 'インストールガイド',
    'macos.notice': '<b>macOS 26 (Tahoe) 以降 / Android:</b> OS の USB 制限により、デバイスは認識されるものの制御転送が timeout する症状が確認されています。<b>実機 Windows または Linux でのご利用を推奨します</b>。',
    'cart.notInserted': 'カートリッジが装着されていません',
  },
  en: {
    'app.subtitle': 'Dumps ROM images from real MSX cartridges using the MSX Game Reader.',
    'status.disconnected': 'Not connected',
    'status.connected_prefix': 'Connected',
    'status.lost': 'Device disconnected',
    'status.no_webusb': 'This browser does not support WebUSB. Use Chrome / Edge / Opera.',
    'db.notLoaded': 'DB: not loaded',
    'db.loading': 'DB: loading…',
    'db.loaded': 'DB: {0} entries ✓',
    'db.failed': 'DB: load failed',
    'btn.connect': '🔌 Connect',
    'btn.disconnect': 'Disconnect',
    'btn.reset': 'Reset device',
    'btn.autoDump': '📀 Auto-detect & dump',
    'section.connect': '<span class="step-num">STEP 1</span> Connect the device',
    'btn.download': '↓ Download',
    'btn.showHex': 'Show hex preview',
    'btn.hideHex': 'Hide hex preview',
    'section.autoDump': '<span class="step-num">STEP 2</span> Auto-dump cartridge',
    'autoDump.maxScan': 'Max scan:',
    'autoDump.hint': '(Will stop early if actual ROM is smaller)',
    'section.lastResult': 'Latest dump result',
    'result.empty': 'No dump yet. Click "Auto-detect & dump" above.',
    'result.unknownTitle': '(Unknown ROM)',
    'result.unknownSubtitle': 'SHA-1 not found in openMSX softwaredb',
    'field.mapper': 'Mapper (detected)',
    'field.mapperDb': 'Mapper (DB expected)',
    'field.size': 'Size',
    'field.timeSpeed': 'Time / Speed',
    'field.trim': 'Trim',
    'field.romHeader': 'ROM header',
    'header.notFound': '(no "AB" signature)',
    'mapperDb.ok': '✓',
    'mapperDb.mismatch': '⚠ detected/DB mismatch (binary matches DB, dump is correct)',
    'section.history': 'This session\'s dump history',
    'history.col.num': '#',
    'history.col.title': 'Title',
    'history.col.mapper': 'Mapper',
    'history.col.size': 'Size',
    'history.col.db': 'DB',
    'history.tooltipDl': 'Re-download',
    'history.unknown': '(unknown)',
    'section.advanced': '🛠 Advanced (individual tests, plain dump, mapper detection)',
    'advanced.connectivity': 'Connectivity tests',
    'advanced.plainDump': 'Plain ROM dump (no-mapper cartridges only)',
    'advanced.chunkSize': 'Chunk size:',
    'advanced.detectOnly': 'Detect mapper only',
    'advanced.detectBtn': 'Detect mapper type (no dump)',
    'btn.dumpCart32': 'Cartridge area (32KB: 0x4000–0xBFFF)',
    'btn.dumpFull64': 'Full memory (64KB)',
    'section.log': '📜 Log',
    'browser.notice': '<b>Browser:</b> Requires the WebUSB API. Use a Chromium-based browser (<b>Chrome / Edge / Opera</b>). Safari and Firefox are not supported.',
    'winusb.notice': '<b>Windows:</b> install the WinUSB driver if the device does not appear in the selection dialog → <a href="./install-winusb.html">Install guide</a>',
    'winusb.link': 'Install guide',
    'macos.notice': '<b>macOS 26 (Tahoe)+ / Android:</b> Due to OS-level USB restrictions, the device enumerates but control transfers time out. <b>Use a real Windows or Linux PC instead</b>.',
    'cart.notInserted': 'No cartridge inserted',
  },
};

function t(key, ...args) {
  let s = T[LOCALE][key] ?? T.en[key] ?? key;
  if (args.length) s = s.replace(/\{(\d+)\}/g, (_, i) => args[i]);
  return s;
}

function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.documentElement.lang = LOCALE;
}

// USB 転送に被せるタイムアウト (ms)。実機はファームウェアの応答が無いとき
// transferIn/controlTransferIn が永久ハングしうるので必ず被せる。
let XFER_TIMEOUT_MS = 3000;
const XFER_TIMEOUT_DUMP_MS = 30000;     // ダンプ中（大きい bulk in）は長めに

/** @type {USBDevice|null} */
let device = null;

// ----- UI helpers -----
const $ = (id) => document.getElementById(id);
const statusEl = $('status-pill');
const dbPillEl = $('db-pill');
const logEl    = $('log');

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = 'pill' + (cls ? ' ' + cls : '');
}
function setDbStatus(text, cls) {
  dbPillEl.textContent = text;
  dbPillEl.className = 'pill' + (cls ? ' ' + cls : '');
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 23);
  const div = document.createElement('div');
  div.className = 'line';
  div.innerHTML = `<span class="ts">[${ts}]</span> ${msg}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function setButtons(connected) {
  $('btn-connect').disabled = connected;
  $('btn-disconnect').disabled = !connected;
  const ids = ['btn-status', 'btn-read-0000', 'btn-read-4000', 'btn-read-8000', 'btn-reset',
               'btn-dump-cart', 'btn-dump-full', 'btn-detect', 'btn-dump-auto'];
  for (const id of ids) {
    $(id).disabled = !connected;
  }
}

function setProgress(percent) {
  const wrap = $('progress-wrap');
  if (percent == null) {
    wrap.hidden = true;
  } else {
    wrap.hidden = false;
    $('progress-bar').style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }
}

function hexdump(bytes, baseAddr = 0) {
  const lines = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const slice = bytes.slice(i, i + 16);
    const hex   = [...slice].map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = [...slice].map((b) => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.').join('');
    const addr  = (baseAddr + i).toString(16).padStart(4, '0');
    lines.push(`${addr}  ${hex.padEnd(48, ' ')}  ${ascii}`);
  }
  return lines.join('\n');
}

/** Promise にタイムアウトを被せる。期限切れで reject する。 */
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

// ----- USB プロトコル -----

/**
 * ベンダリクエスト送信（EP0、データなし）。
 *
 * Chrome WebUSB のプラットフォーム差対策のため、2 つの方式を持つ：
 *   - IN 方式: `controlTransferIn(setup, 0)`
 *               bmRequestType=0xC0, wLength=0, ステータスステージ=OUT
 *               → 多くの環境（Windows Chrome 等）で動作。
 *   - OUT 方式: `controlTransferOut(setup, new Uint8Array(0))`
 *               bmRequestType=0x40, wLength=0, ステータスステージ=IN
 *               → IN 方式が timeout する環境のフォールバック。
 *
 * 仕様上はどちらも動くはずだが、Chrome の実装差で片方しか通らない環境がある。
 * 最初の SETUP で両方を順に試し、通った方式を以降ずっと使う。
 */
let SETUP_METHOD = null; // 'in' | 'out' | null

// IN→OUT を試して通った方を採用するときの 1 回ぶんの待ち時間。
// Parallels の USB passthrough は経路が長いので余裕を持って 5 秒。
const SETUP_PROBE_TIMEOUT_MS = 5000;

async function trySetup(method, bRequest, wValue, wIndex, timeoutMs) {
  const setup = {
    requestType: 'vendor',
    recipient:   'device',
    request:     bRequest,
    value:       wValue & 0xffff,
    index:       wIndex & 0xffff,
  };
  if (method === 'in') {
    return await withTimeout(
      device.controlTransferIn(setup, 0),
      timeoutMs,
      `controlTransferIn(req=${bRequest})`,
    );
  } else {
    return await withTimeout(
      device.controlTransferOut(setup, new Uint8Array(0)),
      timeoutMs,
      `controlTransferOut(req=${bRequest})`,
    );
  }
}

async function sendVendorCmd(bRequest, wValue, wIndex) {
  log(`  SETUP: req=0x${bRequest.toString(16).padStart(2,'0')} val=0x${wValue.toString(16).padStart(4,'0')} idx=0x${wIndex.toString(16).padStart(4,'0')}`);

  if (SETUP_METHOD) {
    // 既に確定済みの方式で送る
    const t0 = performance.now();
    const r = await trySetup(SETUP_METHOD, bRequest, wValue, wIndex, XFER_TIMEOUT_MS);
    const dt = (performance.now() - t0).toFixed(1);
    log(`  SETUP[${SETUP_METHOD}] ok (${dt} ms, status=${r.status})`);
    if (r.status !== 'ok') throw new Error(`SETUP failed: ${r.status}`);
    return;
  }

  // 初回：IN → OUT の順に試す
  for (const method of ['in', 'out']) {
    try {
      const t0 = performance.now();
      const r = await trySetup(method, bRequest, wValue, wIndex, SETUP_PROBE_TIMEOUT_MS);
      const dt = (performance.now() - t0).toFixed(1);
      if (r.status === 'ok') {
        SETUP_METHOD = method;
        log(`  SETUP[${method}] ok (${dt} ms, status=ok) — このセッションは以降 ${method} 方式を使用`);
        return;
      }
      log(`  SETUP[${method}] returned status=${r.status}, 次の方式を試行`);
    } catch (e) {
      log(`  SETUP[${method}] failed: ${e.message}, 次の方式を試行`);
    }
  }
  throw new Error('SETUP failed: both IN and OUT methods timed out');
}

/** EP2 IN から指定バイト数を取得。1回の transferIn で要求量を投げる（既存実装と同じ）。 */
async function bulkInAll(total) {
  log(`  bulkIn(${total}) ...`);
  const t0 = performance.now();
  const r = await withTimeout(
    device.transferIn(EP_IN, total),
    XFER_TIMEOUT_MS,
    `transferIn(EP${EP_IN}, ${total})`,
  );
  const dt = (performance.now() - t0).toFixed(1);
  if (r.status !== 'ok') throw new Error(`bulk IN failed: ${r.status}`);
  const a = new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength);
  log(`  bulkIn ok (${dt} ms, ${a.length} bytes)`);
  return a;
}

async function getSlotStatus() {
  await sendVendorCmd(CMD.GetSlotStatus, 0x0000, 0x0003);
  return await bulkInAll(3);
}

async function memoryRead(addr, size) {
  await sendVendorCmd(CMD.MemoryRead, addr, size);
  return await bulkInAll(size);
}

/** EP2 OUT に bulk で 64 バイト単位に分割して送る。 */
async function bulkOutAll(data) {
  for (let off = 0; off < data.length; off += 64) {
    const chunk = data.subarray(off, Math.min(off + 64, data.length));
    const r = await withTimeout(
      device.transferOut(EP_OUT, chunk),
      XFER_TIMEOUT_MS,
      `transferOut(EP${EP_OUT}, ${chunk.length})`,
    );
    if (r.status !== 'ok') throw new Error(`bulk OUT failed: ${r.status}`);
  }
}

async function memoryWrite(addr, data) {
  await sendVendorCmd(CMD.MemoryWrite, addr, data.length);
  await bulkOutAll(data);
}

/** マッパーレジスタへの 1 バイト書き込み（よく使うのでショートカット）。 */
async function writeByte(addr, value) {
  await memoryWrite(addr, new Uint8Array([value]));
}

// ============================================================
// MegaROM マッパー対応
// ============================================================

const ROM_TYPE = Object.freeze({
  PLAIN:         0,  // マッパーなし（最大 64KB）
  KONAMI:        1,  // Konami（SCC無）: 8KB バンク @ 0x8000, 0xA000
  ASCII16:       2,  // ASCII16: 16KB バンク @ 0x8000
  KONAMI_SCC:    3,  // Konami SCC: 8KB バンク @ 0x5000, 0x7000, 0x9000, 0xB000
  KONAMI_SCC_P:  4,  // Konami SCC+: 8KB バンク @ 0x8000, 0xA000 + SRAM ビット
  ASCII8:        5,  // ASCII8: 8KB バンク @ 0x6000, 0x6800, 0x7000, 0x7800
  ASCII16_SRAM:  6,  // ASCII16 with SRAM
  GAME_MASTER_2: 7,  // GM2 系: 5FFF/7FF6/7FF7
});

const ROM_TYPE_NAMES = {
  0: 'Plain ROM (no mapper)',
  1: 'Konami (no SCC)',
  2: 'ASCII16',
  3: 'Konami SCC',
  4: 'Konami SCC+',
  5: 'ASCII8',
  6: 'ASCII16 with SRAM',
  7: 'Game Master 2',
};

// romType -> デフォルトの最大想定容量（16KB ページ単位）
const ROM_DEFAULT_SIZE_16K = {
  0: 4,    // 64KB
  1: 128,  // 2MB
  2: 256,  // 4MB
  3: 64,   // 1MB
  4: 128,  // 2MB
  5: 128,  // 2MB
  6: 256,  // 4MB
  7: 8,    // 128KB
};

const MAPPER_REG_CANDIDATES = [
  0xBFFE, 0x7FFE, 0x7FF7, 0x5FFE, 0x5FFF,
  0x0000, 0x4000, 0x5000, 0x6000, 0x6800,
  0x7000, 0x7800, 0x8000, 0x9000, 0xA000, 0xB000,
];

/** 2 つの Uint8Array の先頭 n バイトが一致するか。 */
function arraysEqualPrefix(a, b, n) {
  if (a.length < n || b.length < n) n = Math.min(a.length, b.length, n);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * マッパーレジスタ候補に書き込んでみて、対象領域の内容が
 * 変化するかどうか判定する。変化ありなら「そのマッパーが効いている」。
 *
 * @param {number} writeAddr 書き込むアドレス
 * @param {number} writeVal  書き込む値
 * @param {number} readAddr  比較対象を再読み込みするアドレス
 * @param {number} readLen   比較対象の長さ
 * @param {Uint8Array} baseline ベースライン（事前の同領域のスナップショット）
 * @returns {Promise<boolean>} 変化があれば true
 */
async function probeMapperReg(writeAddr, writeVal, readAddr, readLen, baseline) {
  await writeByte(writeAddr, writeVal);
  const after = await memoryRead(readAddr, readLen);
  await writeByte(writeAddr, 0x00);  // 元に戻す
  const cmpLen = Math.min(0x800, readLen, baseline.length);
  return !arraysEqualPrefix(baseline, after, cmpLen);
}

/**
 * 装着カートリッジのマッパー種別を自動判定する。
 * マッパーレジスタ候補に書き込んで該当領域の内容が変化するか調べる
 * 既知の手法 (psxdev/msxGameReader 等で確立) に基づく決定木。
 */
async function detectRomType() {
  log('--- Detect ROM mapper type ---');

  // Step 1: すべてのマッパーレジスタ候補を 0 に初期化
  log(`  initializing ${MAPPER_REG_CANDIDATES.length} mapper register candidates to 0...`);
  for (const addr of MAPPER_REG_CANDIDATES) {
    await writeByte(addr, 0);
  }

  // Step 2: ベースライン読み込み（mapper 試験で何度も比較対象になる）
  log('  reading baselines...');
  const base4 = await memoryRead(0x4000, 0x2000);  // 8KB from 0x4000
  const base6 = await memoryRead(0x6000, 0x2000);  // 8KB from 0x6000
  const base8 = await memoryRead(0x8000, 0x2000);  // 8KB from 0x8000
  const baseA = await memoryRead(0xA000, 0x2000);  // 8KB from 0xA000

  // Step 3: Konami / SCC+ パス: 0xA000 への書き込みが 0xA000 領域を変えるか
  log('  testing Konami / Konami SCC+ (write 0xA000)...');
  if (await probeMapperReg(0xA000, 0xFF, 0xA000, 0x2000, baseA)) {
    // 0xA000 が効く → SCC+ かそうじゃない Konami の二択
    log('  testing SCC+ vs Konami (write 0x4000)...');
    if (await probeMapperReg(0x4000, 0xFF, 0x4000, 0x2000, base4)) {
      log('  → Konami SCC+ (romType=4)');
      return ROM_TYPE.KONAMI_SCC_P;
    } else {
      log('  → Konami no-SCC (romType=1)');
      return ROM_TYPE.KONAMI;
    }
  }

  // Step 4: Konami SCC パス: 0x9000 への書き込みが 0x8000 領域を変えるか
  log('  testing Konami SCC (write 0x9000)...');
  if (await probeMapperReg(0x9000, 0xFF, 0x8000, 0x2000, base8)) {
    log('  → Konami SCC (romType=3)');
    return ROM_TYPE.KONAMI_SCC;
  }

  // Step 5: ASCII8 パス: 0x6800 への書き込みが 0x6000 領域を変えるか
  log('  testing ASCII8 (write 0x6800)...');
  if (await probeMapperReg(0x6800, 0xFF, 0x6000, 0x2000, base6)) {
    log('  → ASCII8 (romType=5)');
    return ROM_TYPE.ASCII8;
  }

  // Step 6: ASCII16 パス: 0x8000 への書き込みが 0x8000 領域を変えるか
  log('  testing ASCII16 (write 0x8000)...');
  if (await probeMapperReg(0x8000, 0xFF, 0x8000, 0x2000, base8)) {
    // ASCII16 確定。SRAM 変種かどうか追加で確認（0x7000 が効くか）
    log('  testing ASCII16 SRAM variant (write 0x7000)...');
    if (await probeMapperReg(0x7000, 0xFF, 0x8000, 0x2000, base8)) {
      log('  → ASCII16 with SRAM (romType=6)');
      return ROM_TYPE.ASCII16_SRAM;
    }
    log('  → ASCII16 (romType=2)');
    return ROM_TYPE.ASCII16;
  }

  // Step 7: どれも該当しない → プレーン ROM 扱い
  log('  → no mapper response detected, assuming plain ROM (romType=0)');
  return ROM_TYPE.PLAIN;
}

// ============================================================
// ROM データベース（openMSX softwaredb.xml 由来）照合
// ============================================================

/** @type {Object<string, {t:string,c:string,y:string,k:string,m:string,r?:string,s?:string}>|null} */
let ROMDB = null;

async function loadRomDb() {
  if (ROMDB) return ROMDB;
  try {
    log('Loading ROM DB...');
    setDbStatus(t('db.loading'));
    const res = await fetch('./data/romdb.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ROMDB = await res.json();
    const n = Object.keys(ROMDB).length;
    log(`ROM DB loaded: ${n} entries`);
    setDbStatus(t('db.loaded', n), 'ok');
    return ROMDB;
  } catch (e) {
    log(`<span style="color:#c00">ROM DB load failed: ${e.message}</span>`);
    setDbStatus(t('db.failed'), 'ng');
    ROMDB = {};
    return ROMDB;
  }
}

/** SHA-1 を 16 進文字列で計算（openMSX softwaredb は SHA-1 ベース）。 */
async function sha1Hex(bytes) {
  const hash = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function lookupRom(sha1) {
  if (!ROMDB) return null;
  return ROMDB[sha1.toLowerCase()] || null;
}

// ============================================================
// 結果カード / セッション履歴
// ============================================================

/** @type {Array<DumpRecord>} */
const HISTORY = [];

/** @typedef {{
 *   id: number, ts: string, buf: Uint8Array, sizeKB: number, romType: number,
 *   sha1: string, sha256: string, filename: string, dbMatch: object|null,
 *   header: object|null, trimNote: string, speedKBs: string, timeMs: number,
 *   trimmedFromKB?: number,
 * }} DumpRecord */

function showResultCard(rec) {
  $('result-empty').hidden = true;
  $('result-content').hidden = false;

  // タイトル行
  if (rec.dbMatch) {
    $('r-title').textContent = rec.dbMatch.t;
    const company = rec.dbMatch.c || '?';
    const year = rec.dbMatch.y || '?';
    const remark = rec.dbMatch.r ? ` [${rec.dbMatch.r}]` : '';
    const status = rec.dbMatch.s ? `  ${rec.dbMatch.s}` : '';
    $('r-subtitle').textContent = `${company}, ${year}${remark}${status}`;
  } else {
    $('r-title').textContent = t('result.unknownTitle');
    $('r-subtitle').textContent = t('result.unknownSubtitle');
  }

  // メタ情報
  $('r-mapper').textContent = `${ROM_TYPE_NAMES[rec.romType]} (romType=${rec.romType})`;
  if (rec.dbMatch) {
    const dbMapper = rec.dbMatch.m || '?';
    const expected = OPENMSX_MAPPER_TO_ROMTYPE[dbMapper];
    const consistent = expected === undefined || expected === rec.romType;
    $('r-mapper-db').innerHTML = `${dbMapper} ${consistent
      ? `<span style="color:var(--ok)">${t('mapperDb.ok')}</span>`
      : `<span style="color:var(--warn)">${t('mapperDb.mismatch')}</span>`}`;
  } else {
    $('r-mapper-db').textContent = '—';
  }
  $('r-size').textContent = `${rec.sizeKB} KB`;
  $('r-speed').textContent = `${rec.timeMs.toFixed(0)} ms / ${rec.speedKBs} KB/s`;
  $('r-trim').textContent = rec.trimNote || '—';
  if (rec.header) {
    $('r-header').textContent = `"AB" at 0x${rec.header.address.toString(16).padStart(4,'0')}  init=0x${rec.header.init.toString(16).padStart(4,'0')}`;
  } else {
    $('r-header').textContent = t('header.notFound');
  }

  // ハッシュ
  $('r-sha1').textContent = rec.sha1;
  $('r-sha256').textContent = rec.sha256;
  $('r-filename').textContent = rec.filename;

  // hex preview を新しいダンプごとにリセット
  $('r-hex').hidden = true;
  $('btn-show-hex').textContent = t('btn.showHex');
  $('r-hex').textContent = hexdumpPreview(rec.buf.subarray(0, 0x100), 0, 16);
}

function addHistoryRow(rec) {
  HISTORY.push(rec);
  $('history-card').hidden = false;

  const tbody = $('history-body');
  const tr = document.createElement('tr');

  const td = (txt) => { const e = document.createElement('td'); e.innerHTML = txt; return e; };

  tr.appendChild(td(`<span class="num">#${rec.id}</span>`));
  tr.appendChild(td(rec.dbMatch ? rec.dbMatch.t : `<span style="color:var(--muted)">${t('history.unknown')}</span>`));
  tr.appendChild(td(ROM_TYPE_NAMES[rec.romType]));
  tr.appendChild(td(`${rec.sizeKB} KB`));
  if (rec.dbMatch) {
    tr.appendChild(td(`<span class="pill ok" style="font-size:0.75rem">✓ ${rec.dbMatch.s || 'matched'}</span>`));
  } else {
    tr.appendChild(td(`<span class="pill" style="font-size:0.75rem">${t('history.unknown')}</span>`));
  }
  const dlBtn = document.createElement('button');
  dlBtn.textContent = '↓';
  dlBtn.title = t('history.tooltipDl');
  dlBtn.style.padding = '2px 8px';
  dlBtn.addEventListener('click', () => triggerDownload(rec.buf, rec.filename));
  const tdAction = document.createElement('td');
  tdAction.appendChild(dlBtn);
  tr.appendChild(tdAction);

  tbody.insertBefore(tr, tbody.firstChild);  // 最新を上に
}

/** 結果カードの「Re-download」ボタンが押したらどのレコードを使うか */
let LAST_DUMP = null;

function recordDump(rec) {
  LAST_DUMP = rec;
  showResultCard(rec);
  addHistoryRow(rec);
}

/** タイトルをファイル名に使える形に正規化。 */
function titleToFilenameSafe(title) {
  // 1. 全角→半角に近づける処理は省略。記号・空白を _ に
  return title
    .replace(/[\s\/\\:*?"<>|]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** ROM DB エントリを結果欄向けに整形。 */
function formatDbMatch(entry) {
  const lines = [
    `   Title    : ${entry.t}`,
    `   Company  : ${entry.c || '?'}`,
    `   Year     : ${entry.y || '?'}${entry.k ? ` (${entry.k})` : ''}`,
    `   Mapper   : ${entry.m || '?'}`,
  ];
  if (entry.r) lines.push(`   Remark   : ${entry.r}`);
  if (entry.s) lines.push(`   Status   : ${entry.s}`);
  return lines.join('\n');
}

/** openMSX のマッパー表記 → 本ツールの romType への対応（簡易マッピング）。 */
const OPENMSX_MAPPER_TO_ROMTYPE = {
  'Plain':         ROM_TYPE.PLAIN,
  'Mirrored':      ROM_TYPE.PLAIN,
  'Konami':        ROM_TYPE.KONAMI,
  'KonamiSCC':     ROM_TYPE.KONAMI_SCC,
  'ASCII8':        ROM_TYPE.ASCII8,
  'ASCII16':       ROM_TYPE.ASCII16,
  'ASCII16SRAM2':  ROM_TYPE.ASCII16_SRAM,
  'ASCII16SRAM8':  ROM_TYPE.ASCII16_SRAM,
  'ASCII8SRAM8':   ROM_TYPE.ASCII8,
  'GameMaster2':   ROM_TYPE.GAME_MASTER_2,
};

// ----- ダンプ補助 -----

/** Web Crypto API で SHA-256 を計算（16進文字列）。 */
async function sha256Hex(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * MSX ROM ヘッダ（"AB" シグネチャ）の判定とデコード。
 * カートリッジ ROM は通常 0x4000 か 0x8000 にヘッダがある。
 */
function detectRomHeader(buf, baseOffsetInBuf, baseAddr) {
  if (baseOffsetInBuf + 16 > buf.length) return null;
  if (buf[baseOffsetInBuf] !== 0x41 || buf[baseOffsetInBuf + 1] !== 0x42) return null;
  const word = (lo, hi) => buf[lo] | (buf[hi] << 8);
  return {
    address: baseAddr,
    init:      word(baseOffsetInBuf + 2, baseOffsetInBuf + 3),
    statement: word(baseOffsetInBuf + 4, baseOffsetInBuf + 5),
    device:    word(baseOffsetInBuf + 6, baseOffsetInBuf + 7),
    basic:     word(baseOffsetInBuf + 8, baseOffsetInBuf + 9),
  };
}

/** Uint8Array を Blob にしてダウンロードトリガを発火。 */
function triggerDownload(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** ダンプ済みのバイト列を 16 バイト幅で 16 進表示。最大行数で切る。 */
function hexdumpPreview(bytes, baseAddr, maxLines = 16) {
  const lines = [];
  for (let i = 0; i < bytes.length && lines.length < maxLines; i += 16) {
    const slice = bytes.subarray(i, Math.min(i + 16, bytes.length));
    const hex = [...slice].map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = [...slice].map((b) => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.').join('');
    const addr = (baseAddr + i).toString(16).padStart(4, '0');
    lines.push(`${addr}  ${hex.padEnd(48, ' ')}  ${ascii}`);
  }
  return lines.join('\n');
}

/**
 * 指定したアドレス範囲 [start, start+size) をチャンク分割して読み出す。
 * MSX バスへのアクセスは Reader が逐次行うので、進捗ログを出しながら読む。
 */
async function dumpRange(start, size, chunk) {
  const buf = new Uint8Array(size);
  // ダンプ中は転送時間が長いのでタイムアウトを拡張
  const savedTimeout = XFER_TIMEOUT_MS;
  XFER_TIMEOUT_MS = XFER_TIMEOUT_DUMP_MS;
  setProgress(0);
  try {
    const t0 = performance.now();
    for (let off = 0; off < size; off += chunk) {
      const len = Math.min(chunk, size - off);
      const addr = start + off;
      const tc = performance.now();
      const data = await memoryRead(addr, len);
      const dt = performance.now() - tc;
      const kbps = (data.length / 1024) / (dt / 1000);
      log(`  read 0x${addr.toString(16).padStart(4,'0')}-0x${(addr+len-1).toString(16).padStart(4,'0')} : ${dt.toFixed(0)} ms (${kbps.toFixed(1)} KB/s)`);
      buf.set(data, off);
      setProgress(((off + len) / size) * 100);
    }
    const total = performance.now() - t0;
    return { buf, totalMs: total };
  } finally {
    XFER_TIMEOUT_MS = savedTimeout;
  }
}

/**
 * ダンプ結果のトリミング：
 *   Step 1: 末尾の「丸ごと 0xFF」16KB バンクを除去
 *           （マッパーが範囲外バンクを 0xFF で返すケース。Hydlide 3 等で観測）
 *   Step 2: 結果が 2 のべき乗（16KB 単位）の場合、前半 == 後半 ならミラーと判断して半分に
 *           （マッパーが範囲外バンク番号で実バンクにラップするケース）
 *
 * MSX ROM はほぼすべて 2 のべき乗 KB（32/64/128/256/512/1024 KB）なので、
 * この 2 段階で実 ROM サイズを精度よく推定できる。
 */
function trimDumpedRom(buf) {
  const originalLen = buf.length;
  let len = buf.length;

  // Step 1: 末尾の all-0xFF バンクを除去
  const banks = (len / 0x4000) | 0;
  let validBanks = banks;
  for (let n = banks - 1; n >= 0; n--) {
    const start = n * 0x4000;
    let allFF = true;
    for (let i = start; i < start + 0x4000; i++) {
      if (buf[i] !== 0xFF) { allFF = false; break; }
    }
    if (!allFF) break;
    validBanks = n;
  }
  if (validBanks === 0) validBanks = banks; // 安全策：全部 0xFF なら何もしない
  const afterFFTrim = validBanks * 0x4000;
  len = afterFFTrim;

  // Step 2: 2 のべき乗バンク数でミラー検出 → 半減
  while (len > 0x4000) {
    const b = len / 0x4000;
    if (b & (b - 1)) break;  // not power-of-2
    const half = len / 2;
    let mirror = true;
    for (let i = 0; i < half; i++) {
      if (buf[i] !== buf[half + i]) { mirror = false; break; }
    }
    if (!mirror) break;
    len = half;
  }

  return {
    trimmed:           buf.subarray(0, len),
    originalKB:        originalLen / 1024,
    afterFFTrimKB:     afterFFTrim / 1024,
    finalKB:           len / 1024,
    trimmedFFBanks:    banks - validBanks,
    trimmedByMirror:   afterFFTrim !== len,
  };
}

/**
 * マッパー別に 16KB ずつバンク切替しながらダンプ。
 * @param {number} romType
 * @param {number} maxBanks16K 最大バンク数（16KB ページ数）
 * @returns {Promise<Uint8Array>} 取得した ROM データ（重複検出で短くなることあり）
 */
async function dumpMegaROM(romType, maxBanks16K) {
  const buf = new Uint8Array(maxBanks16K * 0x4000);
  let banks = 0;          // 取得した 16KB バンク数
  const t0 = performance.now();

  // 同じバンクが繰り返し出現したら、そこで打ち切る用のヒント
  // （簡易：bank N == bank 0 になった時点で実 ROM サイズは N と推定）
  const checkRepeat = (n) => {
    if (n < 2) return false;
    // 直近バンクと最初のバンクが完全一致なら繰り返し
    const a = buf.subarray(0, 0x4000);
    const b = buf.subarray(n * 0x4000, (n + 1) * 0x4000);
    for (let i = 0; i < 0x4000; i++) if (a[i] !== b[i]) return false;
    return true;
  };

  log(`Dumping ${ROM_TYPE_NAMES[romType]}, max ${maxBanks16K} x 16KB = ${maxBanks16K * 16} KB`);

  switch (romType) {
    case ROM_TYPE.PLAIN: {
      // 0x4000-0xBFFF (32KB) を一発
      const cart = await memoryRead(0x4000, 0x8000);
      buf.set(cart, 0);
      banks = 2;
      break;
    }

    case ROM_TYPE.KONAMI:
    case ROM_TYPE.KONAMI_SCC_P: {
      // 8KB バンク。偶数を 0x8000、奇数を 0xA000 にロード → 0x8000 から 16KB 読む
      for (let i = 0; i < maxBanks16K; i++) {
        await writeByte(0x8000, i * 2);
        await writeByte(0xA000, i * 2 + 1);
        const chunk = await memoryRead(0x8000, 0x4000);
        buf.set(chunk, i * 0x4000);
        banks++;
        setProgress((banks / maxBanks16K) * 100);
        if (checkRepeat(i)) {
          log(`  bank ${i} == bank 0, stopping early (actual ROM = ${i * 16} KB)`);
          banks = i;
          break;
        }
      }
      await writeByte(0x8000, 0); await writeByte(0xA000, 0);
      break;
    }

    case ROM_TYPE.KONAMI_SCC: {
      // 8KB バンク。0x5000/0x7000 にロード → 0x4000 から 16KB 読む
      for (let i = 0; i < maxBanks16K; i++) {
        await writeByte(0x5000, i * 2);
        await writeByte(0x7000, i * 2 + 1);
        const chunk = await memoryRead(0x4000, 0x4000);
        buf.set(chunk, i * 0x4000);
        banks++;
        setProgress((banks / maxBanks16K) * 100);
        if (checkRepeat(i)) {
          log(`  bank ${i} == bank 0, stopping early (actual ROM = ${i * 16} KB)`);
          banks = i;
          break;
        }
      }
      await writeByte(0x5000, 0); await writeByte(0x7000, 1);
      break;
    }

    case ROM_TYPE.ASCII16:
    case ROM_TYPE.ASCII16_SRAM: {
      // 16KB バンク。0x8000 (or 0x6000 for SRAM) に書く → 0x8000 から 16KB 読む
      const switchAddr = romType === ROM_TYPE.ASCII16_SRAM ? 0x6000 : 0x8000;
      for (let i = 0; i < maxBanks16K; i++) {
        await writeByte(switchAddr, i);
        const chunk = await memoryRead(0x8000, 0x4000);
        buf.set(chunk, i * 0x4000);
        banks++;
        setProgress((banks / maxBanks16K) * 100);
        if (checkRepeat(i)) {
          log(`  bank ${i} == bank 0, stopping early (actual ROM = ${i * 16} KB)`);
          banks = i;
          break;
        }
      }
      await writeByte(switchAddr, 0);
      break;
    }

    case ROM_TYPE.ASCII8: {
      // 8KB バンク。0x7000 と 0x7800 にロード → 0x8000 から 16KB 読む
      for (let i = 0; i < maxBanks16K; i++) {
        await writeByte(0x7000, i * 2);
        await writeByte(0x7800, i * 2 + 1);
        const chunk = await memoryRead(0x8000, 0x4000);
        buf.set(chunk, i * 0x4000);
        banks++;
        setProgress((banks / maxBanks16K) * 100);
        if (checkRepeat(i)) {
          log(`  bank ${i} == bank 0, stopping early (actual ROM = ${i * 16} KB)`);
          banks = i;
          break;
        }
      }
      await writeByte(0x6000, 0); await writeByte(0x6800, 0);
      await writeByte(0x7000, 0); await writeByte(0x7800, 0);
      break;
    }

    default:
      throw new Error(`romType ${romType} (${ROM_TYPE_NAMES[romType]}) のダンプは未実装です`);
  }

  const totalMs = performance.now() - t0;
  return { buf: buf.subarray(0, banks * 0x4000), banks, totalMs };
}

async function runDump({ startAddr, size, label, fileSuffix }) {
  log(`--- Dump ${label}: 0x${startAddr.toString(16).padStart(4,'0')}-0x${(startAddr+size-1).toString(16).padStart(4,'0')} (${(size/1024)|0} KB) ---`);

  // カートリッジ装着確認
  const st = await getSlotStatus();
  if (st[1] !== 0xff) {
    throw new Error(t('cart.notInserted'));
  }

  const chunk = parseInt($('chunk-size').value, 10);
  const { buf, totalMs } = await dumpRange(startAddr, size, chunk);

  const [sha1, sha256] = await Promise.all([sha1Hex(buf), sha256Hex(buf)]);
  const speed = ((size / 1024) / (totalMs / 1000)).toFixed(1);

  await loadRomDb();
  const dbMatch = lookupRom(sha1);

  // ヘッダ判定：0x4000 と 0x8000 を見る（バッファ内オフセットで）
  const candidates = [
    { offsetInBuf: 0x4000 - startAddr, baseAddr: 0x4000 },
    { offsetInBuf: 0x8000 - startAddr, baseAddr: 0x8000 },
    { offsetInBuf: 0x0000 - startAddr, baseAddr: 0x0000 },
  ].filter(c => c.offsetInBuf >= 0 && c.offsetInBuf + 16 <= buf.length);

  let header = null;
  for (const c of candidates) {
    const h = detectRomHeader(buf, c.offsetInBuf, c.baseAddr);
    if (h) { header = h; break; }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const titleTag = dbMatch ? `_${titleToFilenameSafe(dbMatch.t)}` : '';
  const filename = `msx${titleTag}_${fileSuffix}_${ts}.rom`;
  // 自動 DL はせず、結果カードの Download ボタンに任せる

  recordDump({
    id: HISTORY.length + 1,
    ts: new Date().toISOString(),
    buf,
    sizeKB: (size / 1024) | 0,
    romType: ROM_TYPE.PLAIN,
    sha1, sha256, filename,
    dbMatch, header,
    trimNote: '—',
    speedKBs: speed,
    timeMs: totalMs,
  });

  log(`<b>Dump ${label} complete: ${(totalMs/1000).toFixed(2)} s, ${speed} KB/s, SHA-1 ${sha1.slice(0,16)}...</b>`);
  log(`saved: ${filename}`);
  if (dbMatch) {
    log(`<b>Identified: ${dbMatch.t} (${dbMatch.c}, ${dbMatch.y})${dbMatch.r ? ' [' + dbMatch.r + ']' : ''}</b>`);
  }
  setProgress(null);
}

// ----- UI ハンドラ -----

async function onConnect() {
  try {
    SETUP_METHOD = null; // 接続のたびに方式判定をやり直す
    device = await navigator.usb.requestDevice({
      filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID }],
    });
    log(`requestDevice → VID=${device.vendorId.toString(16)} PID=${device.productId.toString(16)} name="${device.productName ?? ''}"`);
    await device.open();
    log('open() ok');
    if (!device.configuration) {
      await device.selectConfiguration(1);
      log('selectConfiguration(1) ok');
    } else {
      log(`already configured (config=${device.configuration.configurationValue})`);
    }
    await device.claimInterface(0);
    log('claimInterface(0) ok');
    // 既存 C 実装が明示的に呼んでいるので合わせる。失敗しても進める。
    try {
      await device.selectAlternateInterface(0, 0);
      log('selectAlternateInterface(0,0) ok');
    } catch (e) {
      log(`selectAlternateInterface skipped: ${e.message}`);
    }
    // clearHalt は意図的に呼ばない：
    // CLEAR_FEATURE(ENDPOINT_HALT) リクエストを送るが、本機 FW は
    // 標準リクエストの最小サブセットしか実装しておらず、EP0 を
    // STALL に陥らせる可能性が高い。必要な時は [Reset device] を使う。
    setButtons(true);
    setStatus(`${t('status.connected_prefix')}: VID=0x${device.vendorId.toString(16)} PID=0x${device.productId.toString(16)}`, 'ok');
    // ROM DB を背景でロード（初回ダンプ前に間に合えばよい）
    loadRomDb();
    log('READY — まず [GetSlotStatus] を押してください');
  } catch (e) {
    log(`<span style="color:#c00">connect error: ${e.message}</span>`);
    setStatus(`${LOCALE === 'ja' ? '接続失敗' : 'Connection failed'}: ${e.message}`, 'ng');
  }
}

async function onDisconnect() {
  try {
    if (device) {
      await device.releaseInterface(0).catch(() => {});
      await device.close();
    }
  } catch (e) {
    log(`disconnect error: ${e.message}`);
  }
  device = null;
  setButtons(false);
  setStatus(t('status.disconnected'));
}

async function onResetDevice() {
  try {
    log('reset() ...');
    await device.reset();
    log('reset() ok');
  } catch (e) {
    log(`<span style="color:#c00">reset error: ${e.message}</span>`);
  }
}

async function safeRun(label, fn) {
  try {
    await fn();
  } catch (e) {
    log(`<span style="color:#c00">${label} error: ${e.message}</span>`);
    // タイムアウト等で詰まったら自動 disconnect。これをやらないと
    // macOS で USB ロックが残り続けて他アプリ/再リロードからアクセスできなくなる。
    if (/timed out|disconnected/i.test(e.message)) {
      log('auto-disconnect due to fatal transfer error');
      await onDisconnect();
    }
  }
}

async function onSlotStatus() {
  await safeRun('GetSlotStatus', async () => {
    log('--- GetSlotStatus ---');
    const r = await getSlotStatus();
    const raw = [...r].map(b => b.toString(16).padStart(2,'0')).join(' ');
    const slotType = r[0];
    const inserted = r[1] === 0xff;
    const slot     = r[2] === 0x00 ? 'SLOT1' : 'SLOT2';
    const summary  = `slotType=0x${slotType.toString(16).padStart(2,'0')}  装着=${inserted ? 'YES' : 'NO'}  ${slot}`;
    log(`<b>GetSlotStatus = [${raw}] → ${summary}</b>`);
  });
}

async function onDumpCartridge() {
  await safeRun('DumpCartridge', () => runDump({
    startAddr:  0x4000,
    size:       0x8000,         // 32 KB
    label:      'cartridge (32KB)',
    fileSuffix: 'cart32k',
  }));
  setProgress(null);
}

async function onDumpFull() {
  await safeRun('DumpFull', () => runDump({
    startAddr:  0x0000,
    size:       0x10000,        // 64 KB
    label:      'full memory (64KB)',
    fileSuffix: 'full64k',
  }));
  setProgress(null);
}

async function onDetectMapper() {
  await safeRun('DetectMapper', async () => {
    const st = await getSlotStatus();
    if (st[1] !== 0xff) throw new Error(t('cart.notInserted'));
    const romType = await detectRomType();
    const name = ROM_TYPE_NAMES[romType];
    log(`<b>Mapper = ${name} (romType=${romType})</b>`);
    log(`デフォルト想定容量: ${ROM_DEFAULT_SIZE_16K[romType] * 16} KB`);
  });
}

async function onDumpAuto() {
  await safeRun('DumpAuto', async () => {
    const st = await getSlotStatus();
    if (st[1] !== 0xff) throw new Error(t('cart.notInserted'));
    const maxBanks = parseInt($('max-banks').value, 10);

    // 拡張タイムアウト
    const savedTimeout = XFER_TIMEOUT_MS;
    XFER_TIMEOUT_MS = XFER_TIMEOUT_DUMP_MS;
    try {
      const romType = await detectRomType();
      log(`<b>Mapper = ${ROM_TYPE_NAMES[romType]} (romType=${romType})</b>`);
      log(`Dumping with max ${maxBanks} x 16KB = ${maxBanks * 16} KB ...`);
      setProgress(0);

      const { buf: rawBuf, banks, totalMs } = await dumpMegaROM(romType, maxBanks);
      const hitMax = banks >= maxBanks;

      // ダンプ結果を自動トリム
      const trim = trimDumpedRom(rawBuf);
      const buf = trim.trimmed;

      const sizeKB = trim.finalKB | 0;
      const speed = ((rawBuf.length / 1024) / (totalMs / 1000)).toFixed(1);

      // SHA-1（DB 照合用）と SHA-256（再現性確認用）を並行計算
      const [sha1, sha256] = await Promise.all([sha1Hex(buf), sha256Hex(buf)]);

      await loadRomDb();
      const dbMatch = lookupRom(sha1);

      const header = detectRomHeader(buf, 0, 0x4000) || detectRomHeader(buf, 0x4000, 0x4000);

      const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
      const mapperTag = ROM_TYPE_NAMES[romType].replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
      const titleTag = dbMatch ? `_${titleToFilenameSafe(dbMatch.t)}` : '';
      const filename = `msx${titleTag}_${mapperTag}_${sizeKB}k_${ts}.rom`;
      // 自動 DL はせず、結果カードの Download ボタンに任せる

      const trimNote = (() => {
        if (trim.finalKB === trim.originalKB) return '無し';
        const parts = [];
        if (trim.trimmedFFBanks > 0) parts.push(`末尾0xFFバンク×${trim.trimmedFFBanks}除去`);
        if (trim.trimmedByMirror) parts.push(`ミラー検出による半減`);
        return `${parts.join(' / ')}  (${trim.originalKB}KB → ${trim.finalKB}KB)`;
      })();

      const sizeNote = trim.finalKB < trim.originalKB
        ? '✅ post-trim で実 ROM size 推定'
        : (banks < maxBanks
            ? '✅ early-stop でバンク 0 ミラー検出 (実 ROM size と判定)'
            : '⚠️  max-scan に到達かつトリム不可。max を上げて再試行を');
      const richTrimNote = `${trimNote}  /  ${sizeNote}`;

      recordDump({
        id: HISTORY.length + 1,
        ts: new Date().toISOString(),
        buf,
        sizeKB,
        romType,
        sha1, sha256, filename,
        dbMatch, header,
        trimNote: richTrimNote,
        speedKBs: speed,
        timeMs: totalMs,
        trimmedFromKB: trim.originalKB,
      });

      log(`<b>Dump complete: ${trim.originalKB} KB → trim → ${sizeKB} KB in ${(totalMs/1000).toFixed(2)} s, ${speed} KB/s, SHA-1 ${sha1.slice(0,16)}...</b>`);
      if (dbMatch) {
        log(`<b>Identified: ${dbMatch.t} (${dbMatch.c}, ${dbMatch.y})${dbMatch.r ? ' [' + dbMatch.r + ']' : ''}</b>`);
      } else {
        log(`<span style="opacity:0.7">SHA-1 not in openMSX softwaredb (unknown dump)</span>`);
      }
      log(`saved: ${filename}`);
      if (hitMax && trim.finalKB === trim.originalKB) {
        log(`<span style="color:#d80">⚠️  max-scan に到達かつトリム不可。実 ROM が ${sizeKB} KB より大きい可能性があります。max を上げて再試行してください。</span>`);
      }
    } finally {
      XFER_TIMEOUT_MS = savedTimeout;
      setProgress(null);
    }
  });
}

async function readAndDump(addr) {
  await safeRun(`MemoryRead(0x${addr.toString(16)})`, async () => {
    log(`--- MemoryRead(0x${addr.toString(16).padStart(4,'0')}, 64) ---`);
    const t0 = performance.now();
    const r = await memoryRead(addr, 64);
    const dt = (performance.now() - t0).toFixed(1);
    log(`<b>MemoryRead total ${dt} ms, ${r.length} bytes</b>`);
    log(`<pre style="margin:4px 0">${hexdump(r, addr)}</pre>`);
  });
}

// ----- 起動 -----

applyTranslations(document);
// 言語スイッチャの active 表示
const langSwitch = document.getElementById('lang-' + LOCALE);
if (langSwitch) langSwitch.classList.add('active');
log(`locale=${LOCALE} (navigator.languages=${(navigator.languages || []).join(',')})`);

if (!('usb' in navigator)) {
  setStatus(t('status.no_webusb'), 'ng');
  document.querySelectorAll('button').forEach((b) => b.disabled = true);
} else {
  $('btn-connect').addEventListener('click', onConnect);
  $('btn-disconnect').addEventListener('click', onDisconnect);
  $('btn-status').addEventListener('click', onSlotStatus);
  $('btn-read-0000').addEventListener('click', () => readAndDump(0x0000));
  $('btn-read-4000').addEventListener('click', () => readAndDump(0x4000));
  $('btn-read-8000').addEventListener('click', () => readAndDump(0x8000));
  $('btn-reset').addEventListener('click', onResetDevice);
  $('btn-dump-cart').addEventListener('click', onDumpCartridge);
  $('btn-dump-full').addEventListener('click', onDumpFull);
  $('btn-detect').addEventListener('click', onDetectMapper);
  $('btn-dump-auto').addEventListener('click', onDumpAuto);
  $('btn-redownload').addEventListener('click', () => {
    if (LAST_DUMP) triggerDownload(LAST_DUMP.buf, LAST_DUMP.filename);
  });
  $('btn-show-hex').addEventListener('click', () => {
    const hex = $('r-hex');
    hex.hidden = !hex.hidden;
    $('btn-show-hex').textContent = hex.hidden ? t('btn.showHex') : t('btn.hideHex');
  });

  // ホットプラグ対応
  navigator.usb.addEventListener('disconnect', (e) => {
    if (e.device === device) {
      log('device disconnected');
      device = null;
      setButtons(false);
      setStatus(t('status.lost'), 'ng');
    }
  });

  // ページを閉じる／リロードする前に確実に release+close する。
  // これを怠ると macOS では IOKit のロックが残り、他プロセス（libusb / 他タブ）から
  // "another process has device opened for exclusive access" エラーになる。
  const teardown = () => {
    if (!device) return;
    try { device.releaseInterface(0); } catch {}
    try { device.close(); } catch {}
  };
  window.addEventListener('pagehide', teardown);
  window.addEventListener('beforeunload', teardown);

  setStatus('未接続 — [Connect] を押してください');
}
