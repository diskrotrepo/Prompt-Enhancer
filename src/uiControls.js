(function (global) {
  const utils =
    global.promptUtils || (typeof require !== 'undefined' && require('./promptUtils'));
  const lists =
    global.listManager || (typeof require !== 'undefined' && require('./listManager'));
  const state =
    global.stateManager || (typeof require !== 'undefined' && require('./stateManager'));

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
    const shuffleBase = document.getElementById('base-shuffle').checked;
    const shufflePos = document.getElementById('pos-shuffle').checked;
    const posStackOn = document.getElementById('pos-stack').checked;
    const posStackSize = parseInt(document.getElementById('pos-stack-size')?.value || '1', 10);
    const includePosForNeg = document.getElementById('neg-include-pos').checked;
    const shuffleNeg = document.getElementById('neg-shuffle').checked;
    const negStackOn = document.getElementById('neg-stack').checked;
    const negStackSize = parseInt(document.getElementById('neg-stack-size')?.value || '1', 10);
    const dividerMods = utils.parseDividerInput(document.getElementById('divider-input')?.value || '');
    const shuffleDividers = document.getElementById('divider-shuffle')?.checked;
    const lengthSelect = document.getElementById('length-select');
    const lengthInput = document.getElementById('length-input');
    let limit = parseInt(lengthInput.value, 10);
    if (isNaN(limit) || limit <= 0) {
      const preset = lists.LENGTH_PRESETS[lengthSelect.value];
      limit = preset ? parseInt(preset[0], 10) : 1000;
      lengthInput.value = limit;
    }
    const insertDepths = utils.parseOrderInput(document.getElementById('base-depth-input')?.value || '');
    const baseOrder = utils.parseOrderInput(document.getElementById('base-order-input')?.value || '');
    function collectOrders(prefix, count) {
      const result = [];
      for (let i = 1; i <= count; i++) {
        const id = `${prefix}-order-input${i === 1 ? '' : '-' + i}`;
        const el = document.getElementById(id);
        result.push(utils.parseOrderInput(el?.value || ''));
      }
      return result;
    }

    const posOrder = collectOrders('pos', posStackOn ? posStackSize : 1);
    const negOrder = collectOrders('neg', negStackOn ? negStackSize : 1);
    const dividerOrder = utils.parseOrderInput(document.getElementById('divider-order-input')?.value || '');
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
      dividerOrder,
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
    rerollRandomOrders();
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
      dividerOrder,
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
      limit,
      includePosForNeg,
      dividers,
      shuffleDividers,
      posStackOn ? posStackSize : 1,
      negStackOn ? negStackSize : 1,
      insertDepths,
      baseOrder,
      posOrder,
      negOrder,
      dividerOrder
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

  function setupShuffleAll() {
    const allRandom = document.getElementById('all-random');
    if (!allRandom) return;
    const selects = [
      document.getElementById('base-order-select'),
      document.getElementById('pos-order-select'),
      document.getElementById('neg-order-select'),
      document.getElementById('divider-order-select')
    ].filter(Boolean);
    const updateAll = () => {
      selects.forEach(sel => {
        sel.value = allRandom.checked ? 'random' : 'canonical';
        sel.dispatchEvent(new Event('change'));
      });
      const btn = document.querySelector('.toggle-button[data-target="all-random"]');
      if (btn) updateButtonState(btn, allRandom);
    };
    allRandom.addEventListener('change', updateAll);
    updateAll();
  }

  function setupStackControls() {
    const configs = [
      { prefix: 'pos', stack: 'pos-stack', size: 'pos-stack-size', shuffle: 'pos-shuffle' },
      { prefix: 'neg', stack: 'neg-stack', size: 'neg-stack-size', shuffle: 'neg-shuffle' }
    ];
    configs.forEach(cfg => {
      const stackCb = document.getElementById(cfg.stack);
      const sizeEl = document.getElementById(cfg.size);
      const shuffleCb = document.getElementById(cfg.shuffle);
      const shuffleBtn = document.querySelector(`.toggle-button[data-target="${cfg.shuffle}"]`);
      if (!stackCb || !sizeEl || !shuffleCb) return;
      let prev = shuffleCb.checked;
      const update = () => {
        if (stackCb.checked) {
          prev = shuffleCb.checked;
          shuffleCb.checked = true;
          if (shuffleBtn) {
            shuffleBtn.classList.add('disabled');
            shuffleBtn.setAttribute('disabled', 'true');
            updateButtonState(shuffleBtn, shuffleCb);
          }
          sizeEl.style.display = '';
        } else {
          if (shuffleBtn) {
            shuffleBtn.classList.remove('disabled');
            shuffleBtn.removeAttribute('disabled');
            updateButtonState(shuffleBtn, shuffleCb);
          }
          shuffleCb.checked = prev;
          sizeEl.style.display = 'none';
        }
        const count = stackCb.checked ? parseInt(sizeEl.value, 10) || 1 : 1;
        updateOrderContainers(cfg.prefix, count);
      };
      stackCb.addEventListener('change', update);
      sizeEl.addEventListener('change', update);
      update();
    });
  }

  const rerollUpdaters = {};

  function setupAdvancedToggle() {
    const cb = document.getElementById('advanced-mode');
    if (!cb) return;
    const selectIds = [
      'base-order-select',
      'pos-order-select',
      'neg-order-select',
      'divider-order-select',
      'base-depth-select',
      'pos-depth-select',
      'neg-depth-select',
      'divider-depth-select'
    ];
    const textIds = [
      'base-order-input',
      'divider-order-input',
      'base-depth-input',
      'pos-depth-input',
      'neg-depth-input',
      'divider-depth-input'
    ];
    const containerIds = ['pos-order-container', 'neg-order-container'];
    const rerollIds = [
      'base-reroll',
      'pos-reroll',
      'neg-reroll',
      'divider-reroll'
    ];
    const setDisplay = (el, show) => {
      if (!el) return;
      el.style.display = show ? '' : 'none';
    };
    const update = () => {
      const adv = cb.checked;
      selectIds.forEach(id => setDisplay(document.getElementById(id), adv));
      textIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentElement && el.parentElement.classList.contains('input-row')) {
          setDisplay(el.parentElement, adv);
        }
      });
      containerIds.forEach(id => setDisplay(document.getElementById(id), adv));
      rerollIds.forEach(id => setDisplay(document.getElementById(id), !adv));
      Object.values(rerollUpdaters).forEach(fn => fn());
    };
    cb.addEventListener('change', update);
    update();
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

  function populateOrderOptions(select) {
    if (!select) return;
    select.innerHTML = '';
    const opts = [
      { id: 'canonical', title: 'Canonical' },
      { id: 'random', title: 'Randomized' }
    ];
    Object.keys(lists.ORDER_PRESETS).forEach(id => {
      opts.push({ id, title: lists.ORDER_PRESETS[id].title || id });
    });
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.title;
      select.appendChild(opt);
    });
  }

  function updateOrderContainers(prefix, count) {
    const container = document.getElementById(`${prefix}-order-container`);
    const baseId = `${prefix}-order`;
    const getItems = () =>
      utils.parseInput(document.getElementById(`${prefix}-input`).value);
    const adv = document.getElementById('advanced-mode');
    const baseSel = document.getElementById(`${baseId}-select`);
    const defaultVal =
      !adv || !adv.checked ? baseSel?.value || 'canonical' : undefined;
    if (!container) return;
    const current = container.querySelectorAll(`select[id^="${baseId}-select"]`).length;
    for (let i = current; i < count; i++) {
      const idx = i + 1;
      const sel = document.createElement('select');
      sel.id = `${baseId}-select-${idx}`;
      populateOrderOptions(sel);
      if (defaultVal) sel.value = defaultVal;
      container.appendChild(sel);
      const div = document.createElement('div');
      div.className = 'input-row';
      const ta = document.createElement('textarea');
      ta.id = `${baseId}-input-${idx}`;
      ta.rows = 1;
      ta.placeholder = '0,1,2';
      div.appendChild(ta);
      container.appendChild(div);
      const dsel = document.createElement('select');
      dsel.id = `${prefix}-depth-select-${idx}`;
      container.appendChild(dsel);
      const ddiv = document.createElement('div');
      ddiv.className = 'input-row';
      const dta = document.createElement('textarea');
      dta.id = `${prefix}-depth-input-${idx}`;
      dta.rows = 1;
      dta.placeholder = '0,1,2';
      ddiv.appendChild(dta);
      container.appendChild(ddiv);
      setupOrderControl(sel.id, ta.id, getItems);
      setupDepthControl(dsel.id, dta.id);
    }
    for (let i = current; i > count; i--) {
      const idx = i;
      const sel = document.getElementById(`${baseId}-select-${idx}`);
      const ta = document.getElementById(`${baseId}-input-${idx}`);
      const ds = document.getElementById(`${prefix}-depth-select-${idx}`);
      const di = document.getElementById(`${prefix}-depth-input-${idx}`);
      if (sel) sel.remove();
      if (ta && ta.parentElement) ta.parentElement.remove();
      if (ds) ds.remove();
      if (di && di.parentElement) di.parentElement.remove();
    }
    if (rerollUpdaters[prefix]) rerollUpdaters[prefix]();
  }

  function setupOrderControl(selectId, inputId, getItems) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    if (!select || !input) return;
    const update = () => {
      const items = getItems();
      if (select.value === 'canonical') {
        input.value = items.map((_, i) => i).join(', ');
      } else if (select.value === 'random') {
        input.value = '';
      } else if (lists.ORDER_PRESETS[select.value]) {
        input.value = lists.ORDER_PRESETS[select.value].join(', ');
      }
    };
    select.addEventListener('change', update);
    update();
  }

  function setupDepthControl(selectId, inputId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    const baseInput = document.getElementById('base-input');
    if (select) {
      select.innerHTML = '';
      const opts = [
        { id: 'prepend', title: 'Prepend' },
        { id: 'append', title: 'Append' },
        { id: 'random', title: 'Random Depth' }
      ];
      Object.keys(lists.ORDER_PRESETS).forEach(id => {
        opts.push({ id, title: lists.ORDER_PRESETS[id].title || id });
      });
      opts.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.title;
        select.appendChild(opt);
      });
    }
    function countWords(str) {
      const cleaned = str.trim().replace(/[,.!:;?]$/, '');
      if (!cleaned) return 0;
      return cleaned.split(/\s+/).length;
    }
    function build(mode) {
      if (!input) return;
      const bases = utils.parseInput(baseInput ? baseInput.value : '', true);
      if (!bases.length) {
        input.value = mode === 'prepend' ? '0' : '';
        return;
      }
      if (mode === 'prepend') {
        input.value = '0';
        return;
      }
      const counts = bases.map(b => countWords(b));
      if (mode === 'append') {
        input.value = counts.join(', ');
        return;
      }
      input.value = '';
    }
    if (!select) return;
    select.addEventListener('change', () => {
      const val = select.value;
      if (val === 'prepend' || val === 'append' || val === 'random') {
        build(val);
      } else if (lists.ORDER_PRESETS[val]) {
        input.value = lists.ORDER_PRESETS[val].join(', ');
      }
    });
    select.dispatchEvent(new Event('change'));
  }

  function setupRerollButton(btnId, selectId) {
    const btn = document.getElementById(btnId);
    const select = document.getElementById(selectId);
    const adv = document.getElementById('advanced-mode');
    if (!btn || !select) return;
    const guessPrefix = id => {
      const m = id.match(/^([a-z]+)(?:-order)?-select/);
      return m ? m[1] : id.replace(/-select$/, '');
    };
    const prefix = guessPrefix(selectId);
    const gather = () => {
      const arr = [];
      let idx = 1;
      while (true) {
        const sid = `${prefix}-order-select${idx === 1 ? '' : '-' + idx}`;
        const sel = document.getElementById(sid);
        if (!sel) break;
        arr.push(sel);
        idx++;
      }
      return arr;
    };
    const gatherDepth = () => {
      const arr = [];
      let idx = 1;
      while (true) {
        const sid = `${prefix}-depth-select${idx === 1 ? '' : '-' + idx}`;
        const sel = document.getElementById(sid);
        if (!sel) break;
        arr.push(sel);
        idx++;
      }
      return arr;
    };
    const updateState = () => {
      if (adv && adv.checked) {
        btn.classList.remove('active', 'indeterminate');
        return;
      }
      const sels = gather();
      const allRand = sels.every(s => s.value === 'random');
      const allCan = sels.every(s => s.value === 'canonical');
      btn.classList.remove('active', 'indeterminate');
      if (allRand) btn.classList.add('active');
      else if (!allCan) btn.classList.add('indeterminate');
    };
    const reroll = () => {
      const advanced = adv && adv.checked;
      const sels = gather();
      const depths = gatherDepth();
      if (advanced) {
        if (sels[0] && sels[0].value !== 'random') {
          sels[0].value = 'random';
          sels[0].dispatchEvent(new Event('change'));
          if (depths[0]) {
            depths[0].value = 'random';
            depths[0].dispatchEvent(new Event('change'));
          }
        }
        return;
      }
      const allRand = sels.every(s => s.value === 'random');
      const target = allRand ? 'canonical' : 'random';
      const targetDepth = allRand ? 'prepend' : 'random';
      sels.forEach(s => {
        s.value = target;
        s.dispatchEvent(new Event('change'));
      });
      depths.forEach(d => {
        d.value = targetDepth;
        d.dispatchEvent(new Event('change'));
      });
      updateState();
    };
    btn.addEventListener('click', reroll);
    select.addEventListener('change', updateState);
    if (adv) adv.addEventListener('change', updateState);
    rerollUpdaters[prefix] = updateState;
    updateState();
  }

  function rerollRandomOrders() {

    const baseItems = utils.parseInput(
      document.getElementById('base-input')?.value || '',
      true
    );
    const posItems = utils.parseInput(document.getElementById('pos-input')?.value || '');
    const negItems = utils.parseInput(document.getElementById('neg-input')?.value || '');
    const divItems = utils.parseDividerInput(
      document.getElementById('divider-input')?.value || ''
    );

    function gather(prefix, items) {
      const arr = [];
      let idx = 1;
      while (true) {
        const sel = document.getElementById(
          `${prefix}-order-select${idx === 1 ? '' : '-' + idx}`
        );
        const inp = document.getElementById(
          `${prefix}-order-input${idx === 1 ? '' : '-' + idx}`
        );
        if (!sel || !inp) break;
        arr.push({ select: sel, input: inp, items });
        idx++;
      }
      return arr;
    }

    const configs = [
      ...gather('base', baseItems),
      ...gather('pos', posItems),
      ...gather('neg', negItems),
      ...gather('divider', divItems)
    ];

    configs.forEach(cfg => {
      if (cfg.select.value !== 'random') return;
      const arr = cfg.items.map((_, i) => i);
      utils.shuffle(arr);
      cfg.input.value = arr.join(', ');
    });

    const insertSel = document.getElementById('base-depth-select');
    const insertInp = document.getElementById('base-depth-input');
    if (insertSel && insertInp && insertSel.value === 'random') {
      const countWords = str => {
        const cleaned = str.trim().replace(/[,.!:;?]$/, '');
        if (!cleaned) return 0;
        return cleaned.split(/\s+/).length;
      };
      const counts = baseItems.map(b => countWords(b));
      const vals = counts.map(c => Math.floor(Math.random() * (c + 1)));
      insertInp.value = vals.join(', ');
    }
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
    populateOrderOptions(document.getElementById('base-order-select'));
    populateOrderOptions(document.getElementById('pos-order-select'));
    populateOrderOptions(document.getElementById('neg-order-select'));
    populateOrderOptions(document.getElementById('divider-order-select'));

    setupOrderControl('base-order-select', 'base-order-input', () =>
      utils.parseInput(document.getElementById('base-input').value, true)
    );
    setupOrderControl('pos-order-select', 'pos-order-input', () =>
      utils.parseInput(document.getElementById('pos-input').value)
    );
    setupOrderControl('neg-order-select', 'neg-order-input', () =>
      utils.parseInput(document.getElementById('neg-input').value)
    );
    setupOrderControl('divider-order-select', 'divider-order-input', () =>
      utils.parseDividerInput(document.getElementById('divider-input').value || '')
    );
    setupRerollButton('base-reroll', 'base-order-select');
    setupRerollButton('pos-reroll', 'pos-order-select');
    setupRerollButton('neg-reroll', 'neg-order-select');
    setupRerollButton('divider-reroll', 'divider-order-select');
    setupAdvancedToggle();
    document.getElementById('generate').addEventListener('click', generate);

    setupToggleButtons();
    setupStackControls();
    setupShuffleAll();
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
    setupDepthControl('base-depth-select', 'base-depth-input');
    setupDepthControl('pos-depth-select', 'pos-depth-input');
    setupDepthControl('neg-depth-select', 'neg-depth-input');
    setupDepthControl('divider-depth-select', 'divider-depth-input');
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
  }

  const api = {
    applyPreset,
    setupPresetListener,
    collectInputs,
    displayOutput,
    generate,
    updateButtonState,
    setupToggleButtons,
    setupShuffleAll,
    setupStackControls,
    setupHideToggles,
    setupCopyButtons,
    setupDepthControl,
    setupStateButtons,
    setupOrderControl,
    setupAdvancedToggle,
    rerollRandomOrders,
    setupRerollButton,
    initializeUI
  };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.uiControls = api;
  }
})(typeof window !== 'undefined' ? window : global);
