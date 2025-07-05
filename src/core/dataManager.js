(function (global) {
  function exportData(stateObj, listsObj) {
    const data = { state: stateObj || {}, lists: listsObj || {} };
    return JSON.stringify(data, null, 2);
  }

  function importData(input) {
    if (!input) return null;
    let obj = input;
    if (typeof input === 'string') {
      try {
        obj = JSON.parse(input);
      } catch (err) {
        return null;
      }
    }
    if (!obj || typeof obj !== 'object') return null;
    if (!obj.lists || !Array.isArray(obj.lists.presets)) return null;
    return { state: obj.state || {}, lists: obj.lists };
  }

  const api = { exportData, importData };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.dataManager = api;
  }
})(typeof window !== 'undefined' ? window : global);
