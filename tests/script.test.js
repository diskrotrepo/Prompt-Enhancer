/** @jest-environment jsdom */
/**
 * Integration tests for the monolithic script.
 * These run in a jsdom environment so DOM manipulations can be exercised.
 */

global.__TEST__ = true;
if (typeof window !== 'undefined') {
  window.__TEST__ = true;
}

const main = require("../src/script");
const utils = main;
const lists = main;
const ui = main;

const {
  parseInput,
  shuffle,
  equalizeLength,
  buildVersions,
  processLyrics,
  parseOrderInput,
  applyOrder,
  insertAtDepth,
  countWords,
  buildOrderIndices,
  buildDepthValues,
  computeDepthCountsFrom
} = utils;

const { exportLists, importLists, saveList, deleteList } = lists;

const {
  setupShuffleAll,
  setupStackControls,
  setupHideToggles,
  setupToggleButtons,
  applyAllHideState,
  applyPreset,
  setupRerollButton,
  setupAdvancedToggle,
  updateStackBlocks,
  setupSectionOrder,
  setupSectionHide,
  setupSectionAdvanced,
  setupPresetListener
} = ui;

describe('Utility functions', () => {
  test('parseInput splits on whitespace by default', () => {
    const input = 'a, b; c\nd';
    expect(parseInput(input)).toEqual(['a, ', 'b; ', 'c\n', 'd']);
  });

  test('parseInput splits on a custom delimiter', () => {
    const input = 'a| b |c|d';
    expect(parseInput(input, false, '|')).toEqual(['a|', ' b |', 'c|', 'd']);
  });

  test('parseInput groups chunks by size', () => {
    expect(parseInput('a,b,c,d', false, /,/, 2)).toEqual(['a,b,', 'c,d']);
  });

  test('parseInput preserves delimiters when requested', () => {
    const input = 'a, b. c';
    expect(parseInput(input, true)).toEqual(['a,', ' b.', ' c']);
  });

  test('parseInput handles multiple delimiters together', () => {
    const input = 'a,,. b';
    expect(parseInput(input, true)).toEqual(['a,,.', ' b']);
  });

  test('parseInput returns empty array for empty input', () => {
    expect(parseInput('')).toEqual([]);
  });

  test('parseInput leaves undelimited input intact', () => {
    expect(parseInput('abc', true)).toEqual(['abc']);
  });

  test('parseInput preserves consecutive newlines', () => {
    expect(parseInput('a\n\nb', true)).toEqual(['a\n\n', 'b']);
  });

  test('parseInput does not special-case closing brackets', () => {
    const input = 'First (one.) Second.';
    expect(parseInput(input, true)).toEqual(['First (one.', ') Second.']);
  });

  test('shuffle retains all items', () => {
    const arr = [1, 2, 3, 4];
    const result = shuffle(arr.slice());
    expect(result.sort()).toEqual(arr);
  });

  test('equalizeLength trims to shorter array', () => {
    const [a, b] = equalizeLength([1, 2, 3], ['x']);
    expect(a).toEqual([1]);
    expect(b).toEqual(['x']);
  });

  test('countWords counts words ignoring trailing punctuation', () => {
    expect(countWords('foo bar baz.')).toBe(3);
    expect(countWords('   ')).toBe(0);
  });

  test('buildOrderIndices returns null for canonical', () => {
    expect(buildOrderIndices(['a', 'b'], 'canonical')).toBeNull();
  });

  test('buildOrderIndices shuffles indices when random', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0);
    const order = buildOrderIndices(['a', 'b', 'c'], 'random');
    Math.random = orig;
    expect(order).toEqual([1, 2, 0]);
  });

  test('buildDepthValues handles prepend/append/random', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0);
    expect(buildDepthValues('prepend', [2, 3])).toEqual([0, 0]);
    expect(buildDepthValues('append', [2, 3])).toEqual([2, 3]);
    expect(buildDepthValues('random', [2, 3])).toEqual([0, 0]);
    Math.random = orig;
  });

  test('computeDepthCountsFrom includes prior stacks and positives', () => {
    const baseCounts = [2];
    const stacks = [['p1'], ['p2']];
    const posStacks = [['pos']];
    const counts = computeDepthCountsFrom(baseCounts, stacks, 2, true, posStacks);
    expect(counts).toEqual([4]);
  });

  test('parseOrderInput converts to numbers', () => {
    expect(parseOrderInput('1, 2 3')).toEqual([1, 2, 3]);
  });

  test('applyOrder reorders list cycling values', () => {
    const out = applyOrder(['a', 'b', 'c'], [2, 0]);
    expect(out).toEqual(['c', 'a', 'c']);
  });

  test('insertAtDepth inserts term at depth', () => {
    expect(insertAtDepth('a b c', 'x', 1)).toBe('ax b c');
  });

  test('insertAtDepth preserves existing spacing without injecting new spaces', () => {
    expect(insertAtDepth(' a  b ', 'x', 1)).toBe(' ax  b ');
  });

  test('insertAtDepth preserves delimiters without adding whitespace', () => {
    expect(insertAtDepth('a,b,', 'x', 1, ',')).toBe('a,bx,');
  });
});

describe('Prompt building', () => {
  test('buildVersions builds positive and negative prompts', () => {
    const out = buildVersions(['cat'], ['bad'], ['good'], 20);
    expect(out).toEqual({ positive: 'goodcatgoodcat', negative: 'badcatbadcat' });
  });

  test('buildVersions does not inject spaces when chunks are compact', () => {
    const out = buildVersions(['ab'], ['n'], ['x'], 10);
    expect(out).toEqual({ positive: 'xabxabxab', negative: 'nabnabnab' });
  });

  test('buildVersions addendum method appends negatives after positives', () => {
    const out = buildVersions(
      ['cat'],
      ['bad'],
      ['good'],
      20,
      false,
      [],
      true,
      1,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true
    );
    expect(out).toEqual({
      positive: 'goodcatgoodcat',
      negative: 'goodcatgoodcatbadbad'
    });
  });

  test('buildVersions can include positive terms for negatives', () => {
    const out = buildVersions(['cat'], ['bad'], ['good'], 20, true);
    expect(out).toEqual({ positive: 'goodcatgoodcat', negative: 'badgoodcatbadgoodcat' });
  });

  test('buildVersions addendum respects include-positive flag', () => {
    const out = buildVersions(
      ['cat'],
      ['bad'],
      ['good'],
      20,
      true,
      [],
      true,
      1,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true
    );
    expect(out).toEqual({ positive: 'goodcatgoodcat', negative: 'goodcatgoodcatbadbad' });
  });

  test('buildVersions applies negative depth after positives', () => {
    const out = buildVersions(['cat'], ['bad'], ['good'], 20, true, [], true, 1, 1, [1], [2]);
    expect(out).toEqual({ positive: 'catgoodcatgood', negative: 'badcatgoodbadcatgood' });
  });

  test('buildVersions respects depth arrays per stack', () => {
    const out = buildVersions(
      ['a b c'],
      ['n'],
      [['x'], ['y']],
      15,
      false,
      [],
      true,
      2,
      1,
      [[1], [2]],
      [1]
    );
    expect(out).toEqual({ positive: 'ax b cyax b cy', negative: 'an b can b c' });
  });

  test('negative depth accounts for stacked positives', () => {
    const out = buildVersions(
      ['foo bar baz'],
      ['bad'],
      [['good'], ['great']],
      40,
      true,
      [],
      true,
      2,
      1,
      [1],
      [5]
    );
    expect(out).toEqual({ positive: 'foogood bargreat baz', negative: 'foogoodbad bargreat baz' });
  });

  test('append depths derived from computeDepthCounts place negatives last', () => {
    const out = buildVersions(
      ['foo bar'],
      ['bad'],
      ['good'],
      50,
      true,
      [],
      true,
      1,
      1,
      [2],
      [3]
    );
    expect(out).toEqual({
      positive: 'foo bargoodfoo bargoodfoo bargood',
      negative: 'badfoo bargoodbadfoo bargoodbadfoo bargood'
    });
  });

  test('negative depth uses independent values', () => {
    const out = buildVersions(
      ['a b'],
      ['neg'],
      ['pos'],
      20,
      true,
      [],
      true,
      1,
      1,
      [0],
      [3]
    );
    expect(out).toEqual({ positive: 'posa bposa b', negative: 'negposa bnegposa b' });
  });

  test('stacked modifiers handle prepend and append depths', () => {
    const out = buildVersions(
      ['foo bar'],
      ['n'],
      [['pre'], ['post']],
      50,
      false,
      [],
      true,
      2,
      1,
      [[0], [2]],
      [0]
    );
    expect(out).toEqual({
      positive: 'postprefoo barpostprefoo barpostprefoo bar',
      negative: 'nfoo barnfoo barnfoo bar'
    });
  });

  test('buildVersions returns empty strings when items list is empty', () => {
    const out = buildVersions([], ['n'], ['p'], 10);
    expect(out).toEqual({ positive: '', negative: '' });
  });

  test('buildVersions respects very small limits', () => {
    const out = buildVersions(['hello'], ['n'], ['p'], 2);
    expect(out).toEqual({ positive: '', negative: '' });
  });

  test('buildVersions concatenates chunked items without inserting commas', () => {
    const out = buildVersions(['a.\n', 'b.\n'], ['n'], ['p'], 30);
    expect(out.positive.includes(',')).toBe(false);
    expect(out.negative.includes(',')).toBe(false);
    expect(out.positive.startsWith('pa.\n')).toBe(true);
    expect(out.positive.endsWith('\n')).toBe(true);
  });

  test('buildVersions inserts dividers when provided', () => {
    const out = buildVersions(
      ['a', 'b'],
      [],
      [],
      50,
      false,
      ['i.e., '],
      true
    );
    expect(out.positive.includes('i.e.,')).toBe(true);
    expect(out.positive.startsWith('abi.e., a')).toBe(true);
  });

  test('buildVersions reuses divider order for negatives', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0.99);
    const out = buildVersions(
      ['a', 'b'],
      [],
      [],
      50,
      false,
      ['x ', 'y ']
    );
    Math.random = orig;
    const posDivs = out.positive.match(/[xy] /g);
    const negDivs = out.negative.match(/[xy] /g);
    expect(posDivs.slice(0, 4)).toEqual(['x ', 'y ', 'x ', 'y ']);
    expect(negDivs).toEqual(posDivs);
  });

  test('buildVersions places dividers on new lines', () => {
    const out = buildVersions(
      ['a', 'b'],
      [],
      [],
      50,
      false,
      ['\nfoo ']
    );
    expect(out.positive).toContain('\nfoo ');
    expect(out.positive.startsWith('ab')).toBe(true);
  });

  test('buildVersions supports modifier stacking', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0.999999);
    const out = buildVersions(
      ['x'],
      ['n1', 'n2'],
      ['p1', 'p2'],
      10,
      false,
      [],
      true,
      2,
      2
    );
    Math.random = orig;
    expect(out).toEqual({ positive: 'p1xp1p2xp2', negative: 'n1xn1n2xn2' });
  });

  test('buildVersions applies separate orders per stack', () => {
    const out = buildVersions(
      ['x'],
      ['n1', 'n2'],
      ['p1', 'p2'],
      20,
      false,
      [],
      true,
      2,
      2,
      null,
      null,
      null,
      [[0, 1], [1, 0]],
      [[1, 0], [0, 1]]
    );
    expect(out.positive).toBe('p1xp2p2xp1p1xp2p2xp1');
    expect(out.negative).toBe('n2xn1n1xn2n2xn1n1xn2');
  });

  test('buildVersions accepts different lists per stack', () => {
    const out = buildVersions(
      ['x'],
      [['n1'], ['n2']],
      [['p1'], ['p2']],
      20,
      false,
      [],
      true,
      2,
      2
    );
    expect(out.positive).toBe('p1xp2p1xp2p1xp2p1xp2');
    expect(out.negative).toBe('n1xn2n1xn2n1xn2n1xn2');
  });

  test('stacking works with natural dividers', () => {
    const out = buildVersions(
      ['a', 'b'],
      ['n1'],
      ['p1'],
      100,
      false,
      ['\nfoo '],
      2,
      2
    );
    expect(out.positive).toContain('\nfoo ');
    expect(out.negative).toContain('\nfoo ');
  });

  test('negative preserves divider placement when built on positives', () => {
    const out = buildVersions(
      ['cat'],
      ['bad'],
      ['good'],
      50,
      true,
      ['\nfoo ']
    );
    expect(out.positive).toBe('goodcat\nfoo goodcat\nfoo goodcat\nfoo ');
    expect(out.negative).toBe('badgoodcat\nfoo badgoodcat\nfoo badgoodcat\nfoo ');
  });

  test('random base order keeps negatives aligned', () => {
    const out = buildVersions(
      ['a', 'b'],
      ['n'],
      ['p'],
      50,
      true,
      ['\nfoo '],
      true,
      1,
      1,
      null,
      null,
      null,
      [1, 0]
    );
    const expectedNeg = out.positive.replace(/p/g, 'np');
    expect(out.negative).toBe(expectedNeg);
  });

  // Complex multi-stack scenario combining Unicode and nested punctuation
  test('buildVersions handles unicode and parentheses in multi-stack prompts', () => {
    const items = parseInput('First (one.) Second.', true);
    const out = buildVersions(
      items,
      ['מינוס'],
      [['פלוס'], ['加']],
      50,
      true,
      [],
      true,
      2,
      1,
      [[1], [2]],
      [3]
    );
    expect(out).toEqual({
      positive: '加Firstפלוס (one.加)פלוס Second.',
      negative: 'מינוס加Firstפלוס (one.מינוס加)פלוס Second.'
    });
  });
});

describe('End-to-end generation', () => {
  test('generate concatenates divider chunks without intersection', () => {
    document.body.innerHTML = `
      <select id="base-delimiter-select"><option value="whitespace" selected>w</option></select>
      <select id="pos-delimiter-select"><option value="whitespace" selected>w</option></select>
      <select id="neg-delimiter-select"><option value="whitespace" selected>w</option></select>
      <select id="divider-delimiter-select"><option value="whitespace" selected>w</option></select>
      <textarea id="base-input">A </textarea>
      <textarea id="pos-input">P</textarea>
      <textarea id="neg-input">N</textarea>
      <textarea id="divider-input">D </textarea>
      <input type="checkbox" id="pos-stack">
      <input type="checkbox" id="neg-stack">
      <input type="checkbox" id="neg-include-pos">
      <input type="checkbox" id="neg-addendum">
      <input type="checkbox" id="divider-shuffle">
      <select id="base-order-select"><option value="canonical" selected>c</option><option value="random">r</option></select>
      <select id="pos-order-select"><option value="canonical" selected>c</option><option value="random">r</option></select>
      <select id="neg-order-select"><option value="canonical" selected>c</option><option value="random">r</option></select>
      <input id="length-input" value="10">
      <pre id="positive-output"></pre>
      <pre id="negative-output"></pre>
    `;
    global.alert = jest.fn();
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0);
    ui.generate();
    Math.random = orig;
    expect(document.getElementById('positive-output').textContent).toBe('PA D PA ');
    expect(document.getElementById('negative-output').textContent).toBe('NA D NA ');
  });
});

describe('Lyrics processing', () => {
  test('processLyrics normalizes text with max 1 space', () => {
    const input = 'Hello, WORLD!\nThis is? a TEST.';
    const out = processLyrics(input, 1);
    expect(out).toBe('hello world this is a test');
  });

  test('processLyrics keeps parenthetical content by default', () => {
    const input = 'keep (this) text';
    const out = processLyrics(input, 1);
    expect(out).toBe('keep (this) text');
  });

  test('processLyrics keeps bracketed content by default', () => {
    const input = 'a [b] c {d} <e>';
    const out = processLyrics(input, 1);
    expect(out).toBe('a [b] c {d} <e>');
  });

  // Unicode characters like Hebrew and Chinese should survive normalization
  test('processLyrics preserves non-English letters', () => {
    const input = 'שלום 你好 world';
    const out = processLyrics(input, 1);
    expect(out).toBe('שלום 你好 world');
  });

  test('processLyrics retains apostrophes in contractions', () => {
    const input = "We'd we're we’re can't";
    const out = processLyrics(input, 1);
    expect(out).toBe("we'd we're we’re can't");
  });

  test('processLyrics inserts random spaces up to max', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0.9);
    const out = processLyrics('a b', 3);
    Math.random = orig;
    expect(out).toBe('a   b');
  });

  test('processLyrics handles up to 10 spaces', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0.9);
    const out = processLyrics('a b', 10);
    Math.random = orig;
    expect(out).toBe('a          b');
  });

  test('processLyrics removes parenthetical content when requested', () => {
    const input = 'hello (remove me) world';
    const out = processLyrics(input, 1, true, false);
    expect(out).toBe('hello world');
  });

  test('processLyrics removes bracketed content when requested', () => {
    const input = 'alpha [beta] gamma {delta} <epsilon>';
    const out = processLyrics(input, 1, false, true);
    expect(out).toBe('alpha gamma');
  });

  test('processLyrics inserts terms at intervals', () => {
    const out = processLyrics('a b c d', 1, false, false, ['x'], 2, 1);
    expect(out).toBe('a b [x] c d');
  });

  test('processLyrics stacks multiple insertions', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0);
    const out = processLyrics('a b c d', 1, false, false, ['x','y'], 2, 2);
    Math.random = orig;
    expect(out).toBe('a b [y x] c d');
  });

  test('processLyrics randomizes insertion positions around mean', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0);
    const out = processLyrics('a b c d e f', 1, false, false, ['x'], 2, 1, true);
    Math.random = orig;
    expect(out).toBe('a b [x] c [x] d [x] e f');
  });
});

describe('UI interactions', () => {
  test('order all toggles dropdown values', () => {
    document.body.innerHTML = `
      <select id="base-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="neg-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <input type="checkbox" id="all-random">
      <button class="toggle-button" data-target="all-random"></button>
    `;
    setupShuffleAll();
    const cb = document.getElementById('all-random');
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    expect(document.getElementById('base-order-select').value).toBe('random');
    expect(document.getElementById('pos-order-select').value).toBe('random');
    expect(document.getElementById('neg-order-select').value).toBe('random');
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    expect(document.getElementById('base-order-select').value).toBe('canonical');
  });

  test('order all also affects stacked dropdowns', () => {
    document.body.innerHTML = `
      <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="pos-order-select-2"><option value="canonical">c</option><option value="random">r</option></select>
      <input type="checkbox" id="all-random">
      <button class="toggle-button" data-target="all-random"></button>
    `;
    setupShuffleAll();
    const cb = document.getElementById('all-random');
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-order-select').value).toBe('random');
    expect(document.getElementById('pos-order-select-2').value).toBe('random');
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-order-select').value).toBe('canonical');
    expect(document.getElementById('pos-order-select-2').value).toBe('canonical');
  });

  test('hide toggle does not hide sibling buttons', () => {
    document.body.innerHTML = `
      <div class="input-row">
        <textarea id="txt"></textarea>
        <div class="button-col">
          <input type="checkbox" id="hide" data-targets="txt" hidden>
          <button class="toggle-button" data-target="hide"></button>
          <button class="copy-button">c</button>
        </div>
      </div>
    `;
    setupHideToggles();
    const cb = document.getElementById('hide');
    const txt = document.getElementById('txt');
    const copy = document.querySelector('.copy-button');
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    expect(txt.style.display).toBe('none');
    expect(copy.style.display).toBe('');
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    expect(txt.style.display).toBe('');
  });

  test('reroll button toggles order mode for its stack', () => {
    document.body.innerHTML = `<select id="pos-order-select">
          <option value="canonical">c</option>
          <option value="random">r</option>
        </select>
      <button id="pos-reroll-1" class="random-button"></button>
    `;
    setupRerollButton('pos-reroll-1', 'pos-order-select');
    document.getElementById('pos-reroll-1').click();
    expect(document.getElementById('pos-order-select').value).toBe('random');
    document.getElementById('pos-reroll-1').click();
    expect(document.getElementById('pos-order-select').value).toBe('canonical');
  });
});

describe('List persistence', () => {
  test('exportLists and importLists round trip', () => {
    importLists({ presets: [{ id: 'x', title: 'x', type: 'positive', items: '1' }] });
    const json = exportLists();
    importLists(JSON.parse(json));
    const again = exportLists();
    expect(again).toBe(json);
  });

  test('saveList updates LISTS', () => {
    document.body.innerHTML = `
      <select id="pos-select"></select>
      <textarea id="pos-input">a,b</textarea>
    `;
    importLists({ presets: [] });
    global.prompt = jest.fn().mockReturnValue('myPos');
    saveList('positive');
    const data = JSON.parse(exportLists());
    const preset = data.presets.find(p => p.id === 'myPos' && p.type === 'positive');
    expect(preset.items).toBe('a,b');
    const opt = document.querySelector('#pos-select option[value="myPos"]');
    expect(opt).not.toBeNull();
  });

  test('saveList works for dividers', () => {
    document.body.innerHTML = `
      <select id="divider-select"></select>
      <textarea id="divider-input">foo\nbar</textarea>
    `;
    importLists({ presets: [] });
    global.prompt = jest.fn().mockReturnValue('div1');
    saveList('divider');
    const data = JSON.parse(exportLists());
    const preset = data.presets.find(p => p.id === 'div1' && p.type === 'divider');
    expect(preset.items).toBe('foo\nbar');
    const opt = document.querySelector('#divider-select option[value="div1"]');
    expect(opt).not.toBeNull();
  });

  test('saveList works for base', () => {
    document.body.innerHTML = `
      <select id="base-select"></select>
      <textarea id="base-input">foo,bar</textarea>
    `;
    importLists({ presets: [] });
    global.prompt = jest.fn().mockReturnValue('b1');
    saveList('base');
    const data = JSON.parse(exportLists());
    const preset = data.presets.find(p => p.id === 'b1' && p.type === 'base');
    expect(preset.items).toBe('foo,bar');
    const opt = document.querySelector('#base-select option[value="b1"]');
    expect(opt).not.toBeNull();
  });

  test('saveList works for lyrics', () => {
    document.body.innerHTML = `
      <select id="lyrics-select"></select>
      <textarea id="lyrics-input">line1\nline2</textarea>
    `;
    importLists({ presets: [] });
    global.prompt = jest.fn().mockReturnValue('ly1');
    saveList('lyrics');
    const data = JSON.parse(exportLists());
    const preset = data.presets.find(p => p.id === 'ly1' && p.type === 'lyrics');
    expect(preset.items).toBe('line1\nline2');
    const opt = document.querySelector('#lyrics-select option[value="ly1"]');
    expect(opt).not.toBeNull();
  });

  test('saveList works for insertions', () => {
    document.body.innerHTML = `
      <select id="lyrics-insert-select"></select>
      <textarea id="lyrics-insert-input">a,b</textarea>
    `;
    importLists({ presets: [] });
    global.prompt = jest.fn().mockReturnValue('ins1');
    saveList('insertion');
    const data = JSON.parse(exportLists());
    const preset = data.presets.find(p => p.id === 'ins1' && p.type === 'insertion');
    expect(preset.items).toBe('a,b');
    const opt = document.querySelector('#lyrics-insert-select option[value="ins1"]');
    expect(opt).not.toBeNull();
  });

  test('saveList inserts new preset alphabetically', () => {
    document.body.innerHTML = `
      <select id="pos-select"></select>
      <textarea id="pos-input">foo,bar</textarea>
    `;
    importLists({
      presets: [
        { id: 'b', title: 'Beta', type: 'positive', items: '' },
        { id: 'd', title: 'Delta', type: 'positive', items: '' }
      ]
    });
    lists.loadLists();
    global.prompt = jest.fn().mockReturnValue('Alpha');
    saveList('positive');
    const titles = Array.from(
      document.querySelectorAll('#pos-select option')
    ).map(o => o.textContent);
    expect(titles).toEqual(['Alpha', 'Beta', 'Delta']);
    expect(document.getElementById('pos-select').value).toBe('Alpha');
  });

  test('deleteList removes preset and option', () => {
    document.body.innerHTML = `
      <select id="pos-select"><option value="foo">foo</option></select>
      <textarea id="pos-input"></textarea>
    `;
    importLists({ presets: [{ id: 'foo', title: 'foo', type: 'positive', items: '1' }] });
    global.confirm = jest.fn(() => true);
    deleteList('positive');
    const data = JSON.parse(exportLists());
    const preset = data.presets.find(p => p.id === 'foo' && p.type === 'positive');
    expect(preset).toBeUndefined();
    const opt = document.querySelector('#pos-select option[value="foo"]');
    expect(opt).toBeNull();
  });

  test('sequential save and reload', () => {
    document.body.innerHTML = `
      <select id="pos-select"></select>
      <textarea id="pos-input"></textarea>
      <select id="base-select"></select>
      <textarea id="base-input"></textarea>
      <select id="neg-select"></select>
      <textarea id="neg-input"></textarea>
      <select id="length-select"></select>
      <input id="length-input">
      <select id="divider-select"></select>
      <textarea id="divider-input"></textarea>
      <select id="lyrics-select"></select>
      <textarea id="lyrics-input"></textarea>
    `;
    importLists({ presets: [] });
    let names = ['p1', 'p2', 'b1', 'n1', 'l1', 'd1', 'ly1'];
    global.prompt = jest.fn(() => names.shift());
    document.getElementById('pos-input').value = 'x';
    saveList('positive');
    document.getElementById('pos-input').value = 'z';
    saveList('positive');
    document.getElementById('base-input').value = 'base';
    saveList('base');
    document.getElementById('neg-input').value = 'y';
    saveList('negative');
    document.getElementById('length-input').value = '5';
    saveList('length');
    document.getElementById('divider-input').value = 'foo';
    saveList('divider');
    document.getElementById('lyrics-input').value = 'lyric';
    saveList('lyrics');

    const exported = JSON.parse(exportLists());
    expect(exported.presets.length).toBe(7);

    document.body.innerHTML = `
      <select id="pos-select"></select>
      <textarea id="pos-input"></textarea>
      <select id="base-select"></select>
      <textarea id="base-input"></textarea>
      <select id="neg-select"></select>
      <textarea id="neg-input"></textarea>
      <select id="length-select"></select>
      <input id="length-input">
      <select id="divider-select"></select>
      <textarea id="divider-input"></textarea>
      <select id="lyrics-select"></select>
      <textarea id="lyrics-input"></textarea>
    `;
    importLists(exported);
    const posSelVals = Array.from(document.querySelectorAll('#pos-select option')).map(o => o.value);
    expect(posSelVals).toEqual(expect.arrayContaining(['p1','p2']));
      const posSelect = document.getElementById('pos-select');
      const posInput = document.getElementById('pos-input');
      posSelect.value = 'p1';
      applyPreset(posSelect, posInput, 'positive');
      expect(posInput.value).toBe('x');
      posSelect.value = 'p2';
      applyPreset(posSelect, posInput, 'positive');
      expect(posInput.value).toBe('z');
      posSelect.value = 'p1';
      applyPreset(posSelect, posInput, 'positive');
      expect(posInput.value).toBe('x');
      const baseSelect = document.getElementById('base-select');
      const baseInput = document.getElementById('base-input');
      baseSelect.value = 'b1';
      applyPreset(baseSelect, baseInput, 'base');
      expect(baseInput.value).toBe('base');
      const divSelect = document.getElementById('divider-select');
      const divInput = document.getElementById('divider-input');
      divSelect.value = 'd1';
      applyPreset(divSelect, divInput, 'divider');
      expect(divInput.value).toBe('foo');
      const lyrSelect = document.getElementById('lyrics-select');
      const lyrInput = document.getElementById('lyrics-input');
      lyrSelect.value = 'ly1';
      applyPreset(lyrSelect, lyrInput, 'lyrics');
      expect(lyrInput.value).toBe('lyric');
  });

  test('importLists additive renames conflicts', () => {
    importLists({
      presets: [
        { id: 'a', title: 'a', type: 'positive', items: '1' },
        { id: 'b', title: 'b', type: 'negative', items: 'x' }
      ]
    });
    importLists(
      {
        presets: [
          { id: 'b', title: 'b', type: 'negative', items: 'y' },
          { id: 'c', title: 'c', type: 'positive', items: '2' }
        ]
      },
      true
    );
    const data = JSON.parse(exportLists());
    const original = data.presets.find(
      p => p.title === 'b' && p.type === 'negative'
    );
    const renamed = data.presets.find(
      p => p.title === 'b (1)' && p.type === 'negative'
    );
    expect(original.items).toBe('x');
    expect(renamed.items).toBe('y');
    expect(
      data.presets.some(p => p.title === 'c' && p.type === 'positive')
    ).toBe(true);
  });

  test('importLists additive keeps different titles separate', () => {
    importLists({ presets: [] });
    importLists({ presets: [{ id: 'a', title: 'a', type: 'positive', items: '1' }] });
    importLists(
      { presets: [{ id: 'a', title: 'b', type: 'positive', items: '2' }] },
      true
    );
    const data = JSON.parse(exportLists());
    const lists = data.presets.filter(p => p.id === 'a' && p.type === 'positive');
    expect(lists.length).toBe(2);
  });

  test('importLists additive treats different orderings as distinct', () => {
    importLists({ presets: [{ id: 'd', title: 'd', type: 'negative', items: 'x, y' }] });
    importLists(
      { presets: [{ id: 'd', title: 'd', type: 'negative', items: 'y, x' }] },
      true
    );
    const data = JSON.parse(exportLists());
    const titles = data.presets
      .filter(p => p.type === 'negative' && p.title.startsWith('d'))
      .map(p => p.title)
      .sort();
    expect(titles).toEqual(['d', 'd (1)']);
  });

  test('importLists additive increments numeric suffix for conflicts', () => {
    importLists({
      presets: [
        { id: 'e', title: 'e', type: 'positive', items: '1' },
        { id: 'e (1)', title: 'e (1)', type: 'positive', items: '2' }
      ]
    });
    importLists(
      { presets: [{ id: 'e', title: 'e', type: 'positive', items: '3' }] },
      true
    );
    const data = JSON.parse(exportLists());
    const names = data.presets
      .filter(p => p.type === 'positive')
      .map(p => p.title)
      .sort();
    expect(names).toEqual(['e', 'e (1)', 'e (2)']);
  });

  test('updateStackBlocks adds buttons for extra stacks', () => {
    document.body.innerHTML = `
      <select id="pos-select"></select>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1"><select id="pos-order-select"></select>
        </div>
      </div>`;
    updateStackBlocks('pos', 2);
    const block = document.getElementById('pos-stack-2');
    expect(block.querySelector('.copy-button')).not.toBeNull();
    expect(block.querySelector('.save-button')).not.toBeNull();
  });

  test('all-hide affects newly created stack blocks', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="all-hide">
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <select id="pos-select"></select>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <div class="label-row">
            <label>Stack 1</label>
            <div class="button-col">
              <input type="checkbox" id="pos-hide-1" data-targets="pos-input" hidden>
              <button type="button" class="toggle-button hide-button" data-target="pos-hide-1" data-on="☰" data-off="✖">☰</button>
            </div>
          </div>
          <div class="input-row"><textarea id="pos-input"></textarea></div><select id="pos-order-select"></select>
        </div>
      </div>`;
    setupStackControls();
    setupHideToggles();
    document.getElementById('all-hide').addEventListener('change', applyAllHideState);
    const allHide = document.getElementById('all-hide');
    allHide.checked = true;
    allHide.dispatchEvent(new Event('change'));
    const posStack = document.getElementById('pos-stack');
    posStack.checked = true;
    posStack.dispatchEvent(new Event('change'));
    const posInput2 = document.getElementById('pos-input-2');
    expect(posInput2.style.display).toBe('none');
    allHide.checked = false;
    allHide.dispatchEvent(new Event('change'));
    expect(posInput2.style.display).toBe('');
  });

  test('section all-hide applies to new stack blocks', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="pos-all-hide">
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <select id="pos-select"></select>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <div class="label-row">
            <label>Stack 1</label>
            <div class="button-col">
              <input type="checkbox" id="pos-hide-1" data-targets="pos-input" hidden>
              <button type="button" class="toggle-button hide-button" data-target="pos-hide-1" data-on="☰" data-off="✖">☰</button>
            </div>
          </div>
          <div class="input-row"><textarea id="pos-input"></textarea></div><select id="pos-order-select"></select>
        </div>
      </div>`;
    setupToggleButtons();
    setupStackControls();
    setupHideToggles();
    setupSectionHide('pos');
    const secHide = document.getElementById('pos-all-hide');
    secHide.checked = true;
    secHide.dispatchEvent(new Event('change'));
    const stackCb = document.getElementById('pos-stack');
    stackCb.checked = true;
    stackCb.dispatchEvent(new Event('change'));
    const posInput2 = document.getElementById('pos-input-2');
    expect(posInput2.style.display).toBe('none');
  });

  test('global hide stays off when section toggled visible before stacking', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="all-hide">
      <button type="button" class="toggle-button" data-target="all-hide" data-on="All hidden" data-off="All visible">All visible</button>
      <input type="checkbox" id="pos-all-hide">
      <button type="button" class="toggle-button" data-target="pos-all-hide" data-on="All hidden" data-off="All visible">All visible</button>
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <select id="pos-select"></select>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <div class="label-row">
            <label>Stack 1</label>
            <div class="button-col">
              <input type="checkbox" id="pos-hide-1" data-targets="pos-input" hidden>
              <button type="button" class="toggle-button hide-button" data-target="pos-hide-1" data-on="☰" data-off="✖">☰</button>
            </div>
          </div>
          <div class="input-row"><textarea id="pos-input"></textarea></div><select id="pos-order-select"></select>
        </div>
      </div>`;
    setupToggleButtons();
    setupStackControls();
    setupHideToggles();
    setupSectionHide('pos');
    const globalHide = document.getElementById('all-hide');
    globalHide.checked = true;
    globalHide.dispatchEvent(new Event('change'));
    const secHide = document.getElementById('pos-all-hide');
    secHide.checked = false;
    secHide.dispatchEvent(new Event('change'));
    expect(globalHide.checked).toBe(false);
    const stackCb = document.getElementById('pos-stack');
    stackCb.checked = true;
    stackCb.dispatchEvent(new Event('change'));
    const posInput2 = document.getElementById('pos-input-2');
    expect(posInput2.style.display).toBe('');
    expect(globalHide.checked).toBe(false);
    const secBtn = document.querySelector('.toggle-button[data-target="pos-all-hide"]');
    expect(secBtn.classList.contains('active')).toBe(false);
  });

  test('hide button works for dynamically added stack blocks', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <select id="pos-select"></select>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <div class="label-row">
            <label>Stack 1</label>
            <div class="button-col">
              <input type="checkbox" id="pos-hide-1" data-targets="pos-input" hidden>
              <button type="button" class="toggle-button hide-button" data-target="pos-hide-1" data-on="☰" data-off="✖">☰</button>
            </div>
          </div>
          <div class="input-row"><textarea id="pos-input"></textarea></div><select id="pos-order-select"></select>
        </div>
      </div>`;
    setupToggleButtons();
    setupStackControls();
    setupHideToggles();
    const cb = document.getElementById('pos-stack');
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    const hideBtn = document.querySelector('#pos-stack-2 .hide-button');
    expect(hideBtn).not.toBeNull();
    hideBtn.click();
    expect(document.getElementById('pos-input-2').style.display).toBe('none');
    hideBtn.click();
    expect(document.getElementById('pos-input-2').style.display).toBe('');
  });

  test('hide buttons still work after toggling stacks on and off', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <select id="pos-select"></select>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <div class="label-row">
            <label>Stack 1</label>
            <div class="button-col">
              <input type="checkbox" id="pos-hide-1" data-targets="pos-input" hidden>
              <button type="button" class="toggle-button hide-button" data-target="pos-hide-1" data-on="☰" data-off="✖">☰</button>
            </div>
          </div>
          <div class="input-row"><textarea id="pos-input"></textarea></div><select id="pos-order-select"></select>
        </div>
      </div>`;
    setupToggleButtons();
    setupStackControls();
    setupHideToggles();
    const cb = document.getElementById('pos-stack');
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    const hideCb = document.getElementById('pos-hide-1');
    hideCb.checked = true;
    hideCb.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-input').style.display).toBe('none');
    hideCb.checked = false;
    hideCb.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-input').style.display).toBe('');
  });

  test('stack toggle button can turn stack off again', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="pos-stack">
      <button type="button" class="toggle-button" data-target="pos-stack" data-on="Stack On" data-off="Stack Off">Stack Off</button>
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <select id="pos-select"></select>
      <select id="pos-order-select"></select>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1"></div>
      </div>`;
    setupToggleButtons();
    setupStackControls();
    const btn = document.querySelector('.toggle-button[data-target="pos-stack"]');
    const cb = document.getElementById('pos-stack');
    btn.click();
    expect(cb.checked).toBe(true);
    btn.click();
    expect(cb.checked).toBe(false);
    btn.click();
    expect(cb.checked).toBe(true);
  });

  test('global random toggle updates sections and button states', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="all-random">
      <button type="button" class="toggle-button" data-target="all-random" data-on="Randomized" data-off="Canonical">Canonical</button>
      <input type="checkbox" id="pos-order-random">
      <button type="button" class="toggle-button" data-target="pos-order-random" data-on="Randomized" data-off="Canonical">Canonical</button>
      <input type="checkbox" id="neg-order-random">
      <button type="button" class="toggle-button" data-target="neg-order-random" data-on="Randomized" data-off="Canonical">Canonical</button>
      <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="neg-order-select"><option value="canonical">c</option><option value="random">r</option></select>
    `;
    setupSectionOrder('pos');
    setupSectionOrder('neg');
    setupShuffleAll();
    const globalCb = document.getElementById('all-random');
    globalCb.checked = true;
    globalCb.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-order-random').checked).toBe(true);
    expect(document.getElementById('neg-order-random').checked).toBe(true);
    const btn = document.querySelector('.toggle-button[data-target="all-random"]');
    expect(btn.classList.contains('active')).toBe(true);
  });

  test('section random button reflects mixed state', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="pos-order-random">
      <button type="button" class="toggle-button" data-target="pos-order-random" data-on="Randomized" data-off="Canonical">Canonical</button>
      <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="pos-order-select-2"><option value="canonical">c</option><option value="random">r</option></select>
    `;
    setupSectionOrder('pos');
    const sel = document.getElementById('pos-order-select');
    sel.value = 'random';
    sel.dispatchEvent(new Event('change'));
    const btn = document.querySelector('.toggle-button[data-target="pos-order-random"]');
    expect(btn.classList.contains('indeterminate')).toBe(true);
    const sel2 = document.getElementById('pos-order-select-2');
    sel2.value = 'random';
    sel2.dispatchEvent(new Event('change'));
    expect(btn.classList.contains('active')).toBe(true);
    sel.value = 'canonical';
    sel.dispatchEvent(new Event('change'));
    expect(btn.classList.contains('indeterminate')).toBe(true);
  });

  test('section random button text updates with state', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="pos-order-random">
      <button type="button" class="toggle-button" data-target="pos-order-random" data-on="Randomized" data-off="Canonical">Canonical</button>
      <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="pos-order-select-2"><option value="canonical">c</option><option value="random">r</option></select>
    `;
    setupSectionOrder('pos');
    const btn = document.querySelector('.toggle-button[data-target="pos-order-random"]');
    const sel = document.getElementById('pos-order-select');
    sel.value = 'random';
    sel.dispatchEvent(new Event('change'));
    expect(btn.textContent).toBe('Canonical');
    const sel2 = document.getElementById('pos-order-select-2');
    sel2.value = 'random';
    sel2.dispatchEvent(new Event('change'));
    expect(btn.textContent).toBe('Randomized');
    sel.value = 'canonical';
    sel.dispatchEvent(new Event('change'));
    expect(btn.textContent).toBe('Canonical');
  });

  test('global random button text updates with state', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="all-random">
      <button type="button" class="toggle-button" data-target="all-random" data-on="Randomized" data-off="Canonical">Canonical</button>
      <input type="checkbox" id="pos-order-random">
      <button type="button" class="toggle-button" data-target="pos-order-random" data-on="Randomized" data-off="Canonical">Canonical</button>
      <input type="checkbox" id="neg-order-random">
      <button type="button" class="toggle-button" data-target="neg-order-random" data-on="Randomized" data-off="Canonical">Canonical</button>
      <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="neg-order-select"><option value="canonical">c</option><option value="random">r</option></select>
    `;
    setupSectionOrder('pos');
    setupSectionOrder('neg');
    setupShuffleAll();
    const btn = document.querySelector('.toggle-button[data-target="all-random"]');
    const ps = document.getElementById('pos-order-select');
    const ns = document.getElementById('neg-order-select');
    ps.value = 'random';
    ps.dispatchEvent(new Event('change'));
    ns.value = 'random';
    ns.dispatchEvent(new Event('change'));
    expect(btn.textContent).toBe('Randomized');
    ns.value = 'canonical';
    ns.dispatchEvent(new Event('change'));
    expect(btn.textContent).toBe('Canonical');
  });

  test('global random button reflects reroll buttons', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="all-random">
      <button type="button" class="toggle-button" data-target="all-random" data-on="Randomized" data-off="Canonical">Canonical</button>
      <input type="checkbox" id="pos-order-random">
      <button type="button" class="toggle-button" data-target="pos-order-random" data-on="Randomized" data-off="Canonical">Canonical</button>
      <input type="checkbox" id="neg-order-random">
      <button type="button" class="toggle-button" data-target="neg-order-random" data-on="Randomized" data-off="Canonical">Canonical</button>
      <select id="base-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="neg-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <button id="base-reroll" class="toggle-button random-button"></button>
      <button id="pos-reroll-1" class="toggle-button random-button"></button>
      <button id="neg-reroll-1" class="toggle-button random-button"></button>
    `;
    setupSectionOrder('pos');
    setupSectionOrder('neg');
    setupShuffleAll();
    setupRerollButton('base-reroll', 'base-order-select');
    setupRerollButton('pos-reroll-1', 'pos-order-select');
    setupRerollButton('neg-reroll-1', 'neg-order-select');
    document.getElementById('base-reroll').click();
    document.getElementById('pos-reroll-1').click();
    document.getElementById('neg-reroll-1').click();
    const btn = document.querySelector('.toggle-button[data-target="all-random"]');
    expect(btn.textContent).toBe('Randomized');
  });

  test('global hide button text updates when all hidden', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="all-hide">
      <button type="button" class="toggle-button" data-target="all-hide" data-on="All hidden" data-off="All visible">All visible</button>
      <input type="checkbox" id="hide-1" data-targets="foo" hidden>
      <div id="foo"></div>
    `;
    setupToggleButtons();
    setupHideToggles();
    const btn = document.querySelector('.toggle-button[data-target="all-hide"]');
    const cb = document.getElementById('hide-1');
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    expect(btn.textContent).toBe('All hidden');
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    expect(btn.textContent).toBe('All visible');
  });
});
