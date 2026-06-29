// Exact website colors — matches index.html :root variables
export const C = {
  bg:       '#080808',   // --bg
  sidebar:  '#060606',   // --sidebar
  surface:  '#0F0F0F',   // --surface
  elevated: '#161616',   // --elevated
  border:   'rgba(201,168,76,0.12)',   // --border
  borderH:  'rgba(201,168,76,0.38)',   // --border-h
  goldDim:  'rgba(201,168,76,0.07)',   // --gold-dim
  gold:     '#C9A84C',   // --gold
  goldH:    '#DFC070',   // --gold-h
  text:     '#EDE3CE',   // --text
  text2:    '#9A8B72',   // --text-2
  text3:    '#554430',   // --text-3
  green:    '#4CAF82',
  red:      '#CF6679',
};

// Font families — exact same as website CSS variables
export const F = {
  mono:    "'Courier Prime', monospace",     // --mono
  display: "'Special Elite', monospace",    // --display (headings, brand)
  serif:   "'Playfair Display', serif",     // Playfair (score numbers)
};

// Shared style objects
export const S = {
  screen:      { flex: 1, backgroundColor: C.bg },
  card:        { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 10 },
  row:         { flexDirection: 'row', alignItems: 'center' },
  sectionHead: { fontSize: 11, color: C.text3, letterSpacing: 3, textTransform: 'uppercase', fontFamily: F.mono, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 14, marginTop: 8 },
  title:       { fontSize: 22, color: C.text, fontFamily: F.display, fontWeight: '400', letterSpacing: 1 },
  goldText:    { color: C.gold, fontFamily: F.mono },
  dimText:     { color: C.text2, fontFamily: F.mono, fontSize: 12 },
  label:       { fontSize: 10, color: C.text3, letterSpacing: 3, textTransform: 'uppercase', fontFamily: F.mono, marginBottom: 6 },
  input:       { backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.22)', color: C.text, fontFamily: F.mono, fontSize: 14, paddingVertical: 7, paddingHorizontal: 0, marginBottom: 14, outlineWidth: 0 },
  btn:         { backgroundColor: C.gold, padding: 11, alignItems: 'center', marginBottom: 8 },
  btnText:     { color: '#060606', fontFamily: F.mono, fontWeight: '700', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' },
  btnGhost:    { borderWidth: 1, borderColor: C.borderH, padding: 11, alignItems: 'center', marginBottom: 8 },
  btnGhostT:   { color: C.gold, fontFamily: F.mono, fontSize: 12, letterSpacing: 1 },
};
