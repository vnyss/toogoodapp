// Adaptive TDEE / weight-trend engine — mirrors MacroFactor's core mechanic:
// instead of trusting a fixed BMR x activity-multiplier forever, recompute
// actual expenditure from how your smoothed weight trend moved relative to
// what you actually ate, then re-derive targets from that.

const KCAL_PER_KG = 7700; // energy density of body-mass change (fat-dominant estimate)

// Exponential moving average over chronologically-sorted {date, weight} points.
// alpha closer to 1 reacts faster to recent days; 0.25 is a ~7-day-ish smoothing window.
export function smoothWeightTrend(points, alpha = 0.25) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  let trend = null;
  return sorted.map(p => {
    trend = trend === null ? p.weight : alpha * p.weight + (1 - alpha) * trend;
    return { date: p.date, raw: p.weight, trend: Math.round(trend * 100) / 100 };
  });
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);
}

// Derives actual average daily expenditure from real weight-trend movement vs
// real calorie intake over the window, instead of a population-average formula.
// Needs enough density (>=5 days with both weight and calories logged) or it
// falls back to the BMR-based estimate so the UI never shows a wild number.
export function estimateAdaptiveTDEE(history, fallbackTDEE) {
  const weightPts = history.filter(d => d.weight && parseFloat(d.weight) > 0)
    .map(d => ({ date: d.date, weight: parseFloat(d.weight) }));
  const calByDate = {};
  history.forEach(d => { if (d.calories) calByDate[d.date] = d.calories; });

  if (weightPts.length < 5) {
    return { tdee: fallbackTDEE, confidence: 'low', daysUsed: weightPts.length, source: 'formula' };
  }

  const trendPts = smoothWeightTrend(weightPts);
  const first = trendPts[0], last = trendPts[trendPts.length - 1];
  const spanDays = daysBetween(first.date, last.date);
  if (spanDays < 5) {
    return { tdee: fallbackTDEE, confidence: 'low', daysUsed: weightPts.length, source: 'formula' };
  }

  const datesWithCalories = trendPts.filter(p => calByDate[p.date]);
  if (datesWithCalories.length < 4) {
    return { tdee: fallbackTDEE, confidence: 'low', daysUsed: weightPts.length, source: 'formula' };
  }

  const avgIntake = datesWithCalories.reduce((s, p) => s + calByDate[p.date], 0) / datesWithCalories.length;
  const trendDeltaKg = last.trend - first.trend;
  const dailyDeficitFromWeight = (trendDeltaKg * KCAL_PER_KG) / spanDays;
  const tdee = Math.round(avgIntake - dailyDeficitFromWeight);

  // Sanity bound — never trust a number that's wildly off the formula estimate,
  // it usually means logging was too sparse/noisy that week.
  const bounded = Math.max(fallbackTDEE * 0.7, Math.min(fallbackTDEE * 1.3, tdee));
  const confidence = spanDays >= 14 && datesWithCalories.length >= 10 ? 'high' : 'medium';

  return { tdee: Math.round(bounded), confidence, daysUsed: weightPts.length, spanDays, source: 'trend' };
}

const PHASE_THRESHOLD_KG_PER_WEEK = 0.15; // below this, treat as "maintaining"

export function detectPhase(trendPts) {
  if (trendPts.length < 5) return { phase: 'maintain', ratePerWeek: 0 };
  const first = trendPts[0], last = trendPts[trendPts.length - 1];
  const spanDays = daysBetween(first.date, last.date) || 1;
  const ratePerWeek = ((last.trend - first.trend) / spanDays) * 7;
  if (ratePerWeek <= -PHASE_THRESHOLD_KG_PER_WEEK) return { phase: 'cutting', ratePerWeek };
  if (ratePerWeek >= PHASE_THRESHOLD_KG_PER_WEEK)  return { phase: 'bulking', ratePerWeek };
  return { phase: 'maintaining', ratePerWeek };
}

const GOAL_DEFICIT = { lose: -0.20, maintain: 0, gain: 0.12 };

export function recommendTargets(tdee, goalKey, bodyWeightKg, cycleKcalAdjust = 0) {
  const adj = GOAL_DEFICIT[goalKey] ?? 0;
  const calories = Math.round(tdee * (1 + adj)) + cycleKcalAdjust;
  const proteinPerKg = goalKey === 'gain' ? 2.0 : goalKey === 'lose' ? 2.2 : 1.8;
  const protein = Math.round((bodyWeightKg || 70) * proteinPerKg);
  const fatCals = calories * 0.27;
  const fat = Math.round(fatCals / 9);
  const proteinCals = protein * 4;
  const carbs = Math.max(0, Math.round((calories - proteinCals - fatCals) / 4));
  return { calories, protein, carbs, fat };
}

// Linear projection from the current trend weight to a target weight at the
// current observed rate of change. Returns null if the rate doesn't move
// toward the target (e.g. trying to lose while trending up).
export function predictGoalDate(currentTrendKg, targetKg, ratePerWeek) {
  if (!targetKg || Math.abs(ratePerWeek) < 0.01) return null;
  const remaining = targetKg - currentTrendKg;
  const movingTowardGoal = (remaining > 0 && ratePerWeek > 0) || (remaining < 0 && ratePerWeek < 0);
  if (!movingTowardGoal) return null;
  const weeksNeeded = Math.abs(remaining / ratePerWeek);
  const d = new Date();
  d.setDate(d.getDate() + Math.round(weeksNeeded * 7));
  return { date: d.toISOString().slice(0, 10), weeksNeeded: Math.round(weeksNeeded * 10) / 10 };
}
