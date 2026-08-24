// ============================================================
// 授权码 & 次数管理系统（前端版 MVP）
// ============================================================
// 授权码格式：PIDOU-XXXX-XXXX-XXXX
// 三种类型：
//   T = 按次导出（图纸导出额度）
//   P = 永久会员（图纸无限导出）
//   Q = Q版次数包（AI Q版生成额度，独立计费）

const SECRET = 0x5A3D7B ^ 0x1F2C4E;

const STORAGE_KEY = 'pidou_license';
const CHIBI_STORAGE_KEY = 'pidou_chibi_license';
const CHIBI_FREE_USED_KEY = 'pidou_chibi_free_used';
export const FREE_CHIBI_LIMIT = 2;
export const PERMANENT_CHIBI_CREDITS = 35;

// ============================================================
// 授权码生成
// ============================================================
export function generateLicense(type, credits) {
  const id = Math.random().toString(36).slice(2, 6).toUpperCase();
  let t, c;
  if (type === 'permanent') { t = 'P'; c = '99'; }
  else if (type === 'chibi') { t = 'Q'; c = String(credits).padStart(2, '0'); }
  else { t = 'T'; c = String(credits).padStart(2, '0'); }
  const raw = t + c + id;
  const encoded = encodePayload(raw);
  const parts = [];
  for (let i = 0; i < encoded.length; i += 4) {
    parts.push(encoded.slice(i, i + 4));
  }
  return 'PIDOU-' + parts.join('-');
}

function encodePayload(raw) {
  let hex = '';
  for (let i = 0; i < raw.length; i++) {
    const xor = raw.charCodeAt(i) ^ (SECRET & 0xFF);
    hex += xor.toString(16).padStart(2, '0');
  }
  return hex.toUpperCase();
}

function decodePayload(code) {
  try {
    const cleanCode = code.replace(/^PIDOU-/, '').replace(/-/g, '');
    let raw = '';
    for (let i = 0; i < cleanCode.length; i += 2) {
      const hex = cleanCode.slice(i, i + 2);
      const xor = parseInt(hex, 16);
      raw += String.fromCharCode(xor ^ (SECRET & 0xFF));
    }
    return raw;
  } catch {
    return null;
  }
}

// ============================================================
// 授权码验证
// ============================================================
export function verifyLicense(code) {
  if (!code || typeof code !== 'string') return { valid: false, error: '请输入授权码' };
  const trimmed = code.trim().toUpperCase();
  if (!trimmed.startsWith('PIDOU-')) return { valid: false, error: '授权码格式错误' };
  const raw = decodePayload(trimmed);
  if (!raw || raw.length < 7) {
    return { valid: false, error: '授权码无效或已损坏' };
  }
  const tChar = raw[0];
  let type;
  if (tChar === 'P') type = 'permanent';
  else if (tChar === 'T') type = 'times';
  else if (tChar === 'Q') type = 'chibi';
  else return { valid: false, error: '授权码类型未知' };
  const credits = parseInt(raw.slice(1, 3), 10);
  const id = raw.slice(3);
  return { valid: true, payload: { t: type, c: credits, i: id } };
}

// ============================================================
// 本地存储管理
// ============================================================
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { code: null, type: null, credits: 0, usedCodes: [] };
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function loadChibiState() {
  try {
    const raw = localStorage.getItem(CHIBI_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { code: null, credits: 0, usedCodes: [] };
}

function saveChibiState(state) {
  try { localStorage.setItem(CHIBI_STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function getChibiFreeUsed() {
  try { return parseInt(localStorage.getItem(CHIBI_FREE_USED_KEY) || '0', 10); } catch { return 0; }
}

function incChibiFreeUsed() {
  try { localStorage.setItem(CHIBI_FREE_USED_KEY, String(getChibiFreeUsed() + 1)); } catch {}
}

// ============================================================
// 图纸导出授权 API
// ============================================================
export function activateLicense(code) {
  const { valid, payload, error } = verifyLicense(code);
  if (!valid) return { success: false, error };

  if (payload.t === 'chibi') {
    return { success: false, error: '此授权码为Q版次数包，请在Q版生成区域激活' };
  }

  const state = loadState();
  if (state.usedCodes?.includes(payload.i)) {
    return { success: false, error: '该授权码已被使用' };
  }

  state.code = code.trim().toUpperCase();
  state.type = payload.t;
  state.credits = payload.c;
  state.usedCodes = [...(state.usedCodes || []), payload.i];
  saveState(state);

  if (payload.t === 'permanent') {
    const chibiState = loadChibiState();
    if (!chibiState.usedCodes?.includes(payload.i)) {
      chibiState.credits = (chibiState.credits || 0) + PERMANENT_CHIBI_CREDITS;
      chibiState.usedCodes = [...(chibiState.usedCodes || []), payload.i];
      saveChibiState(chibiState);
    }
  }

  return {
    success: true,
    type: payload.t,
    credits: payload.c,
    message: payload.t === 'permanent' ? `永久会员已激活，含 ${PERMANENT_CHIBI_CREDITS} 次Q版生成额度` : `已激活，剩余 ${payload.c} 次导出额度`,
  };
}

export function getLicenseState() {
  const state = loadState();
  return {
    activated: Boolean(state.code),
    type: state.type,
    credits: state.credits,
    isPermanent: state.type === 'permanent',
    canExport: state.type === 'permanent' || state.credits > 0,
  };
}

export function consumeExport() {
  const state = loadState();
  if (state.type === 'permanent') return { success: true, remaining: -1 };
  if (state.credits <= 0) return { success: false, error: '导出额度不足' };
  state.credits--;
  saveState(state);
  return { success: true, remaining: state.credits };
}

// ============================================================
// Q版生成授权 API（独立计费）
// ============================================================
export function activateChibiLicense(code) {
  const { valid, payload, error } = verifyLicense(code);
  if (!valid) return { success: false, error };

  if (payload.t !== 'chibi') {
    return { success: false, error: '此授权码为图纸导出码，请在导出区域激活' };
  }

  const state = loadChibiState();
  if (state.usedCodes?.includes(payload.i)) {
    return { success: false, error: '该授权码已被使用' };
  }

  state.code = code.trim().toUpperCase();
  state.credits = (state.credits || 0) + payload.c;
  state.usedCodes = [...(state.usedCodes || []), payload.i];
  saveChibiState(state);

  return {
    success: true,
    credits: state.credits,
    message: `Q版次数包已激活，当前剩余 ${state.credits} 次`,
  };
}

export function getChibiLicenseState() {
  const exportLicense = getLicenseState();
  const chibiState = loadChibiState();
  const freeRemaining = Math.max(0, FREE_CHIBI_LIMIT - getChibiFreeUsed());

  if (chibiState.credits > 0) {
    const source = exportLicense.isPermanent ? 'permanent' : 'paid';
    return { source, credits: chibiState.credits, freeRemaining, can: true };
  }
  if (freeRemaining > 0) {
    return { source: 'free', credits: 0, freeRemaining, can: true };
  }
  return { source: 'none', credits: 0, freeRemaining: 0, can: false };
}

export function canGenerateChibi() {
  const st = getChibiLicenseState();
  const sourceLabel = st.source === 'permanent' ? '永久会员' : st.source === 'paid' ? 'Q版次数包' : st.source === 'free' ? '免费体验' : '已用完';
  const remaining = st.source === 'permanent' || st.source === 'paid' ? st.credits : st.freeRemaining;
  return { can: st.can, remaining, source: sourceLabel };
}

export function consumeChibi() {
  const chibiState = loadChibiState();
  if (chibiState.credits > 0) {
    chibiState.credits--;
    saveChibiState(chibiState);
    return { success: true, remaining: chibiState.credits };
  }

  const freeRemaining = Math.max(0, FREE_CHIBI_LIMIT - getChibiFreeUsed());
  if (freeRemaining > 0) {
    incChibiFreeUsed();
    const newFreeRemaining = Math.max(0, FREE_CHIBI_LIMIT - getChibiFreeUsed());
    return { success: true, remaining: newFreeRemaining };
  }

  return { success: false, error: 'Q版生成次数已用完' };
}

// ============================================================
// 通用 API
// ============================================================
export function clearLicense() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CHIBI_STORAGE_KEY);
  localStorage.removeItem(CHIBI_FREE_USED_KEY);
}

export function checkUrlCode() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) {
    const result = activateLicense(code);
    if (!result.success) {
      const chibiResult = activateChibiLicense(code);
      if (chibiResult.success) {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        window.history.replaceState({}, '', url.toString());
        return chibiResult;
      }
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url.toString());
    return result;
  }

  const chibiCode = params.get('qcode');
  if (chibiCode) {
    const result = activateChibiLicense(chibiCode);
    const url = new URL(window.location.href);
    url.searchParams.delete('qcode');
    window.history.replaceState({}, '', url.toString());
    return result;
  }

  return null;
}
