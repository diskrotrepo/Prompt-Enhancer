import utils from './lib/promptUtils.js';
import lists from './listManager.js';
import ui from './uiControls.js';
import state from './stateManager.js';

if (typeof document !== 'undefined' && !(typeof window !== 'undefined' && window.__TEST__)) {
  const init = ui.initializeUI;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

export default { ...utils, ...lists, ...ui, ...state };
