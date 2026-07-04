// Shared cycle-phase math, mirrors the inline calculation in PeriodScreen.js
// so other screens (e.g. SmartTargetsScreen) can derive the same phase
// without duplicating the formula.

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

// Returns the current phase key ('menstruation'|'follicular'|'ovulation'|'luteal')
// or null if no period data has been logged yet.
export function getCyclePhase({ lastPeriod, cycleLen, periodLen }, todayISO = new Date().toISOString().slice(0, 10)) {
  if (!lastPeriod) return null;
  const cycleDay = daysBetween(lastPeriod, todayISO) + 1;
  const posInCycle = ((cycleDay - 1) % cycleLen) + 1;
  if (posInCycle <= periodLen)            return 'menstruation';
  if (posInCycle <= cycleLen / 2 - 1)     return 'follicular';
  if (posInCycle <= cycleLen / 2 + 1)     return 'ovulation';
  return 'luteal';
}

// Modest, well-established physiological adjustment: BMR rises slightly
// during the luteal phase due to elevated progesterone.
export const PHASE_KCAL_ADJUST = { menstruation: 0, follicular: 0, ovulation: 0, luteal: 125 };
