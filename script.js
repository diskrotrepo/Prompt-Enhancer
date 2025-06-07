const DEFAULT_NEGATIVE_MODIFIERS = ["not", "no", "un-"];
const RAW_DEFAULT_DESCS = `Horrorcore, Rockabilly, Soundtrack, kid's, children's, Christmas, holiday, jingle, oldies, Teen, Vocaloid, idol, K-Pop, mandarin, LGBT, Swing, Country, Anime, Black Metal, Straight Edge, Psychobilly, mediocre, Parody, humorous, Comedy, Reggaetón, Drill, Future Bass, Big Room House, Dubstep, Bounce, Hardstyle, Trance, Jersey Club, Footwork, Chiptune, Psytrance, Moombahton, Riddim Dubstep, Tech-House, Phonk, Electro-swing, Cumbia, Tango, Bossa Nova, Samba, Dancehall, Bhangra, Disco, Polka, Vaporwave, Minimal Techno, Blues, Sea Shanty, Lo-fi Hip-Hop, Synthwave, K-pop`;
const DEFAULT_DESCRIPTORS = RAW_DEFAULT_DESCS.split(',').map(d => d.trim()).filter(Boolean);

function parseInput(raw) {
  if (!raw) return [];
  const normalized = raw.replace(/;/g, ',').replace(/\s*,\s*/g, ',');
  return normalized.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
}

function generateNegatedList(items, negs) {
  if (!negs.length) return [];
  return items.map(item => `${negs[Math.floor(Math.random() * negs.length)]} ${item}`);
}

function generateBadDescriptorList(items, descs) {
  const shuffled = descs.slice().sort(() => Math.random() - 0.5);
  const badTerms = [];
  for (let i = 0; i < shuffled.length; i++) {
    const desc = shuffled[i % shuffled.length];
    const item = items[i % items.length];
    badTerms.push(`${desc} ${item}`);
  }
  return badTerms;
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

function buildVersions(items, descs, negs, mode) {
  const negated = generateNegatedList(items, negs);
  const bad = generateBadDescriptorList(items, descs);
  const combinedNeg = combineListsByMode(negated, bad, mode, 1000);
  const positive = generatePositiveList(items, combinedNeg);
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
  getList(document.getElementById('desc-select'), document.getElementById('desc-input'), DEFAULT_DESCRIPTORS);
});

document.getElementById('neg-select').addEventListener('change', () => {
  getList(document.getElementById('neg-select'), document.getElementById('neg-input'), DEFAULT_NEGATIVE_MODIFIERS);
});

function collectInputs() {
  const baseItems = parseInput(document.getElementById('base-input').value);
  const descs = getList(document.getElementById('desc-select'), document.getElementById('desc-input'), DEFAULT_DESCRIPTORS);
  const negs = getList(document.getElementById('neg-select'), document.getElementById('neg-input'), DEFAULT_NEGATIVE_MODIFIERS);
  const mode = document.getElementById('mode-select').value;
  return { baseItems, descs, negs, mode };
}

function displayOutput(result) {
  document.getElementById('good-output').textContent = result.good;
  document.getElementById('bad-output').textContent = result.bad;
}

function generate() {
  const { baseItems, descs, negs, mode } = collectInputs();
  if (!baseItems.length) {
    alert('Please enter at least one base prompt item.');
    return;
  }
  const result = buildVersions(baseItems, descs, negs, mode);
  displayOutput(result);
}

document.getElementById('generate').addEventListener('click', generate);

document.getElementById('randomize').addEventListener('click', () => {
  const { baseItems, descs, negs, mode } = collectInputs();
  if (!baseItems.length) {
    alert('Please enter at least one base prompt item.');
    return;
  }
  const shuffled = baseItems.slice().sort(() => Math.random() - 0.5);
  const result = buildVersions(shuffled, descs, negs, mode);
  displayOutput(result);
});
