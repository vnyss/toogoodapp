import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { C, F } from '../theme';
import { useTheme } from '../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUser } from '../auth';

// ── Meal plan data (mirrors the HTML opt object exactly) ──────────────────────
const OPT = {
  breakfast: {
    loss: [
      ['2 boiled eggs', 'Oats with skim milk (40 g)', 'Black coffee or green tea'],
      ['Vegetable omelette (2 eggs)', 'Brown bread (1 slice)', 'Unsweetened yogurt (100 g)'],
      ['Moong dal chilla (2)', 'Mint chutney', 'Green tea'],
      ['Poha with vegetables (1 cup)', '1 boiled egg', 'Black coffee'],
    ],
    gain: [
      ['3 scrambled eggs + 2 whole wheat toast', 'Banana + peanut butter (1 tbsp)', 'Full-fat milk (200 ml)'],
      ['Besan chilla (3)', 'Paneer (50 g)', 'Banana shake (300 ml)'],
      ['4-egg omelette with cheese', '3 multigrain toast', 'Orange juice (200 ml)'],
      ['Upma (1.5 cup)', '2 boiled eggs', 'Whole milk (250 ml)'],
    ],
    maintain: [
      ['2 eggs (any style)', 'Whole wheat toast (2 slices)', 'Seasonal fruit'],
      ['Idli (3) with sambar', 'Coconut chutney', 'Tea or coffee'],
      ['Vegetable poha (1 cup)', '1 egg', 'Any fruit'],
      ['Dalia with milk (1 bowl)', '1 banana', 'Green tea'],
    ],
  },
  lunch: {
    loss: [
      ['Grilled chicken breast (120 g)', 'Brown rice (80 g cooked)', 'Mixed salad with lemon dressing'],
      ['Dal (1 cup)', '1 roti', 'Stir-fried vegetables', 'Buttermilk (200 ml)'],
      ['Baked fish (150 g)', 'Quinoa (80 g cooked)', 'Steamed broccoli'],
      ['Paneer bhurji (low oil, 100 g)', '1 roti', 'Cucumber + tomato salad'],
    ],
    gain: [
      ['Chicken or paneer (150 g)', 'White rice (150 g cooked)', 'Dal + 2 rotis', 'Curd (100 g)'],
      ['Rajma (1 cup)', 'Rice (200 g cooked)', '2 rotis', 'Salad'],
      ['Egg curry (3 eggs)', 'Rice (200 g)', '2 rotis', 'Curd'],
      ['Chicken biryani (1 plate)', 'Raita (150 g)', 'Salad'],
    ],
    maintain: [
      ['Dal + rice or 2 rotis', 'Sabzi (any vegetable)', 'Curd or buttermilk'],
      ['2 chapati', 'Paneer sabzi', 'Dal', 'Salad'],
      ['Khichdi (1 bowl)', 'Papad', 'Mixed pickle', 'Curd'],
      ['Chole (1 cup)', '2 rotis', 'Onion salad', 'Lassi (small)'],
    ],
  },
  dinner: {
    loss: [
      ['Baked fish or tofu (100 g)', 'Stir-fried vegetables', '1 small roti'],
      ['Grilled paneer (80 g)', 'Dal soup (1 bowl)', 'Salad'],
      ['Egg white omelette (3 whites)', 'Sauteed mushrooms', 'Whole wheat toast (1)'],
      ['Chicken clear soup', 'Steamed vegetables', 'Small salad'],
    ],
    gain: [
      ['Chicken / paneer (150 g)', '2-3 rotis', 'Cooked vegetables + dal'],
      ['Pasta with chicken (1 bowl)', 'Garlic bread (2)', 'Mixed salad'],
      ['Dal makhani (1 cup)', '3 rotis', 'Paneer (80 g)', 'Rice (100 g cooked)'],
      ['Egg fried rice (1 plate)', 'Chicken (100 g)', 'Soup'],
    ],
    maintain: [
      ['2 rotis + dal', 'Vegetable sabzi', 'Small bowl curd'],
      ['Rice (100 g cooked)', 'Dal', 'Sabzi', 'Salad'],
      ['Mixed veg khichdi (1 bowl)', 'Papad', 'Pickle'],
      ['Paneer sabzi', '2 rotis', 'Dal soup'],
    ],
  },
  snacks: {
    loss: [
      ['Almonds (15 g)', 'Green tea', 'Apple or pear'],
      ['Roasted chana (30 g)', 'Black coffee', 'Cucumber sticks'],
      ['Low-fat yogurt (100 g)', 'Berries or banana'],
      ['1 boiled egg', 'Apple', 'Herbal tea'],
    ],
    gain: [
      ['Banana milkshake (300 ml)', 'Mixed nuts (30 g)', 'Protein bar'],
      ['Peanut butter toast (2 slices)', 'Whole milk (200 ml)', 'Banana'],
      ['Dates (5) + almonds (20 g)', 'Full-fat curd (150 g)'],
      ['Chikki (1 piece)', '2 bananas', 'Whole milk (250 ml)'],
    ],
    maintain: [
      ['Seasonal fruit', 'Handful of nuts or murmura'],
      ['Roasted makhana (30 g)', 'Green tea', 'Apple'],
      ['Curd (100 g)', 'Banana', 'Tea'],
      ['Rice cake (2)', 'Peanut butter (1 tsp)', 'Herbal tea'],
    ],
  },
};

const MEAL_ROWS = [
  { key: 'breakfast', label: 'Breakfast', time: '7 - 9 am' },
  { key: 'lunch',     label: 'Lunch',     time: '12 - 2 pm' },
  { key: 'dinner',    label: 'Dinner',    time: '7 - 9 pm' },
  { key: 'snacks',    label: 'Snacks',    time: 'Between meals' },
];

const KCAL_SPLITS = { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snacks: 0.10 };

function macroFor(cal) {
  return {
    p: Math.round((cal * 0.25) / 4),
    c: Math.round((cal * 0.50) / 4),
    f: Math.round((cal * 0.25) / 9),
  };
}

function goalKey(goal) {
  const g = (goal || '').toLowerCase();
  if (g.includes('loss') || g === 'fat_loss') return 'loss';
  if (g.includes('gain') || g.includes('muscle') || g === 'weight_gain') return 'gain';
  return 'maintain';
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdaptScreen({ navigation }) {
  const { mc, accentColor, fontSize, borderRadius } = useTheme();
  const [loading,    setLoading]    = useState(true);
  const [plan,       setPlan]       = useState({});
  const [stats,      setStats]      = useState({ avgCal: 0, wtChange: null, days: 0 });
  const [calInput,   setCalInput]   = useState('');
  const [planKey,    setPlanKey]    = useState('');
  const [logKey,     setLogKey]     = useState('');

  // ── Derived adapt analysis (mirrors renderAdapt in HTML) ──────────────────
  const target  = plan.target_calories || 0;
  const goal    = (plan.goal || '').toLowerCase();
  const avgCal  = stats.avgCal;
  const wtChange = stats.wtChange;
  const days    = stats.days;
  const surplus = avgCal && target ? avgCal - target : null;

  const isLoss = goal.includes('loss') || goal === 'fat_loss';
  const isGain = goal.includes('gain') || goal.includes('muscle') || goal === 'weight_gain';

  let adaptTitle   = 'Analysing your week...';
  let adaptInsight = 'Log your weight and food for at least 3 days to unlock your first weekly insight.';
  let statusClass  = 'warn';
  let statusText   = 'Set up plan';

  if (days < 3) {
    adaptTitle   = 'Not enough data yet';
    adaptInsight = 'Log your weight and food for at least 3 days to unlock your first weekly insight.';
    statusClass  = 'warn';
    statusText   = 'Need more data';
  } else if (!target) {
    adaptTitle   = 'Set your calorie target';
    adaptInsight = 'Enter your daily calorie target above and I\'ll adapt your plan based on your real results each week.';
    statusClass  = 'warn';
    statusText   = 'Set up plan';
  } else if (surplus !== null && Math.abs(surplus) <= 150) {
    adaptTitle  = 'Right on track';
    adaptInsight = `You're averaging ${avgCal} kcal per day — exactly what your target asks for.${wtChange !== null ? ` Your weight changed by ${Number(wtChange) > 0 ? '+' : ''}${wtChange} kg this week.` : ''} Keep it up.`;
    statusClass  = 'ok';
    statusText   = 'On track';
  } else if (surplus !== null && surplus > 150 && isLoss) {
    adaptTitle   = 'Slightly over — easy fix';
    adaptInsight = `You're averaging ${avgCal} kcal, about ${surplus} kcal above your target. Try reducing portion sizes at dinner or swapping one snack for a lighter option.`;
    statusClass  = 'adj';
    statusText   = 'Adjust down';
  } else if (surplus !== null && surplus < -150 && isGain) {
    adaptTitle   = 'Under-eating for your goal';
    adaptInsight = `You're averaging ${avgCal} kcal, about ${Math.abs(surplus)} kcal below your target. Add a protein-rich snack or increase your lunch portion to hit your muscle-building target.`;
    statusClass  = 'adj';
    statusText   = 'Eat more';
  } else if (surplus !== null && surplus > 150) {
    adaptTitle   = "You're eating above target";
    adaptInsight = `You're averaging ${avgCal} kcal against a target of ${target} kcal. Consider tracking your snacks more carefully — they often add up unnoticed.`;
    statusClass  = 'warn';
    statusText   = 'Above target';
  } else if (surplus !== null) {
    adaptTitle   = 'Below target this week';
    adaptInsight = `You're averaging ${avgCal} kcal, which is ${Math.abs(surplus)} kcal below your target. Make sure you're eating enough to fuel your body properly.`;
    statusClass  = 'warn';
    statusText   = 'Below target';
  }

  // Badge styles by type
  const BADGE_STYLE = {
    ok:   { bg: 'rgba(76,175,130,0.1)',   border: 'rgba(76,175,130,0.3)',   color: C.green },
    warn: { bg: 'rgba(201,168,76,0.08)',  border: 'rgba(201,168,76,0.3)',   color: accentColor },
    adj:  { bg: 'rgba(207,102,121,0.08)', border: 'rgba(207,102,121,0.3)',  color: C.red   },
  };
  const badge = BADGE_STYLE[statusClass] || BADGE_STYLE.warn;

  // ── Meal plan rows (mirrors renderMealPlan in HTML) ───────────────────────
  const dow = new Date().getDay();
  const gk  = goalKey(goal);
  const showMealPlan = target > 0;

  function pickFoods(meal) {
    const opts = OPT[meal][gk];
    return opts[dow % opts.length];
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const u = await getUser();
      const lk = `toogood_daily_logs_${u}`;
      const pk = `toogood_user_plan_${u}`;
      setLogKey(lk);
      setPlanKey(pk);
      await loadData(lk, pk);
      setLoading(false);
    })();
  }, []);

  async function loadData(lk, pk) {
    const [rawLogs, rawPlan] = await Promise.all([
      AsyncStorage.getItem(lk),
      AsyncStorage.getItem(pk),
    ]);
    const logs = rawLogs ? JSON.parse(rawLogs) : [];
    const p    = rawPlan ? JSON.parse(rawPlan) : {};
    setPlan(p);
    if (p.target_calories) setCalInput(String(p.target_calories));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const week    = logs.filter(l => new Date(l.date + 'T00:00') >= cutoff);
    const calLogs = week.filter(l => l.calories > 0);
    const wtLogs  = week
      .filter(l => l.weight && parseFloat(l.weight) > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const avgCal   = calLogs.length
      ? Math.round(calLogs.reduce((s, l) => s + l.calories, 0) / calLogs.length)
      : 0;
    const wtChange = wtLogs.length >= 2
      ? (parseFloat(wtLogs[wtLogs.length - 1].weight) - parseFloat(wtLogs[0].weight)).toFixed(1)
      : null;
    setStats({ avgCal, wtChange, days: calLogs.length });
  }

  async function saveCalTarget() {
    const val = parseInt(calInput, 10);
    if (!val || val < 800 || val > 6000) return;
    const newPlan = { ...plan, target_calories: val };
    await AsyncStorage.setItem(planKey, JSON.stringify(newPlan));
    setPlan(newPlan);
  }

  // ── StyleSheet ──────────────────────────────────────────────────────────────
  const st = StyleSheet.create({
    loadingWrap: {
      flex: 1,
      backgroundColor: mc.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    screen: {
      flex: 1,
      backgroundColor: mc.bg,
    },
    scrollContent: {
      paddingBottom: 60,
    },

    // .page-header / .page-title / .page-sub
    pageHeader: {
      paddingHorizontal: 48,
      paddingTop: 40,
      marginBottom: 32,
    },
    pageTitle: {
      fontFamily: F.display,
      fontSize: 26,
      color: mc.text,
      letterSpacing: 1,
      marginBottom: 6,
    },
    pageSub: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text3,
      letterSpacing: 1,
    },

    // .adapt-card
    adaptCard: {
      marginHorizontal: 48,
      backgroundColor: mc.surface,
      borderWidth: 1,
      borderColor: mc.border,
      paddingTop: 28,
      paddingBottom: 28,
      paddingLeft: 38,   // extra left to clear gold strip
      paddingRight: 32,
      position: 'relative',
      overflow: 'hidden',
    },
    // .adapt-card::before  (gold left strip, 3 px wide, full height)
    goldStrip: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 3,
      bottom: 0,
      backgroundColor: accentColor,
    },

    // .adapt-label
    adaptLabel: {
      fontFamily: F.mono,
      fontSize: 9,
      color: accentColor,
      letterSpacing: 5,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    // .adapt-title
    adaptTitle: {
      fontFamily: F.display,
      fontSize: 22,
      color: mc.text,
      letterSpacing: 1,
      marginBottom: 16,
    },
    // .adapt-insight
    adaptInsight: {
      fontFamily: F.mono,
      fontSize: 15,
      color: mc.text,
      lineHeight: 26,
      marginBottom: 20,
      letterSpacing: 0.3,
    },

    // .adapt-stats
    adaptStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 32,
      borderTopWidth: 1,
      borderTopColor: mc.border,
      paddingTop: 16,
    },
    adaptStat: {
      gap: 3,
    },
    adaptStatLabel: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
      letterSpacing: 3,
      textTransform: 'uppercase',
    },
    adaptStatVal: {
      fontFamily: F.display,
      fontSize: 18,
      color: mc.text,
    },

    // .adapt-badge
    adaptBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderWidth: 1,
      marginTop: 4,
    },
    adaptBadgeText: {
      fontFamily: F.mono,
      fontSize: 10,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },

    // .adapt-cal-strip
    calStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 14,
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: mc.border,
    },
    calStripLabel: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
      letterSpacing: 3,
      textTransform: 'uppercase',
    },
    calInput: {
      backgroundColor: 'transparent',
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
      color: mc.text,
      fontFamily: F.display,
      fontSize: 18,
      width: 90,
      paddingVertical: 4,
      outlineWidth: 0,
    },
    calUnit: {
      fontFamily: F.mono,
      fontSize: 11,
      color: mc.text3,
    },
    calBtn: {
      marginLeft: 'auto',
      paddingVertical: 7,
      paddingHorizontal: 18,
      backgroundColor: accentColor,
    },
    calBtnTxt: {
      fontFamily: F.mono,
      fontSize: 11,
      color: '#060606',
      letterSpacing: 2,
    },

    // .meal-plan-wrap
    mealPlanWrap: {
      marginTop: 24,
      borderTopWidth: 1,
      borderTopColor: mc.border,
      paddingTop: 20,
    },
    mealPlanLabel: {
      fontFamily: F.mono,
      fontSize: 9,
      color: accentColor,
      letterSpacing: 5,
      textTransform: 'uppercase',
      marginBottom: 14,
    },

    // Table layout
    tableRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 14,
    },
    tableHeader: {
      paddingTop: 0,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: mc.border,
    },
    tableRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.04)',
    },

    // Column widths — mirrors th widths in HTML
    colMeal: {
      width: 110,
      paddingRight: 12,
    },
    colFoods: {
      flex: 1,
      paddingRight: 12,
    },
    colKcal: {
      width: 110,
      alignItems: 'flex-end',
    },

    // th
    th: {
      fontFamily: F.mono,
      fontSize: 9,
      color: mc.text3,
      letterSpacing: 3,
      textTransform: 'uppercase',
      fontWeight: '400',
    },
    thRight: {
      textAlign: 'right',
    },

    // .meal-name
    mealName: {
      fontFamily: F.display,
      fontSize: 15,
      color: mc.text,
      letterSpacing: 1,
    },
    // .meal-time
    mealTime: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
      marginTop: 2,
      letterSpacing: 2,
    },
    // .meal-foods span
    mealFood: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text2,
      lineHeight: 21,
    },
    // .meal-kcal
    mealKcal: {
      fontFamily: F.display,
      fontSize: 17,
      color: mc.text,
    },
    // .meal-macros
    mealMacros: {
      fontFamily: F.mono,
      fontSize: 10,
      color: mc.text3,
      marginTop: 3,
    },

    // .meal-total-row
    totalRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: mc.border,
    },

    // placeholder when no target
    mealPlaceholderRow: {
      paddingVertical: 18,
    },
    mealPlaceholder: {
      fontFamily: F.mono,
      fontSize: fontSize,
      color: mc.text3,
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={st.loadingWrap}>
        <ActivityIndicator color={accentColor} />
      </View>
    );
  }

  // Meal plan kcal amounts
  const mealKcal = {
    breakfast: Math.round(target * KCAL_SPLITS.breakfast),
    lunch:     Math.round(target * KCAL_SPLITS.lunch),
    dinner:    Math.round(target * KCAL_SPLITS.dinner),
    snacks:    Math.round(target * KCAL_SPLITS.snacks),
  };
  const totalMacro = macroFor(target);

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.scrollContent}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <View style={st.pageHeader}>
        <Text style={st.pageTitle}>TG·Adapt</Text>
        <Text style={st.pageSub}>Your plan adjusts week to week based on your real results.</Text>
      </View>

      {/* ── Adapt card (.adapt-card) ──────────────────────────────────────── */}
      <View style={st.adaptCard}>
        {/* Gold left strip (.adapt-card::before) */}
        <View style={st.goldStrip} />

        {/* .adapt-label */}
        <Text style={st.adaptLabel}>TG·Adapt — Intelligent Plan Adaptation</Text>

        {/* .adapt-title */}
        <Text style={st.adaptTitle}>{adaptTitle}</Text>

        {/* .adapt-insight */}
        <Text style={st.adaptInsight}>{adaptInsight}</Text>

        {/* .adapt-stats */}
        <View style={st.adaptStats}>
          <View style={st.adaptStat}>
            <Text style={st.adaptStatLabel}>Avg Daily Calories</Text>
            <Text style={st.adaptStatVal}>{avgCal ? `${avgCal} kcal` : '—'}</Text>
          </View>
          <View style={st.adaptStat}>
            <Text style={st.adaptStatLabel}>Weight Change</Text>
            <Text style={st.adaptStatVal}>
              {wtChange !== null
                ? `${Number(wtChange) > 0 ? '+' : ''}${wtChange} kg`
                : '—'}
            </Text>
          </View>
          <View style={st.adaptStat}>
            <Text style={st.adaptStatLabel}>Daily Target</Text>
            <Text style={st.adaptStatVal}>{target ? `${target} kcal` : '—'}</Text>
          </View>
          <View style={st.adaptStat}>
            <Text style={st.adaptStatLabel}>Status</Text>
            <View style={[st.adaptBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
              <Text style={[st.adaptBadgeText, { color: badge.color }]}>{statusText}</Text>
            </View>
          </View>
        </View>

        {/* ── Calorie input strip (.adapt-cal-strip) ────────────────────── */}
        <View style={st.calStrip}>
          <Text style={st.calStripLabel}>Daily calorie target</Text>
          <TextInput
            style={st.calInput}
            value={calInput}
            onChangeText={setCalInput}
            keyboardType="number-pad"
            placeholder="2000"
            placeholderTextColor={mc.text3}
          />
          <Text style={st.calUnit}>kcal / day</Text>
          <TouchableOpacity style={st.calBtn} onPress={saveCalTarget}>
            <Text style={st.calBtnTxt}>Save target</Text>
          </TouchableOpacity>
        </View>

        {/* ── Meal plan (.meal-plan-wrap) ────────────────────────────────── */}
        <View style={st.mealPlanWrap}>
          <Text style={st.mealPlanLabel}>Today's Meal Plan</Text>

          {/* Table header */}
          <View style={[st.tableRow, st.tableHeader]}>
            <View style={st.colMeal}>
              <Text style={st.th}>Meal</Text>
            </View>
            <View style={st.colFoods}>
              <Text style={st.th}>What to eat</Text>
            </View>
            <View style={st.colKcal}>
              <Text style={[st.th, st.thRight]}>Kcal / Macros</Text>
            </View>
          </View>

          {/* Meal rows or placeholder */}
          {!showMealPlan ? (
            <View style={st.mealPlaceholderRow}>
              <Text style={st.mealPlaceholder}>
                Set your calorie target above to see your meal breakdown.
              </Text>
            </View>
          ) : (
            <>
              {MEAL_ROWS.map((row, i) => {
                const foods  = pickFoods(row.key);
                const kcal   = mealKcal[row.key];
                const macro  = macroFor(kcal);
                const isLast = i === MEAL_ROWS.length - 1;
                return (
                  <View
                    key={row.key}
                    style={[
                      st.tableRow,
                      !isLast && st.tableRowBorder,
                    ]}
                  >
                    <View style={st.colMeal}>
                      <Text style={st.mealName}>{row.label}</Text>
                      <Text style={st.mealTime}>{row.time}</Text>
                    </View>
                    <View style={st.colFoods}>
                      {foods.map((food, fi) => (
                        <Text key={fi} style={st.mealFood}>{food}</Text>
                      ))}
                    </View>
                    <View style={st.colKcal}>
                      <Text style={[st.mealKcal, { textAlign: 'right' }]}>{kcal} kcal</Text>
                      <Text style={[st.mealMacros, { textAlign: 'right' }]}>
                        {macro.p}g P · {macro.c}g C · {macro.f}g F
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Total row (.meal-total-row) */}
              <View style={st.totalRow}>
                <View style={st.colMeal}>
                  <Text style={[st.mealName, { color: accentColor }]}>Total</Text>
                </View>
                <View style={st.colFoods} />
                <View style={st.colKcal}>
                  <Text style={[st.mealKcal, { color: accentColor, textAlign: 'right' }]}>
                    {target} kcal
                  </Text>
                  <Text style={[st.mealMacros, { textAlign: 'right' }]}>
                    {totalMacro.p}g P · {totalMacro.c}g C · {totalMacro.f}g F
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

    </ScrollView>
  );
}

