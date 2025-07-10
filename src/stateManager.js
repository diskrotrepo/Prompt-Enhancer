(function (global) {
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

  function getFieldIds() {
    if (typeof document === 'undefined') return [];
    return Array.from(
      document.querySelectorAll('input[id], textarea[id], select[id]')
    ).map(el => el.id);
  }

  function loadFromDOM() {
    const obj = {};
    getFieldIds().forEach(id => {
      const el = typeof document !== 'undefined' && document.getElementById(id);
      if (el) obj[id] = getVal(el);
    });
    Object.keys(State).forEach(k => delete State[k]);
    Object.assign(State, obj);
    return obj;
  }

  function applyToDOM(state) {
    if (!state) return;
    getFieldIds().forEach(id => {
      if (Object.prototype.hasOwnProperty.call(state, id)) {
        const el = typeof document !== 'undefined' && document.getElementById(id);
        setVal(el, state[id]);
      }
    });
    Object.keys(State).forEach(k => delete State[k]);
    Object.assign(State, state);
  }

  function exportState() {
    return JSON.stringify(State, null, 2);
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
