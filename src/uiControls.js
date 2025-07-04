(function (global) {
  const utils = global.promptUtils || (typeof require !== 'undefined' && require('./promptUtils'));
  const lists = global.listManager || (typeof require !== 'undefined' && require('./listManager'));

  function applyPreset(selectEl, inputEl, presetsOrType) {
    let presets = presetsOrType;
    if (typeof presetsOrType === 'string') {
      if (presetsOrType === 'negative') {
        presets = lists.NEG_PRESETS;
      } else if (presetsOrType === 'positive') {
        presets = lists.POS_PRESETS;
      } else if (presetsOrType === 'length') {
        presets = lists.LENGTH_PRESETS;
      } else if (presetsOrType === 'divider') {
        presets = lists.DIVIDER_PRESETS;
      } else if (presetsOrType === 'base') {
        presets = lists.BASE_PRESETS;
      } else if (presetsOrType === 'lyrics') {
        presets = lists.LYRICS_PRESETS;
      } else {
        presets = {};
      }
    }
    const key = selectEl.value;
    const list = presets[key] || [];
    if (inputEl.tagName === 'TEXTAREA') {
      const sep = presetsOrType === 'divider' || presets === lists.DIVIDER_PRESETS ? '\n' : ', ';
      inputEl.value = list.join(sep);
    } else {
      inputEl.value = list[0] || '';
    }
    inputEl.disabled = false;
  }

  function setupPresetListener(selectId, inputId, type) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    if (!select || !input) return;
    select.addEventListener('change', () => applyPreset(select, input, type));
  }

  function collectInputs() {
    const baseItems = utils.parseInput(document.getElementById('base-input').value, true);
    const negMods = utils.parseInput(document.getElementById('neg-input').value);
    const posMods = utils.parseInput(document.getElementById('pos-input').value);
    const shuffleBase = false;
    const shufflePos = false;
    const posStackOn = document.getElementById('pos-stack').checked;
    const posStackSize = parseInt(document.getElementById('pos-stack-size')?.value || '1', 10);
    const includePosForNeg = document.getElementById('neg-include-pos').checked;
    const shuffleNeg = false;
    const negStackOn = document.getElementById('neg-stack').checked;
    const negStackSize = parseInt(document.getElementById('neg-stack-size')?.value || '1', 10);
    const dividerMods = utils.parseDividerInput(document.getElementById('divider-input')?.value || '');
    const shuffleDividers = false;
    const lengthSelect = document.getElementById('length-select');
    const lengthInput = document.getElementById('length-input');
    let limit = parseInt(lengthInput.value, 10);
    if (isNaN(limit) || limit <= 0) {
      const preset = lists.LENGTH_PRESETS[lengthSelect.value];
      limit = preset ? parseInt(preset[0], 10) : 1000;
      lengthInput.value = limit;
    }
    const insertDepths = utils.parseOrderInput(document.getElementById('insert-input')?.value || '');
    const baseOrder = utils.parseOrderInput(document.getElementById('base-order-input')?.value || '');
    const posOrder = utils.parseOrderInput(document.getElementById('pos-order-input')?.value || '');
    const negOrder = utils.parseOrderInput(document.getElementById('neg-order-input')?.value || '');
    return {
      baseItems,
      negMods,
      posMods,
      shuffleBase,
      shuffleNeg,
      shufflePos,
      posStackOn,
      posStackSize,
      negStackOn,
      negStackSize,
      limit,
      includePosForNeg,
      dividerMods,
      shuffleDividers,
      insertDepths,
      baseOrder,
      posOrder,
      negOrder
    };
  }

  function displayOutput(result) {
    document.getElementById('positive-output').textContent = result.positive;
    document.getElementById('negative-output').textContent = result.negative;
  }

  function generate() {
    const {
      baseItems,
      negMods,
      posMods,
      shuffleBase,
      shuffleNeg,
      shufflePos,
      posStackOn,
      posStackSize,
      negStackOn,
      negStackSize,
      limit,
      includePosForNeg,
      dividerMods,
      shuffleDividers,
      insertDepths,
      baseOrder,
      posOrder,
      negOrder
    } = collectInputs();
    if (!baseItems.length) {
      alert('Please enter at least one base prompt item.');
      return;
    }
    const dividers = dividerMods.length ? dividerMods : [];
    const result = utils.buildVersions(
      baseItems,
      negMods,
      posMods,
      shuffleBase,
      negStackOn ? true : shuffleNeg,
      posStackOn ? true : shufflePos,
      limit,
      includePosForNeg,
      dividers,
      shuffleDividers,
      posStackOn ? posStackSize : 1,
      negStackOn ? negStackSize : 1,
      insertDepths,
      baseOrder,
      posOrder,
      negOrder
    );
    displayOutput(result);

    const lyricsInput = document.getElementById('lyrics-input');
    if (lyricsInput && lyricsInput.value.trim()) {
      const spaceSel = document.getElementById('lyrics-space');
      const maxSpaces = spaceSel ? spaceSel.value : 1;
      const removeParens = document.getElementById('lyrics-remove-parens')?.checked;
      const removeBrackets = document.getElementById('lyrics-remove-brackets')?.checked;
      const processed = utils.processLyrics(
        lyricsInput.value,
        maxSpaces,
        removeParens,
        removeBrackets
      );
      document.getElementById('lyrics-output').textContent = processed;
    } else {
      const out = document.getElementById('lyrics-output');
      if (out) out.textContent = '';
    }
  }

  function updateButtonState(btn, checkbox) {
    btn.classList.toggle('active', checkbox.checked);
    if (btn.dataset.on && btn.dataset.off) {
      btn.textContent = checkbox.checked ? btn.dataset.on : btn.dataset.off;
    }
  }

  function setupToggleButtons() {
    document.querySelectorAll('.toggle-button').forEach(btn => {
      const target = btn.dataset.target;
      const checkbox = document.getElementById(target);
      if (!checkbox) return;
      updateButtonState(btn, checkbox);
      btn.addEventListener('click', () => {
        checkbox.checked = !checkbox.checked;
        updateButtonState(btn, checkbox);
        checkbox.dispatchEvent(new Event('change'));
      });
    });
  }



  function setupStackControls() {
    const configs = [
      { stack: 'pos-stack', size: 'pos-stack-size' },
      { stack: 'neg-stack', size: 'neg-stack-size' }
    ];
    configs.forEach(cfg => {
      const stackCb = document.getElementById(cfg.stack);
      const sizeEl = document.getElementById(cfg.size);
      if (!stackCb || !sizeEl) return;
      const update = () => {
        if (stackCb.checked) {
          sizeEl.style.display = '';
        } else {
          sizeEl.style.display = 'none';
        }
      };
      stackCb.addEventListener('change', update);
      update();
    });
  }

  function setupHideToggles() {
    const hideCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"][data-targets]'));
    hideCheckboxes.forEach(cb => {
      const ids = cb.dataset.targets.split(',').map(id => id.trim());
      const elems = ids.map(id => document.getElementById(id)).filter(Boolean);
      const update = () => {
        elems.forEach(el => {
          el.style.display = cb.checked ? 'none' : '';
        });
        const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
        if (btn) {
          updateButtonState(btn, cb);
          const col = btn.parentElement;
          if (col && col.classList.contains('button-col')) {
            const row = col.parentElement;
            if (row && row.classList.contains('input-row')) {
              row.style.justifyContent = cb.checked ? 'flex-end' : '';
            }
          }
        }
      };
      cb.addEventListener('change', update);
      update();
    });
    return hideCheckboxes;
  }

  function setupCopyButtons() {
    document.querySelectorAll('.copy-button').forEach(btn => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      if (!btn.dataset.orig) {
        btn.dataset.orig = btn.innerHTML;
      }
      btn.addEventListener('click', async () => {
        try {
          const text = target.value !== undefined ? target.value : target.textContent;
          await navigator.clipboard.writeText(text);
          btn.innerHTML = '&#10003;';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.innerHTML = btn.dataset.orig;
            btn.classList.remove('copied');
          }, 800);
        } catch (err) {
          console.error('Copy failed', err);
        }
      });
    });
  }

  function buildOrderList(len, mode) {
    const arr = Array.from({ length: len }, (_, i) => i);
    if (mode === 'random') utils.shuffle(arr);
    return arr.join(', ');
  }

  function setupOrderInput(listId, selectId, orderId) {
    const listInput = document.getElementById(listId);
    const select = document.getElementById(selectId);
    const orderInput = document.getElementById(orderId);
    if (!select || !orderInput) return;
    function update() {
      const mode = select.value;
      let len = 0;
      if (listInput) len = utils.parseInput(listInput.value, true).length;
      if (mode === 'canonical' || mode === 'random') {
        orderInput.value = buildOrderList(len, mode);
      } else {
        const preset = lists.ORDER_PRESETS[mode];
        orderInput.value = preset ? preset.join(', ') : '';
      }
    }
    select.addEventListener('change', update);
    if (listInput) listInput.addEventListener('change', update);
    update();
  }

  function setupDepthControls() {
    const select = document.getElementById('insert-select');
    const input = document.getElementById('insert-input');
    const baseInput = document.getElementById('base-input');
    if (!select || !input) return;
    function countWords(str) {
      const cleaned = str.trim().replace(/[,.!:;?]$/, '');
      if (!cleaned) return 0;
      return cleaned.split(/\s+/).length;
    }
    function update() {
      const mode = select.value;
      const bases = utils.parseInput(baseInput.value, true);
      if (!bases.length) {
        input.value = mode === 'prepend' ? '0' : '';
        return;
      }
      const counts = bases.map(b => countWords(b));
      if (mode === 'prepend') {
        input.value = '0';
      } else if (mode === 'append') {
        input.value = counts.join(', ');
      } else if (mode === 'random') {
        const vals = counts.map(c => Math.floor(Math.random() * (c + 1)));
        input.value = vals.join(', ');
      } else {
        const preset = lists.ORDER_PRESETS[mode];
        input.value = preset ? preset.join(', ') : '';
      }
    }
    select.addEventListener('change', update);
    if (baseInput) baseInput.addEventListener('change', update);
    update();
  }

  function setupStateButtons() {
    const saveBtn = document.getElementById('save-state');
    const loadBtn = document.getElementById('load-state');
    const fileInput = document.getElementById('state-file');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        state.loadFromDOM();
        const blob = new Blob([state.exportState()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'state.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }
    if (loadBtn && fileInput) {
      loadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            state.importState(data);
          } catch (err) {
            alert('Invalid state file');
          }
        };
        reader.readAsText(f);
        fileInput.value = '';
      });
    }
  }

  function initializeUI() {
    lists.loadLists();
    applyPreset(document.getElementById('neg-select'), document.getElementById('neg-input'), 'negative');
    applyPreset(document.getElementById('pos-select'), document.getElementById('pos-input'), 'positive');
    applyPreset(document.getElementById('length-select'), document.getElementById('length-input'), 'length');
    applyPreset(document.getElementById('divider-select'), document.getElementById('divider-input'), 'divider');
    applyPreset(document.getElementById('base-select'), document.getElementById('base-input'), 'base');
    applyPreset(document.getElementById('lyrics-select'), document.getElementById('lyrics-input'), 'lyrics');

    setupPresetListener('neg-select', 'neg-input', 'negative');
    setupPresetListener('pos-select', 'pos-input', 'positive');
    setupPresetListener('length-select', 'length-input', 'length');
    setupPresetListener('divider-select', 'divider-input', 'divider');
    setupPresetListener('base-select', 'base-input', 'base');
    setupPresetListener('lyrics-select', 'lyrics-input', 'lyrics');
    document.getElementById('generate').addEventListener('click', generate);

    setupToggleButtons();
    setupStackControls();
    const hideCheckboxes = setupHideToggles();

    const allHide = document.getElementById('all-hide');
    if (allHide) {
      allHide.addEventListener('change', () => {
        hideCheckboxes.forEach(cb => {
          cb.checked = allHide.checked;
          const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
          if (btn) updateButtonState(btn, cb);
          cb.dispatchEvent(new Event('change'));
        });
        const allHideBtn = document.querySelector('.toggle-button[data-target="all-hide"]');
        if (allHideBtn) updateButtonState(allHideBtn, allHide);
      });
    }

    setupCopyButtons();
    setupOrderInput('base-input', 'base-order-select', 'base-order-input');
    setupOrderInput('pos-input', 'pos-order-select', 'pos-order-input');
    setupOrderInput('neg-input', 'neg-order-select', 'neg-order-input');
    setupDepthControls();
    setupStateButtons();

    const loadBtn = document.getElementById('load-lists');
    const additiveBtn = document.getElementById('additive-load');
    const fileInput = document.getElementById('lists-file');
    if (loadBtn && fileInput) {
      loadBtn.addEventListener('click', () => {
        fileInput.dataset.additive = 'false';
        fileInput.click();
      });
    }
    if (additiveBtn && fileInput) {
      additiveBtn.addEventListener('click', () => {
        fileInput.dataset.additive = 'true';
        fileInput.click();
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (f) lists.loadListsFromFile(f, fileInput.dataset.additive === 'true');
        fileInput.value = '';
      });
    }
    const dlBtn = document.getElementById('download-lists');
    if (dlBtn) dlBtn.addEventListener('click', lists.downloadLists);
    const baseSave = document.getElementById('base-save');
    if (baseSave) baseSave.addEventListener('click', () => lists.saveList('base'));
    const posSave = document.getElementById('pos-save');
    if (posSave) posSave.addEventListener('click', () => lists.saveList('positive'));
    const negSave = document.getElementById('neg-save');
    if (negSave) negSave.addEventListener('click', () => lists.saveList('negative'));
    const lenSave = document.getElementById('length-save');
    if (lenSave) lenSave.addEventListener('click', () => lists.saveList('length'));
    const divSave = document.getElementById('divider-save');
    if (divSave) divSave.addEventListener('click', () => lists.saveList('divider'));
    const lyricsSave = document.getElementById('lyrics-save');
    if (lyricsSave) lyricsSave.addEventListener('click', () => lists.saveList('lyrics'));
    const insertSave = document.getElementById('insert-save');
    if (insertSave) insertSave.addEventListener('click', () => lists.saveList('order'));
    const baseOrderSave = document.getElementById('base-order-save');
    if (baseOrderSave) baseOrderSave.addEventListener('click', () => lists.saveList('base-order'));
    const posOrderSave = document.getElementById('pos-order-save');
    if (posOrderSave) posOrderSave.addEventListener('click', () => lists.saveList('pos-order'));
    const negOrderSave = document.getElementById('neg-order-save');
    if (negOrderSave) negOrderSave.addEventListener('click', () => lists.saveList('neg-order'));
  }

  const api = {
    applyPreset,
    setupPresetListener,
    collectInputs,
    displayOutput,
    generate,
    updateButtonState,
    setupToggleButtons,
    setupStackControls,
    setupHideToggles,
    setupCopyButtons,
    setupOrderInput,
    setupDepthControls,
    setupStateButtons,
    initializeUI
  };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.uiControls = api;
  }
})(typeof window !== 'undefined' ? window : global);
