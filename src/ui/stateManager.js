(function (global) {
  const coreState =
    global.stateUtils || (typeof require !== 'undefined' && require('../core/state'));
  const State = {};

  function getVal(el) {
    if (!el) return undefined;
    if (el.type === 'checkbox') return el.checked;
    return el.value;
  }

  function setVal(el, val) {
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = !!val;
    } else {
      el.value = val != null ? val : '';
    }
    el.dispatchEvent(new Event('change'));
  }

  const FIELD_IDS = [
    'base-input',
    'base-select',
    'base-shuffle',
    'pos-input',
    'pos-select',
    'pos-shuffle',
    'pos-stack',
    'pos-stack-size',
    'neg-input',
    'neg-select',
    'neg-shuffle',
    'neg-stack',
    'neg-stack-size',
    'neg-include-pos',
    'divider-input',
    'divider-select',
    'divider-shuffle',
    'length-input',
    'length-select',
    'lyrics-input',
    'lyrics-select',
    'lyrics-space',
    'lyrics-remove-parens',
    'lyrics-remove-brackets',
    'pos-depth-input',
    'pos-depth-select',
    'neg-depth-input',
    'neg-depth-select',
    'base-order-input',
    'base-order-select',
    'pos-order-input',
    'pos-order-select',
    'neg-order-input',
    'neg-order-select',
    'divider-order-input',
    'divider-order-select'
  ];

  function loadFromDOM() {
    const obj = {};
    FIELD_IDS.forEach(id => {
      const el = typeof document !== 'undefined' && document.getElementById(id);
      if (el) obj[id] = getVal(el);
    });
    Object.keys(State).forEach(k => delete State[k]);
    Object.assign(State, obj);
    return obj;
  }

  function applyToDOM(state) {
    if (!state) return;
    FIELD_IDS.forEach(id => {
      if (Object.prototype.hasOwnProperty.call(state, id)) {
        const el = typeof document !== 'undefined' && document.getElementById(id);
        setVal(el, state[id]);
      }
    });
    Object.keys(State).forEach(k => delete State[k]);
    Object.assign(State, state);
  }

  function exportState() {
    return coreState.exportState(State);
  }

  function importState(obj) {
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
    applyToDOM(data);
  }

  const api = { State, loadFromDOM, applyToDOM, exportState, importState };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.stateManager = api;
  }
})(typeof window !== 'undefined' ? window : global);
