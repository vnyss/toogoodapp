import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACCENT_MAP = {
  gold:   { gold: '#C9A84C', goldH: '#DFC070', goldDim: 'rgba(201,168,76,0.07)',  border: 'rgba(201,168,76,0.12)',  borderH: 'rgba(201,168,76,0.38)' },
  red:    { gold: '#C94C4C', goldH: '#E07070', goldDim: 'rgba(201,76,76,0.07)',   border: 'rgba(201,76,76,0.12)',   borderH: 'rgba(201,76,76,0.38)' },
  green:  { gold: '#4CAF7C', goldH: '#70D4A0', goldDim: 'rgba(76,175,124,0.07)', border: 'rgba(76,175,124,0.12)',  borderH: 'rgba(76,175,124,0.38)' },
  blue:   { gold: '#4C8FC9', goldH: '#70B0E0', goldDim: 'rgba(76,143,201,0.07)', border: 'rgba(76,143,201,0.12)',  borderH: 'rgba(76,143,201,0.38)' },
  purple: { gold: '#9B6FCC', goldH: '#BA96E8', goldDim: 'rgba(155,111,204,0.07)',border: 'rgba(155,111,204,0.12)', borderH: 'rgba(155,111,204,0.38)' },
  orange: { gold: '#C97B4C', goldH: '#E09A6A', goldDim: 'rgba(201,123,76,0.07)', border: 'rgba(201,123,76,0.12)',  borderH: 'rgba(201,123,76,0.38)' },
  pink:   { gold: '#C94C8A', goldH: '#E070AA', goldDim: 'rgba(201,76,138,0.07)', border: 'rgba(201,76,138,0.12)',  borderH: 'rgba(201,76,138,0.38)' },
  teal:   { gold: '#4CB8B8', goldH: '#70D4D4', goldDim: 'rgba(76,184,184,0.07)', border: 'rgba(76,184,184,0.12)',  borderH: 'rgba(76,184,184,0.38)' },
};

const FS_MAP     = { xs: 12, sm: 13, md: 15, lg: 17, xl: 19 };
const RADIUS_MAP = { sharp: 0, soft: 6, rounded: 14 };

const DARK_MC = {
  bg:      '#000000',
  sidebar: '#000000',
  surface: '#080808',
  elevated:'#101010',
  text:    '#E8E0D0',
  text2:   '#B0A090',
  text3:   '#7A6858',
};

const LIGHT_MC = {
  bg:      '#F5F0E8',
  sidebar: '#EDE8DF',
  surface: '#FFFFFF',
  elevated:'#F0EBE1',
  text:    '#1A1208',
  text2:   '#6B5A3E',
  text3:   '#9A8A72',
};

function buildMc(mode, accent) {
  const base = mode === 'light' ? LIGHT_MC : DARK_MC;
  const ac = ACCENT_MAP[accent] || ACCENT_MAP.green;
  return { ...base, border: ac.border, borderH: ac.borderH, goldDim: ac.goldDim };
}

const defaultTheme = {
  mode: 'dark',
  accent: 'green',
  accentColor: '#4CAF7C',
  accentDim: 'rgba(76,175,124,0.1)',
  mc: { ...DARK_MC, border: 'rgba(76,175,124,0.12)', borderH: 'rgba(76,175,124,0.38)', goldDim: 'rgba(76,175,124,0.07)' },
  fontSize: 15,
  borderRadius: 6,
  weatherEffects: true,
  setTheme: () => {},
  setExtras: () => {},
};

export const ThemeContext = createContext(defaultTheme);

export function useTheme() {
  return useContext(ThemeContext);
}

// keys scoped per user so each account has its own settings
function keys(username) {
  const u = username || '';
  return {
    mode:    `tg_mode${u ? '_' + u : ''}`,
    accent:  `tg_accent${u ? '_' + u : ''}`,
    fs:      `tg_fontsize${u ? '_' + u : ''}`,
    corner:  `tg_corner${u ? '_' + u : ''}`,
    weather: `tg_weather${u ? '_' + u : ''}`,
  };
}

export function ThemeProvider({ username = '', children }) {
  const [mode,           setMode]           = useState('dark');
  const [accent,         setAccent]         = useState('green');
  const [fontSize,       setFontSize]       = useState(15);
  const [borderRadius,   setBorderRadius]   = useState(6);
  const [weatherEffects, setWeatherEffects] = useState(true);

  // Reload whenever the logged-in user changes (new user gets defaults if no saved prefs)
  useEffect(() => {
    const k = keys(username);
    Promise.all([
      AsyncStorage.getItem(k.mode),
      AsyncStorage.getItem(k.accent),
      AsyncStorage.getItem(k.fs),
      AsyncStorage.getItem(k.corner),
      AsyncStorage.getItem(k.weather),
    ]).then(([m, a, fs, corner, wx]) => {
      const finalMode   = m      || 'dark';
      const finalAccent = a      || 'green';
      setMode(finalMode);
      setAccent(finalAccent);
      applyToDom(finalMode, finalAccent);
      setFontSize(fs ? (FS_MAP[fs] || 14) : 14);
      setBorderRadius(corner ? (RADIUS_MAP[corner] || 6) : 6);
      setWeatherEffects(wx !== 'off');
    });
  }, [username]);

  // Saves to AsyncStorage + updates state
  function setTheme(newMode, newAccent) {
    const k = keys(username);
    const resolvedMode   = newMode   ?? mode;
    const resolvedAccent = newAccent ?? accent;
    if (newMode   !== undefined) { setMode(newMode);     AsyncStorage.setItem(k.mode,   newMode); }
    if (newAccent !== undefined) { setAccent(newAccent); AsyncStorage.setItem(k.accent, newAccent); }
    applyToDom(resolvedMode, resolvedAccent);
  }

  function setExtras({ fontsize, corner, weather }) {
    const k = keys(username);
    if (fontsize !== undefined) { setFontSize(FS_MAP[fontsize] || 14);       AsyncStorage.setItem(k.fs,      fontsize); }
    if (corner   !== undefined) { setBorderRadius(RADIUS_MAP[corner] || 6);  AsyncStorage.setItem(k.corner,  corner); }
    if (weather  !== undefined) { setWeatherEffects(weather);                 AsyncStorage.setItem(k.weather, weather ? 'on' : 'off'); }
  }

  const ac          = ACCENT_MAP[accent] || ACCENT_MAP.green;
  const accentColor = ac.gold;
  const accentDim   = ac.goldDim;
  const accentGlow  = `0 0 10px ${ac.gold}66, 0 0 22px ${ac.gold}30`;
  const mc          = buildMc(mode, accent);

  const value = { mode, accent, accentColor, accentDim, accentGlow, mc, fontSize, borderRadius, weatherEffects, setTheme, setExtras };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function applyToDom(mode, accent) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const ac = ACCENT_MAP[accent] || ACCENT_MAP.green;
  root.style.setProperty('--gold', ac.gold);
  root.style.setProperty('--gold-h', ac.goldH);
  root.style.setProperty('--gold-dim', ac.goldDim);
  root.style.setProperty('--border', ac.border);
  root.style.setProperty('--border-h', ac.borderH);
  if (mode === 'light') {
    root.classList.add('light-mode');
    root.style.setProperty('--bg', '#F5F0E8');
    root.style.setProperty('--sidebar', '#080808');
    root.style.setProperty('--surface', '#FFFFFF');
    root.style.setProperty('--elevated', '#F0EBE1');
    root.style.setProperty('--text', '#1A1208');
    root.style.setProperty('--text-2', '#6B5A3E');
    root.style.setProperty('--text-3', '#9A8A72');
    document.body.style.backgroundColor = '#F5F0E8';
    document.body.style.color = '#1A1208';
  } else {
    root.classList.remove('light-mode');
    root.style.setProperty('--bg', '#000000');
    root.style.setProperty('--sidebar', '#000000');
    root.style.setProperty('--surface', '#080808');
    root.style.setProperty('--elevated', '#101010');
    root.style.setProperty('--text', '#E8E0D0');
    root.style.setProperty('--text-2', '#8A7A68');
    root.style.setProperty('--text-3', '#3E3228');
    document.body.style.backgroundColor = '#000000';
    document.body.style.color = '#E8DCC8';
  }
}
