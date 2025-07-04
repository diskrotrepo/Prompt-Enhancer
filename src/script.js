(function(){
  let utils, lists, ui;
  if (typeof module !== 'undefined' && module.exports) {
    utils = require('./promptUtils');
    lists = require('./listManager');
    ui = require('./uiControls');
    module.exports = Object.assign({}, utils, lists, ui);
  } else {
    utils = window.promptUtils;
    lists = window.listManager;
    ui = window.uiControls;
    if (typeof document !== 'undefined' && !(typeof window !== 'undefined' && window.__TEST__)) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ui.initializeUI);
      } else {
        ui.initializeUI();
      }
    }
  }
})();
