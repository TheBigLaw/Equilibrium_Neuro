// WAIS-III norms helpers (BR - Estudos Normativos 2020)
export function rawToScaled(rawNorms, ageGroup, subtest, rawScore) {
  const age = rawNorms.raw_to_scaled?.[ageGroup];
  if (!age) return null;
  const rows = age[subtest];
  if (!rows) return null;

  for (const row of rows) {
    if (row.rawMin == null || row.rawMax == null) continue; // "—"
    if (rawScore >= row.rawMin && rawScore <= row.rawMax) return row.scaled;
  }
  return null;
}

export function sumToComposite(compNorms, scaleType, sumScaled) {
  const list = compNorms.sum_to_composite || [];
  for (const row of list) {
    if (row.scale_type === scaleType && sumScaled >= row.sum_min && sumScaled <= row.sum_max) {
      return {
        composite: row.composite_score,
        percentile: row.percentile,
        ci90: [row.ci_90_min, row.ci_90_max],
        ci95: [row.ci_95_min, row.ci_95_max]
      };
    }
  }
  return null;
}
