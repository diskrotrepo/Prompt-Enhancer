(function (global) {
  function exportState(state) {
    return JSON.stringify(state, null, 2);
  }

  const api = { exportState };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.stateUtils = api;
  }
})(typeof window !== 'undefined' ? window : global);
