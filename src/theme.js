// Exact website colors — matches index.html :root variables
export const C = {
  bg:       '#000000',   // --bg
  sidebar:  '#000000',   // --sidebar
  surface:  '#0A0A0A',   // --surface
  elevated: '#111111',   // --elevated
  border:   'rgba(76,175,124,0.10)',   // --border (default accent: green)
  borderH:  'rgba(76,175,124,0.32)',   // --border-h
  goldDim:  'rgba(76,175,124,0.06)',   // --gold-dim
  gold:     '#4CAF7C',   // --gold (default accent color, user-changeable in Settings)
  goldH:    '#70D4A0',   // --gold-h
  text:     '#E8E0D0',   // --text
  text2:    '#B0A090',   // --text-2
  text3:    '#7A6858',   // --text-3
  green:    '#4CAF82',
  red:      '#C85A6E',
};

// Font families — typewriter aesthetic throughout
export const F = {
  mono:       "'Courier New', Courier, monospace",  // typewriter mono (data, labels)
  display:    "'Courier New', Courier, monospace",  // typewriter headings
  serif:      "'Courier New', Courier, monospace",  // typewriter display numbers
  nightshade: "'Jim Nightshade', cursive",          // dashboard name only
};

// Shared style objects
export const S = {
  screen:      { flex: 1, backgroundColor: C.bg },
  card:        { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 8 },
  row:         { flexDirection: 'row', alignItems: 'center' },
  sectionHead: { fontSize: 12, color: C.text3, letterSpacing: 2.5, textTransform: 'uppercase', fontFamily: F.mono, fontWeight: '600', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12, marginTop: 8 },
  title:       { fontSize: 22, color: C.text, fontFamily: F.display, fontWeight: '700', letterSpacing: -0.2 },
  goldText:    { color: C.gold, fontFamily: F.mono },
  dimText:     { color: C.text2, fontFamily: F.mono, fontSize: 13 },
  label:       { fontSize: 11, color: C.text3, letterSpacing: 2.5, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 6 },
  input:       { backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'rgba(76,175,124,0.18)', color: C.text, fontFamily: F.mono, fontSize: 14, paddingVertical: 7, paddingHorizontal: 0, marginBottom: 12, outlineWidth: 0 },
  btn:         { backgroundColor: C.gold, paddingVertical: 11, paddingHorizontal: 18, alignItems: 'center', marginBottom: 6 },
  btnText:     { color: '#000000', fontFamily: F.mono, fontWeight: '700', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  btnGhost:    { borderWidth: 1, borderColor: C.borderH, paddingVertical: 11, paddingHorizontal: 18, alignItems: 'center', marginBottom: 6 },
  btnGhostT:   { color: C.gold, fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5 },
};
