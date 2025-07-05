(function (global) {
  const utils =
    global.promptUtils ||
    (typeof require !== 'undefined' && require('./core/promptUtils'));
  const lists =
    global.listManager ||
    (typeof require !== 'undefined' && require('./ui/listManager'));
  const ui =
    global.uiControls ||
    (typeof require !== 'undefined' && require('./ui/uiControls'));
  const state =
    global.stateManager ||
    (typeof require !== 'undefined' && require('./ui/stateManager'));

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
