(function (global) {
  const lists = global.listManager || (typeof require !== 'undefined' && require('./listManager'));
  const state = global.stateManager || (typeof require !== 'undefined' && require('./stateManager'));

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
  }

  const api = { exportData, importData };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.storageManager = api;
  }
})(typeof window !== 'undefined' ? window : global);
