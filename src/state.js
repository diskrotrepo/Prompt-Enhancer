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
    shuffleFlags: {},
    seed: null
  };

  function exportState() {
    return JSON.stringify(state, null, 2);
  }

  function importState(obj) {
    const data = typeof obj === 'string' ? JSON.parse(obj) : obj;
    if (!data || typeof data !== 'object') return;
    if (data.presets && typeof data.presets === 'object') {
      state.presets = {
        negative: data.presets.negative || {},
        positive: data.presets.positive || {},
        length: data.presets.length || {},
        divider: data.presets.divider || {},
        base: data.presets.base || {},
        lyrics: data.presets.lyrics || {}
      };
    }
    state.shuffleFlags = data.shuffleFlags || {};
    state.seed = data.seed !== undefined ? data.seed : null;
  }

  const api = { state, exportState, importState };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.state = state;
    global.stateUtils = api;
  }
})(typeof window !== 'undefined' ? window : global);
