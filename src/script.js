(function (global) {
  const utils =
    global.promptUtils ||
    (typeof require !== 'undefined' && require('./utils/promptUtils'));
  const lists =
    global.listManager ||
    (typeof require !== 'undefined' && require('./managers/listManager'));
  const ui =
    global.uiControls ||
    (typeof require !== 'undefined' && require('./managers/uiControls'));
  const state =
    global.stateManager ||
    (typeof require !== 'undefined' && require('./managers/stateManager'));

  if (typeof document !== 'undefined' && !(typeof window !== 'undefined' && window.__TEST__)) {
    const init = ui.initializeUI;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  if (typeof module !== 'undefined') {
    module.exports = { ...utils, ...lists, ...ui, ...state };
  }
})(typeof window !== 'undefined' ? window : global);
