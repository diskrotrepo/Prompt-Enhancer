(function (global) {
  const utils = global.promptUtils || (typeof require !== 'undefined' && require('./lib/promptUtils'));
  const lists = global.listManager || (typeof require !== 'undefined' && require('./listManager'));
  const ui = global.uiControls || (typeof require !== 'undefined' && require('./uiControls'));
  const state = global.stateManager || (typeof require !== 'undefined' && require('./stateManager'));

  if (typeof document !== 'undefined' && !(typeof window !== 'undefined' && window.__TEST__)) {
    const start = () => lists.loadPresets().then(ui.initializeUI);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }

  if (typeof module !== 'undefined') {
    module.exports = { ...utils, ...lists, ...ui, ...state };
  }
})(typeof window !== 'undefined' ? window : global);
