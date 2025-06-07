let DEFAULT_NEGATIVE_MODIFIERS = [];
let DEFAULT_DESCRIPTORS = [];
let IMAGE_BAD_DESCRIPTORS = [];
let DEFAULT_POSITIVE_MODIFIERS = [];

function loadLists() {
  if (typeof BAD_LISTS === 'object') {
    DEFAULT_DESCRIPTORS = BAD_LISTS.DEFAULT_DESCRIPTORS || [];
    IMAGE_BAD_DESCRIPTORS = BAD_LISTS.IMAGE_BAD_DESCRIPTORS || [];
  }
  if (typeof NEGATIVE_MODIFIER_LISTS === 'object') {
    DEFAULT_NEGATIVE_MODIFIERS = NEGATIVE_MODIFIER_LISTS.DEFAULT_NEGATIVE_MODIFIERS || [];
  }
  if (typeof GOOD_LISTS === 'object') {
    DEFAULT_POSITIVE_MODIFIERS = GOOD_LISTS.DEFAULT_POSITIVE_MODIFIERS || [];
  }
  
  // Debug: Log loaded lists to verify they're populated
  console.log('Lists loaded:', {
    DEFAULT_DESCRIPTORS: DEFAULT_DESCRIPTORS.length,
    IMAGE_BAD_DESCRIPTORS: IMAGE_BAD_DESCRIPTORS.length,
    DEFAULT_NEGATIVE_MODIFIERS: DEFAULT_NEGATIVE_MODIFIERS.length,
    DEFAULT_POSITIVE_MODIFIERS: DEFAULT_POSITIVE_MODIFIERS.length
  });
}

// Load lists immediately
loadLists();

function parseInput(raw) {
  if (!raw) return [];
  const normalized = raw.replace(/;/g, ',').replace(/\s*,\s*/g, ',');
  return normalized.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
}

function generatePrependedList(items, prefixes) {
  if (!prefixes.length) return [];
  const shuffled = prefixes.slice().sort(() => Math.random() - 0.5);
  const result = [];
  for (let i = 0; i < shuffled.length; i++) {
    const prefix = shuffled[i % shuffled.length];
    const item = items[i % items.length];
    result.push(`${prefix} ${item}`);
  }
  return result;
}

function generateNegatedList(items, negs) {
  return generatePrependedList(items, negs);
}

function generateBadDescriptorList(items, descs) {
  return generatePrependedList(items, descs);
}

function combineListsByMode(negated, bad, mode, limit) {
  const combined = [];

  function tryAdd(term) {
    const test = [...combined, term].join(', ');
    if (test.length > limit) return false;
    combined.push(term);
    return true;
  }

  const addAll = (list) => {
    for (const term of list) {
      if (!tryAdd(term)) break;
    }
  };

  switch (mode) {
    case 'bad-only':
      addAll(bad);
      break;
    case 'negative-only':
      addAll(negated);
      break;
    case 'bad-first':
      addAll(bad);
      addAll(negated);
      break;
    case 'mixed': {
      let n = 0;
      let b = 0;
      while (n < negated.length || b < bad.length) {
        let useNeg;
        if (n >= negated.length) {
          useNeg = false;
        } else if (b >= bad.length) {
          useNeg = true;
        } else {
          useNeg = Math.random() < 0.5;
        }
        const term = useNeg ? negated[n++] : bad[b++];
        if (!tryAdd(term)) break;
      }
      break;
    }
    case 'negative-first':
    default:
      addAll(negated);
      addAll(bad);
      break;
  }

  return combined;
}

function generatePositiveList(items, combinedNeg) {
  const target = combinedNeg.length;
  const pos = [];
  for (let i = 0; i < target; i++) {
    pos.push(items[i % items.length]);
  }
  return pos;
}

function buildVersions(items, descs, negs, posMods, negMode, posMode, limit) {
  const negated = generateNegatedList(items, negs);
  const bad = generateBadDescriptorList(items, descs);
  const combinedNeg = combineListsByMode(negated, bad, negMode, limit);
  const basePos = posMode === 'on'
    ? generatePrependedList(items, posMods)
    : items;
  const positive = generatePositiveList(basePos, combinedNeg);
  return {
    good: positive.join(', '),
    bad: combinedNeg.join(', ')
  };
}

function getList(selectEl, textareaEl, defaults) {
  const choice = selectEl.value;
  if (choice === 'default') {
    textareaEl.value = defaults.join(', ');
    textareaEl.disabled = true;
    return defaults;
  } else if (choice === 'image') {
    textareaEl.value = IMAGE_BAD_DESCRIPTORS.join(', ');
    textareaEl.disabled = true;
    return IMAGE_BAD_DESCRIPTORS;
  } else if (choice === 'empty') {
    textareaEl.value = '';
    textareaEl.disabled = true;
    return [];
  } else {
    textareaEl.disabled = false;
    return parseInput(textareaEl.value);
  }
}

document.getElementById('desc-select').addEventListener('change', () => {
  console.log('Desc select changed to:', document.getElementById('desc-select').value);
  getList(document.getElementById('desc-select'), document.getElementById('desc-input'), DEFAULT_DESCRIPTORS);
});

document.getElementById('neg-select').addEventListener('change', () => {
  console.log('Neg select changed to:', document.getElementById('neg-select').value);
  getList(document.getElementById('neg-select'), document.getElementById('neg-input'), DEFAULT_NEGATIVE_MODIFIERS);
});

document.getElementById('pos-select').addEventListener('change', () => {
  console.log('Pos select changed to:', document.getElementById('pos-select').value);
  getList(document.getElementById('pos-select'), document.getElementById('pos-input'), DEFAULT_POSITIVE_MODIFIERS);
});

document.getElementById('length-select').addEventListener('change', () => {
  const select = document.getElementById('length-select');
  const input = document.getElementById('length-input');
  if (select.value === 'custom') {
    input.disabled = false;
  } else {
    input.value = select.value;
    input.disabled = true;
  }
});

function collectInputs() {
  const baseItems = parseInput(document.getElementById('base-input').value);
  const descs = getList(document.getElementById('desc-select'), document.getElementById('desc-input'), DEFAULT_DESCRIPTORS);
  const negs = getList(document.getElementById('neg-select'), document.getElementById('neg-input'), DEFAULT_NEGATIVE_MODIFIERS);
  const posMods = getList(document.getElementById('pos-select'), document.getElementById('pos-input'), DEFAULT_POSITIVE_MODIFIERS);
  const negMode = document.getElementById('neg-mode-select').value;
  const posMode = document.getElementById('pos-mode-select').value;
  const lengthSelect = document.getElementById('length-select');
  const lengthInput = document.getElementById('length-input');
  let limit;
  if (lengthSelect.value === 'custom') {
    limit = parseInt(lengthInput.value, 10) || 1000;
  } else {
    limit = parseInt(lengthSelect.value, 10);
    lengthInput.value = limit;
  }
  return { baseItems, descs, negs, posMods, negMode, posMode, limit };
}

function displayOutput(result) {
  document.getElementById('good-output').textContent = result.good;
  document.getElementById('bad-output').textContent = result.bad;
}

function generate() {
  const { baseItems, descs, negs, posMods, negMode, posMode, limit } = collectInputs();
  if (!baseItems.length) {
    alert('Please enter at least one base prompt item.');
    return;
  }
  const result = buildVersions(baseItems, descs, negs, posMods, negMode, posMode, limit);
  displayOutput(result);
}

document.getElementById('generate').addEventListener('click', generate);

document.getElementById('randomize').addEventListener('click', () => {
  const { baseItems, descs, negs, posMods, negMode, posMode, limit } = collectInputs();
  if (!baseItems.length) {
    alert('Please enter at least one base prompt item.');
    return;
  }
  const shuffled = baseItems.slice().sort(() => Math.random() - 0.5);
  const result = buildVersions(shuffled, descs, negs, posMods, negMode, posMode, limit);
  displayOutput(result);
});
