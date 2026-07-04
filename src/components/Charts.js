import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Path, Polyline, Rect, Line, Text as SvgText } from 'react-native-svg';
import { F } from '../theme';

// ── Line / trend chart over time ────────────────────────────────────────────
// points: [{ x: label|date, y: number }]  (or pass raw numbers via toY)
export function TrendLine({ points, color, mc, height = 110, showDots = false, fill = false }) {
  if (!points || points.length < 2) return null;
  const W = 320, H = height, pad = 10;
  const ys = points.map(p => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const range = Math.max(max - min, 0.0001);
  const x = i => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = v => H - pad - ((v - min) / range) * (H - pad * 2);
  const lineStr = points.map((p, i) => `${x(i)},${y(p.y)}`).join(' ');
  const areaPath = `M${x(0)},${H - pad} L${points.map((p, i) => `${x(i)},${y(p.y)}`).join(' L')} L${x(points.length - 1)},${H - pad} Z`;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke={mc.border} strokeWidth={1} />
      {fill && <Path d={areaPath} fill={color + '22'} stroke="none" />}
      <Polyline points={lineStr} fill="none" stroke={color} strokeWidth={2.2} />
      {showDots && points.map((p, i) => (
        <Circle key={i} cx={x(i)} cy={y(p.y)} r={2.5} fill={color} />
      ))}
      <Circle cx={x(points.length - 1)} cy={y(points[points.length - 1].y)} r={3.5} fill={color} />
    </Svg>
  );
}

// ── Bar chart (categorical / weekly) ────────────────────────────────────────
// data: [{ label, v }]
export function BarChart({ data, color, mc, height = 80, goal = null }) {
  if (!data || data.length === 0) return null;
  const W = 320, H = height, pad = 12;
  const barW = Math.max(4, Math.floor((W - pad * 2) / data.length) - 4);
  const max = Math.max(...data.map(d => d.v), goal || 0, 1);
  return (
    <Svg width="100%" height={H + 24} viewBox={`0 0 ${W} ${H + 24}`}>
      {goal != null && (
        <Path d={`M${pad} ${H - (goal / max) * H} H${W - pad}`} stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
      )}
      {data.map((d, i) => {
        const x = pad + i * ((W - pad * 2) / data.length);
        const barH = Math.max(2, Math.round((d.v / max) * H));
        const hit = goal != null && d.v >= goal;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={H - barH} width={barW} height={barH} fill={hit ? color : color + '70'} rx={2} />
            <SvgText x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize={8} fill={mc.text3}>{d.label}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ── Progress ring (circular) ────────────────────────────────────────────────
export function ProgressRing({ value, max, color, mc, size = 140, strokeWidth = 10, label, sublabel }) {
  const Cc = size / 2, R = Cc - strokeWidth / 2 - 2;
  const pct = Math.max(0, Math.min(value / Math.max(max, 1), 1));
  const circ = 2 * Math.PI * R;
  const dash = circ * pct;
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={Cc} cy={Cc} r={R} fill="none" stroke={mc.border} strokeWidth={strokeWidth} />
        <Circle cx={Cc} cy={Cc} r={R} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${Cc} ${Cc})`} />
        {label != null && (
          <SvgText x={Cc} y={Cc + 6} textAnchor="middle" fontSize={size * 0.16} fontWeight="700" fill={color} fontFamily={F.mono}>
            {label}
          </SvgText>
        )}
      </Svg>
      {sublabel ? <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: -size * 0.18 }}>{sublabel}</Text> : null}
    </View>
  );
}

// ── Donut / segmented breakdown (e.g. macros) ───────────────────────────────
// segments: [{ value, color, label }]
export function DonutChart({ segments, mc, size = 130, strokeWidth = 16 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const Cc = size / 2, R = Cc - strokeWidth / 2 - 2;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={Cc} cy={Cc} r={R} fill="none" stroke={mc.border} strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const frac = seg.value / total;
        const dash = circ * frac;
        const el = (
          <Circle key={i} cx={Cc} cy={Cc} r={R} fill="none" stroke={seg.color} strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${Cc} ${Cc})`} strokeLinecap="butt" />
        );
        offset += dash;
        return el;
      })}
    </Svg>
  );
}

// ── Horizontal stat bar (label + value + proportional fill) ────────────────
export function StatBar({ label, value, max, color, mc, displayValue }) {
  const pct = Math.max(0, Math.min(value / Math.max(max, 1), 1));
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1 }}>{label}</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text2 }}>{displayValue != null ? displayValue : value}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: mc.border, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

// ── Density / heatmap grid (e.g. calendar activity) ─────────────────────────
// cells: [{ key, intensity (0-1), label? }]
export function HeatmapGrid({ cells, color, mc, columns = 7, cellSize = 14, gap = 3 }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: columns * (cellSize + gap) }}>
      {cells.map(c => (
        <View
          key={c.key}
          style={{
            width: cellSize, height: cellSize, margin: gap / 2, borderRadius: 2,
            backgroundColor: c.intensity <= 0 ? mc.border : color + Math.round(40 + c.intensity * 180).toString(16).padStart(2, '0'),
          }}
        />
      ))}
    </View>
  );
}
