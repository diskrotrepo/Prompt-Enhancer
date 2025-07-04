import { parseInput, parseDividerInput } from './utils.js';
import { buildVersions, processLyrics } from './generator.js';
import {
  loadLists,
  NEG_PRESETS,
  POS_PRESETS,
  LENGTH_PRESETS,
  DIVIDER_PRESETS,
  BASE_PRESETS,
  LYRICS_PRESETS,
  exportLists,
  importLists,
  saveList,
  loadListsFromFile,
  downloadLists
} from './listManager.js';

export function applyPreset(selectEl, inputEl, presetsOrType) {
  let presets = presetsOrType;
  if (typeof presetsOrType === 'string') {
    if (presetsOrType === 'negative') {
      presets = NEG_PRESETS;
    } else if (presetsOrType === 'positive') {
      presets = POS_PRESETS;
    } else if (presetsOrType === 'length') {
      presets = LENGTH_PRESETS;
    } else if (presetsOrType === 'divider') {
      presets = DIVIDER_PRESETS;
    } else if (presetsOrType === 'base') {
      presets = BASE_PRESETS;
    } else if (presetsOrType === 'lyrics') {
      presets = LYRICS_PRESETS;
    } else {
      presets = {};
    }
  }
  const key = selectEl.value;
  const list = presets[key] || [];
  if (inputEl.tagName === 'TEXTAREA') {
    const sep = presetsOrType === 'divider' || presets === DIVIDER_PRESETS ? '\n' : ', ';
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

export function collectInputs() {
  const baseItems = parseInput(document.getElementById('base-input').value, true);
  const negMods = parseInput(document.getElementById('neg-input').value);
  const posMods = parseInput(document.getElementById('pos-input').value);
  const shuffleBase = document.getElementById('base-shuffle').checked;
  const shufflePos = document.getElementById('pos-shuffle').checked;
  const posStackOn = document.getElementById('pos-stack').checked;
  const posStackSize = parseInt(document.getElementById('pos-stack-size')?.value || '1', 10);
  const includePosForNeg = document.getElementById('neg-include-pos').checked;
  const shuffleNeg = document.getElementById('neg-shuffle').checked;
  const negStackOn = document.getElementById('neg-stack').checked;
  const negStackSize = parseInt(document.getElementById('neg-stack-size')?.value || '1', 10);
  const dividerMods = parseDividerInput(document.getElementById('divider-input')?.value || '');
  const shuffleDividers = document.getElementById('divider-shuffle')?.checked;
  const lengthSelect = document.getElementById('length-select');
  const lengthInput = document.getElementById('length-input');

  let limit = parseInt(lengthInput.value, 10);
  if (isNaN(limit) || limit <= 0) {
    const preset = LENGTH_PRESETS[lengthSelect.value];
    limit = preset ? parseInt(preset[0], 10) : 1000;
    lengthInput.value = limit;
  }

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
    shuffleDividers
  };
}

export function displayOutput(result) {
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
    shuffleDividers
  } = collectInputs();
  if (!baseItems.length) {
    alert('Please enter at least one base prompt item.');
    return;
  }
  const dividers = dividerMods.length ? dividerMods : [];
  const result = buildVersions(
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
    negStackOn ? negStackSize : 1
  );
  displayOutput(result);

  const lyricsInput = document.getElementById('lyrics-input');
  if (lyricsInput && lyricsInput.value.trim()) {
    const spaceSel = document.getElementById('lyrics-space');
    const maxSpaces = spaceSel ? spaceSel.value : 1;
    const removeParens = document.getElementById('lyrics-remove-parens')?.checked;
    const removeBrackets = document.getElementById('lyrics-remove-brackets')?.checked;
    const processed = processLyrics(lyricsInput.value, maxSpaces, removeParens, removeBrackets);
    document.getElementById('lyrics-output').textContent = processed;
  } else {
    const out = document.getElementById('lyrics-output');
    if (out) out.textContent = '';
  }
}

export function updateButtonState(btn, checkbox) {
  btn.classList.toggle('active', checkbox.checked);
  if (btn.dataset.on && btn.dataset.off) {
    btn.textContent = checkbox.checked ? btn.dataset.on : btn.dataset.off;
  }
}

export function setupToggleButtons() {
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

export function setupShuffleAll() {
  const allRandom = document.getElementById('all-random');
  if (!allRandom) return;
  const shuffleCheckboxes = [
    document.getElementById('base-shuffle'),
    document.getElementById('pos-shuffle'),
    document.getElementById('neg-shuffle')
  ].filter(Boolean);
  allRandom.addEventListener('change', () => {
    shuffleCheckboxes.forEach(cb => {
      const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
      if (btn && btn.classList.contains('disabled')) {
        return;
      }
      cb.checked = allRandom.checked;
      if (btn) updateButtonState(btn, cb);
    });
    const allBtn = document.querySelector('.toggle-button[data-target="all-random"]');
    if (allBtn) updateButtonState(allBtn, allRandom);
  });
}

export function setupStackControls() {
  const configs = [
    { stack: 'pos-stack', size: 'pos-stack-size', shuffle: 'pos-shuffle' },
    { stack: 'neg-stack', size: 'neg-stack-size', shuffle: 'neg-shuffle' }
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
    };
    stackCb.addEventListener('change', update);
    update();
  });
}

export function setupHideToggles() {
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

export function setupCopyButtons() {
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

export function initializeUI() {
  loadLists();

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
      if (f) loadListsFromFile(f, fileInput.dataset.additive === 'true');
      fileInput.value = '';
    });
  }
  const dlBtn = document.getElementById('download-lists');
  if (dlBtn) dlBtn.addEventListener('click', downloadLists);
  const baseSave = document.getElementById('base-save');
  if (baseSave) baseSave.addEventListener('click', () => saveList('base'));
  const posSave = document.getElementById('pos-save');
  if (posSave) posSave.addEventListener('click', () => saveList('positive'));
  const negSave = document.getElementById('neg-save');
  if (negSave) negSave.addEventListener('click', () => saveList('negative'));
  const lenSave = document.getElementById('length-save');
  if (lenSave) lenSave.addEventListener('click', () => saveList('length'));
  const divSave = document.getElementById('divider-save');
  if (divSave) divSave.addEventListener('click', () => saveList('divider'));
  const lyricsSave = document.getElementById('lyrics-save');
  if (lyricsSave) lyricsSave.addEventListener('click', () => saveList('lyrics'));
}

if (typeof document !== 'undefined' && !(typeof window !== 'undefined' && window.__TEST__)) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUI);
  } else {
    initializeUI();
  }
}
