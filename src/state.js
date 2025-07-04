(function (global) {
  function collectState() {
    const get = id => document.getElementById(id);
    return {
      text: {
        base: get('base-input')?.value || '',
        positive: get('pos-input')?.value || '',
        negative: get('neg-input')?.value || '',
        dividers: get('divider-input')?.value || '',
        lyrics: get('lyrics-input')?.value || ''
      },
      presets: {
        base: get('base-select')?.value || '',
        positive: get('pos-select')?.value || '',
        negative: get('neg-select')?.value || '',
        divider: get('divider-select')?.value || '',
        length: get('length-select')?.value || '',
        lyrics: get('lyrics-select')?.value || ''
      },
      stack: {
        includePosForNeg: get('neg-include-pos')?.checked || false,
        posStack: get('pos-stack')?.checked || false,
        posStackSize: get('pos-stack-size')?.value || '1',
        negStack: get('neg-stack')?.checked || false,
        negStackSize: get('neg-stack-size')?.value || '1'
      },
      shuffleSettings: {
        base: get('base-shuffle')?.checked || false,
        positive: get('pos-shuffle')?.checked || false,
        negative: get('neg-shuffle')?.checked || false,
        divider: get('divider-shuffle')?.checked || false
      },
      length: {
        limit: get('length-input')?.value || ''
      },
      shuffleOrders: {},
      insertionPositions: []
    };
  }

  function applyState(state) {
    if (!state || typeof state !== 'object') return;
    const get = id => document.getElementById(id);
    if (state.text) {
      if (get('base-input')) get('base-input').value = state.text.base || '';
      if (get('pos-input')) get('pos-input').value = state.text.positive || '';
      if (get('neg-input')) get('neg-input').value = state.text.negative || '';
      if (get('divider-input')) get('divider-input').value = state.text.dividers || '';
      if (get('lyrics-input')) get('lyrics-input').value = state.text.lyrics || '';
    }
    if (state.presets) {
      if (get('base-select')) get('base-select').value = state.presets.base || '';
      if (get('pos-select')) get('pos-select').value = state.presets.positive || '';
      if (get('neg-select')) get('neg-select').value = state.presets.negative || '';
      if (get('divider-select')) get('divider-select').value = state.presets.divider || '';
      if (get('length-select')) get('length-select').value = state.presets.length || '';
      if (get('lyrics-select')) get('lyrics-select').value = state.presets.lyrics || '';
    }
    if (state.stack) {
      if (get('neg-include-pos')) get('neg-include-pos').checked = !!state.stack.includePosForNeg;
      if (get('pos-stack')) get('pos-stack').checked = !!state.stack.posStack;
      if (get('pos-stack-size')) get('pos-stack-size').value = state.stack.posStackSize || '1';
      if (get('neg-stack')) get('neg-stack').checked = !!state.stack.negStack;
      if (get('neg-stack-size')) get('neg-stack-size').value = state.stack.negStackSize || '1';
    }
    if (state.shuffleSettings) {
      if (get('base-shuffle')) get('base-shuffle').checked = !!state.shuffleSettings.base;
      if (get('pos-shuffle')) get('pos-shuffle').checked = !!state.shuffleSettings.positive;
      if (get('neg-shuffle')) get('neg-shuffle').checked = !!state.shuffleSettings.negative;
      if (get('divider-shuffle')) get('divider-shuffle').checked = !!state.shuffleSettings.divider;
    }
    if (state.length && get('length-input')) {
      get('length-input').value = state.length.limit || '';
    }
  }

  function exportState() {
    return JSON.stringify(collectState(), null, 2);
  }

  function importState(obj) {
    if (!obj) return;
    applyState(obj);
  }

  function loadStateFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        importState(data);
      } catch (err) {
        alert('Invalid state file');
      }
    };
    reader.readAsText(file);
  }

  function downloadState() {
    const blob = new Blob([exportState()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'state.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const api = {
    collectState,
    applyState,
    exportState,
    importState,
    loadStateFromFile,
    downloadState
  };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.stateManager = api;
  }
})(typeof window !== 'undefined' ? window : global);
