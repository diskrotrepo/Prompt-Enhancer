/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { createDom, registerDomCleanup } = require('./helpers/dom');

// Serialization audit: real File Save/Open, every box kind and control family,
// empty documents, and independent prompt palettes. Compare the file contents
// as well as the reopened UI so matching bugs in two helpers cannot hide loss.
const ROOT = path.join(__dirname, '..');

function setupPrompt() {
  const dom = createDom(fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8'), {
    runScripts: 'dangerously', url: 'http://localhost'
  });
  const { window } = dom;
  window.alert = () => {};
  window.prompt = () => 'serialization-audit';
  const downloads = [];
  window.URL.createObjectURL = blob => {
    downloads.push(blob);
    return 'blob:serialization-audit';
  };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = () => {};
  window.eval(fs.readFileSync(path.join(ROOT, 'src', 'script.js'), 'utf8'));
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  const instanceId = window.PromptMixer.openWindow('prompts');
  const win = window.document.querySelector(`.app-window[data-instance="${instanceId}"]`);
  return { window, win, root: win.querySelector('.mix-root'), downloads };
}

// Read the actual download Blob, including the JSON boundary used on disk.
async function saveFile(session) {
  const { window, win, downloads } = session;
  const previousCount = downloads.length;
  win.querySelector('.prompt-menu-item[data-action="save"]').click();
  expect(downloads).toHaveLength(previousCount + 1);
  const text = await new Promise((resolve, reject) => {
    const reader = new window.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(downloads[downloads.length - 1]);
  });
  return JSON.parse(text);
}

// Feed a real File through the existing Open/append input; wait for its reader.
async function openFile(session, state, append = false) {
  const { window, win } = session;
  const NativeFileReader = window.FileReader;
  try {
    await new Promise((resolve, reject) => {
      window.FileReader = class extends NativeFileReader {
        constructor() {
          super();
          this.addEventListener('loadend', resolve);
          this.addEventListener('error', reject);
        }
      };
      const input = win.querySelector(append ? '.append-save-file' : '.load-mix-file');
      if (append) win.querySelector('.add-root-save').click();
      else win.querySelector('.prompt-menu-item[data-action="open"]').click();
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new window.File([JSON.stringify(state)], 'roundtrip.json', { type: 'application/json' })]
      });
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
  } finally {
    window.FileReader = NativeFileReader;
  }
}

function setControl(session, boxId, selector, value) {
  const field = session.root.querySelector(`[data-box-id="${boxId}"] ${selector}`);
  field.value = value;
  const eventType = field.tagName === 'SELECT' ? 'change' : 'input';
  field.dispatchEvent(new session.window.Event(eventType, { bubbles: true }));
}

// Repeatable random generation proves that saved settings retain their meaning,
// while arbitrary cached Output text is deliberately not part of the file schema.
function generateOutputs(session) {
  let seed = 73;
  session.window.Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  session.win.querySelector('.generate-button').click();
  return Array.from(session.root.querySelectorAll('.mix-output-text, .chunk-output-text'))
    .map(output => output.textContent);
}

describe('Mix state serialization', () => {
  test('Save/Open retains root and nested variables, forward references, order, and collapse state', async () => {
    const session = setupPrompt();
    const state = {
      mixes: [
        { type: 'variable', id: 'root-ref', targetId: 'source', collapsed: true },
        { type: 'mix', id: 'host', preserve: true, children: [
          { type: 'variable', id: 'nested-ref', targetId: 'source', collapsed: true },
          { type: 'mix', id: 'nested', preserve: true, children: [
            { type: 'chunk', id: 'source', text: 'a b ', delimiter: { mode: 'whitespace', size: 1 } }
          ] }
        ] }
      ]
    };
    // Add Save already accepts root variables; saving that tree must not omit them.
    session.window.PromptMixer.applyMixState({ mixes: [] }, session.root);
    await openFile(session, state, true);
    const saved = await saveFile(session);
    expect(saved).toMatchObject(state);
    expect(saved.mixes.map(box => box.type)).toEqual(['variable', 'mix']);
    const before = generateOutputs(session);
    await openFile(session, saved);
    expect(await saveFile(session)).toEqual(saved);
    expect(generateOutputs(session)).toEqual(before);
    session.root.querySelectorAll('.variable-box').forEach(box => {
      expect(box.querySelector('.variable-select').value).toBe('source');
      expect(box.classList.contains('is-collapsed')).toBe(true);
      expect(box.querySelector('.collapse-toggle').getAttribute('aria-label')).toBe('Expand variable');
    });
  });

  test('an intentionally empty prompt stays empty on Open and appends no phantom mix', async () => {
    const session = setupPrompt();
    session.root.querySelector('.remove-box').click();
    const empty = await saveFile(session);
    expect(empty.mixes).toEqual([]);
    await openFile(session, empty);
    expect(session.root.children).toHaveLength(0);
    session.win.querySelector('.add-empty-mix').click();
    const before = await saveFile(session);
    await openFile(session, empty, true);
    expect(await saveFile(session)).toEqual(before);
  });

  test('blank mix/string titles and literal multiline text survive the file boundary', async () => {
    const session = setupPrompt();
    session.window.PromptMixer.applyMixState({ mixes: [
      { type: 'mix', id: 'host', children: [{ type: 'chunk', id: 'text', text: '  α\t"quoted" \\n\n🙂  ' }] }
    ] }, session.root);
    setControl(session, 'host', '.box-title', '');
    setControl(session, 'text', '.box-title', '');
    const saved = await saveFile(session);
    expect(saved.mixes[0].title).toBe('');
    expect(saved.mixes[0].children[0]).toMatchObject({ title: '', text: '  α\t"quoted" \\n\n🙂  ' });
    await openFile(session, saved);
    expect(session.root.querySelectorAll('.box-title')[0].value).toBe('');
    expect(await saveFile(session)).toEqual(saved);
  });

  test('Preserve and empty-string locks retain inactive size, delimiter, and first-chunk settings', async () => {
    const session = setupPrompt();
    session.window.PromptMixer.applyMixState({ mixes: [
      { type: 'mix', id: 'host', preserve: false, firstChunkBehavior: 'random-start',
        delimiter: { mode: 'custom-any', custom: '|,', size: 23 }, children: [
          { type: 'chunk', id: 'text', text: '', firstChunkBehavior: 'between',
            delimiter: { mode: 'custom-all', custom: '||\\n', size: 17 } }
        ] }
    ] }, session.root);
    setControl(session, 'host', '.delimiter-size', 'preserve');
    const saved = await saveFile(session);
    expect(saved.mixes[0]).toMatchObject({ preserve: true, firstChunkBehavior: 'random-start',
      delimiter: { mode: 'custom-any', custom: '|,', size: 23 } });
    await openFile(session, saved);
    expect(await saveFile(session)).toEqual(saved);
    setControl(session, 'host', '.delimiter-size', 'custom');
    expect(session.root.querySelector('.delimiter-size-custom').value).toBe('23');
    expect(session.root.querySelector('.first-chunk-select').value).toBe('random-start');
    setControl(session, 'text', '.chunk-input', 'a||\nb||\n');
    expect(session.root.querySelector('.chunk-box .delimiter-select').value).toBe('custom-all');
    expect(session.root.querySelector('.chunk-box .delimiter-size-custom').value).toBe('17');
  });

  test('custom preset definitions belong to the saved prompt even after another window opens', async () => {
    const session = setupPrompt();
    const state = {
      colorPresets: [{ id: 'storm', name: 'Storm', color: '#445566' },
        { id: 'unused', name: 'Unused', color: '#778899' }],
      mixes: [{ type: 'chunk', id: 'source', text: 'colors', colorMode: 'preset', colorPreset: 'storm' }]
    };
    session.window.PromptMixer.applyMixState(state, session.root);
    const saved = await saveFile(session);
    const secondId = session.window.PromptMixer.openWindow('prompts');
    const second = session.window.document.querySelector(`.app-window[data-instance="${secondId}"]`);
    session.window.PromptMixer.applyMixState({ colorPresets: [
      { id: 'storm', name: 'Storm', color: '#aabbcc' }
    ], mixes: [] }, second.querySelector('.mix-root'));
    expect(await saveFile(session)).toEqual(saved);
    await openFile(session, saved);
    expect(session.root.querySelector('.chunk-box').dataset.colorValue).toBe('#445566');
    expect(session.window.PromptMixer.exportMixState(second.querySelector('.mix-root')).colorPresets)
      .toEqual([{ id: 'storm', name: 'Storm', color: '#aabbcc' }]);
  });

  test('imported palette ids survive labels and collisions without recoloring existing boxes', async () => {
    const session = setupPrompt();
    session.window.PromptMixer.applyMixState({ colorPresets: [
      { id: 'brand-v1', name: 'Renamed Brand', color: '#123456' }
    ], mixes: [{ type: 'chunk', id: 'existing', text: 'old', colorMode: 'preset', colorPreset: 'brand-v1' }] }, session.root);
    expect(session.root.querySelector('.chunk-box').dataset.colorValue).toBe('#123456');
    await openFile(session, { colorPresets: [
      { id: 'brand-v1', name: 'Renamed Brand', color: '#abcdef' }
    ], mixes: [{ type: 'chunk', id: 'imported', text: 'new', colorMode: 'preset', colorPreset: 'brand-v1' }] }, true);
    const saved = await saveFile(session);
    expect(saved.colorPresets).toHaveLength(2);
    expect(saved.mixes.map(box => box.colorValue)).toEqual(['#123456', '#abcdef']);
    expect(new Set(saved.mixes.map(box => box.colorPreset)).size).toBe(2);
    await openFile(session, saved);
    expect(await saveFile(session)).toEqual(saved);
  });

  test('named preset edits reach every linked box and keep built-in imports distinct', async () => {
    const session = setupPrompt();
    session.window.PromptMixer.applyMixState({ mixes: [
      { type: 'chunk', id: 'first', text: 'one', colorMode: 'preset', colorPreset: 'sunset' },
      { type: 'chunk', id: 'second', text: 'two', colorMode: 'preset', colorPreset: 'sunset' }
    ] }, session.root);
    const defaultColor = session.root.querySelector('.chunk-box').dataset.colorValue;
    setControl(session, 'first', '.color-custom-input', '#123456');
    setControl(session, 'first', '.color-preset-name', 'Sunset');
    session.root.querySelector('.save-color-preset').click();
    expect(Array.from(session.root.querySelectorAll('.chunk-box')).map(box => box.dataset.colorValue))
      .toEqual(['#123456', '#123456']);
    await openFile(session, { mixes: [{ type: 'mix', id: 'imported', preserve: true, children: [
      { type: 'chunk', id: 'builtin', text: 'three', colorMode: 'preset', colorPreset: 'sunset' }
    ] }] }, true);
    const saved = await saveFile(session);
    expect(saved.mixes[2].children[0].colorValue).toBe(defaultColor);
    expect(saved.mixes[2].children[0].colorPreset).not.toBe('sunset');
    await openFile(session, saved);
    expect(await saveFile(session)).toEqual(saved);
  });

  test('all control families remain stable over repeated edit/generate/Save/Open cycles', async () => {
    const session = setupPrompt();
    const mixModes = ['exact', 'allow', 'fit-smallest', 'fit-largest', 'dropout', 'proportional-dropout'];
    const chunkModes = ['exact', 'allow', 'exact-once', 'dropout'];
    const delimiters = ['whitespace', 'comma', 'semicolon', 'pipe', 'newline', 'tab', 'sentence', 'custom-all', 'custom-any'];
    const state = { colorPresets: [{ id: 'audit', name: 'Audit', color: '#456789' }], mixes: delimiters.map((mode, index) => ({
      type: 'mix', id: `mix-${index}`, title: `Mix ${index}`, limit: 29 + index,
      lengthMode: mixModes[index % mixModes.length], preserve: index % 2 === 0,
      orderMode: ['canonical', 'randomize-interleave', 'full-randomize'][index % 3],
      firstChunkBehavior: ['size', 'between', 'random-start'][index % 3],
      color: String(index % 6 + 1), colorMode: 'preset', colorPreset: 'audit', collapsed: index % 2 === 0,
      delimiter: { mode, custom: mode.startsWith('custom') ? ',|' : '', size: index + 13 },
      children: [{ type: 'chunk', id: `text-${index}`, title: `String ${index}`, text: 'a b,c;d|e\nf\tg. ',
        limit: 19 + index, lengthMode: chunkModes[index % chunkModes.length],
        orderMode: index % 2 ? 'full-randomize' : 'canonical',
        firstChunkBehavior: ['random-start', 'size', 'between'][index % 3],
        color: String(index % 6 + 1), colorMode: 'custom', colorValue: '#654321', collapsed: index % 2 !== 0,
        delimiter: { mode, custom: mode.startsWith('custom') ? ',|' : '', size: index % 2 ? 13 : 2 }
      }]
    })) };
    session.window.PromptMixer.applyMixState(state, session.root);
    expect(await saveFile(session)).toMatchObject(state);
    let actionSeed = 17;
    const chooseIndex = () => {
      actionSeed = (Math.imul(actionSeed, 1664525) + 1013904223) >>> 0;
      return actionSeed % delimiters.length;
    };
    for (let cycle = 0; cycle < 3; cycle += 1) {
      // Seeded random edits simulate sessions while leaving failures reproducible.
      setControl(session, `text-${chooseIndex()}`, '.chunk-input', `round ${cycle}\nwith whitespace  `);
      setControl(session, `mix-${chooseIndex()}`, '.length-input', String(21 + cycle));
      const output = generateOutputs(session);
      const saved = await saveFile(session);
      await openFile(session, saved);
      expect(await saveFile(session)).toEqual(saved);
      expect(generateOutputs(session)).toEqual(output);
    }
  });
});

registerDomCleanup();
