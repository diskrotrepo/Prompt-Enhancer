(function (global) {
  const state = {
    NEG_PRESETS: {},
    POS_PRESETS: {},
    LENGTH_PRESETS: {},
    DIVIDER_PRESETS: {},
    BASE_PRESETS: {},
    LYRICS_PRESETS: {},
    shuffleBase: false,
    shufflePos: false,
    shuffleNeg: false,
    seed: null
  };

  function exportState() {
    return JSON.stringify(state, null, 2);
  }

  function importState(obj) {
    if (!obj) return;
    if (typeof obj === 'string') {
      try {
        obj = JSON.parse(obj);
      } catch (err) {
        return;
      }
    }
    if (typeof obj !== 'object') return;
    Object.keys(state).forEach(key => {
      if (obj[key] !== undefined) {
        if (state[key] && typeof state[key] === 'object') {
          state[key] = JSON.parse(JSON.stringify(obj[key]));
        } else {
          state[key] = obj[key];
        }
      }
    });
  }

  const api = { state, exportState, importState };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.appState = api;
  }
})(typeof window !== 'undefined' ? window : global);
