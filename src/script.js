(function (global) {
  const utils = global.promptUtils || (typeof require !== 'undefined' && require('./promptUtils'));
  const lists = global.listManager || (typeof require !== 'undefined' && require('./listManager'));
  const ui = global.uiControls || (typeof require !== 'undefined' && require('./uiControls'));
  const stateModule = global.promptState || (typeof require !== 'undefined' && require('./state'));

  if (typeof document !== 'undefined' && !(typeof window !== 'undefined' && window.__TEST__)) {
    const init = ui.initializeUI;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  if (typeof module !== 'undefined') {
    module.exports = { ...utils, ...lists, ...ui, ...stateModule };
  }
})(typeof window !== 'undefined' ? window : global);
