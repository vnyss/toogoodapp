/**
 * Local-first data layer for the Electron desktop app.
 * All personal data is stored in AsyncStorage (persisted to disk by Electron).
 * Social, auth, and AI calls stay on the server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUser } from './auth';

// ── Profile ──────────────────────────────────────────────────────────────────
export async function saveProfile(data) {
  const u = await getUser();
  await AsyncStorage.setItem(`tg_profile_${u}`, JSON.stringify(data));
  return { ok: true };
}

export async function getMe() {
  const u = await getUser();
  if (!u) return { ok: false };
  const raw = await AsyncStorage.getItem(`tg_profile_${u}`);
  const data = raw ? JSON.parse(raw) : {};
  return { ok: true, username: u, ...data };
}

// ── Diary ─────────────────────────────────────────────────────────────────────
export async function getDiaryEntry(date) {
  const u = await getUser();
  const raw = await AsyncStorage.getItem(`tg_diary_${u}_${date}`);
  return { entry: raw || '' };
}

export async function saveDiaryEntry(date, entry) {
  const u = await getUser();
  await AsyncStorage.setItem(`tg_diary_${u}_${date}`, entry);
  return { ok: true };
}

export async function getDiaryLock() {
  const u = await getUser();
  const raw = await AsyncStorage.getItem(`tg_diary_lock_${u}`);
  const d = raw ? JSON.parse(raw) : {};
  return { setup_done: !!d.pin, enabled: !!d.enabled };
}

export async function setDiaryLock({ action, enabled, pin }) {
  const u = await getUser();
  const key = `tg_diary_lock_${u}`;
  if (action === 'setup') {
    const existing = await AsyncStorage.getItem(key);
    const d = existing ? JSON.parse(existing) : {};
    await AsyncStorage.setItem(key, JSON.stringify({
      pin: pin !== undefined ? pin : d.pin,
      enabled: enabled !== undefined ? enabled : d.enabled,
    }));
    return { ok: true };
  }
  if (action === 'verify') {
    const existing = await AsyncStorage.getItem(key);
    const d = existing ? JSON.parse(existing) : {};
    return { ok: true, valid: !!d.pin && d.pin === pin };
  }
  return { ok: false };
}

// ── Blood Monitor ─────────────────────────────────────────────────────────────
export async function monitorSave({ report, label = '' }) {
  const u = await getUser();
  const key = `tg_monitor_${u}`;
  const raw = await AsyncStorage.getItem(key);
  const history = raw ? JSON.parse(raw) : [];
  history.unshift({
    id: Date.now(),
    scanned_at: new Date().toISOString(),
    label,
    result: report,
  });
  await AsyncStorage.setItem(key, JSON.stringify(history));
  return { ok: true };
}

export async function monitorHistory() {
  const u = await getUser();
  const raw = await AsyncStorage.getItem(`tg_monitor_${u}`);
  return { ok: true, history: raw ? JSON.parse(raw) : [] };
}

// ── Exercise schedule ─────────────────────────────────────────────────────────
// ExerciseScreen and CalendarScreen already write to AsyncStorage first,
// then call these server functions as a secondary sync. Making them no-ops
// means the local AsyncStorage copy is the only copy — no server traffic.
export const saveExerciseSchedule = async () => ({ ok: true });
export const saveExerciseTimes    = async () => ({ ok: true });

// ── Food logs ─────────────────────────────────────────────────────────────────
// LogScreen already stores logs in AsyncStorage (`toogood_daily_logs_${u}`).
// fetchLogs is used to merge server data into local on first load.
// Returning ok:false skips the merge step — local AsyncStorage is authoritative.
export const fetchLogs = async () => ({ ok: false, logs: [] });
export const syncLogs  = async () => ({ ok: true });

// ── Chat sessions ─────────────────────────────────────────────────────────────
// AIScreen stores sessions in AsyncStorage (`toogood_sessions_${u}`) first,
// then calls saveSessions as a sync. Returning ok:false from getSessions
// makes AIScreen fall through to its local AsyncStorage read.
export const getSessions  = async () => ({ ok: false, sessions: [] });
export const saveSessions = async () => ({ ok: true });
