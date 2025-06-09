let DESC_PRESETS = {};
let POS_PRESETS = {};

function loadLists() {
  if (typeof BAD_LISTS === 'object') {
    DESC_PRESETS = {
      default: {
        display: BAD_LISTS.DEFAULT_DESCRIPTORS || [],
        descs: BAD_LISTS.DEFAULT_DESCRIPTORS || [],
        negs: []
      },
      'audio-neg': {
        display: BAD_LISTS.DEFAULT_DESCRIPTORS_WITH_NEGATIONS || [],
        descs: BAD_LISTS.DEFAULT_DESCRIPTORS || [],
        negs: BAD_LISTS.DEFAULT_NEGATIVE_MODIFIERS || []
      },
      image: {
        display: BAD_LISTS.IMAGE_BAD_DESCRIPTORS || [],
        descs: BAD_LISTS.IMAGE_BAD_DESCRIPTORS || [],
        negs: []
      },
      empty: { display: [], descs: [], negs: [] }
    };
  }
  if (typeof GOOD_LISTS === 'object') {
    POS_PRESETS = {
      default: GOOD_LISTS.DEFAULT_POSITIVE_MODIFIERS || [],
      empty: []
    };
  }

  console.log('Lists loaded:', {
    descPresets: Object.keys(DESC_PRESETS).length,
    posPresets: Object.keys(POS_PRESETS).length
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

function buildVersions(items, descs, negs, posMods, negMode, limit) {
  function makeCycler(arr, shuffle = true) {
    let pool = shuffle ? [] : arr.slice();
    let idx = 0;
    return () => {
      if (!arr.length) return null;
      if (idx >= pool.length) {
        pool = shuffle ? arr.slice().sort(() => Math.random() - 0.5) : arr.slice();
        idx = 0;
      }
      return pool[idx++];
    };
  }

  const nextItem = makeCycler(items, false);
  const nextNeg = makeCycler(negs);
  const nextBad = makeCycler(descs);
  const nextPos = makeCycler(posMods);

  const bad = [];
  const good = [];

  function makeNegTerm() {
    const prefix = nextNeg();
    if (prefix === null) return null;
    const item = nextItem();
    return { term: `${prefix} ${item}`, item };
  }

  function makeBadTerm() {
    const prefix = nextBad();
    if (prefix === null) return null;
    const item = nextItem();
    return { term: `${prefix} ${item}`, item };
  }

  function makePosTerm(item) {
    if (posMods.length === 0) return item;
    const prefix = nextPos();
    return `${prefix} ${item}`;
  }

  function tryAdd(obj) {
    if (!obj) return false;
    const test = [...bad, obj.term].join(', ');
    if (test.length > limit) return false;
    bad.push(obj.term);
    good.push(makePosTerm(obj.item));
    return true;
  }

  const addAll = (maker) => {
    while (true) {
      const obj = maker();
      if (!obj) break;
      if (!tryAdd(obj)) break;
    }
  };

  switch (negMode) {
    case 'bad-first':
      addAll(makeBadTerm);
      if (bad.join(', ').length < limit) addAll(makeNegTerm);
      break;
    case 'mixed':
      while (true) {
        const useNeg = descs.length === 0 ? true : negs.length === 0 ? false : Math.random() < 0.5;
        const maker = useNeg ? makeNegTerm : makeBadTerm;
        if (!tryAdd(maker())) break;
      }
      break;
    case 'negative-first':
    default:
      addAll(makeNegTerm);
      if (bad.join(', ').length < limit) addAll(makeBadTerm);
      break;
  }

  return {
    good: good.join(', '),
    bad: bad.join(', ')
  };
}


function getList(selectEl, textareaEl, presets) {
  const key = selectEl.value;
  if (key === 'custom') {
    textareaEl.disabled = false;
    return parseInput(textareaEl.value);
  }
  const list = presets[key] || [];
  textareaEl.value = list.join(', ');
  textareaEl.disabled = true;
  return list;
}

function getDescLists(selectEl, textareaEl) {
  const key = selectEl.value;
  if (key === 'custom') {
    textareaEl.disabled = false;
    const parsed = parseInput(textareaEl.value);
    return { descs: parsed, negs: [] };
  }
  const preset = DESC_PRESETS[key] || { display: [], descs: [], negs: [] };
  textareaEl.value = preset.display.join(', ');
  textareaEl.disabled = true;
  return { descs: preset.descs, negs: preset.negs };
}

document.getElementById('desc-select').addEventListener('change', () => {
  console.log('Desc select changed to:', document.getElementById('desc-select').value);
  getDescLists(document.getElementById('desc-select'), document.getElementById('desc-input'));
});


document.getElementById('pos-select').addEventListener('change', () => {
  console.log('Pos select changed to:', document.getElementById('pos-select').value);
  getList(document.getElementById('pos-select'), document.getElementById('pos-input'), POS_PRESETS);
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
  const { descs, negs } = getDescLists(document.getElementById('desc-select'), document.getElementById('desc-input'));
  const posMods = getList(document.getElementById('pos-select'), document.getElementById('pos-input'), POS_PRESETS);
  const negMode = document.getElementById('neg-mode-select').value;
  const lengthSelect = document.getElementById('length-select');
  const lengthInput = document.getElementById('length-input');
  let limit;
  if (lengthSelect.value === 'custom') {
    limit = parseInt(lengthInput.value, 10) || 1000;
  } else {
    limit = parseInt(lengthSelect.value, 10);
    lengthInput.value = limit;
  }
  return { baseItems, descs, negs, posMods, negMode, limit };
}

function displayOutput(result) {
  document.getElementById('good-output').textContent = result.good;
  document.getElementById('bad-output').textContent = result.bad;
}

function generate() {
  const { baseItems, descs, negs, posMods, negMode, limit } = collectInputs();
  if (!baseItems.length) {
    alert('Please enter at least one base prompt item.');
    return;
  }
  const result = buildVersions(baseItems, descs, negs, posMods, negMode, limit);
  displayOutput(result);
}

document.getElementById('generate').addEventListener('click', generate);

document.getElementById('randomize').addEventListener('click', () => {
  const { baseItems, descs, negs, posMods, negMode, limit } = collectInputs();
  if (!baseItems.length) {
    alert('Please enter at least one base prompt item.');
    return;
  }
  const shuffled = baseItems.slice().sort(() => Math.random() - 0.5);
  const result = buildVersions(shuffled, descs, negs, posMods, negMode, limit);
  displayOutput(result);
});
