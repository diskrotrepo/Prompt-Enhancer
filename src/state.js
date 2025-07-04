(function (global) {
  const state = {
    presets: {
      negative: {},
      positive: {},
      length: {},
      divider: {},
      base: {},
      lyrics: {}
    },
    shuffleFlags: {
      base: false,
      negative: false,
      positive: false,
      dividers: false
    },
    seed: null
  };

  function exportState() {
    return JSON.stringify(state, null, 2);
  }

  function importState(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.presets && typeof obj.presets === 'object') {
      Object.keys(state.presets).forEach(key => {
        state.presets[key] = { ...(obj.presets[key] || {}) };
      });
    }
    if (obj.shuffleFlags && typeof obj.shuffleFlags === 'object') {
      Object.keys(state.shuffleFlags).forEach(key => {
        state.shuffleFlags[key] = !!obj.shuffleFlags[key];
      });
    }
    if ('seed' in obj) state.seed = obj.seed;
  }

  const api = { state, exportState, importState };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.promptState = api;
  }
})(typeof window !== 'undefined' ? window : global);
