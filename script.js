const DEFAULT_NEGATIVE_MODIFIERS = ["not", "no", "un-"];
const RAW_DEFAULT_DESCS = `Horrorcore, Rockabilly, Soundtrack, kid's, children's, Christmas, holiday, jingle, oldies, Teen, Vocaloid, idol, K-Pop, mandarin, LGBT, Swing, Country, Anime, Black Metal, Straight Edge, Psychobilly, mediocre, Parody, humorous, Comedy, Reggaetón, Drill, Future Bass, Big Room House, Dubstep, Bounce, Hardstyle, Trance, Jersey Club, Footwork, Chiptune, Psytrance, Moombahton, Riddim Dubstep, Tech-House, Phonk, Electro-swing, Cumbia, Tango, Bossa Nova, Samba, Dancehall, Bhangra, Disco, Polka, Vaporwave, Minimal Techno, Blues, Sea Shanty, Lo-fi Hip-Hop, Synthwave, K-pop`;
const DEFAULT_DESCRIPTORS = RAW_DEFAULT_DESCS.split(',').map(d => d.trim()).filter(Boolean);
const RAW_IMAGE_BAD_LIST = `worst quality, normal quality, low quality, low res, old, oldest, blurry, distortion, extra digits, cropped, jpeg artifacts, grainy, pixelated, sketch, error, duplicate, ugly, monochrome, horror, geometry, disgusting, mutation, bad anatomy, bad proportions, bad quality, deformed, disconnected limbs, out of frame, out of focus, dehydrated, disfigured, extra arms, extra limbs, extra hands, fused fingers, gross proportions, long neck, malformed limbs, mutated, mutated hands, mutated limbs, missing arms, missing legs, missing hand, missing fingers, poorly drawn face, poorly drawn hands, poorly drawn feet, bad face, bad hands, ugly face, asymmetrical, fused face, double face, worst face, worst quality, worst face, worst feet, worst thigh, three hands, three legs, three feet, three thigh, three crus, extra crus, fused crus, extra legs, extra fingers, extra toes, extra crus, extra thigh, fused feet, fused thigh, fused crus, fused hands, fused toes, too many fingers, too many toes, long fingers, oversized eyes, huge eyes, extra eyes, cross-eyed, imperfect eyes, bad eyes, day-glo, high CFG artifact, bad illustration, bad composition, malformed, misshapen, disproportioned, gross proportions, mutated body parts, deformed body features, dismembered, amputee, amputation, disfigured, morbid, mutilated, mutation, mutated, mutated hands, mutated limbs, distorted, stretched, conjoined, floating limbs, disconnected limbs, unnatural pose, unnatural, unsightly, unattractive, split image, tiling, duplicated features, cloned face, duplicate, watermark, signature, username, autograph, printed words, text, banner, branding, logo, identifying mark, geometry, script, UI, interface, low resolution, low quality, normal quality, worst quality, jpeg artifacts, color aberration, aberrations, noise, grainy, hazy, blurry, unfocused, underexposed, overexposed, low saturation, oversaturated, harsh lighting, flash, sketch, drawing, abstract, surreal, psychedelic, kitsch, rotten, twisted`;
const IMAGE_BAD_DESCRIPTORS = RAW_IMAGE_BAD_LIST.split(',').map(d => d.trim()).filter(Boolean);
const RAW_POSITIVE_IMAGE_LIST = `masterpiece, best quality, high quality, top quality, highest quality, ultra high quality, very aesthetic, aesthetic, beautiful, beautiful and aesthetic, good, great, best, beautiful, newest, 2023, 2022, 2021, depth of field, DOF, bokeh, 8k, 8k resolution, 8k wallpaper, 4k, 4k resolution, UHD, HD, highres, absurdres, ultra high definition, high definition, detailed, highly detailed, very detailed, extremely detailed, ultra detailed, incredibly detailed, hyper detailed, intricate, intricate details, finely detailed, sharp focus, in focus, focused, detailed shadows, detailed background, detailed clothing, detailed eyes, beautiful eyes, vibrant colors, vivid colors, rich colors, colorful, bright colors, volumetric, god rays, lens flare, bloom, ambient occlusion, official, dynamic, detailed skin, detailed skin texture`;
const DEFAULT_POSITIVE_MODIFIERS = RAW_POSITIVE_IMAGE_LIST.split(",").map(d => d.trim()).filter(Boolean);

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
  getList(document.getElementById('desc-select'), document.getElementById('desc-input'), DEFAULT_DESCRIPTORS);
});

document.getElementById('neg-select').addEventListener('change', () => {
  getList(document.getElementById('neg-select'), document.getElementById('neg-input'), DEFAULT_NEGATIVE_MODIFIERS);
});

document.getElementById('pos-select').addEventListener('change', () => {
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
