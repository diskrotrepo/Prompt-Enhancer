/** @jest-environment jsdom */

global.__TEST__ = true;
if (typeof window !== 'undefined') {
  window.__TEST__ = true;
}

const {
  parseInput,
  shuffle,
  equalizeLength,
  buildPrefixedList,
  buildVersions,
  processLyrics,
  setupShuffleAll,
  setupStackControls,
  setupHideToggles,
  applyPreset,
  parseDividerInput,
  exportLists,
  importLists,
  saveList,
} = require('../src/script');

describe('Utility functions', () => {
  test('parseInput splits and trims correctly', () => {
    const input = 'a, b; c\nd';
    expect(parseInput(input)).toEqual(['a', 'b', 'c', 'd']);
  });

  test('parseInput preserves delimiters when requested', () => {
    const input = 'a, b. c';
    expect(parseInput(input, true)).toEqual(['a, ', 'b. ', 'c. ']);
  });

  test('parseInput handles multiple delimiters together', () => {
    const input = 'a,,. b';
    expect(parseInput(input, true)).toEqual(['a,,. ', 'b. ']);
  });

  test('parseInput returns empty array for empty input', () => {
    expect(parseInput('')).toEqual([]);
  });

  test('parseInput adds punctuation when missing delimiters', () => {
    expect(parseInput('abc', true)).toEqual(['abc. ']);
  });

  test('parseInput preserves consecutive newlines', () => {
    expect(parseInput('a\n\nb', true)).toEqual(['a\n\n', 'b. ']);
  });

  test('parseDividerInput splits by line', () => {
    const raw = 'one\ntwo';
    expect(parseDividerInput(raw)).toEqual(['one', 'two']);
  });

  test('parseDividerInput preserves trailing spaces', () => {
    const raw = 'foo \nbar  ';
    expect(parseDividerInput(raw)).toEqual(['foo ', 'bar  ']);
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
});

describe('Prompt building', () => {
  test('buildPrefixedList respects limit', () => {
    const result = buildPrefixedList(['a', 'b'], ['x'], 5);
    expect(result).toEqual(['x a']);
  });

  test('buildPrefixedList returns empty when limit too small', () => {
    expect(buildPrefixedList(['a'], ['x'], 2)).toEqual([]);
  });

  test('buildPrefixedList falls back to items when prefixes empty', () => {
    const result = buildPrefixedList(['a', 'b'], [], 10);
    expect(result).toEqual(['a', 'b', 'a', 'b']);
  });

  test('buildPrefixedList handles empty items', () => {
    expect(buildPrefixedList([], ['x'], 10)).toEqual([]);
  });

  test('buildPrefixedList inserts dividers on repeat', () => {
    const result = buildPrefixedList(['a', 'b'], [], 20, false, false, ['i.e., ']);
    expect(result).toEqual(['a', 'b', 'i.e., ', 'a', 'b']);
  });

  test('buildPrefixedList omits divider when limit lacks room for item', () => {
    const result = buildPrefixedList(['a', 'b'], [], 12, false, false, ['i.e., ']);
    expect(result).toEqual(['a', 'b']);
  });

  test('buildVersions builds positive and negative prompts', () => {
    const out = buildVersions(['cat'], ['bad'], ['good'], false, false, false, 20);
    expect(out).toEqual({ positive: 'good cat, good cat', negative: 'bad cat, bad cat' });
  });

  test('buildVersions can include positive terms for negatives', () => {
    const out = buildVersions(['cat'], ['bad'], ['good'], false, false, false, 20, true);
    expect(out).toEqual({ positive: 'good cat', negative: 'bad good cat' });
  });

  test('buildVersions returns empty strings when items list is empty', () => {
    const out = buildVersions([], ['n'], ['p'], false, false, false, 10);
    expect(out).toEqual({ positive: '', negative: '' });
  });

  test('buildVersions respects very small limits', () => {
    const out = buildVersions(['hello'], ['n'], ['p'], false, false, false, 2);
    expect(out).toEqual({ positive: '', negative: '' });
  });

  test('buildVersions joins items without commas when delimited', () => {
    const out = buildVersions(['a.\n', 'b.\n'], ['n'], ['p'], false, false, false, 30);
    expect(out.positive.includes(',')).toBe(false);
    expect(out.negative.includes(',')).toBe(false);
    expect(out.positive.startsWith('p a.\n')).toBe(true);
    expect(out.positive.endsWith('\n')).toBe(true);
  });

  test('buildVersions inserts dividers when provided', () => {
    const out = buildVersions(
      ['a', 'b'],
      [],
      [],
      false,
      false,
      false,
      50,
      false,
      ['i.e., '],
      true
    );
    expect(out.positive.includes('i.e.,')).toBe(true);
    expect(out.positive.startsWith('a, b, \ni.e., ')).toBe(true);
  });

  test('buildVersions keeps spaces from parsed divider list', () => {
    const divs = parseDividerInput('foo ');
    const out = buildVersions(
      ['a', 'b'],
      [],
      [],
      false,
      false,
      false,
      50,
      false,
      divs
    );
    expect(out.positive.startsWith('a, b, \nfoo ')).toBe(true);
  });

  test('buildVersions reuses divider order for negatives', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0.99);
    const out = buildVersions(
      ['a', 'b'],
      [],
      [],
      false,
      false,
      false,
      50,
      false,
      ['x ', 'y ']
    );
    Math.random = orig;
    const posDivs = out.positive.match(/[xy] /g);
    const negDivs = out.negative.match(/[xy] /g);
    expect(posDivs).toEqual(['x ', 'y ', 'x ', 'y ']);
    expect(negDivs).toEqual(posDivs);
  });

  test('buildVersions places dividers on new lines', () => {
    const out = buildVersions(
      ['a', 'b'],
      [],
      [],
      false,
      false,
      false,
      50,
      false,
      ['\nfoo ']
    );
    expect(out.positive).toContain('\nfoo ');
    expect(out.positive.startsWith('a, b')).toBe(true);
  });

  test('buildVersions supports modifier stacking', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0.999999);
    const out = buildVersions(
      ['x'],
      ['n1', 'n2'],
      ['p1', 'p2'],
      false,
      false,
      false,
      10,
      false,
      [],
      true,
      2,
      2
    );
    Math.random = orig;
    expect(out).toEqual({ positive: 'p1 p1 x', negative: 'n1 n1 x' });
  });

  test('stacking works with natural dividers', () => {
    const out = buildVersions(
      ['a', 'b'],
      ['n1'],
      ['p1'],
      false,
      false,
      false,
      100,
      false,
      ['\nfoo '],
      2,
      2
    );
    expect(out.positive).not.toMatch(/p1 \nfoo /);
    expect(out.negative).not.toMatch(/n1 \nfoo /);
    const divMatches = out.positive.match(/, \nfoo /g) || [];
    expect(divMatches.length).toBeGreaterThan(0);
  });

  test('negative preserves divider placement when built on positives', () => {
    const out = buildVersions(
      ['cat'],
      ['bad'],
      ['good'],
      false,
      false,
      false,
      50,
      true,
      ['\nfoo ']
    );
    expect(out.positive).toBe('good cat, \nfoo , good cat, \nfoo ');
    expect(out.negative).toBe('bad good cat, \nfoo , bad good cat, \nfoo ');
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
});

describe('UI interactions', () => {
  test('shuffle all respects stack lock', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"></select>
      <input type="checkbox" id="pos-shuffle">
      <button class="toggle-button" data-target="pos-shuffle"></button>
      <input type="checkbox" id="neg-stack">
      <select id="neg-stack-size"></select>
      <input type="checkbox" id="neg-shuffle">
      <button class="toggle-button" data-target="neg-shuffle"></button>
      <input type="checkbox" id="all-random">
      <button class="toggle-button" data-target="all-random"></button>
    `;
    setupStackControls();
    setupShuffleAll();
    const posShuffle = document.getElementById('pos-shuffle');
    const posBtn = document.querySelector('[data-target="pos-shuffle"]');
    const posStack = document.getElementById('pos-stack');
    posStack.checked = true;
    posStack.dispatchEvent(new Event('change'));
    expect(posShuffle.checked).toBe(true);
    expect(posBtn.classList.contains('disabled')).toBe(true);
    const allRandom = document.getElementById('all-random');
    allRandom.checked = false;
    allRandom.dispatchEvent(new Event('change'));
    expect(posShuffle.checked).toBe(true);
    expect(posBtn.classList.contains('disabled')).toBe(true);
    posStack.checked = false;
    posStack.dispatchEvent(new Event('change'));
    expect(posShuffle.checked).toBe(false);
    expect(posBtn.classList.contains('disabled')).toBe(false);
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
});

describe('List persistence', () => {
  test('exportLists and importLists round trip', () => {
    importLists({ presets: [{ id: 'x', title: 'x', type: 'positive', items: ['1'] }] });
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
    expect(preset.items).toEqual(['a', 'b']);
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
    expect(preset.items).toEqual(['foo', 'bar']);
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
    expect(preset.items).toEqual(['foo', 'bar']);
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
    expect(preset.items).toEqual(['line1\nline2']);
    const opt = document.querySelector('#lyrics-select option[value="ly1"]');
    expect(opt).not.toBeNull();
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

  test('importLists additive merges lists', () => {
    importLists({
      presets: [
        { id: 'a', title: 'a', type: 'positive', items: ['1'] },
        { id: 'b', title: 'b', type: 'negative', items: ['x'] }
      ]
    });
    importLists(
      {
        presets: [
          { id: 'b', title: 'b', type: 'negative', items: ['y'] },
          { id: 'c', title: 'c', type: 'positive', items: ['2'] }
        ]
      },
      true
    );
    const data = JSON.parse(exportLists());
    const neg = data.presets.find(
      p => p.id === 'b' && p.type === 'negative' && p.title === 'b'
    );
    expect(neg.items).toEqual(['y']);
    expect(
      data.presets.some(p => p.id === 'c' && p.type === 'positive')
    ).toBe(true);
  });

  test('importLists additive keeps different titles separate', () => {
    importLists({ presets: [] });
    importLists({ presets: [{ id: 'a', title: 'a', type: 'positive', items: ['1'] }] });
    importLists(
      { presets: [{ id: 'a', title: 'b', type: 'positive', items: ['2'] }] },
      true
    );
    const data = JSON.parse(exportLists());
    const lists = data.presets.filter(p => p.id === 'a' && p.type === 'positive');
    expect(lists.length).toBe(2);
  });
});
