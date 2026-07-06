import { API_BASE, IS_ELECTRON } from './config';
import { getToken } from './auth';
import * as local from './localStore';

async function req(path, opts = {}) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  return res.json();
}

const get  = (path)        => req(path);
const post = (path, body)  => req(path, { method: 'POST', body: JSON.stringify(body) });

// Auth
export const login    = (username, password) => post('/api/v1/login',    { username, password });
export const register = (body)              => post('/api/v1/register', body);
export const logout = ()                   => post('/api/v1/logout', {});
export async function getMe() {
  if (!IS_ELECTRON) return get('/api/v1/me');
  const localData = await local.getMe();
  // If Electron has profile data locally, use it
  if (localData?.ok && (localData.weight_kg || localData.age || localData.full_name)) return localData;
  // Otherwise pull from server and cache locally for future loads
  try {
    const serverData = await get('/api/v1/me');
    if (serverData?.username) {
      await local.saveProfile(serverData);
      return { ok: true, ...serverData };
    }
  } catch {}
  return localData;
}

// Score / XP
export const getScore   = ()       => get('/perfect/api/score');
export const awardXP    = (action) => post('/perfect/api/score/award', { action });
export const leaderboard= ()       => get('/perfect/api/leaderboard');

// Challenges
export const getChallenges    = ()    => get('/perfect/api/challenges');
export const getChallengeLb   = (id) => get(`/perfect/api/challenges/${id}/leaderboard`);

// Clubs
export const getClubs      = ()        => get('/perfect/api/clubs');
export const createClub    = (d)       => post('/perfect/api/clubs/create', d);
export const joinClub      = (id)      => post(`/perfect/api/clubs/${id}/join`, {});
export const leaveClub     = (id)      => post(`/perfect/api/clubs/${id}/leave`, {});
export const getClubDetail = (id)      => get(`/perfect/api/clubs/${id}`);
export const getClubFeed   = (id)      => get(`/perfect/api/clubs/${id}/feed`);

// Segments
export const getSegments      = ()         => get('/perfect/api/segments');
export const createSegment    = (d)        => post('/perfect/api/segments/create', d);
export const getSegmentDetail = (id)       => get(`/perfect/api/segments/${id}`);
export const logEffort        = (id, d)    => post(`/perfect/api/segments/${id}/effort`, d);
export const deleteSegment    = (id)       => post(`/perfect/api/segments/${id}/delete`, {});

// Achievements
export const getAchievements = () => get('/perfect/api/achievements');

// Socials
export const getBuddies    = ()        => get('/perfect/api/buddies');
export const searchUsers   = (q)       => get(`/perfect/api/users/search?q=${encodeURIComponent(q)}`);
export const sendBuddyReq  = (u)       => post('/perfect/api/buddy/request', { username: u });
export const respondBuddy  = (u, act)  => post('/perfect/api/buddy/respond', { username: u, action: act });
export const removeBuddy   = (u)       => post('/perfect/api/buddy/remove', { username: u });
export const getActivity   = (u)       => get(`/perfect/api/activity/${u}`);

// AI Assistant — general chat (no topic restriction)
export const generalAiChat = (msgs) => post('/api/nutriai/chat', { messages: msgs });
export const banComment     = (text, sorry_count) => post('/perfect/ban_comment', { text, sorry_count });
// Log assistant — restricted to logging today's food/activity
export const aiChat    = (message, history) => post('/perfect/api/assistant',  { message, history });
export const coachChat = (message, history) => post('/perfect/api/coach-chat', { message, history });

// Chat sessions (local on desktop, server-synced on web)
export const getSessions  = ()         => IS_ELECTRON ? local.getSessions()          : get('/api/v1/sessions');
export const saveSessions = (sessions) => IS_ELECTRON ? local.saveSessions(sessions) : post('/api/v1/sessions', { sessions });

// Blood Monitor
export const monitorAnalyze = (d)    => post('/perfect/api/monitor', d);                    // {gender, age, values}
export const monitorExtract = (d)    => post('/perfect/api/monitor/extract', d);             // {image_b64, image_mime}

// Photo-based food recognition
export const foodPhotoExtract = (d)  => post('/perfect/api/food/photo-extract', d);          // {image_b64, image_mime}
export const monitorSave    = (data) => IS_ELECTRON ? local.monitorSave(data)    : post('/perfect/api/monitor/save', data);
export const monitorHistory = ()     => IS_ELECTRON ? local.monitorHistory()     : get('/perfect/api/monitor/history');

// Exercise schedule
export const saveExerciseSchedule = (d) => IS_ELECTRON ? local.saveExerciseSchedule(d) : post('/perfect/api/save-day-schedule', d);

// Calendar AI edit
export const calendarEdit     = (d) => post('/perfect/api/calendar-edit', d);                // {instruction}
export const saveExerciseTimes = (d) => IS_ELECTRON ? local.saveExerciseTimes(d) : post('/perfect/api/save-exercise-times', d);

// Settings / Profile
export const saveProfile = (d) => IS_ELECTRON ? local.saveProfile(d) : post('/perfect/api/onboarding', d);
export const changeEmail = (d) => post('/perfect/api/account/email', d);     // {email}

// Daily logs (local on desktop, server-synced on web)
export const fetchLogs = ()      => IS_ELECTRON ? local.fetchLogs()      : get('/perfect/api/daily-logs');
export const syncLogs  = (logs)  => IS_ELECTRON ? local.syncLogs(logs)   : post('/perfect/api/daily-logs', { logs });

// Email / reminders
export const forgotPassword  = (email)                       => post('/api/v1/forgot-password', { email });
export const sendResetCode   = (email)                       => post('/api/v1/password-reset/send', { email });
export const verifyResetCode = (email, code, new_password)   => post('/api/v1/password-reset/verify', { email, code, new_password });
export const calendarRemind  = (date, blocks)                => post('/perfect/api/calendar/remind', { date, blocks });

// Open Food Facts reports minerals in g/100g (sodium, calcium, iron, potassium,
// magnesium, zinc) but our RDI table tracks them in mg — convert on the way in.
// Vitamins A/D/B12 are already µg and vitamin C is already mg in OFF's schema.
function microsFromNutriments(n) {
  return {
    fiber:     Math.round((n.fiber_100g || 0) * 10) / 10,
    sugar:     Math.round((n.sugars_100g || 0) * 10) / 10,
    sodium:    Math.round((n.sodium_100g || 0) * 1000),
    vitA:      Math.round(n['vitamin-a_100g'] || 0),
    vitC:      Math.round((n['vitamin-c_100g'] || 0) * 10) / 10,
    vitD:      Math.round((n['vitamin-d_100g'] || 0) * 10) / 10,
    vitB12:    Math.round((n['vitamin-b12_100g'] || 0) * 10) / 10,
    iron:      Math.round((n.iron_100g || 0) * 1000 * 10) / 10,
    calcium:   Math.round((n.calcium_100g || 0) * 1000),
    potassium: Math.round((n.potassium_100g || 0) * 1000),
    magnesium: Math.round((n.magnesium_100g || 0) * 1000),
    zinc:      Math.round((n.zinc_100g || 0) * 1000 * 10) / 10,
  };
}

// Food search via Open Food Facts (no API key needed)
export async function searchFood(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=10&fields=product_name,brands,nutriments,serving_size,image_small_url`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return (data.products || [])
    .filter(p => p.product_name)
    .map(p => {
      const n = p.nutriments || {};
      return {
        name:     p.product_name,
        brand:    p.brands || '',
        serving:  p.serving_size || '100g',
        calories: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
        protein:  Math.round(n.proteins_100g  || 0),
        carbs:    Math.round(n.carbohydrates_100g || 0),
        fat:      Math.round(n.fat_100g || 0),
        ...microsFromNutriments(n),
      };
    });
}

// ── Watch / Wearable Integrations ─────────────────────────────────────────────
export const watchStatus              = ()           => get('/api/v1/integrations/status');
export const watchSyncGoogleFit       = (days = 7)  => post('/api/v1/integrations/google-fit/sync', { days });
export const watchSyncGarmin          = (days = 7)  => post('/api/v1/integrations/garmin/sync', { days });
export const watchDisconnectGoogleFit = ()           => req('/api/v1/integrations/google-fit/disconnect', { method: 'DELETE' });
export const watchDisconnectGarmin    = ()           => req('/api/v1/integrations/garmin/disconnect',     { method: 'DELETE' });
export const watchData                = (start, end) => get(`/api/v1/integrations/data?start=${start}&end=${end}`);

// Barcode lookup via Open Food Facts (no API key needed)
export async function lookupBarcode(code) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
  if (!res.ok) throw new Error('Not found');
  const data = await res.json();
  if (!data.product) throw new Error('Product not found');
  const p = data.product;
  const n = p.nutriments || {};
  return {
    name:     p.product_name || p.product_name_en || 'Unknown product',
    brand:    p.brands || '',
    serving:  p.serving_size || '100g',
    calories: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
    protein:  Math.round(n.proteins_100g  || 0),
    carbs:    Math.round(n.carbohydrates_100g || 0),
    fat:      Math.round(n.fat_100g || 0),
    ...microsFromNutriments(n),
  };
}
