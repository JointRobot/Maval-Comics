// GYANU HUNT · scoring rules. Pure functions, no DOM, no storage.
// The same rules are mirrored in supabase/schema.sql (gh_score) — change both together.

export const RULES = {
  // Base score by the order of approved finds on ONE appearance: 1st, 2nd, later.
  base: { first: 100, second: 50, later: 10 },
  golden: { first: 500, later: 10 },          // only the first verified hunter gets the 500
  final:  { first: 1000, later: 50 },         // the winner takes 1,000
  // Speed bonus, seconds since the appearance went live → bonus
  speed: [[30, 100], [60, 75], [120, 50], [300, 25]],
  quality: { clear: 25, partial: 10, unclear: 0 },
  // Combo bonus for the streak count reached by this find (5 and above = 200)
  combo: { 2: 25, 3: 50, 4: 100, 5: 200 },
  cooldownSec: 15,          // between any two submissions by one player
  maxTriesPerGyanu: 3,      // wrong / unclear photos allowed per appearance
  dupHamming: 6,            // dHash distance at or under which two photos count as the same
  autoApprove: 0.62,        // reference-match confidence for automatic approval
  clearAt: 0.78,            // confidence at or above which the photo counts as "clear"

  // Hype moments (chant / shake / statue): everyone who joined a won moment gets this
  hypePoints: 20,
  callsPerPlayer: 5, callCooldownSec: 60, callGapSec: 15, callDurSec: 30, callBonusPerPhone: 1, callBonusCap: 40, callHelpsPer: 3, callEarnCap: 5, callBuyCap: 3, callBuyMin: 60, callBuyShare: 0.55,
  roamPts: { wild: [40, 25, 15, 10], golden: [150, 60], player: [30, 20, 15, 10] }, dropperPerCatch: 10, dropperFullBonus: 20, dropsPerHour: 3, dropLifeSec: 300, // 'Call the crowd': every player gets 5 calls
  hypeGoalPerPhone: 8,      // meter units each joined phone must add on average (1 unit ≈ 1.5 s at full power)
  // The Scene (crowd-sourced info)
  reportPoints: 5, reportCapPerHour: 6, confirmPoints: 2, sceneTTLMin: 45,
  // Whack-a-Gyanu (at home): its own board, plausibility cap per 30 s round
  homeMaxPerRound: 90, homeCooldownSec: 20, punchMaxPerRound: 200, punchCooldownSec: 15
};

export function basePoints(order, g) {
  // order: 0 for the first approved find on this appearance, 1 second, ...
  if (g.type === 'golden') return order === 0 ? RULES.golden.first : RULES.golden.later;
  if (g.type === 'final') return order === 0 ? RULES.final.first : RULES.final.later;
  const first = Number(g.points) || RULES.base.first;
  if (order === 0) return first;
  if (order === 1) return Math.round(first / 2);
  return RULES.base.later;
}

export function speedBonus(secondsSinceLive) {
  if (!(secondsSinceLive >= 0)) return 0;
  for (const [limit, bonus] of RULES.speed) if (secondsSinceLive < limit) return bonus;
  return 0;
}

export const qualityBonus = q => RULES.quality[q] ?? 0;

export function comboBonus(streak) {
  if (streak < 2) return 0;
  return RULES.combo[Math.min(streak, 5)];
}

// Score one approved find. streakBefore = the player's streak before this find.
export function scoreFind({ order, gyanu, secondsSinceLive, quality, streakBefore }) {
  const streak = (streakBefore || 0) + 1;
  const parts = {
    base: basePoints(order, gyanu),
    speed: speedBonus(secondsSinceLive),
    quality: qualityBonus(quality),
    combo: comboBonus(streak)
  };
  return { total: parts.base + parts.speed + parts.quality + parts.combo, parts, streak };
}

export const qualityFromConfidence = c => (c >= RULES.clearAt ? 'clear' : c >= RULES.autoApprove ? 'partial' : 'unclear');
