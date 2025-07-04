(function (global) {

  function getState() {
    if (typeof document === 'undefined') return {};
    const val = id => {
      const el = document.getElementById(id);
      return el ? el.value : '';
    };
    const checked = id => {
      const el = document.getElementById(id);
      return el ? !!el.checked : false;
    };
    return {
      text: {
        base: val('base-input'),
        positive: val('pos-input'),
        negative: val('neg-input'),
        dividers: val('divider-input'),
        lyrics: val('lyrics-input')
      },
      presets: {
        base: val('base-select'),
        positive: val('pos-select'),
        negative: val('neg-select'),
        divider: val('divider-select'),
        length: val('length-select'),
        lyrics: val('lyrics-select')
      },
      stack: {
        posOn: checked('pos-stack'),
        posSize: val('pos-stack-size') || '1',
        negOn: checked('neg-stack'),
        negSize: val('neg-stack-size') || '1'
      },
      shuffle: {
        base: checked('base-shuffle'),
        positive: checked('pos-shuffle'),
        negative: checked('neg-shuffle'),
        dividers: checked('divider-shuffle')
      },
      includePosForNeg: checked('neg-include-pos'),
      limit: val('length-input'),
      lyricsOptions: {
        removeParens: checked('lyrics-remove-parens'),
        removeBrackets: checked('lyrics-remove-brackets'),
        space: val('lyrics-space')
      },
      shuffleOrders: {},
      insertPositions: []
    };
  }

  function applyState(state) {
    if (typeof document === 'undefined' || !state) return;
    const setValue = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    const setChecked = (id, v) => {
      const el = document.getElementById(id);
      if (el) {
        el.checked = !!v;
        el.dispatchEvent(new Event('change'));
      }
    };
    setValue('base-input', state.text && state.text.base);
    setValue('pos-input', state.text && state.text.positive);
    setValue('neg-input', state.text && state.text.negative);
    setValue('divider-input', state.text && state.text.dividers);
    setValue('lyrics-input', state.text && state.text.lyrics);

    setValue('base-select', state.presets && state.presets.base);
    setValue('pos-select', state.presets && state.presets.positive);
    setValue('neg-select', state.presets && state.presets.negative);
    setValue('divider-select', state.presets && state.presets.divider);
    setValue('length-select', state.presets && state.presets.length);
    setValue('lyrics-select', state.presets && state.presets.lyrics);

    setChecked('pos-stack', state.stack && state.stack.posOn);
    setValue('pos-stack-size', state.stack && state.stack.posSize);
    setChecked('neg-stack', state.stack && state.stack.negOn);
    setValue('neg-stack-size', state.stack && state.stack.negSize);

    setChecked('base-shuffle', state.shuffle && state.shuffle.base);
    setChecked('pos-shuffle', state.shuffle && state.shuffle.positive);
    setChecked('neg-shuffle', state.shuffle && state.shuffle.negative);
    setChecked('divider-shuffle', state.shuffle && state.shuffle.dividers);

    setChecked('neg-include-pos', state.includePosForNeg);

    setValue('length-input', state.limit);

    if (state.lyricsOptions) {
      setChecked('lyrics-remove-parens', state.lyricsOptions.removeParens);
      setChecked('lyrics-remove-brackets', state.lyricsOptions.removeBrackets);
      setValue('lyrics-space', state.lyricsOptions.space);
    }
  }

  function exportState() {
    return JSON.stringify(getState(), null, 2);
  }

  function importState(obj) {
    if (!obj) return;
    if (typeof obj === 'string') {
      try {
        obj = JSON.parse(obj);
      } catch (err) {
        return;
      }
    }
    applyState(obj);
  }

  function saveState() {
    if (typeof document === 'undefined') return;
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

  function loadState(file) {
    if (typeof FileReader === 'undefined') return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importState(JSON.parse(reader.result));
      } catch (err) {
        alert('Invalid state file');
      }
    };
    reader.readAsText(file);
  }

  const api = { getState, applyState, exportState, importState, saveState, loadState };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.stateManager = api;
  }
})(typeof window !== 'undefined' ? window : global);
