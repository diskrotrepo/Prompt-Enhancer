(function (global) {
  const lists = global.listManager || (typeof require !== 'undefined' && require('./listManager'));
  const state = global.stateManager || (typeof require !== 'undefined' && require('./stateManager'));

  const KEY = 'promptEnhancerData';

  function saveLocal(data) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      /* ignore */
    }
  }

  function loadLocal() {
    if (typeof localStorage === 'undefined') return null;
    try {
      const json = localStorage.getItem(KEY);
      return json ? JSON.parse(json) : null;
    } catch (err) {
      return null;
    }
  }

  function exportData() {
    const listData = JSON.parse(lists.exportLists());
    state.loadFromDOM();
    const stateData = JSON.parse(state.exportState());
    return JSON.stringify({ lists: listData, state: stateData }, null, 2);
  }

  function importData(obj) {
    if (!obj) return;
    let data = obj;
    if (typeof obj === 'string') {
      try {
        data = JSON.parse(obj);
      } catch (err) {
        return;
      }
    }
    if (typeof data !== 'object') return;
    if (data.lists) lists.importLists(data.lists);
    if (data.state) state.importState(data.state);
    saveLocal(data);
  }

  function persist() {
    const json = exportData();
    saveLocal(JSON.parse(json));
  }

  function loadPersisted() {
    const stored = loadLocal();
    if (stored) {
      importData(stored);
      return;
    }
    if (typeof DEFAULT_DATA !== 'undefined') {
      importData(DEFAULT_DATA);
    }
  }

  function reset() {
    if (typeof DEFAULT_DATA !== 'undefined') {
      importData(DEFAULT_DATA);
    }
  }

  const api = { exportData, importData, persist, loadPersisted, reset };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.storageManager = api;
  }
})(typeof window !== 'undefined' ? window : global);
