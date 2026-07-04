import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { C, F, S } from '../theme';
import { useTheme } from '../ThemeContext';
import { saveExerciseSchedule } from '../api';
import { getToken, getUser } from '../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BarChart } from '../components/Charts';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function hToTime(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

function timeToH(str) {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  return h + m / 60;
}

function fmtH(h) {
  const hh = Math.floor(h) % 12 || 12;
  const mm = Math.round((h - Math.floor(h)) * 60);
  const suf = Math.floor(h) < 12 ? 'am' : 'pm';
  return mm ? `${hh}:${String(mm).padStart(2, '0')}${suf}` : `${hh}${suf}`;
}

function buildDefaultSchedule(poolNames) {
  const sched = {};
  DAYS.forEach((d, i) => {
    sched[d] = {
      active: i < 5,
      exercises: poolNames.map(name => ({ name, startH: 7, endH: 8 })),
    };
  });
  return sched;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ExerciseScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  // pool: [{name}]
  const [pool, setPool] = useState([]);
  // schedule: {dayName: {active, exercises:[{name,startH,endH}]}}
  const [schedule, setSchedule] = useState({});
  const [newEx, setNewEx] = useState('');
  const [expanded, setExpanded] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const poolInputRef = useRef(null);

  // ── Load saved state ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('exercise_schedule_v2');
        if (raw) {
          const parsed = JSON.parse(raw);
          const savedPool = (parsed.pool || []).map(n => ({ name: n }));
          const savedSched = parsed.schedule || {};
          // Fill any missing days
          DAYS.forEach(d => {
            if (!savedSched[d]) savedSched[d] = { active: true, exercises: [] };
          });
          setPool(savedPool);
          setSchedule(savedSched);
        } else {
          // First time — empty pool, default schedule
          const initSched = {};
          DAYS.forEach((d, i) => {
            initSched[d] = { active: i < 5, exercises: [] };
          });
          setSchedule(initSched);
        }
      } catch {
        const initSched = {};
        DAYS.forEach((d, i) => {
          initSched[d] = { active: i < 5, exercises: [] };
        });
        setSchedule(initSched);
      }
    })();
  }, []);

  // ── Pool ────────────────────────────────────────────────────────────────────

  function addToPool() {
    const name = newEx.trim();
    if (!name) return;
    if (pool.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      setNewEx('');
      return;
    }
    const newPool = [...pool, { name }];
    setPool(newPool);
    setNewEx('');
  }

  function removeFromPool(name) {
    setPool(p => p.filter(p2 => p2.name !== name));
    setSchedule(s => {
      const next = { ...s };
      DAYS.forEach(d => {
        if (next[d]) {
          next[d] = {
            ...next[d],
            exercises: next[d].exercises.filter(e => e.name !== name),
          };
        }
      });
      return next;
    });
  }

  // ── Day active toggle ───────────────────────────────────────────────────────

  function toggleActive(day) {
    setSchedule(s => ({
      ...s,
      [day]: { ...s[day], active: !s[day].active },
    }));
  }

  // ── Expand / collapse ───────────────────────────────────────────────────────

  function toggleExpand(day) {
    setExpanded(p => ({ ...p, [day]: !p[day] }));
  }

  // ── Exercise checkbox ───────────────────────────────────────────────────────

  function toggleExercise(day, name, checked) {
    setSchedule(s => {
      const d = s[day] || { active: true, exercises: [] };
      let exs = d.exercises;
      if (checked) {
        if (!exs.find(e => e.name === name)) {
          exs = [...exs, { name, startH: 7, endH: 8 }];
        }
      } else {
        exs = exs.filter(e => e.name !== name);
      }
      return { ...s, [day]: { ...d, exercises: exs } };
    });
  }

  // ── Time update ─────────────────────────────────────────────────────────────

  function updateTime(day, name, field, val) {
    // val is a string like "07:30"
    const h = timeToH(val);
    setSchedule(s => {
      const d = s[day] || { active: true, exercises: [] };
      const exs = d.exercises.map(e =>
        e.name === name ? { ...e, [field]: h } : e
      );
      return { ...s, [day]: { ...d, exercises: exs } };
    });
  }

  // ── Apply to all ────────────────────────────────────────────────────────────

  function applyToAll(sourceDay) {
    const src = schedule[sourceDay];
    if (!src) return;
    setSchedule(s => {
      const next = { ...s };
      DAYS.forEach(d => {
        if (d === sourceDay || !next[d] || !next[d].active) return;
        next[d] = {
          ...next[d],
          exercises: src.exercises.map(e => ({ ...e })),
        };
      });
      return next;
    });
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function doSave() {
    setSaving(true);
    setSaved(false);
    try {
      const payload = {
        schedule,
        pool: pool.map(p => p.name),
      };
      await saveExerciseSchedule(payload);
      await AsyncStorage.setItem('exercise_schedule_v2', JSON.stringify(payload));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  }

  // ── Weekly minutes chart data ───────────────────────────────────────────────
  // Sum scheduled exercise minutes per active day, from startH/endH of each exercise.
  const weeklyMinutesData = DAYS.map(day => {
    const d = schedule[day];
    const mins = d && d.active && d.exercises
      ? d.exercises.reduce((sum, e) => sum + Math.max(0, (e.endH - e.startH) * 60), 0)
      : 0;
    return { label: day.slice(0, 2), v: Math.round(mins) };
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: mc.bg,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
  },

  // Page header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: mc.border,
    marginBottom: 24,
  },
  pageTitle: {
    fontFamily: F.display,
    fontSize: 18,
    color: mc.text,
    letterSpacing: 1,
  },
  pageSubtitle: {
    fontFamily: F.mono,
    fontSize: 11,
    color: mc.text2,
    marginTop: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  savedIndicator: {
    fontFamily: F.mono,
    fontSize: 11,
    color: C.green,
    letterSpacing: 1,
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: accentColor,
    borderRadius: borderRadius,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: F.mono,
    fontSize: Math.max(10, fontSize - 2),
    fontWeight: '700',
    color: '#080808',
    letterSpacing: 1,
  },

  // Sections
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: F.mono,
    fontSize: 11,
    color: mc.text3,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Pool
  poolWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    padding: 16,
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: borderRadius,
  },
  poolEmpty: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text3,
    fontStyle: 'italic',
  },
  poolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: mc.goldDim,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: Math.max(4, borderRadius - 2),
  },
  poolChipText: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text,
  },
  poolChipDel: {
    fontFamily: F.mono,
    fontSize: 14,
    color: mc.text3,
    paddingLeft: 4,
    lineHeight: 16,
  },
  poolAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  poolInput: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: mc.border,
    color: mc.text,
    fontFamily: F.mono,
    fontSize: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    width: 140,
    outlineWidth: 0,
  },
  poolAddBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: mc.borderH,
    borderRadius: 4,
  },
  poolAddBtnText: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: accentColor,
    whiteSpace: 'nowrap',
  },

  // Days list
  daysList: {
    flexDirection: 'column',
    gap: 10,
  },
  dayCard: {
    backgroundColor: mc.surface,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: borderRadius,
    overflow: 'hidden',
  },
  dayCardRest: {
    opacity: 0.6,
  },

  // Day header
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dayName: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text,
    fontWeight: '700',
    letterSpacing: 1,
    width: 88,
  },
  dayToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleLabel: {
    fontFamily: F.mono,
    fontSize: 11,
    color: mc.text2,
    letterSpacing: 1,
    minWidth: 38,
  },
  toggleTrack: {
    width: 36,
    height: 20,
    backgroundColor: mc.elevated,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: mc.text3,
  },
  toggleThumbActive: {
    backgroundColor: accentColor,
    alignSelf: 'flex-end',
  },
  daySummary: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginLeft: 8,
  },
  daySumChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: mc.elevated,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: 2,
  },
  daySumChipText: {
    fontFamily: F.mono,
    fontSize: 10,
    color: mc.text2,
    letterSpacing: 1,
  },
  dayExpandIcon: {
    fontFamily: F.mono,
    fontSize: 11,
    color: mc.text3,
    marginLeft: 'auto',
  },
  dayExpandIconOpen: {
    // rotated indicator — use caret up character
    color: mc.text2,
  },

  // Day body (expanded)
  dayBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: mc.border,
  },
  dayBodyInner: {
    paddingTop: 14,
    flexDirection: 'column',
    gap: 10,
  },
  noExercises: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text3,
    fontStyle: 'italic',
    paddingVertical: 4,
  },

  // Exercise row
  dayExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  dayExCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  checkBox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: mc.border,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkBoxChecked: {
    backgroundColor: accentColor,
    borderColor: accentColor,
  },
  checkMark: {
    fontFamily: F.mono,
    fontSize: 9,
    color: '#080808',
    lineHeight: 12,
  },
  dayExName: {
    fontFamily: F.mono,
    fontSize: fontSize,
    color: mc.text,
    width: 110,
  },
  dayExTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dayExTimeDisabled: {
    opacity: 0.3,
  },
  timeInput: {
    backgroundColor: mc.elevated,
    borderWidth: 1,
    borderColor: mc.border,
    color: mc.text,
    fontFamily: F.mono,
    fontSize: fontSize,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    width: 70,
    textAlign: 'center',
    outlineWidth: 0,
  },
  timeSep: {
    fontFamily: F.mono,
    fontSize: 11,
    color: mc.text3,
  },
  applyAllBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: 'transparent',
    padding: 0,
  },
  applyAllBtnText: {
    fontFamily: F.mono,
    fontSize: 11,
    color: accentColor,
    letterSpacing: 1,
    opacity: 0.7,
    textDecorationLine: 'underline',
  },

  // Chart card
  chartCard: {
    borderWidth: 1,
    borderColor: mc.border,
    padding: 16,
    marginBottom: 14,
    backgroundColor: mc.surface,
    borderRadius: borderRadius,
  },
  chartLabel: {
    fontFamily: F.mono,
    fontSize: 10,
    color: mc.text3,
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  chartCaption: {
    fontFamily: F.mono,
    fontSize: 9,
    color: mc.text3,
    marginTop: 6,
  },
});

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Exercise Schedule</Text>
          <Text style={styles.pageSubtitle}>Customise what you do each day of the week</Text>
        </View>
        <View style={styles.headerActions}>
          {saved && <Text style={styles.savedIndicator}>Saved</Text>}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={doSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#080808" />
              : <Text style={styles.saveBtnText}>Save changes</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Section: Weekly exercise minutes ── */}
      <View style={styles.chartCard}>
        <Text style={styles.chartLabel}>Scheduled minutes per day</Text>
        <BarChart data={weeklyMinutesData} color={accentColor} mc={mc} height={80} />
        <Text style={styles.chartCaption}>
          Total scheduled this week: {weeklyMinutesData.reduce((s, d) => s + d.v, 0)} min
        </Text>
      </View>

      {/* ── Section: My exercises (pool) ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My exercises</Text>
        <View style={styles.poolWrap}>
          {pool.length === 0 && (
            <Text style={styles.poolEmpty}>No exercises added yet.</Text>
          )}
          {pool.map(({ name }) => (
            <View key={name} style={styles.poolChip}>
              <Text style={styles.poolChipText}>{name}</Text>
              <TouchableOpacity onPress={() => removeFromPool(name)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={styles.poolChipDel}>x</Text>
              </TouchableOpacity>
            </View>
          ))}
          {/* Add row always at the end */}
          <View style={styles.poolAddRow}>
            <TextInput
              ref={poolInputRef}
              style={styles.poolInput}
              value={newEx}
              onChangeText={setNewEx}
              placeholder="e.g. Swimming"
              placeholderTextColor={mc.text3}
              maxLength={40}
              onSubmitEditing={addToPool}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.poolAddBtn} onPress={addToPool}>
              <Text style={styles.poolAddBtnText}>+ Add exercise</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Section: Weekly plan ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly plan</Text>
        <View style={styles.daysList}>
          {DAYS.map(day => {
            const d = schedule[day] || { active: true, exercises: [] };
            const isOpen = !!expanded[day];
            return (
              <DayCard
                key={day}
                day={day}
                dayData={d}
                pool={pool}
                isOpen={isOpen}
                styles={styles}
                onToggleExpand={() => toggleExpand(day)}
                onToggleActive={() => toggleActive(day)}
                onToggleExercise={(name, checked) => toggleExercise(day, name, checked)}
                onUpdateTime={(name, field, val) => updateTime(day, name, field, val)}
                onApplyToAll={() => applyToAll(day)}
              />
            );
          })}
        </View>
      </View>

    </ScrollView>
  );
}

// ── DayCard sub-component ─────────────────────────────────────────────────────

function DayCard({ day, dayData, pool, isOpen, styles, onToggleExpand, onToggleActive, onToggleExercise, onUpdateTime, onApplyToAll }) {
  const { mc } = useTheme();
  const d = dayData;
  const isActive = d.active;

  // Summary chips
  const summaryChips = () => {
    if (!isActive) {
      return <View style={styles.daySumChip}><Text style={[styles.daySumChipText, { color: mc.text3 }]}>Rest day</Text></View>;
    }
    if (!d.exercises || d.exercises.length === 0) {
      return <View style={styles.daySumChip}><Text style={[styles.daySumChipText, { color: mc.text3 }]}>No exercises selected</Text></View>;
    }
    return d.exercises.map(e => (
      <View key={e.name} style={styles.daySumChip}>
        <Text style={styles.daySumChipText} numberOfLines={1}>
          {e.name} {fmtH(e.startH)}-{fmtH(e.endH)}
        </Text>
      </View>
    ));
  };

  return (
    <View style={[styles.dayCard, !isActive && styles.dayCardRest]}>
      {/* Day header row */}
      <TouchableOpacity style={styles.dayHeader} onPress={onToggleExpand} activeOpacity={0.8}>
        <Text style={styles.dayName}>{day}</Text>

        {/* Active/Rest toggle — stop propagation handled by separate touch */}
        <TouchableOpacity
          style={styles.dayToggleWrap}
          onPress={onToggleActive}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.toggleLabel}>{isActive ? 'Active' : 'Rest'}</Text>
          <View style={styles.toggleTrack}>
            <View style={[styles.toggleThumb, isActive && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>

        {/* Summary chips */}
        <View style={styles.daySummary}>
          {summaryChips()}
        </View>

        {/* Expand icon */}
        <Text style={[styles.dayExpandIcon, isOpen && styles.dayExpandIconOpen]}>v</Text>
      </TouchableOpacity>

      {/* Expanded day body */}
      {isOpen && (
        <View style={styles.dayBody}>
          <View style={styles.dayBodyInner}>
            {!isActive && (
              <Text style={styles.noExercises}>Rest day - no workout scheduled.</Text>
            )}
            {isActive && pool.length === 0 && (
              <Text style={styles.noExercises}>Add exercises to "My exercises" above first.</Text>
            )}
            {isActive && pool.length > 0 && pool.map(({ name }) => {
              const sel = d.exercises && d.exercises.find(e => e.name === name);
              const isChecked = !!sel;
              const sh = sel ? sel.startH : 7;
              const eh = sel ? sel.endH : 8;
              return (
                <ExerciseRow
                  key={name}
                  name={name}
                  isChecked={isChecked}
                  startH={sh}
                  endH={eh}
                  styles={styles}
                  onToggle={checked => onToggleExercise(name, checked)}
                  onUpdateStart={val => onUpdateTime(name, 'startH', val)}
                  onUpdateEnd={val => onUpdateTime(name, 'endH', val)}
                />
              );
            })}
            {isActive && d.exercises && d.exercises.length > 0 && (
              <TouchableOpacity style={styles.applyAllBtn} onPress={onApplyToAll}>
                <Text style={styles.applyAllBtnText}>Apply this day's schedule to all active days</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ── ExerciseRow sub-component ─────────────────────────────────────────────────

function ExerciseRow({ name, isChecked, startH, endH, styles, onToggle, onUpdateStart, onUpdateEnd }) {
  const { mc } = useTheme();
  return (
    <View style={styles.dayExRow}>
      {/* Checkbox + name */}
      <TouchableOpacity style={styles.dayExCheck} onPress={() => onToggle(!isChecked)}>
        <View style={[styles.checkBox, isChecked && styles.checkBoxChecked]}>
          {isChecked && <Text style={styles.checkMark}>v</Text>}
        </View>
        <Text style={styles.dayExName} numberOfLines={1}>{name}</Text>
      </TouchableOpacity>

      {/* Time inputs */}
      <View style={[styles.dayExTime, !isChecked && styles.dayExTimeDisabled]}>
        <TextInput
          style={styles.timeInput}
          value={hToTime(startH)}
          onChangeText={onUpdateStart}
          editable={isChecked}
          placeholder="07:00"
          placeholderTextColor={mc.text3}
          maxLength={5}
        />
        <Text style={styles.timeSep}>to</Text>
        <TextInput
          style={styles.timeInput}
          value={hToTime(endH)}
          onChangeText={onUpdateEnd}
          editable={isChecked}
          placeholder="08:00"
          placeholderTextColor={mc.text3}
          maxLength={5}
        />
      </View>
    </View>
  );
}

