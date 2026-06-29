import { API_BASE } from './config';
import { getToken } from './auth';

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
export const getMe  = ()                   => get('/api/v1/me');

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

// Chat sessions (server-side sync)
export const getSessions  = ()         => get('/api/v1/sessions');
export const saveSessions = (sessions) => post('/api/v1/sessions', { sessions });

// Blood Monitor
export const monitorAnalyze = (d)    => post('/perfect/api/monitor', d);                    // {gender, age, values}
export const monitorExtract = (d)    => post('/perfect/api/monitor/extract', d);             // {image_b64, image_mime}
export const monitorSave    = (data) => post('/perfect/api/monitor/save', data);             // {report: {...}, label?}
export const monitorHistory = ()     => get('/perfect/api/monitor/history');

// Exercise schedule
export const saveExerciseSchedule = (d) => post('/perfect/api/save-day-schedule', d);       // {schedule, pool}

// Calendar AI edit
export const calendarEdit     = (d) => post('/perfect/api/calendar-edit', d);                // {instruction}
export const saveExerciseTimes = (d) => post('/perfect/api/save-exercise-times', d);         // {times}

// Settings / Profile
export const saveProfile = (d) => post('/perfect/api/onboarding', d);       // {age, gender, weight_kg, height_cm, target_weight_kg, goal, activity_level, mobility_note, food_prefs}
export const changeEmail = (d) => post('/perfect/api/account/email', d);     // {email}

// Daily logs sync (persists across devices/browsers)
export const fetchLogs = ()      => get('/perfect/api/daily-logs');
export const syncLogs  = (logs)  => post('/perfect/api/daily-logs', { logs });

// Email / reminders
export const forgotPassword  = (email)         => post('/api/v1/forgot-password', { email });
export const calendarRemind  = (date, blocks)  => post('/perfect/api/calendar/remind', { date, blocks });
