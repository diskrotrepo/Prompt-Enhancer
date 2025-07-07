(function (global) {
  const utils =
    global.promptUtils || (typeof require !== 'undefined' && require('./lib/promptUtils'));
  const lists =
    global.listManager || (typeof require !== 'undefined' && require('./listManager'));
  const storage = global.storageManager || (typeof require !== "undefined" && require("./storageManager"));

  function guessPrefix(id) {
    const m = id.match(/^([a-z]+)(?:-(?:order|depth))?-select/);
    return m ? m[1] : id.replace(/-select.*$/, '');
  }

  function gatherControls(prefix, base) {
    const results = [];
    let idx = 1;
    while (true) {
      const sel = document.getElementById(
        `${prefix}-${base}-select${idx === 1 ? '' : '-' + idx}`
      );
      if (!sel) break;
      const inp = document.getElementById(
        `${prefix}-${base}-input${idx === 1 ? '' : '-' + idx}`
      );
      results.push({ select: sel, input: inp });
      idx++;
    }
    return results;
  }

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
    function collectLists(prefix, count) {
      const result = [];
      for (let i = 1; i <= count; i++) {
        const id = `${prefix}-input${i === 1 ? '' : '-' + i}`;
        const el = document.getElementById(id);
        result.push(utils.parseInput(el?.value || ''));
      }
      return result;
    }

    const posStackOn = document.getElementById('pos-stack').checked;
    const posStackSize = parseInt(document.getElementById('pos-stack-size')?.value || '1', 10);
    const negStackOn = document.getElementById('neg-stack').checked;
    const negStackSize = parseInt(document.getElementById('neg-stack-size')?.value || '1', 10);

    const posMods = posStackOn ? collectLists('pos', posStackSize) : utils.parseInput(document.getElementById('pos-input').value);
    const negMods = negStackOn ? collectLists('neg', negStackSize) : utils.parseInput(document.getElementById('neg-input').value);
    const includePosForNeg = document.getElementById('neg-include-pos').checked;
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
    function collectDepths(prefix, count) {
      const result = [];
      for (let i = 1; i <= count; i++) {
        const id = `${prefix}-depth-input${i === 1 ? '' : '-' + i}`;
        const el = document.getElementById(id);
        result.push(utils.parseOrderInput(el?.value || ''));
      }
      return result;
    }

    const rawPosDepths = collectDepths('pos', posStackOn ? posStackSize : 1);
    const posDepths = posStackOn ? rawPosDepths : rawPosDepths[0];
    const rawNegDepths = collectDepths('neg', negStackOn ? negStackSize : 1);
    const negDepths = negStackOn ? rawNegDepths : rawNegDepths[0];
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
      posStackOn,
      posStackSize,
      negStackOn,
      negStackSize,
      limit,
      includePosForNeg,
      dividerMods,
      shuffleDividers,
      dividerOrder,
      posDepths,
      negDepths,
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
      posStackOn,
      posStackSize,
      negStackOn,
      negStackSize,
      limit,
      includePosForNeg,
      dividerMods,
      shuffleDividers,
      dividerOrder,
      posDepths,
      negDepths,
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
      posDepths,
      negDepths,
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
    const canonicalFor = sel =>
      sel.id.includes('-depth-select') ? 'prepend' : 'canonical';
    const updateAll = () => {
      const selects = Array.from(
        document.querySelectorAll('[id*="-order-select"], [id*="-depth-select"]')
      );
      selects.forEach(sel => {
        sel.value = allRandom.checked ? 'random' : canonicalFor(sel);
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
        updateStackBlocks(cfg.prefix, count);
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
      'pos-depth-select',
      'neg-depth-select'
    ];
    const textIds = [
      'base-order-input',
      'divider-order-input',
      'pos-depth-input',
      'neg-depth-input'
    ];
    const containerIds = ['pos-order-container', 'neg-order-container', 'pos-depth-container', 'neg-depth-container'];
    const setDisplay = (el, show) => {
      if (!el) return;
      el.style.display = show ? '' : 'none';
    };
    const update = () => {
      const adv = cb.checked;
      selectIds.forEach(id => {
        document.querySelectorAll(`[id^="${id}"]`).forEach(el => setDisplay(el, adv));
      });
      textIds.forEach(id => {
        document.querySelectorAll(`[id^="${id}"]`).forEach(el => {
          if (el.parentElement && el.parentElement.classList.contains('input-row')) {
            setDisplay(el.parentElement, adv);
          }
        });
      });
      containerIds.forEach(id => {
        document.querySelectorAll(`[id^="${id}"]`).forEach(el => setDisplay(el, adv));
      });
      // Dice buttons remain visible in both modes
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


  function setupOrderControl(selectId, inputId, getItems) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    if (!select || !input) return;
    const prefix = guessPrefix(selectId);
    const update = () => {
      const items = getItems();
      if (select.value === 'canonical') {
        input.value = items.map((_, i) => i).join(', ');
      } else if (select.value === 'random') {
        input.value = '';
      } else if (lists.ORDER_PRESETS[select.value]) {
        input.value = lists.ORDER_PRESETS[select.value].join(', ');
      }
      if (rerollUpdaters[prefix]) rerollUpdaters[prefix]();
    };
    select.addEventListener('change', update);
    update();
  }

  function populateDepthOptions(select) {
    if (!select) return;
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


  function setupDepthControl(selectId, inputId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    const baseInput = document.getElementById('base-input');
    if (!select || !input || !baseInput) return;
    const prefix = guessPrefix(selectId);
    const build = mode => {
      const bases = utils.parseInput(baseInput.value, true);
      if (!bases.length) {
        input.value = mode === 'prepend' ? '0' : '';
        return;
      }
      if (mode === 'prepend') {
        input.value = '0';
        return;
      }
      const counts = bases.map(b => utils.countWords(b));
      if (mode === 'append') {
        input.value = counts.join(', ');
        return;
      }
      input.value = '';
    };
    select.addEventListener('change', () => {
      const val = select.value;
      if (val === 'prepend' || val === 'append' || val === 'random') {
        build(val);
      } else if (lists.ORDER_PRESETS[val]) {
        input.value = lists.ORDER_PRESETS[val].join(', ');
      }
      if (rerollUpdaters[prefix]) rerollUpdaters[prefix]();
    });
    select.dispatchEvent(new Event('change'));
  }

  function updateDepthContainers(prefix, count) {
    const container = document.getElementById(`${prefix}-depth-container`);
    const baseId = `${prefix}-depth`;
    const adv = document.getElementById('advanced-mode');
    const baseSel = document.getElementById(`${baseId}-select`);
    const defaultVal = !adv || !adv.checked ? baseSel?.value || 'prepend' : undefined;
    if (!container) return;
    const current = container.querySelectorAll('select').length;
    for (let i = current; i < count; i++) {
      const idx = i + 1;
      const sel = document.createElement('select');
      sel.id = `${baseId}-select-${idx}`;
      populateDepthOptions(sel);
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
      setupDepthControl(sel.id, ta.id);
    }
    for (let i = current; i > count; i--) {
      const idx = i;
      const sel = document.getElementById(`${baseId}-select-${idx}`);
      const ta = document.getElementById(`${baseId}-input-${idx}`);
      if (sel) sel.remove();
      if (ta && ta.parentElement) ta.parentElement.remove();
    }
  }

  function updateStackBlocks(prefix, count) {
    const container = document.getElementById(`${prefix}-stack-container`);
    if (!container) return;
    const current = container.querySelectorAll('.stack-block').length;
    const type = prefix === 'neg' ? 'negative' : 'positive';
    const rows = prefix === 'neg' ? 3 : 2;
    for (let i = current; i < count; i++) {
      const idx = i + 1;
      const block = document.createElement('div');
      block.className = 'stack-block';
      block.id = `${prefix}-stack-${idx}`;

      if (idx > 1) {
        const labelRow = document.createElement('div');
        labelRow.className = 'label-row';
        const lbl = document.createElement('label');
        lbl.textContent = `Stack ${idx}`;
        labelRow.appendChild(lbl);
        const btnCol = document.createElement('div');
        btnCol.className = 'button-col';
        const save = document.createElement('button');
        save.type = 'button';
        save.id = `${prefix}-save-${idx}`;
        save.className = 'save-button icon-button';
        save.title = 'Save';
        save.innerHTML = '&#128190;';
        save.addEventListener('click', () => lists.saveList(type, idx));
        btnCol.appendChild(save);
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'copy-button icon-button';
        copy.dataset.target = `${prefix}-input-${idx}`;
        copy.title = 'Copy';
        copy.innerHTML = '&#128203;';
        btnCol.appendChild(copy);
        const hideCb = document.createElement('input');
        hideCb.type = 'checkbox';
        hideCb.id = `${prefix}-hide-${idx}`;
        hideCb.dataset.targets = `${prefix}-input-${idx},${prefix}-order-input-${idx}`;
        hideCb.hidden = true;
        btnCol.appendChild(hideCb);
        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'toggle-button icon-button hide-button';
        hideBtn.dataset.target = hideCb.id;
        hideBtn.dataset.on = '☰';
        hideBtn.dataset.off = '✖';
        hideBtn.textContent = '☰';
        btnCol.appendChild(hideBtn);
        labelRow.appendChild(btnCol);
        block.appendChild(labelRow);
      }

      const sel = document.createElement('select');
      sel.id = `${prefix}-select-${idx}`;
      const baseSel = document.getElementById(`${prefix}-select`);
      if (baseSel) sel.innerHTML = baseSel.innerHTML;
      block.appendChild(sel);

      const row = document.createElement('div');
      row.className = 'input-row';
      const ta = document.createElement('textarea');
      ta.id = `${prefix}-input-${idx}`;
      ta.rows = rows;
      ta.placeholder = type.charAt(0).toUpperCase() + type.slice(1) + ' modifiers';
      row.appendChild(ta);
      block.appendChild(row);

      const orderCont = document.createElement('div');
      orderCont.id = `${prefix}-order-container-${idx}`;
      const oLabelRow = document.createElement('div');
      oLabelRow.className = 'label-row';
      const oLbl = document.createElement('label');
      oLbl.textContent = type.charAt(0).toUpperCase() + type.slice(1) + ' Ordering';
      oLbl.setAttribute('for', `${prefix}-order-input-${idx}`);
      oLabelRow.appendChild(oLbl);
      orderCont.appendChild(oLabelRow);
      const orderSel = document.createElement('select');
      orderSel.id = `${prefix}-order-select-${idx}`;
      populateOrderOptions(orderSel);
      const baseOrderSel = document.getElementById(`${prefix}-order-select`);
      if (baseOrderSel) orderSel.value = baseOrderSel.value;
      orderCont.appendChild(orderSel);
      const oRow = document.createElement('div');
      oRow.className = 'input-row';
      const oTa = document.createElement('textarea');
      oTa.id = `${prefix}-order-input-${idx}`;
      oTa.rows = 1;
      oTa.placeholder = '0,1,2';
      oRow.appendChild(oTa);
      orderCont.appendChild(oRow);
      block.appendChild(orderCont);

      const depthCont = document.createElement('div');
      depthCont.id = `${prefix}-depth-container-${idx}`;
      const dLabelRow = document.createElement('div');
      dLabelRow.className = 'label-row';
      const dLbl = document.createElement('label');
      dLbl.textContent = type.charAt(0).toUpperCase() + type.slice(1) + ' Depth';
      dLbl.setAttribute('for', `${prefix}-depth-input-${idx}`);
      dLabelRow.appendChild(dLbl);
      depthCont.appendChild(dLabelRow);
      const depthSel = document.createElement('select');
      depthSel.id = `${prefix}-depth-select-${idx}`;
      populateDepthOptions(depthSel);
      const baseDepthSel = document.getElementById(`${prefix}-depth-select`);
      if (baseDepthSel) depthSel.value = baseDepthSel.value;
      depthCont.appendChild(depthSel);
      const dRow = document.createElement('div');
      dRow.className = 'input-row';
      const dTa = document.createElement('textarea');
      dTa.id = `${prefix}-depth-input-${idx}`;
      dTa.rows = 1;
      dTa.placeholder = '0,1,2';
      dRow.appendChild(dTa);
      depthCont.appendChild(dRow);
      block.appendChild(depthCont);

      container.appendChild(block);
      setupPresetListener(sel.id, ta.id, type);
      applyPreset(sel, ta, type);
      setupOrderControl(orderSel.id, oTa.id, () => utils.parseInput(ta.value));
      setupDepthControl(depthSel.id, dTa.id);
    }
    for (let i = current; i > count; i--) {
      const block = document.getElementById(`${prefix}-stack-${i}`);
      if (block) block.remove();
    }
    setupCopyButtons();
    setupHideToggles();
    const adv = document.getElementById('advanced-mode');
    if (adv && !adv.checked) adv.dispatchEvent(new Event('change'));
  }

  function setupRerollButton(btnId, selectId) {
    const btn = document.getElementById(btnId);
    const select = document.getElementById(selectId);
    const adv = document.getElementById('advanced-mode');
    if (!btn || !select) return;
    const prefix = guessPrefix(selectId);
    const gather = () =>
      [
        ...gatherControls(prefix, 'order'),
        ...gatherControls(prefix, 'depth')
      ]
        .map(p => p.select)
        .filter(Boolean);
    const updateState = () => {
      const sels = gather();
      const canonicalFor = s => (s.id.includes('-depth-select') ? 'prepend' : 'canonical');
      const allRand = sels.every(s => s.value === 'random');
      const allCan = sels.every(s => s.value === canonicalFor(s));
      btn.classList.remove('active', 'indeterminate');
      if (allRand) btn.classList.add('active');
      else if (!allCan) btn.classList.add('indeterminate');
    };
    const reroll = () => {
      const sels = gather();
      const canonicalFor = s => (s.id.includes('-depth-select') ? 'prepend' : 'canonical');
      const allRand = sels.every(s => s.value === 'random');
      sels.forEach(s => {
        const target = allRand ? canonicalFor(s) : 'random';
        s.value = target;
        s.dispatchEvent(new Event('change'));
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
    const gatherItems = prefix => {
      const arr = [];
      let idx = 1;
      while (true) {
        const el = document.getElementById(`${prefix}-input${idx === 1 ? '' : '-' + idx}`);
        if (!el) break;
        arr.push(utils.parseInput(el.value || ''));
        idx++;
      }
      if (arr.length === 1) return arr[0];
      return arr;
    };

    const posItems = gatherItems('pos');
    const negItems = gatherItems('neg');
    const divItems = utils.parseDividerInput(
      document.getElementById('divider-input')?.value || ''
    );

    function gather(prefix, items) {
      return gatherControls(prefix, 'order').map((pair, i) => ({
        select: pair.select,
        input: pair.input,
        items: Array.isArray(items[0]) ? items[i] || items[0] : items
      }));
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

    function gatherDepth(prefix) {
      return gatherControls(prefix, 'depth');
    }

    const depthConfigs = [...gatherDepth('pos'), ...gatherDepth('neg')];
    depthConfigs.forEach(cfg => {
      if (!cfg.select || !cfg.input || cfg.select.value !== 'random') return;
      const counts = baseItems.map(b => utils.countWords(b));
      const vals = counts.map(c => Math.floor(Math.random() * (c + 1)));
      cfg.input.value = vals.join(', ');
    });
  }

  function setupDataButtons() {
    const saveBtn = document.getElementById('save-data');
    const loadBtn = document.getElementById('load-data');
    const fileInput = document.getElementById('data-file');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const blob = new Blob([storage.exportData()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.json';
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
            storage.importData(data);
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
    storage.loadPersisted();
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
    populateDepthOptions(document.getElementById('pos-depth-select'));
    populateDepthOptions(document.getElementById('neg-depth-select'));

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
    setupDepthControl('pos-depth-select', 'pos-depth-input');
    setupDepthControl('neg-depth-select', 'neg-depth-input');
    updateDepthContainers('pos', 1);
    updateDepthContainers('neg', 1);
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
    setupDataButtons();

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
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => storage.persist());
    }
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
    setupDataButtons,
    setupOrderControl,
    setupAdvancedToggle,
    updateStackBlocks,
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
