/**
 * Combined lists for easy save/load. Uses existing presets if defined.
 */
const ALL_LISTS = {
  negative: typeof NEGATIVE_LISTS !== 'undefined' ? NEGATIVE_LISTS : { presets: [] },
  positive: typeof POSITIVE_LISTS !== 'undefined' ? POSITIVE_LISTS : { presets: [] },
  length: typeof LENGTH_LISTS !== 'undefined' ? LENGTH_LISTS : { presets: [] }
};
