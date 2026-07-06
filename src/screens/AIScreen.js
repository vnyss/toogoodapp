import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform, useWindowDimensions,
} from 'react-native';
import Svg, { Path, Line, Rect, Circle, Polyline, Polygon } from 'react-native-svg';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { generalAiChat, getSessions, saveSessions, banComment, lookupBarcode, getMe } from '../api';
import BarcodeScanner from '../components/BarcodeScanner';
import { getToken, getUser } from '../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IS_ELECTRON } from '../config';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function MicIcon({ size = 13, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text3;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <Rect x="9" y="2" width="6" height="12" rx="3" />
      <Path d="M5 10a7 7 0 0 0 14 0" />
      <Line x1="12" y1="19" x2="12" y2="22" />
      <Line x1="8" y1="22" x2="16" y2="22" />
    </Svg>
  );
}

function SendIcon({ size = 14, color = '#080808' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
      <Line x1="22" y1="2" x2="11" y2="13" />
      <Polygon points="22 2 15 22 11 13 2 9 22 2" fill={color} />
    </Svg>
  );
}

function PlusIcon({ size = 14, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text3;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function ChatIcon({ size = 13, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text3;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

function CheckIcon() {
  const { mc } = useTheme();
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth="2" strokeLinecap="round">
      <Path d="M9 11l3 3L22 4" />
      <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Svg>
  );
}

function FireIcon() {
  const { mc } = useTheme();
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth="2" strokeLinecap="round">
      <Path d="M12 2c0 0-4 4-4 8a4 4 0 0 0 8 0c0-4-4-8-4-8z" />
      <Path d="M12 14v8" />
      <Path d="M9 19h6" />
    </Svg>
  );
}

function InfoIcon() {
  const { mc } = useTheme();
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth="2" strokeLinecap="round">
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="8" x2="12" y2="12" />
      <Line x1="12" y1="16" x2="12.01" y2="16" />
    </Svg>
  );
}

function CalendarIcon() {
  const { mc } = useTheme();
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth="2" strokeLinecap="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  );
}

function BarChartIcon() {
  const { mc } = useTheme();
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth="2" strokeLinecap="round">
      <Line x1="18" y1="20" x2="18" y2="10" />
      <Line x1="12" y1="20" x2="12" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="14" />
    </Svg>
  );
}

function HeartIcon() {
  const { mc } = useTheme();
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth="2" strokeLinecap="round">
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  );
}

function RegenIcon({ size = 12, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text2;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Polyline points="1 4 1 10 7 10" />
      <Path d="M3.51 15a9 9 0 1 0 .49-3.79" />
    </Svg>
  );
}

function CopyIcon({ size = 10, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text3;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Rect x="9" y="9" width="13" height="13" rx="1" />
      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

function TrashIcon({ size = 12, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text3;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <Path d="M10 11v6M14 11v6" />
      <Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Svg>
  );
}

function ExportIcon({ size = 12, color }) {
  const { mc } = useTheme();
  color = color ?? mc.text3;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Polyline points="7 10 12 15 17 10" />
      <Line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  );
}

// ─── Chip definitions ─────────────────────────────────────────────────────────

const CHIPS = [
  { id: 'diet',     label: 'Build my plan',     Icon: CheckIcon },
  { id: 'roast',    label: 'Roast my diet',      Icon: FireIcon },
  { id: 'missing',  label: 'What am I missing?', Icon: InfoIcon },
  { id: '7day',     label: '7-day meal plan',    Icon: CalendarIcon },
  { id: 'calories', label: 'Calorie target',     Icon: BarChartIcon },
  { id: 'protein',  label: 'High-protein foods', Icon: HeartIcon },
];

const CHIP_PROMPTS = {
  diet:     'Make me a personalised diet plan.',
  missing:  'What micronutrients am I most likely deficient in, and exactly how do I fix each one through food or supplements?',
  '7day':   'Give me a practical 7-day healthy meal plan with breakfast, lunch, dinner and one snack each day. Make it realistic, not boring, and include rough calorie counts per meal.',
  calories: 'How many calories should I eat per day to lose 0.5 kg per week safely? Walk me through the full calculation based on my stats.',
  protein:  'What are the best high-protein foods I should be eating, and exactly how much protein do I need per day? Give me a practical list with amounts.',
};

const FUNNY = [
  "Consulting the broccoli elders...",
  "Asking 47 nutritionists who all disagree...",
  "Checking if pizza counts as a vegetable...",
  "Negotiating with your carbohydrates...",
  "Running the calorie math... running it again...",
  "Bribing the metabolism gnomes for insider tips...",
  "Translating your body's cryptic demands...",
  "Interrogating a rogue protein molecule...",
  "Calculating how many salads equal happiness...",
  "Convincing your metabolism to cooperate...",
  "Pretending I know what adaptogens are...",
  "Counting calories you haven't logged yet...",
  "Apologising to your vegetables on your behalf...",
  "Diplomatically not mentioning the samosa...",
  "Negotiating a peace treaty between your goals and your appetite...",
];

// ─── Diet keyword triggers ────────────────────────────────────────────────────

const DIET_TRIGGERS = [
  /build.{0,20}(me.{0,10})?(a.{0,5})?(diet|meal|nutrition|eating)/i,
  /create.{0,20}(me.{0,10})?(a.{0,5})?(diet|meal|nutrition|plan)/i,
  /make.{0,20}(me.{0,10})?(a.{0,5})?(diet|meal|plan)/i,
  /give.{0,20}(me.{0,10})?(a.{0,5})?(diet|meal|plan)/i,
  /design.{0,20}(a.{0,5})?(diet|meal|nutrition)/i,
  /what (should|can) i eat/i,
  /meal plan/i,
  /diet plan/i,
  /eating plan/i,
  /nutrition plan/i,
  /help.{0,10}(me.{0,5})?(diet|eat|meal)/i,
  /food plan/i,
];

function isDietQuery(text) {
  return DIET_TRIGGERS.some(r => r.test(text));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SESS_KEY = u => `toogood_sessions_${u}`;

function autoTitle(text = '') {
  let t = (text || '').trim().replace(/\n/g, ' ');
  const STRIP = /^(can you|could you|please|i want to|i want|i need to|i need|help me|tell me|show me|what is|what are|what's|how do i|how do|give me|make me a|make me|create a|create|build me|build a|make a|make)\s+/i;
  let prev;
  do { prev = t; t = t.replace(STRIP, ''); } while (t !== prev);
  t = t.replace(/[?!.]+$/, '').trim();
  if (!t) t = text.trim().slice(0, 48);
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 52) || 'Conversation';
}

// ─── Markdown text renderer ───────────────────────────────────────────────────

function parseLine(line) {
  // Returns array of {text, bold, italic}
  const out = [];
  let cur = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] === '*' && line[i + 1] === '*') {
      const end = line.indexOf('**', i + 2);
      if (end > -1) {
        if (cur) { out.push({ text: cur }); cur = ''; }
        out.push({ text: line.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }
    if (line[i] === '*') {
      const end = line.indexOf('*', i + 1);
      if (end > -1) {
        if (cur) { out.push({ text: cur }); cur = ''; }
        out.push({ text: line.slice(i + 1, end), italic: true });
        i = end + 1;
        continue;
      }
    }
    cur += line[i];
    i++;
  }
  if (cur) out.push({ text: cur });
  return out;
}

function isTableLine(line) { return /^\s*\|/.test(line); }
function isSepLine(line) { return /^\s*\|[\s\-:|]+\|/.test(line); }

function MsgTable({ rows, mc, accentColor }) {
  if (rows.length < 2) return null;
  const header = rows[0].split('|').map(c => c.trim()).filter(Boolean);
  const body = rows.slice(2).map(r => r.split('|').map(c => c.trim()).filter(Boolean));
  const cellBase = { fontFamily: F.mono, fontSize: 12, color: mc.text, paddingVertical: 5, paddingHorizontal: 8 };
  return (
    <View style={{ borderWidth: 1, borderColor: mc.border, marginVertical: 8, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', backgroundColor: accentColor + '18', borderBottomWidth: 1, borderBottomColor: mc.border }}>
        {header.map((h, i) => (
          <Text key={i} style={[cellBase, { fontWeight: '700', color: accentColor, flex: i === 0 ? 2 : 1 }]}>{h}</Text>
        ))}
      </View>
      {body.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', borderBottomWidth: ri < body.length - 1 ? 1 : 0, borderBottomColor: mc.border, backgroundColor: ri % 2 === 0 ? 'transparent' : mc.bg + '60' }}>
          {header.map((_, ci) => (
            <Text key={ci} style={[cellBase, { flex: ci === 0 ? 2 : 1, color: ci === 0 ? mc.text2 : mc.text }]}>{row[ci] || ''}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function MsgText({ text, mc, accentColor }) {
  const msgTxt = { fontFamily: F.mono, fontSize: 15, color: mc.text, lineHeight: 28, letterSpacing: 0.3 };
  const lines = (text || '').split('\n');
  const elements = [];
  let tableRows = [];
  let li = 0;

  function flushTable() {
    if (tableRows.length >= 2) {
      elements.push(<MsgTable key={`tbl_${li}`} rows={tableRows} mc={mc} accentColor={accentColor} />);
    }
    tableRows = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isTableLine(line)) {
      tableRows.push(line);
      li = i;
    } else {
      if (tableRows.length) flushTable();
      const isBullet = /^[\-\*•]\s/.test(line);
      const isHeader = /^#{1,3}\s/.test(line);
      const content = isBullet ? line.replace(/^[\-\*•]\s/, '') : isHeader ? line.replace(/^#+\s/, '') : line;
      const parts = parseLine(content);
      if (!content.trim() && !isBullet) {
        elements.push(<View key={i} style={{ height: 6 }} />);
      } else {
        elements.push(
          <Text key={i} style={[
            msgTxt,
            isBullet && { marginLeft: 12 },
            isHeader && { fontFamily: F.display, fontSize: 16, color: mc.text, marginBottom: 4, marginTop: 8 },
          ]}>
            {isBullet ? <Text style={{ color: accentColor }}>{'• '}</Text> : null}
            {parts.map((p, pi) =>
              p.bold
                ? <Text key={pi} style={[msgTxt, { color: accentColor, fontWeight: '700' }]}>{p.text}</Text>
                : p.italic
                ? <Text key={pi} style={[msgTxt, { color: mc.text2, fontStyle: 'italic' }]}>{p.text}</Text>
                : <Text key={pi} style={msgTxt}>{p.text}</Text>
            )}
          </Text>
        );
      }
    }
  }
  if (tableRows.length) flushTable();
  return <View>{elements}</View>;
}

// ─── Session row component ────────────────────────────────────────────────────

function SessRow({ s, cur, onOpen, onDel, mc, accentColor, st }) {
  const isCur = s.id === cur;
  return (
    <View style={st.sessRow}>
      <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={() => onOpen(s)}>
        <Text style={[st.sessTitle, isCur && { color: accentColor }]} numberOfLines={1}>
          {s.title}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onDel(s.id)} style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
        <TrashIcon size={11} color={mc.text3} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Message row component ────────────────────────────────────────────────────

function MessageRow({ msg, initials, onCopy, mc, accentColor, st }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(msg.content).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }

  function handleDownloadDiet() {
    if (Platform.OS !== 'web') return;
    const now  = new Date();
    const date = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const yr   = now.getFullYear();
    const ac   = accentColor || '#4CAF7C';
    const acL  = ac + '15';
    const acM  = ac + '33';
    const acD  = ac + '55';

    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function inline(s) {
      return esc(s)
        .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,'<em>$1</em>');
    }

    function mdToHtml(md) {
      const lines = md.split('\n');
      let out = '', inTable = false, tHeadDone = false, inList = false, inNotes = false;
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i], line = raw.trim();
        if (line.startsWith('|')) {
          if (!inTable) { out += '<div class="tbl-wrap"><table>'; inTable = true; tHeadDone = false; }
          if (/^\|[\s\-|:]+\|$/.test(line)) { if(!tHeadDone){ out+='<tbody>'; tHeadDone=true; } continue; }
          const cells = line.split('|').slice(1,-1).map(c=>c.trim());
          const isNum = (v) => /^[\d,.\-–—\s]+$/.test(v);
          if (!tHeadDone) {
            out += '<thead><tr>' + cells.map(c=>`<th>${esc(c)}</th>`).join('') + '</tr></thead>';
          } else {
            const isTotal = /total|summary/i.test(cells[0]);
            out += `<tr${isTotal?' class="total-row"':''}>` + cells.map((c,ci)=>`<td${ci>0&&isNum(c)?' class="num"':''}>${esc(c)}</td>`).join('') + '</tr>';
          }
          continue;
        }
        if (inTable) { out += tHeadDone?'</tbody></table></div>':'</table></div>'; inTable=false; tHeadDone=false; }

        if (line.startsWith('### ')){ if(inList){out+='</ul>';inList=false;} out+=`<h3>${inline(line.slice(4))}</h3>`; continue; }
        if (line.startsWith('## ')) { if(inList){out+='</ul>';inList=false;} out+=`<h2>${inline(line.slice(3))}</h2>`; continue; }
        if (line.startsWith('# '))  { if(inList){out+='</ul>';inList=false;} out+=`<h2>${inline(line.slice(2))}</h2>`; continue; }

        if (/coach\s*notes/i.test(line)) {
          if(inList){out+='</ul>';inList=false;}
          out+=`<div class="notes-box"><div class="notes-header"><span class="notes-icon">✦</span>Coach Notes</div><div class="notes-body">`;
          inNotes=true; continue;
        }
        if (/^[-•*]\s/.test(raw)) {
          if(!inList){ out+='<ul>'; inList=true; }
          out+=`<li>${inline(raw.replace(/^[-•*]\s/,''))}</li>`; continue;
        }
        if (/^\d+\.\s/.test(raw)) {
          if(!inList){ out+='<ol>'; inList=true; }
          out+=`<li>${inline(raw.replace(/^\d+\.\s/,''))}</li>`; continue;
        }
        if (inList) { out+='</ul>'; inList=false; if(inNotes){out+='</div></div>';inNotes=false;} }
        if (line==='') continue;
        out+=`<p>${inline(raw)}</p>`;
      }
      if (inTable) out += tHeadDone?'</tbody></table></div>':'</table></div>';
      if (inList)  out += '</ul>';
      if (inNotes) out += '</div></div>';
      return out;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Personalised Diet Plan — Too Good</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:'Inter',sans-serif;color:#1c1208;background:#ffffff;font-size:12.5px;line-height:1.7;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* ═══════════════════════════════════════════════════════
   COVER PAGE
═══════════════════════════════════════════════════════ */
.cover{
  min-height:100vh;background:linear-gradient(160deg,#080604 0%,#161009 55%,#0c0a07 100%);
  color:#fff;display:flex;flex-direction:column;padding:0;position:relative;overflow:hidden;
  page-break-after:always;
}
.cover-deco{position:absolute;inset:0;pointer-events:none}
.cover-inner{flex:1;display:flex;flex-direction:column;padding:72px 80px}
.cover-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:auto}
.cover-brand{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;letter-spacing:6px;text-transform:uppercase;color:${ac}}
.cover-ref{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:3px;color:rgba(255,255,255,0.22);text-transform:uppercase}
.cover-mid{margin:auto 0;padding:60px 0 48px}
.cover-eyebrow{font-family:'Inter',sans-serif;font-size:10px;font-weight:500;letter-spacing:6px;text-transform:uppercase;color:${ac};margin-bottom:28px;display:flex;align-items:center;gap:14px}
.cover-eyebrow::before{content:'';display:block;width:32px;height:1px;background:${ac}}
.cover-h1{font-family:'Cormorant Garamond',serif;font-size:88px;font-weight:300;line-height:0.92;letter-spacing:-3px;color:#ffffff;margin-bottom:6px}
.cover-h1 em{color:${ac};font-style:italic}
.cover-rule{width:64px;height:1px;background:linear-gradient(to right,${ac},transparent);margin:32px 0}
.cover-tagline{font-family:'Inter',sans-serif;font-size:13px;font-weight:300;color:rgba(255,255,255,0.38);letter-spacing:1.5px;max-width:400px;line-height:1.8}
.cover-bottom{border-top:1px solid rgba(255,255,255,0.08);padding-top:28px;display:flex;justify-content:space-between;align-items:flex-end}
.cover-meta{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.25);line-height:1.9}
.cover-seal{border:1px solid ${acD};padding:8px 18px;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:${ac}}

/* ═══════════════════════════════════════════════════════
   CONTENT PAGES
═══════════════════════════════════════════════════════ */
.page-header{display:flex;justify-content:space-between;align-items:center;padding:20px 72px 16px;border-bottom:1px solid #ece6dc}
.page-header-brand{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:4px;text-transform:uppercase;color:${ac}}
.page-header-title{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#c0b4a0}
.page-header-date{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:2px;color:#c0b4a0}

.content{padding:44px 72px 120px;max-width:100%}

/* ── Headings ── */
h2{
  font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:400;font-style:italic;
  color:#1c1208;margin:48px 0 18px;letter-spacing:-0.3px;line-height:1.2;
  border-bottom:1px solid #e4ddd3;padding-bottom:10px;
  display:flex;align-items:center;gap:12px
}
h2::before{content:'';display:inline-block;width:3px;height:26px;background:${ac};flex-shrink:0;border-radius:2px}
h3{
  font-family:'Inter',sans-serif;font-size:9px;font-weight:700;letter-spacing:5px;
  text-transform:uppercase;color:${ac};margin:28px 0 10px
}
p{margin-bottom:12px;line-height:1.8;color:#3a2e20;font-size:13px}

/* ── Table ── */
.tbl-wrap{margin:22px 0 32px;border-radius:2px;overflow:hidden;border:1px solid #e4ddd3;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
table{width:100%;border-collapse:collapse;font-size:11.5px}
thead tr{background:#1c1208}
thead th{
  padding:11px 14px;text-align:left;font-family:'Inter',sans-serif;
  font-weight:600;letter-spacing:1px;font-size:9.5px;text-transform:uppercase;color:#f0e8d8
}
thead th:first-child{padding-left:18px}
tbody tr{border-bottom:1px solid #ece6dc;transition:background 0.1s}
tbody tr:nth-child(even){background:#faf7f3}
tbody td{padding:10px 14px;vertical-align:top;color:#2a1e10;font-size:12px;line-height:1.55}
tbody td:first-child{padding-left:18px;font-weight:500}
td.num{text-align:right;font-family:'JetBrains Mono',monospace;font-size:11px;color:#4a3a28}
.total-row{background:${acL} !important;border-top:1.5px solid ${acD} !important;border-bottom:1.5px solid ${acD} !important}
.total-row td{font-weight:700;color:#1c1208;font-family:'Inter',sans-serif}
.total-row td.num{font-family:'JetBrains Mono',monospace;font-weight:700}

/* ── Coach notes ── */
.notes-box{margin:36px 0;background:#faf7f2;border:1px solid ${acM};border-radius:2px;overflow:hidden}
.notes-header{
  background:${acL};padding:12px 20px;font-family:'Inter',sans-serif;
  font-size:9.5px;font-weight:700;letter-spacing:4px;text-transform:uppercase;
  color:${ac};display:flex;align-items:center;gap:10px;border-bottom:1px solid ${acM}
}
.notes-icon{font-size:12px}
.notes-body{padding:18px 22px}
.notes-body ul{padding-left:0;list-style:none;margin:0}
.notes-body li{
  padding:8px 0 8px 22px;border-bottom:1px solid ${acL};position:relative;
  font-size:12.5px;line-height:1.75;color:#3a2e20
}
.notes-body li:last-child{border-bottom:none}
.notes-body li::before{content:'→';position:absolute;left:0;color:${ac};font-weight:700}
ul,ol{padding-left:22px;margin:10px 0 18px}
li{margin-bottom:6px;line-height:1.8;font-size:12.5px;color:#3a2e20}

/* ── Footer ── */
.doc-footer{
  position:fixed;bottom:0;left:0;right:0;
  display:flex;justify-content:space-between;align-items:center;
  padding:11px 72px;background:#fff;border-top:1px solid #ece6dc
}
.doc-footer span{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:2.5px;text-transform:uppercase;color:#c0b4a0}
.doc-footer .ft-mid{color:${ac}}

@media print{
  @page{margin:0;size:A4}
  body{background:#fff}
  .tbl-wrap{box-shadow:none}
  .doc-footer{position:fixed;bottom:0}
  .cover{min-height:100vh;page-break-after:always}
}
</style>
</head>
<body>

<!-- ═══ COVER ═══ -->
<div class="cover">
  <!-- Decorative SVG -->
  <svg class="cover-deco" viewBox="0 0 800 1130" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%">
    <circle cx="720" cy="160" r="320" stroke="${ac}" stroke-opacity="0.04" stroke-width="1"/>
    <circle cx="720" cy="160" r="220" stroke="${ac}" stroke-opacity="0.05" stroke-width="1"/>
    <circle cx="720" cy="160" r="120" stroke="${ac}" stroke-opacity="0.07" stroke-width="1"/>
    <circle cx="720" cy="160" r="50"  fill="${ac}" fill-opacity="0.06"/>
    <line x1="0" y1="900" x2="800" y2="900" stroke="white" stroke-opacity="0.04" stroke-width="1"/>
    <line x1="80" y1="900" x2="80" y2="1130" stroke="${ac}" stroke-opacity="0.12" stroke-width="1"/>
    <rect x="80" y="900" width="640" height="1" fill="${ac}" fill-opacity="0.15"/>
  </svg>

  <div class="cover-inner">
    <div class="cover-top">
      <div class="cover-brand">Too Good</div>
      <div class="cover-ref">Ref: TG-DIET-${yr}</div>
    </div>

    <div class="cover-mid">
      <div class="cover-eyebrow">Personalised Nutrition Programme</div>
      <div class="cover-h1">Diet<br><em>Plan.</em></div>
      <div class="cover-rule"></div>
      <div class="cover-tagline">A precision-crafted nutrition plan tailored to your body, goals, and lifestyle — powered by Too Good AI.</div>
    </div>

    <div class="cover-bottom">
      <div class="cover-meta">
        <div>Prepared on</div>
        <div>${date}</div>
      </div>
      <div class="cover-seal">Powered by Too Good AI</div>
    </div>
  </div>
</div>

<!-- ═══ PAGE HEADER ═══ -->
<div class="page-header">
  <span class="page-header-brand">Too Good</span>
  <span class="page-header-title">Personalised Diet Plan</span>
  <span class="page-header-date">${date}</span>
</div>

<!-- ═══ CONTENT ═══ -->
<div class="content">
  ${mdToHtml(msg.content)}
</div>

<!-- ═══ FOOTER ═══ -->
<div class="doc-footer">
  <span>Too Good</span>
  <span class="ft-mid">Personalised Diet Plan</span>
  <span>${date}</span>
</div>

<script>document.fonts.ready.then(()=>setTimeout(()=>window.print(),500))</script>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    if (IS_ELECTRON) {
      // Electron intercepts window.open — open blob in new window directly
      const w = window.open(blobUrl, '_blank', 'width=900,height=700');
      if (!w) {
        // Fallback: trigger download so user can open manually
        const a = document.createElement('a');
        a.href = blobUrl; a.download = 'TooGood-Diet-Plan.html';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
    } else {
      window.open(blobUrl, '_blank');
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }

  return (
    <View style={[st.msgRow, isUser && st.msgRowUser]}>
      {isUser
        ? <View style={st.userAvatar}><Text style={st.avatarTxt}>{initials}</Text></View>
        : <View style={st.aiAvatar}><Text style={st.avatarTxt}>T</Text></View>
      }
      <View style={st.msgBubbleWrap}>
        <MsgText text={msg.content} mc={mc} accentColor={accentColor} />
        {Platform.OS === 'web' && (
          <View style={{ marginTop: 10, gap: 8 }}>
            {msg.isDiet && (
              <TouchableOpacity
                onPress={handleDownloadDiet}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: accentColor, alignSelf: 'flex-start',
                  paddingVertical: 9, paddingHorizontal: 18, borderRadius: 4,
                }}
              >
                <ExportIcon size={13} color="#080808" />
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: '#080808', fontWeight: '700', letterSpacing: 1 }}>
                  Save as PDF
                </Text>
              </TouchableOpacity>
            )}
            <View style={st.msgActions}>
              <TouchableOpacity style={st.msgActionBtn} onPress={handleCopy}>
                <CopyIcon size={10} color={copied ? accentColor : mc.text3} />
                <Text style={[st.msgActionTxt, copied && { color: accentColor }]}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingRow({ funnyIdx, st }) {
  return (
    <View style={st.msgRow}>
      <View style={st.aiAvatar}><Text style={st.avatarTxt}>T</Text></View>
      <View style={st.msgBubbleWrap}>
        <Text style={st.thinkingTxt}>{FUNNY[funnyIdx % FUNNY.length]}</Text>
      </View>
    </View>
  );
}

// ─── Diet MCQ Modal ───────────────────────────────────────────────────────────

const MCQ_STEPS = [
  {
    id: 'goal', q: "What's the mission here?",
    opts: [
      { val: 'weight_loss', label: 'Lose weight',   desc: 'The eternal human struggle' },
      { val: 'weight_gain', label: 'Gain weight',   desc: 'Build up, fill out, get there' },
      { val: 'muscle_gain', label: 'Build muscle',  desc: 'Strength, size, and power' },
      { val: 'maintain',    label: 'Stay the same', desc: "Not broken, don't fix it" },
      { val: 'health',      label: 'Eat healthier', desc: 'Do the responsible thing, ugh' },
    ],
  },
  {
    id: 'meals', q: 'How many times a day do you eat?',
    opts: [
      { val: '2', label: '2 meals',  desc: 'Warrior mode / OMAD adjacent' },
      { val: '3', label: '3 meals',  desc: 'The classic human schedule' },
      { val: '4', label: '4 meals',  desc: 'Including a snack (very wise)' },
      { val: '5', label: '5+ meals', desc: 'Never not eating (respect)' },
    ],
  },
  {
    id: 'diet_type', q: "What's the dietary style?",
    opts: [
      { val: 'non_veg',    label: 'Non-veg',    desc: 'Full food chain, no regrets' },
      { val: 'veg',        label: 'Vegetarian', desc: 'Plants are friends AND food' },
      { val: 'vegan',      label: 'Vegan',      desc: 'Hardcore plants-only mode' },
      { val: 'eggetarian', label: 'Eggetarian', desc: 'Vegetarian but chickens owe you' },
    ],
  },
  {
    id: 'restrictions', q: 'Any strong food opinions?',
    opts: [
      { val: 'none',      label: 'None',       desc: 'Iron stomach, very blessed' },
      { val: 'no_dairy',  label: 'No dairy',   desc: 'Milk and I had a falling out' },
      { val: 'no_gluten', label: 'No gluten',  desc: 'Bread is the enemy' },
      { val: 'no_nuts',   label: 'No nuts',    desc: 'Tree nuts specifically' },
    ],
  },
  {
    id: 'duration', q: 'How long a plan are we cooking up?',
    opts: [
      { val: '1_day',   label: 'Just today',  desc: 'Living in the moment' },
      { val: '3_days',  label: '3-day plan',  desc: 'A solid mini-commitment' },
      { val: '1_week',  label: '1-week plan', desc: 'The responsible adult choice' },
      { val: '2_weeks', label: '2-week plan', desc: "Full lifestyle arc, let's go" },
    ],
  },
];

function computeTDEE({ weight, height, age, gender, activity }) {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'female' ? -161 : 5);
  const mult = { sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, very_active: 1.725 };
  return Math.round(bmr * (mult[activity] || 1.55));
}

function resolveVal(map, val) {
  if (Array.isArray(val)) {
    return val.map(v => v.startsWith('custom:') ? v.slice(7) : (map[v] || v)).join('; ');
  }
  if (typeof val === 'string' && val.startsWith('custom:')) return val.slice(7);
  return map[val] || val;
}

function buildDietPrompt(a, profileData) {
  const gMap = {
    weight_loss: 'weight loss — calorie deficit (300–500 kcal below TDEE), high protein, high fibre, filling whole foods',
    weight_gain: 'weight gain — calorie surplus (300–500 kcal above TDEE), high protein (1.6–2 g/kg), nutrient-dense calorie-rich foods, frequent meals',
    muscle_gain: 'muscle gain — moderate calorie surplus, very high protein (1.8–2.2 g/kg), complex carbs for training energy',
    maintain:    'weight maintenance — balanced macros, sustainable eating patterns',
    health:      'general health improvement — micronutrient-rich whole foods, variety, WHO guidelines',
  };
  const mMap = { '2': '2 meals/day', '3': '3 meals/day', '4': '4 meals/day (3 main + 1 snack)', '5': '5+ smaller meals/day' };
  const dMap = {
    non_veg:    'non-vegetarian (chicken, fish, eggs, lean meat all fine)',
    veg:        'vegetarian (no meat or fish; dairy and eggs fine)',
    vegan:      'vegan (zero animal products)',
    eggetarian: 'eggetarian (vegetarian + eggs; no meat or fish)',
  };
  const rMap = {
    none:      'no food restrictions',
    no_dairy:  'dairy-free (avoid milk, curd, paneer, cheese, butter)',
    no_gluten: 'gluten-free (avoid wheat, maida, regular bread — use rice, bajra, jowar)',
    no_nuts:   'nut-free (no tree nuts or groundnuts)',
  };
  const tMap = {
    '1_day':   '1 day (full single-day plan)',
    '3_days':  '3 days — vary meals each day',
    '1_week':  '7 days — full week, different meals daily',
    '2_weeks': '14 days — two full weeks, avoid repetition',
  };
  let profileSection = '';
  if (profileData && profileData.weight && profileData.height && profileData.age) {
    const bmi = (profileData.weight / Math.pow(profileData.height / 100, 2)).toFixed(1);
    const tdee = computeTDEE(profileData);
    const actLabel = { sedentary: 'Sedentary', lightly_active: 'Lightly active', moderately_active: 'Moderately active', very_active: 'Very active' };
    profileSection = `\n\nPerson's stats:\n• Age: ${profileData.age} years\n• Weight: ${profileData.weight} kg\n• Height: ${profileData.height} cm\n• Gender: ${profileData.gender || 'not specified'}\n• BMI: ${bmi}\n• Activity: ${actLabel[profileData.activity] || 'Moderate'}\n• Estimated TDEE: ~${tdee} kcal/day\n\nCalibrate all portions, calorie targets, and macro splits precisely to these stats.`;
  }
  return `Create a detailed, personalised diet plan with these specifications:\n\n• Goal: ${resolveVal(gMap, a.goal)}\n• Meals per day: ${resolveVal(mMap, a.meals)}\n• Dietary type: ${resolveVal(dMap, a.diet_type)}\n• Restrictions: ${resolveVal(rMap, a.restrictions)}\n• Duration: ${resolveVal(tMap, a.duration)}${profileSection}\n\nFORMAT RULES — follow exactly:\n1. Present the full plan as a markdown table with these columns: Day | Meal | Food & Portion | Kcal | Protein (g) | Carbs (g) | Fat (g)\n2. Add a summary row after each day's meals: e.g. | Monday Total | — | — | 1850 | 142 | 195 | 58 |\n3. After the table, add a short 3-bullet "Coach notes" section.\n4. Keep foods practical, available in India, and genuinely tasty.`;
}

const ACTIVITY_OPTS = [
  { val: 'sedentary',         label: 'Sedentary',          desc: 'Desk job, little to no exercise' },
  { val: 'lightly_active',    label: 'Lightly active',     desc: '1–3 days of exercise per week' },
  { val: 'moderately_active', label: 'Moderately active',  desc: '3–5 days of exercise per week' },
  { val: 'very_active',       label: 'Very active',        desc: '6–7 days or physical job' },
];

function BmiBar({ bmi, accentColor, mc }) {
  const ranges = [
    { label: 'Under', end: 18.5, color: '#5B9DD9' },
    { label: 'Normal', end: 25,  color: '#4CAF7C' },
    { label: 'Over',   end: 30,  color: '#FFB74D' },
    { label: 'Obese',  end: 40,  color: '#E57373' },
  ];
  const pct = Math.min(Math.max(((bmi - 10) / 30) * 100, 2), 98);
  return (
    <View style={{ marginVertical: 14 }}>
      <View style={{ flexDirection: 'row', height: 12, borderRadius: 2, overflow: 'hidden' }}>
        {ranges.map(r => <View key={r.label} style={{ flex: 1, backgroundColor: r.color }} />)}
      </View>
      <View style={{ position: 'relative', height: 20, marginTop: 2 }}>
        <View style={{ position: 'absolute', left: `${pct}%`, transform: [{ translateX: -6 }] }}>
          <Text style={{ fontFamily: F.mono, fontSize: 14, color: accentColor }}>▲</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {ranges.map(r => <Text key={r.label} style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{r.label}</Text>)}
      </View>
      <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, textAlign: 'center', marginTop: 4 }}>
        18.5 ─────── 25 ─────── 30
      </Text>
    </View>
  );
}

function DietMCQModal({ visible, onClose, onSubmit, mc, accentColor, st, profile }) {
  const [phase,        setPhase]        = useState('mcq');
  const [step,         setStep]         = useState(0);
  const [answers,      setAnswers]      = useState({});
  const [selectedVals, setSelectedVals] = useState([]);
  const [customText,   setCustomText]   = useState('');
  const [otherAge,     setOtherAge]     = useState('');
  const [otherWeight,  setOtherWeight]  = useState('');
  const [otherHeight,  setOtherHeight]  = useState('');
  const [otherGender,  setOtherGender]  = useState('male');
  const [otherAct,     setOtherAct]     = useState('moderately_active');
  const [bmiData,      setBmiData]      = useState(null);
  const [otherErr,     setOtherErr]     = useState('');

  function reset() {
    setPhase('mcq'); setStep(0); setAnswers({}); setSelectedVals([]); setCustomText('');
    setOtherAge(''); setOtherWeight(''); setOtherHeight('');
    setOtherGender('male'); setOtherAct('moderately_active');
    setBmiData(null); setOtherErr('');
  }

  function toggleOption(val) {
    setSelectedVals(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }

  function handleMcqNext() {
    const hasSelection = selectedVals.length > 0 || customText.trim();
    if (!hasSelection) return;
    const cur = MCQ_STEPS[step];
    const all = customText.trim() ? [...selectedVals, `custom:${customText.trim()}`] : selectedVals;
    const newAnswers = { ...answers, [cur.id]: all.length === 1 ? all[0] : all };
    setAnswers(newAnswers);
    setSelectedVals([]); setCustomText('');
    if (step + 1 >= MCQ_STEPS.length) {
      setPhase('who');
    } else {
      setStep(step + 1);
    }
  }

  function handleForMe() {
    const p = {
      weight: parseFloat(profile?.weight_kg) || null,
      height: parseFloat(profile?.height_cm) || null,
      age:    parseInt(profile?.age)           || null,
      gender: profile?.gender                  || 'not specified',
      activity: 'moderately_active',
    };
    onSubmit(buildDietPrompt(answers, p.weight && p.height && p.age ? p : null));
    reset();
  }

  function handleOtherSubmit() {
    const w = parseFloat(otherWeight), h = parseFloat(otherHeight), a = parseInt(otherAge);
    if (!w || !h || !a) { setOtherErr('Please fill in age, weight, and height.'); return; }
    if (a < 5 || a > 120) { setOtherErr('Enter a valid age.'); return; }
    if (w < 20 || w > 300) { setOtherErr('Enter a valid weight in kg.'); return; }
    if (h < 100 || h > 250) { setOtherErr('Enter a valid height in cm.'); return; }
    const bmi = w / Math.pow(h / 100, 2);
    const p = { weight: w, height: h, age: a, gender: otherGender, activity: otherAct };
    if (bmi < 18.5 && answers.goal === 'weight_loss') {
      setBmiData({ bmi: bmi.toFixed(1), profile: p });
      setPhase('bmi_warn');
    } else {
      onSubmit(buildDietPrompt(answers, p));
      reset();
    }
  }

  if (!visible) return null;

  const closeBtn = (
    <TouchableOpacity onPress={() => { onClose(); reset(); }} style={{ position: 'absolute', top: 12, right: 12, padding: 8 }}>
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={mc.text2} strokeWidth={1.8} strokeLinecap="round">
        <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
      </Svg>
    </TouchableOpacity>
  );

  // ── Phase: MCQ ──────────────────────────────────────────────────────
  if (phase === 'mcq') {
    const cur = MCQ_STEPS[step];
    const progress = ((step / MCQ_STEPS.length) * 100).toFixed(0);
    const hasSelection = selectedVals.length > 0 || customText.trim().length > 0;
    return (
      <View style={st.modalOverlay}>
        <View style={[st.modalCard, { position: 'relative' }]}>
          {closeBtn}
          <Text style={st.mcqEyebrow}>Question {step + 1} of {MCQ_STEPS.length}</Text>
          <View style={st.mcqProgBar}><View style={[st.mcqProgFill, { width: `${progress}%` }]} /></View>
          <Text style={st.mcqQ}>{cur.q}</Text>
          <Text style={[st.mcqOptDesc, { marginBottom: 8, color: mc.text3 }]}>Select all that apply</Text>
          <View style={st.mcqOpts}>
            {cur.opts.map(o => {
              const isSel = selectedVals.includes(o.val);
              return (
                <TouchableOpacity key={o.val} style={[st.mcqOpt, isSel && st.mcqOptSelected]} onPress={() => toggleOption(o.val)}>
                  <View style={[st.mcqOptCheck, isSel && st.mcqOptCheckSel]}>
                    {isSel && (
                      <Svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#080808" strokeWidth="2.2" strokeLinecap="round">
                        <Polyline points="2,6 5,9 10,3" />
                      </Svg>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.mcqOptLabel, isSel && { color: accentColor }]}>{o.label}</Text>
                    <Text style={st.mcqOptDesc}>{o.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={[st.mcqOpt, { paddingVertical: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.mcqOptDesc, { marginBottom: 4 }]}>Something else?</Text>
                <TextInput
                  value={customText}
                  onChangeText={setCustomText}
                  placeholder="Type your own answer..."
                  placeholderTextColor={mc.text3}
                  style={{
                    fontFamily: F.mono, fontSize: 13, color: mc.text,
                    borderBottomWidth: 1, borderBottomColor: customText.trim() ? accentColor : mc.border,
                    paddingVertical: 4, outlineWidth: 0, backgroundColor: 'transparent',
                  }}
                />
              </View>
            </View>
          </View>
          <View style={st.mcqFooter}>
            <TouchableOpacity onPress={() => { onClose(); reset(); }}>
              <Text style={st.mcqSkip}>Skip — just wing it with the AI</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.mcqNextBtn, !hasSelection && st.mcqNextBtnOff]}
              onPress={handleMcqNext}
              disabled={!hasSelection}
            >
              <Text style={[st.mcqNextBtnTxt, !hasSelection && { opacity: 0.3 }]}>
                {step + 1 >= MCQ_STEPS.length ? 'Next →' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Phase: Who is this for? ─────────────────────────────────────────
  if (phase === 'who') {
    return (
      <View style={st.modalOverlay}>
        <View style={[st.modalCard, { position: 'relative' }]}>
          {closeBtn}
          <Text style={st.mcqEyebrow}>Almost there</Text>
          <Text style={st.mcqQ}>Who is this diet plan for?</Text>
          <View style={{ gap: 10, marginBottom: 24 }}>
            <TouchableOpacity
              style={[st.mcqOpt, { padding: 16 }]}
              onPress={handleForMe}
            >
              <View style={{ flex: 1 }}>
                <Text style={[st.mcqOptLabel, { color: accentColor }]}>For me</Text>
                <Text style={st.mcqOptDesc}>I'll use my profile stats already saved in the app</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.mcqOpt, { padding: 16 }]}
              onPress={() => setPhase('other_data')}
            >
              <View style={{ flex: 1 }}>
                <Text style={st.mcqOptLabel}>For someone else</Text>
                <Text style={st.mcqOptDesc}>I'll enter their age, weight, height and activity level</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Phase: Collect other person's data ─────────────────────────────
  if (phase === 'other_data') {
    const inpStyle = [st.mcqOpt, { paddingVertical: 8, paddingHorizontal: 12, marginBottom: 0 }];
    return (
      <View style={st.modalOverlay}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={[st.modalCard, { position: 'relative', width: 480, maxWidth: '95%' }]}>
          {closeBtn}
          <Text style={st.mcqEyebrow}>Their details</Text>
          <Text style={[st.mcqQ, { marginBottom: 16 }]}>Tell us about the person</Text>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={st.mcqOptDesc}>Age (years)</Text>
              <TextInput style={[inpStyle, { fontFamily: F.mono, fontSize: 14, color: mc.text, outlineWidth: 0 }]}
                value={otherAge} onChangeText={setOtherAge} keyboardType="number-pad" placeholder="25" placeholderTextColor={mc.text3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.mcqOptDesc}>Weight (kg)</Text>
              <TextInput style={[inpStyle, { fontFamily: F.mono, fontSize: 14, color: mc.text, outlineWidth: 0 }]}
                value={otherWeight} onChangeText={setOtherWeight} keyboardType="decimal-pad" placeholder="65" placeholderTextColor={mc.text3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.mcqOptDesc}>Height (cm)</Text>
              <TextInput style={[inpStyle, { fontFamily: F.mono, fontSize: 14, color: mc.text, outlineWidth: 0 }]}
                value={otherHeight} onChangeText={setOtherHeight} keyboardType="decimal-pad" placeholder="170" placeholderTextColor={mc.text3} />
            </View>
          </View>

          <Text style={[st.mcqOptDesc, { marginBottom: 6 }]}>Gender</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {[['male','Male'],['female','Female'],['other','Other']].map(([v,l]) => (
              <TouchableOpacity key={v} onPress={() => setOtherGender(v)}
                style={[st.mcqOpt, { flex: 1, paddingVertical: 8, borderColor: otherGender === v ? accentColor : mc.border, backgroundColor: otherGender === v ? accentColor + '18' : 'transparent' }]}>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: otherGender === v ? accentColor : mc.text3, textAlign: 'center' }}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[st.mcqOptDesc, { marginBottom: 6 }]}>Activity level</Text>
          <View style={{ gap: 6, marginBottom: 16 }}>
            {ACTIVITY_OPTS.map(o => (
              <TouchableOpacity key={o.val} onPress={() => setOtherAct(o.val)}
                style={[st.mcqOpt, { flexDirection: 'row', alignItems: 'center', borderColor: otherAct === o.val ? accentColor : mc.border, backgroundColor: otherAct === o.val ? accentColor + '18' : 'transparent' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.mcqOptLabel, otherAct === o.val && { color: accentColor }]}>{o.label}</Text>
                  <Text style={st.mcqOptDesc}>{o.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {!!otherErr && <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#E57373', marginBottom: 10 }}>{otherErr}</Text>}

          <View style={st.mcqFooter}>
            <TouchableOpacity onPress={() => setPhase('who')}>
              <Text style={st.mcqSkip}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.mcqNextBtn} onPress={handleOtherSubmit}>
              <Text style={st.mcqNextBtnTxt}>Build plan →</Text>
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>
      </View>
    );
  }

  // ── Phase: BMI warning (underweight + weight loss goal) ────────────
  if (phase === 'bmi_warn') {
    return (
      <View style={st.modalOverlay}>
        <View style={[st.modalCard, { position: 'relative' }]}>
          {closeBtn}
          <Text style={[st.mcqEyebrow, { color: '#5B9DD9' }]}>BMI Check</Text>
          <Text style={[st.mcqQ, { marginBottom: 8 }]}>Weight loss not recommended</Text>
          <Text style={[st.mcqOptDesc, { marginBottom: 14, lineHeight: 20 }]}>
            This person's BMI is <Text style={{ color: '#5B9DD9', fontWeight: '700' }}>{bmiData?.bmi}</Text>, which is below the healthy range (18.5–24.9).
            {'\n\n'}A weight loss plan would be unsafe. We've automatically switched to a <Text style={{ color: accentColor }}>weight gain plan</Text> to help them reach a healthy weight.
          </Text>
          <BmiBar bmi={parseFloat(bmiData?.bmi || 16)} accentColor={accentColor} mc={mc} />
          <TouchableOpacity
            style={[st.mcqNextBtn, { marginTop: 16, alignSelf: 'stretch', alignItems: 'center', paddingVertical: 14 }]}
            onPress={() => {
              onSubmit(buildDietPrompt({ ...answers, goal: 'weight_gain' }, bmiData?.profile));
              reset();
            }}
          >
            <Text style={st.mcqNextBtnTxt}>Got it — build weight gain plan →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AIScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 640;
  const [showSessSidebar, setShowSessSidebar] = useState(false);
  const [username,   setUsername]   = useState('');
  const [sessions,   setSessions]   = useState([]);
  const [sessionId,  setSessionId]  = useState(() => `sess_${Date.now()}`);
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [showRoast,  setShowRoast]  = useState(false);
  const [roastText,  setRoastText]  = useState('');
  const [listening,  setListening]  = useState(false);
  const [showPlus,   setShowPlus]   = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showMCQ,    setShowMCQ]    = useState(false);
  const [wizardShown, setWizardShown] = useState(false);
  const [profile,    setProfile]    = useState(null);
  const [funnyIdx,   setFunnyIdx]   = useState(0);
  const [showRegen,  setShowRegen]  = useState(false);
  const [banUntil,   setBanUntil]   = useState(null);
  const [banRemaining, setBanRemaining] = useState(0);
  const [banInput,   setBanInput]   = useState('');
  const [banReply,   setBanReply]   = useState('');
  const [banSorryCount, setBanSorryCount] = useState(0);

  const scrollRef   = useRef(null);
  const recogRef    = useRef(null);
  const funnyTimer  = useRef(null);
  const plusRef     = useRef(null);

  // ── Load user & sessions ──────────────────────────────────────────

  useEffect(() => {
    getUser().then(async u => {
      if (u) {
        const name = typeof u === 'string' ? u : (u.username || u.email || '');
        setUsername(name);
        loadSessions(name);
        // Persist wizard-shown state so MCQ doesn't re-appear on every mount
        const shown = await AsyncStorage.getItem(`tg_diet_wizard_${name}`);
        if (shown) setWizardShown(true);
        getMe().then(d => { if (d?.username || d?.email) setProfile(d); }).catch(() => {});
      }
    });
  }, []);

  // ── Click-outside for plus popup on web ──────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'web' || !showPlus) return;
    const handler = e => {
      if (plusRef.current && !plusRef.current.contains?.(e.target)) setShowPlus(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPlus]);

  // ── Barcode scan handler ──────────────────────────────────────────

  async function handleScanned(code) {
    setShowScanner(false);
    try {
      const p = await lookupBarcode(code);
      const brand = p.brand ? ` by ${p.brand}` : '';
      setInput(`I scanned ${p.name}${brand}. Per 100g: ${p.calories} kcal, ${p.protein}g protein, ${p.carbs}g carbs, ${p.fat}g fat (serving: ${p.serving}). Can you help me log this and tell me if it fits my goals?`);
    } catch {
      setInput(`I scanned barcode ${code} but couldn't find it in the database. Can you help me log it manually?`);
    }
  }

  // ── Funny ticker while loading ────────────────────────────────────

  useEffect(() => {
    if (loading) {
      setFunnyIdx(Math.floor(Math.random() * FUNNY.length));
      funnyTimer.current = setInterval(() => {
        setFunnyIdx(i => (i + 1) % FUNNY.length);
      }, 2600);
    } else {
      if (funnyTimer.current) { clearInterval(funnyTimer.current); funnyTimer.current = null; }
    }
    return () => { if (funnyTimer.current) clearInterval(funnyTimer.current); };
  }, [loading]);

  // ── Ban countdown ─────────────────────────────────────────────────

  useEffect(() => {
    if (!banUntil) return;
    function tick() {
      const rem = Math.max(0, Math.floor((banUntil - Date.now()) / 1000));
      setBanRemaining(rem);
      if (rem <= 0) setBanUntil(null);
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [banUntil]);

  // ── Auto-scroll ───────────────────────────────────────────────────

  function scrollToBottom() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  // ── Session persistence ───────────────────────────────────────────

  function loadSessions(u) {
    getSessions()
      .then(d => {
        if (d?.ok && d.sessions?.length) {
          setSessions(d.sessions);
          AsyncStorage.setItem(SESS_KEY(u), JSON.stringify(d.sessions));
        } else {
          AsyncStorage.getItem(SESS_KEY(u)).then(raw =>
            setSessions(raw ? JSON.parse(raw) : [])
          );
        }
      })
      .catch(() =>
        AsyncStorage.getItem(SESS_KEY(u)).then(raw =>
          setSessions(raw ? JSON.parse(raw) : [])
        )
      );
  }

  function storeSessions(list) {
    const trimmed = list.slice(0, 40);
    AsyncStorage.setItem(SESS_KEY(username), JSON.stringify(trimmed));
    setSessions(trimmed);
    saveSessions(trimmed).catch(() => {});
  }

  function persistCurrentSession(msgs, sid) {
    if (!msgs.length) return;
    const firstUser = msgs.find(m => m.role === 'user');
    const title = autoTitle(firstUser?.content || '');
    const entry = { id: sid || sessionId, title, history: [...msgs], updatedAt: Date.now() };
    AsyncStorage.getItem(SESS_KEY(username)).then(raw => {
      const all = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(s => s.id === entry.id);
      if (idx >= 0) all[idx] = entry; else all.unshift(entry);
      storeSessions(all);
    });
  }

  function openSession(sess) {
    persistCurrentSession(messages);
    setSessionId(sess.id);
    setMessages(sess.history || []);
    setShowRoast(false);
    setShowRegen(false);
    scrollToBottom();
  }

  function delSession(id) {
    AsyncStorage.getItem(SESS_KEY(username)).then(raw => {
      const all = raw ? JSON.parse(raw) : [];
      storeSessions(all.filter(s => s.id !== id));
    });
    if (id === sessionId) {
      setSessionId(`sess_${Date.now()}`);
      setMessages([]);
      setShowRegen(false);
    }
  }

  function newChat() {
    persistCurrentSession(messages);
    loadSessions(username);
    setSessionId(`sess_${Date.now()}`);
    setMessages([]);
    setShowRoast(false);
    setShowRegen(false);
    setWizardShown(false);
  }

  function clearChat() {
    setMessages([]);
    setShowRegen(false);
    AsyncStorage.getItem(SESS_KEY(username)).then(raw => {
      const all = raw ? JSON.parse(raw) : [];
      storeSessions(all.filter(s => s.id !== sessionId));
    });
  }

  function exportChat() {
    if (!messages.length || Platform.OS !== 'web') return;
    const txt = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n---\n\n');
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
    a.download = `too-good-chat-${Date.now()}.txt`;
    a.click();
  }

  // ── Core send ─────────────────────────────────────────────────────

  async function send(text, isDietPlan = false) {
    text = (text || input).trim();
    if (!text || loading) return;
    if (isDietQuery(text) && !wizardShown) {
      setInput('');
      setShowMCQ(true);
      setWizardShown(true);
      if (username) AsyncStorage.setItem(`tg_diet_wizard_${username}`, '1').catch(() => {});
      return;
    }
    setInput('');
    setShowRoast(false);
    setShowPlus(false);
    setShowRegen(false);
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setLoading(true);
    scrollToBottom();
    try {
      const apiMsgs = next.map(m => ({ role: m.role, content: m.content }));
      const d = await generalAiChat(apiMsgs);
      if (d.banned) {
        if (d.reply) {
          const withReply = [...next, { role: 'assistant', content: d.reply }];
          setMessages(withReply);
          persistCurrentSession(withReply);
          scrollToBottom();
        }
        setBanUntil(new Date(d.ban_until + 'Z'));
        setBanSorryCount(0);
        setBanReply('');
        setBanInput('');
        setLoading(false);
        return;
      }
      const reply = d.reply || 'No response.';
      const withReply = [...next, { role: 'assistant', content: reply, isDiet: isDietPlan }];
      setMessages(withReply);
      persistCurrentSession(withReply);
      setShowRegen(true);
      scrollToBottom();
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: 'Could not reach server. Please try again.' }]);
    }
    setLoading(false);
  }

  // ── Regenerate last ───────────────────────────────────────────────

  function regenerateLast() {
    if (!messages.length || loading) return;
    const withoutLast = messages[messages.length - 1].role === 'assistant'
      ? messages.slice(0, -1)
      : messages;
    const lastUser = [...withoutLast].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    const trimmed = withoutLast.filter(
      (m, i) => !(i === withoutLast.length - 1 && m.role === 'user')
    );
    setMessages(trimmed);
    setShowRegen(false);
    send(lastUser.content);
  }

  // ── Ban comment submit ────────────────────────────────────────────

  async function submitBanComment() {
    const text = banInput.trim();
    if (!text) return;
    setBanInput('');
    setBanReply('...');
    try {
      const d = await banComment(text, banSorryCount);
      if (d.action === 'bypass') {
        setBanReply(d.msg || '');
        setTimeout(() => setBanUntil(null), 1200);
      } else if (d.action === 'sorry') {
        setBanSorryCount(c => c + 1);
        setBanUntil(new Date(d.new_ban_until + 'Z'));
        setBanReply(d.msg || '');
      } else if (d.action === 'insult') {
        setBanUntil(new Date(d.new_ban_until + 'Z'));
        setBanReply(d.msg || '');
      } else if (d.action === 'expired') {
        setBanUntil(null);
      } else {
        setBanReply(d.msg || '');
      }
    } catch {
      setBanReply('');
    }
  }

  // ── Chips ─────────────────────────────────────────────────────────

  function handleChip(id) {
    if (id === 'roast') { setShowRoast(v => !v); return; }
    if (id === 'diet')  { setShowMCQ(true); return; }
    const prompt = CHIP_PROMPTS[id];
    if (prompt) send(prompt);
  }

  function submitRoast() {
    if (!roastText.trim()) return;
    const prompt = `Roast my diet — be brutally honest but constructive. Here's what I typically eat in a day:\n\n${roastText.trim()}\n\nTell me exactly what's wrong with it, what nutrients I'm missing, and how to fix it.`;
    send(prompt);
    setRoastText('');
    setShowRoast(false);
  }

  // ── Mic (Web Speech API) ──────────────────────────────────────────

  function toggleMic() {
    if (Platform.OS !== 'web') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const r = new SR();
    r.lang = 'en-US';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = e => {
      const t = e.results[0][0].transcript;
      setInput(p => (p ? p + ' ' : '') + t);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    r.start();
    setListening(true);
  }

  // ── Derived ───────────────────────────────────────────────────────

  const initials = (username || '?')[0].toUpperCase();
  const DAY = 86400000;
  const now = Date.now();
  const todaySess     = sessions.filter(s => now - s.updatedAt < DAY);
  const yesterdaySess = sessions.filter(s => now - s.updatedAt >= DAY && now - s.updatedAt < 2 * DAY);
  const olderSess     = sessions.filter(s => now - s.updatedAt >= 2 * DAY);
  const chatTitleText = messages.length
    ? autoTitle(messages.find(m => m.role === 'user')?.content || '')
    : 'New conversation';

  // ── Render ────────────────────────────────────────────────────────

  const st = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: mc.bg,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },

  // ── Session sidebar ──────────────────────────────────────────────
  sessSidebar: {
    width: 240,
    backgroundColor: mc.sidebar,
    borderRightWidth: 1,
    borderRightColor: mc.border,
    flexDirection: 'column',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: mc.border,
  },
  newChatTxt: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text2,
    letterSpacing: 1,
  },
  sessNav: {
    flex: 1,
    paddingVertical: 4,
  },
  sessEmpty: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text3,
    fontStyle: 'italic',
    padding: 14,
  },
  sessLabel: {
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 4,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    fontFamily: F.mono,
  },
  sessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sessTitle: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text2,
    letterSpacing: 0.5,
  },

  // ── Main area ────────────────────────────────────────────────────
  main: {
    flex: 1,
    flexDirection: 'column',
  },

  // ── Header ───────────────────────────────────────────────────────
  header: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: mc.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
    flexShrink: 0,
    backgroundColor: mc.bg,
  },
  chatTitle: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text2,
    letterSpacing: 1,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  headerBtnTxt: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text3,
    letterSpacing: 1,
  },
  headerSep: {
    width: 1,
    height: 16,
    backgroundColor: mc.border,
  },

  // ── Chat scroll ───────────────────────────────────────────────────
  chatScroll: {
    flex: 1,
  },

  // ── Empty state ───────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    paddingTop: 60,
    paddingBottom: 20,
    minHeight: 400,
  },
  esTitle: {
    fontFamily: F.display,
    fontSize: 28,
    color: mc.text,
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 36,
  },
  esSub: {
    fontSize: 15,
    color: mc.text2,
    fontStyle: 'italic',
    marginBottom: 40,
    letterSpacing: 0.5,
    textAlign: 'center',
    fontFamily: F.mono,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    maxWidth: 600,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 16,
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: Math.max(4, borderRadius - 2),
  },
  chipTxt: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text2,
    letterSpacing: 0.5,
  },

  // ── Roast prompt ──────────────────────────────────────────────────
  roastBox: {
    marginTop: 24,
    width: '100%',
    maxWidth: 520,
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: borderRadius,
    padding: 20,
  },
  roastQ: {
    fontFamily: F.display,
    fontSize: 15,
    color: mc.text,
    marginBottom: 12,
    lineHeight: 22,
  },
  roastInput: {
    backgroundColor: mc.elevated,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: Math.max(4, borderRadius - 2),
    color: mc.text,
    fontFamily: F.mono,
    fontSize: fontSize,
    padding: 10,
    minHeight: 80,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },
  roastActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  roastCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: borderRadius,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  roastCancelTxt: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text3,
    letterSpacing: 1,
  },
  roastSubmit: {
    backgroundColor: accentColor,
    borderRadius: borderRadius,
    paddingVertical: 7,
    paddingHorizontal: 18,
  },
  roastSubmitTxt: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    fontWeight: '700',
    color: '#080808',
    letterSpacing: 1,
  },

  // ── Messages ──────────────────────────────────────────────────────
  messages: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  msgRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: '10%',
    alignItems: 'flex-start',
  },
  msgRowUser: {
    backgroundColor: 'rgba(201,168,76,0.025)',
    flexDirection: 'row-reverse',
  },
  aiAvatar: {
    width: 26,
    height: 26,
    flexShrink: 0,
    backgroundColor: 'rgba(201,168,76,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  userAvatar: {
    width: 26,
    height: 26,
    flexShrink: 0,
    backgroundColor: 'rgba(201,168,76,0.16)',
    borderWidth: 1,
    borderColor: accentColor,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarTxt: {
    fontFamily: F.display,
    fontSize: 12,
    color: accentColor,
  },
  msgBubbleWrap: {
    flex: 1,
    maxWidth: 680,
  },
  msgTxt: {
    fontFamily: F.mono,
    fontSize: 15,
    color: mc.text,
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  msgActions: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
    opacity: 0.6,
  },
  msgActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: mc.border,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  msgActionTxt: {
    fontFamily: F.mono,
    fontSize: 11,
    color: mc.text3,
    letterSpacing: 1,
  },

  // ── Thinking indicator ────────────────────────────────────────────
  thinkingTxt: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text2,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // ── Regenerate bar ────────────────────────────────────────────────
  regenBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: mc.border,
    paddingVertical: 7,
    paddingHorizontal: 18,
  },
  regenBtnTxt: {
    fontFamily: F.mono,
    fontSize: 11,
    color: mc.text2,
    letterSpacing: 1,
  },

  // ── Composer ──────────────────────────────────────────────────────
  composer: {
    paddingVertical: 10,
    paddingHorizontal: '10%',
    paddingBottom: 20,
    backgroundColor: mc.bg,
    flexShrink: 0,
  },
  composerBox: {
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
    maxWidth: 740,
    alignSelf: 'center',
    width: '100%',
  },
  chatInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: mc.text,
    fontFamily: F.mono,
    fontSize: 15,
    letterSpacing: 0.3,
    lineHeight: 26,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    maxHeight: 200,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },
  composerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: mc.border,
  },
  cbLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cbRight: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cbBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 2,
  },
  cbBtnListening: {
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  charCount: {
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 1,
    fontFamily: F.mono,
  },

  // ── Plus popup ────────────────────────────────────────────────────
  plusPopup: {
    position: 'absolute',
    bottom: 44,
    left: 0,
    backgroundColor: mc.elevated,
    borderWidth: 1,
    borderColor: mc.borderH,
    minWidth: 190,
    zIndex: 300,
  },
  plusItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  plusItemTxt: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text2,
    letterSpacing: 0.5,
  },

  // ── Send button ───────────────────────────────────────────────────
  sendBtn: {
    width: 32,
    height: 32,
    backgroundColor: accentColor,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnOff: {
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
  },
  composerNote: {
    maxWidth: 740,
    alignSelf: 'center',
    width: '100%',
    marginTop: 7,
    fontSize: Math.max(10, fontSize - 2),
    color: mc.text3,
    letterSpacing: 1,
    textAlign: 'center',
    fontFamily: F.mono,
  },

  // ── Ban Overlay ───────────────────────────────────────────────────
  banOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 999,
    backgroundColor: '#080808',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  banCard: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 8,
  },
  banIcon: {
    fontSize: 52,
    marginBottom: 20,
  },
  banTitle: {
    fontFamily: F.display,
    fontSize: 28,
    color: accentColor,
    marginBottom: 12,
    letterSpacing: 1,
    textAlign: 'center',
  },
  banMsg: {
    fontSize: 14,
    color: mc.text2,
    lineHeight: 24,
    marginBottom: 28,
    textAlign: 'center',
    fontFamily: F.mono,
  },
  banClock: {
    fontFamily: F.display,
    fontSize: 48,
    color: mc.text,
    letterSpacing: 2,
    marginBottom: 8,
  },
  banClockLabel: {
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginBottom: 28,
    fontFamily: F.mono,
  },
  banCommentWrap: {
    marginTop: 4,
    width: '100%',
  },
  banCommentLabel: {
    fontSize: 11,
    color: mc.text3,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
    fontFamily: F.mono,
  },
  banCommentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  banCommentInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: mc.border,
    color: mc.text,
    fontFamily: F.mono,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },
  banCommentBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  banCommentBtnTxt: {
    fontFamily: F.mono,
    fontSize: 11,
    color: accentColor,
    letterSpacing: 2,
  },
  banCommentReply: {
    fontSize: 12,
    color: accentColor,
    marginTop: 12,
    fontFamily: F.mono,
    lineHeight: 20,
  },

  // ── Diet MCQ Modal ────────────────────────────────────────────────
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
  },
  modalCard: {
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.borderH,
    width: 500,
    maxWidth: '92%',
    padding: 28,
    paddingTop: 32,
  },
  mcqEyebrow: {
    fontSize: 9,
    color: mc.text3,
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: F.mono,
  },
  mcqProgBar: {
    height: 2,
    backgroundColor: 'rgba(201,168,76,0.10)',
    marginBottom: 26,
  },
  mcqProgFill: {
    height: '100%',
    backgroundColor: accentColor,
  },
  mcqQ: {
    fontFamily: F.display,
    fontSize: 21,
    color: mc.text,
    lineHeight: 28,
    marginBottom: 22,
  },
  mcqOpts: {
    gap: 10,
    marginBottom: 14,
  },
  mcqOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.elevated,
    borderWidth: 1,
    borderColor: mc.border,
    padding: 13,
    paddingLeft: 12,
  },
  mcqOptSelected: {
    borderColor: accentColor,
    backgroundColor: mc.goldDim,
  },
  mcqOptCheck: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mcqOptCheckSel: {
    backgroundColor: accentColor,
    borderColor: accentColor,
  },
  mcqOptLabel: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  mcqOptDesc: {
    fontFamily: F.mono,
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 0.5,
    fontStyle: 'italic',
  },
  mcqFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  mcqSkip: {
    fontFamily: F.mono,
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 0.5,
  },
  mcqNextBtn: {
    backgroundColor: accentColor,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  mcqNextBtnOff: {
    opacity: 0.3,
  },
  mcqNextBtnTxt: {
    fontFamily: F.mono,
    fontSize: fontSize,
    fontWeight: '700',
    color: '#080808',
    letterSpacing: 2,
  },
});

  const sessSidebarVisible = isMobile ? showSessSidebar : true;

  return (
    <View style={st.screen}>
      <View style={st.layout}>

        {/* ── SESSION SIDEBAR ── */}
        {sessSidebarVisible && (
        <View style={[st.sessSidebar, isMobile && { position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 20, width: 260 }]}>
          <TouchableOpacity style={st.newChatBtn} onPress={() => { newChat(); if (isMobile) setShowSessSidebar(false); }}>
            <PlusIcon size={12} color={mc.text2} />
            <Text style={st.newChatTxt}>New conversation</Text>
          </TouchableOpacity>

          <ScrollView style={st.sessNav} showsVerticalScrollIndicator={false}>
            {sessions.length === 0 && (
              <Text style={st.sessEmpty}>No saved conversations yet.</Text>
            )}
            {todaySess.length > 0 && (
              <>
                <Text style={st.sessLabel}>TODAY</Text>
                {todaySess.map(s => (
                  <SessRow key={s.id} s={s} cur={sessionId} onOpen={sess => { openSession(sess); if (isMobile) setShowSessSidebar(false); }} onDel={delSession} mc={mc} accentColor={accentColor} st={st} />
                ))}
              </>
            )}
            {yesterdaySess.length > 0 && (
              <>
                <Text style={st.sessLabel}>YESTERDAY</Text>
                {yesterdaySess.map(s => (
                  <SessRow key={s.id} s={s} cur={sessionId} onOpen={sess => { openSession(sess); if (isMobile) setShowSessSidebar(false); }} onDel={delSession} mc={mc} accentColor={accentColor} st={st} />
                ))}
              </>
            )}
            {olderSess.length > 0 && (
              <>
                <Text style={st.sessLabel}>OLDER</Text>
                {olderSess.map(s => (
                  <SessRow key={s.id} s={s} cur={sessionId} onOpen={sess => { openSession(sess); if (isMobile) setShowSessSidebar(false); }} onDel={delSession} mc={mc} accentColor={accentColor} st={st} />
                ))}
              </>
            )}
          </ScrollView>
        </View>
        )}

        {/* Mobile overlay to close sidebar */}
        {isMobile && showSessSidebar && (
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 19, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setShowSessSidebar(false)}
            activeOpacity={1}
          />
        )}

        {/* ── MAIN AREA ── */}
        <View style={st.main}>

          {/* Header */}
          <View style={st.header}>
            {isMobile && (
              <TouchableOpacity onPress={() => setShowSessSidebar(s => !s)} style={{ paddingRight: 8, paddingVertical: 4 }}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={mc.text3} strokeWidth={2} strokeLinecap="round">
                  <Path d="M3 12h18M3 6h18M3 18h12" />
                </Svg>
              </TouchableOpacity>
            )}
            <ChatIcon size={13} color={mc.text3} />
            <Text style={st.chatTitle} numberOfLines={1}>{chatTitleText}</Text>
            <TouchableOpacity style={st.headerBtn} onPress={exportChat}>
              <ExportIcon size={12} color={mc.text3} />
              <Text style={st.headerBtnTxt}>Export</Text>
            </TouchableOpacity>
            <View style={st.headerSep} />
            <TouchableOpacity style={st.headerBtn} onPress={clearChat}>
              <TrashIcon size={12} color={mc.text3} />
              <Text style={st.headerBtnTxt}>Clear</Text>
            </TouchableOpacity>
          </View>

          {/* Chat scroll */}
          <ScrollView
            ref={scrollRef}
            style={st.chatScroll}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Empty state */}
            {messages.length === 0 && !loading && (
              <View style={st.emptyState}>
                <Text style={st.esTitle}>
                  {'What can I help with, '}
                  <Text style={{ color: accentColor }}>{username.split('@')[0] || 'you'}</Text>
                  {'?'}
                </Text>
                <Text style={st.esSub}>
                  Diet plans · Food analysis · Calorie math · Judging your choices (kindly)
                </Text>
                <View style={st.chips}>
                  {CHIPS.map(c => (
                    <TouchableOpacity key={c.id} style={st.chip} onPress={() => handleChip(c.id)}>
                      <c.Icon />
                      <Text style={st.chipTxt}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Roast prompt box */}
                {showRoast && (
                  <View style={st.roastBox}>
                    <Text style={st.roastQ}>
                      Describe what you eat in a typical day — be honest, I won't tell anyone.
                    </Text>
                    <TextInput
                      style={st.roastInput}
                      value={roastText}
                      onChangeText={setRoastText}
                      placeholder="e.g. Breakfast: chai and paratha. Lunch: rice, dal, sabzi. Dinner: roti and paneer..."
                      placeholderTextColor={mc.text3}
                      multiline
                      numberOfLines={3}
                    />
                    <View style={st.roastActions}>
                      <TouchableOpacity style={st.roastCancel} onPress={() => setShowRoast(false)}>
                        <Text style={st.roastCancelTxt}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={st.roastSubmit} onPress={submitRoast}>
                        <Text style={st.roastSubmitTxt}>Roast it →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Messages */}
            <View style={st.messages}>
              {messages.map((m, i) => (
                <MessageRow key={i} msg={m} initials={initials} mc={mc} accentColor={accentColor} st={st} />
              ))}
              {loading && <ThinkingRow funnyIdx={funnyIdx} st={st} />}
            </View>
          </ScrollView>

          {/* Regenerate bar */}
          {showRegen && !loading && (
            <View style={st.regenBar}>
              <TouchableOpacity style={st.regenBtn} onPress={regenerateLast}>
                <RegenIcon size={12} color={mc.text2} />
                <Text style={st.regenBtnTxt}>Regenerate response</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Composer */}
          <View style={st.composer}>
            <View style={st.composerBox}>
              <TextInput
                style={st.chatInput}
                value={input}
                onChangeText={setInput}
                placeholder="Ask me anything. I won't judge. (Much.)"
                placeholderTextColor={mc.text3}
                multiline
                returnKeyType="send"
                onSubmitEditing={() => send()}
                blurOnSubmit={false}
                onKeyPress={(e) => {
                  if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                    e.preventDefault && e.preventDefault();
                    send();
                  }
                }}
              />
              <View style={st.composerBottom}>
                {/* Left controls */}
                <View style={st.cbLeft}>
                  {/* Plus button */}
                  <View ref={plusRef} style={{ position: 'relative' }}>
                    <TouchableOpacity
                      style={st.cbBtn}
                      onPress={() => setShowPlus(v => !v)}
                    >
                      <PlusIcon size={14} color={mc.text3} />
                    </TouchableOpacity>
                    {showPlus && (
                      <View style={st.plusPopup}>
                        <TouchableOpacity style={st.plusItem} onPress={() => { setShowPlus(false); setShowScanner(true); }}>
                          <Text style={st.plusItemTxt}>Scan barcode</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={st.plusItem} onPress={() => setShowPlus(false)}>
                          <Text style={st.plusItemTxt}>Upload file / photo</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Mic button */}
                  <TouchableOpacity
                    style={[st.cbBtn, listening && st.cbBtnListening]}
                    onPress={toggleMic}
                  >
                    <MicIcon size={13} color={listening ? accentColor : mc.text3} />
                  </TouchableOpacity>
                </View>

                {/* Right controls */}
                <View style={st.cbRight}>
                  {input.length > 80 && (
                    <Text style={st.charCount}>{input.length}</Text>
                  )}
                  <TouchableOpacity
                    style={[st.sendBtn, (!input.trim() || loading) && st.sendBtnOff]}
                    onPress={() => send()}
                    disabled={!input.trim() || loading}
                  >
                    {loading
                      ? <ActivityIndicator size="small" color={mc.text3} />
                      : <SendIcon size={14} color={input.trim() ? '#080808' : mc.text3} />
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <Text style={st.composerNote}>
              Not medical advice. Consult a real dietitian — I'm an AI, not a doctor, despite what my confidence suggests.
            </Text>
          </View>

        </View>
      </View>

      {/* Diet MCQ Modal */}
      <DietMCQModal
        visible={showMCQ}
        onClose={() => setShowMCQ(false)}
        onSubmit={prompt => { setShowMCQ(false); send(prompt, true); }}
        mc={mc}
        accentColor={accentColor}
        st={st}
        profile={profile}
      />

      {/* Barcode Scanner */}
      <BarcodeScanner
        visible={showScanner}
        onScanned={handleScanned}
        onClose={() => setShowScanner(false)}
      />

      {/* Ban Overlay */}
      {banUntil && (
        <View style={st.banOverlay}>
          <View style={st.banCard}>
            <Text style={st.banIcon}></Text>
            <Text style={st.banTitle}>You're in timeout.</Text>
            <Text style={st.banMsg}>
              {"The AI needed a breather after that last one.\nSit quietly, reflect, maybe eat a vegetable.\n\nNext time talk properly"}
            </Text>
            <Text style={st.banClock}>
              {String(Math.floor(banRemaining / 60)).padStart(2, '0')}:{String(banRemaining % 60).padStart(2, '0')}
            </Text>
            <Text style={st.banClockLabel}>remaining</Text>
            <View style={st.banCommentWrap}>
              <Text style={st.banCommentLabel}>Do you have anything to say?</Text>
              <View style={st.banCommentRow}>
                <TextInput
                  style={st.banCommentInput}
                  value={banInput}
                  onChangeText={setBanInput}
                  placeholder="Type here..."
                  placeholderTextColor={mc.text3}
                  maxLength={200}
                  autoComplete="off"
                  onSubmitEditing={submitBanComment}
                  returnKeyType="send"
                  blurOnSubmit={false}
                />
                <TouchableOpacity style={st.banCommentBtn} onPress={submitBanComment}>
                  <Text style={st.banCommentBtnTxt}>Send</Text>
                </TouchableOpacity>
              </View>
              {!!banReply && <Text style={st.banCommentReply}>{banReply}</Text>}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

