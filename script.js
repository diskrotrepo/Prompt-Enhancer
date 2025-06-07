const DEFAULT_NEGATIVE_MODIFIERS = ["not", "no", "un-"];
const RAW_DEFAULT_DESCS = `Horrorcore, Rockabilly, Soundtrack, kid's, children's, Christmas, holiday, jingle, oldies, Teen, Vocaloid, idol, K-Pop, mandarin, LGBT, Swing, Country, Anime, Black Metal, Straight Edge, Psychobilly, mediocre, Parody, humorous, Comedy, Reggaetón, Drill, Future Bass, Big Room House, Dubstep, Bounce, Hardstyle, Trance, Jersey Club, Footwork, Chiptune, Psytrance, Moombahton, Riddim Dubstep, Tech-House, Phonk, Electro-swing, Cumbia, Tango, Bossa Nova, Samba, Dancehall, Bhangra, Disco, Polka, Vaporwave, Minimal Techno, Blues, Sea Shanty, Lo-fi Hip-Hop, Synthwave, K-pop`;
const DEFAULT_DESCRIPTORS = RAW_DEFAULT_DESCS.split(',').map(d => d.trim()).filter(Boolean);
const RAW_IMAGE_BAD_LIST = `worst quality, normal quality, low quality, low res, old, oldest, blurry, distortion, extra digits, cropped, jpeg artifacts, grainy, pixelated, sketch, error, duplicate, ugly, monochrome, horror, geometry, disgusting, mutation, bad anatomy, bad proportions, bad quality, deformed, disconnected limbs, out of frame, out of focus, dehydrated, disfigured, extra arms, extra limbs, extra hands, fused fingers, gross proportions, long neck, malformed limbs, mutated, mutated hands, mutated limbs, missing arms, missing legs, missing hand, missing fingers, poorly drawn face, poorly drawn hands, poorly drawn feet, bad face, bad hands, ugly face, asymmetrical, fused face, double face, worst face, worst quality, worst face, worst feet, worst thigh, three hands, three legs, three feet, three thigh, three crus, extra crus, fused crus, extra legs, extra fingers, extra toes, extra crus, extra thigh, fused feet, fused thigh, fused crus, fused hands, fused toes, too many fingers, too many toes, long fingers, oversized eyes, huge eyes, extra eyes, cross-eyed, imperfect eyes, bad eyes, day-glo, high CFG artifact, bad illustration, bad composition, malformed, misshapen, disproportioned, gross proportions, mutated body parts, deformed body features, dismembered, amputee, amputation, disfigured, morbid, mutilated, mutation, mutated, mutated hands, mutated limbs, distorted, stretched, conjoined, floating limbs, disconnected limbs, unnatural pose, unnatural, unsightly, unattractive, split image, tiling, duplicated features, cloned face, duplicate, watermark, signature, username, autograph, printed words, text, banner, branding, logo, identifying mark, geometry, script, UI, interface, low resolution, low quality, normal quality, worst quality, jpeg artifacts, color aberration, aberrations, noise, grainy, hazy, blurry, unfocused, underexposed, overexposed, low saturation, oversaturated, harsh lighting, flash, sketch, drawing, abstract, surreal, psychedelic, kitsch, rotten, twisted`;
const IMAGE_BAD_DESCRIPTORS = RAW_IMAGE_BAD_LIST.split(',').map(d => d.trim()).filter(Boolean);

function parseInput(raw) {
  if (!raw) return [];
  const normalized = raw.replace(/;/g, ',').replace(/\s*,\s*/g, ',');
  return normalized.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
}

function generateNegatedList(items, negs) {
  if (!negs.length) return [];
  const result = [];
  for (const neg of negs) {
    for (const item of items) {
      result.push(`${neg} ${item}`);
    }
  }
  return result;
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
