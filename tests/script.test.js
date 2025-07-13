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
  parseDividerInput,
  parseOrderInput,
  applyOrder,
  insertAtDepth,
  countWords
} = utils;

const { exportLists, importLists, saveList } = lists;

const {
  setupShuffleAll,
  setupStackControls,
  setupHideToggles,
  setupToggleButtons,
  applyAllHideState,
  applyPreset,
  setupOrderControl,
  setupRerollButton,
  rerollRandomOrders,
  setupAdvancedToggle,
  updateStackBlocks,
  setupSectionOrder,
  setupSectionHide,
  setupSectionAdvanced,
  setupDepthControl,
  updateDepthContainers,
  depthWatchIds,
  setupPresetListener
} = ui;

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

  test('countWords counts words ignoring trailing punctuation', () => {
    expect(countWords('foo bar baz.')).toBe(3);
    expect(countWords('   ')).toBe(0);
  });

  test('parseOrderInput converts to numbers', () => {
    expect(parseOrderInput('1, 2 3')).toEqual([1, 2, 3]);
  });

  test('applyOrder reorders list cycling values', () => {
    const out = applyOrder(['a', 'b', 'c'], [2, 0]);
    expect(out).toEqual(['c', 'a', 'c']);
  });

  test('insertAtDepth inserts term at depth', () => {
    expect(insertAtDepth('a b c', 'x', 1)).toBe('a x b c');
  });
});

describe('Prompt building', () => {
  test('buildVersions builds positive and negative prompts', () => {
    const out = buildVersions(['cat'], ['bad'], ['good'], 20);
    expect(out).toEqual({ positive: 'good cat, good cat', negative: 'bad cat, bad cat' });
  });

  test('buildVersions can include positive terms for negatives', () => {
    const out = buildVersions(['cat'], ['bad'], ['good'], 20, true);
    expect(out).toEqual({ positive: 'good cat', negative: 'bad good cat' });
  });

  test('buildVersions applies negative depth after positives', () => {
    const out = buildVersions(['cat'], ['bad'], ['good'], 20, true, [], true, 1, 1, [1], [2]);
    expect(out).toEqual({ positive: 'cat good', negative: 'cat good bad' });
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
    expect(out).toEqual({ positive: 'a x b y c', negative: 'a n b c' });
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
    expect(out).toEqual({ positive: 'foo good great bar baz', negative: 'foo good great bar baz bad' });
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
    expect(out).toEqual({ positive: 'foo bar good, foo bar good', negative: 'foo bar good bad, foo bar good bad' });
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
    expect(out).toEqual({ positive: 'pos a b', negative: 'pos a b neg' });
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
    expect(out).toEqual({ positive: 'pre foo bar post, pre foo bar post', negative: 'n foo bar, n foo bar' });
  });

  test('buildVersions returns empty strings when items list is empty', () => {
    const out = buildVersions([], ['n'], ['p'], 10);
    expect(out).toEqual({ positive: '', negative: '' });
  });

  test('buildVersions respects very small limits', () => {
    const out = buildVersions(['hello'], ['n'], ['p'], 2);
    expect(out).toEqual({ positive: '', negative: '' });
  });

  test('buildVersions joins items without commas when delimited', () => {
    const out = buildVersions(['a.\n', 'b.\n'], ['n'], ['p'], 30);
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
    expect(out.positive).toBe('p1 p2 x, p2 p1 x');
    expect(out.negative).toBe('n2 n1 x, n1 n2 x');
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
    expect(out.positive).toBe('p1 p2 x, p1 p2 x');
    expect(out.negative).toBe('n1 n2 x, n1 n2 x');
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
      50,
      true,
      ['\nfoo ']
    );
    expect(out.positive).toBe('good cat, \nfoo , good cat, \nfoo ');
    expect(out.negative).toBe('bad good cat, \nfoo , bad good cat, \nfoo ');
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
    const expectedNeg = out.positive.replace(/\bp /g, 'n p ');
    expect(out.negative).toBe(expectedNeg);
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
  test('order all toggles dropdown values', () => {
    document.body.innerHTML = `
      <select id="base-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="neg-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="divider-order-select"><option value="canonical">c</option><option value="random">r</option></select>
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
    expect(document.getElementById('divider-order-select').value).toBe('random');
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    expect(document.getElementById('base-order-select').value).toBe('canonical');
    expect(document.getElementById('divider-order-select').value).toBe('canonical');
  });

  test('order all also affects stacked dropdowns', () => {
    document.body.innerHTML = `
      <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="pos-order-select-2"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="neg-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
      <select id="neg-depth-select-2"><option value="prepend">p</option><option value="random">r</option></select>
      <input type="checkbox" id="all-random">
      <button class="toggle-button" data-target="all-random"></button>
    `;
    setupShuffleAll();
    const cb = document.getElementById('all-random');
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-order-select').value).toBe('random');
    expect(document.getElementById('pos-order-select-2').value).toBe('random');
    expect(document.getElementById('neg-depth-select').value).toBe('random');
    expect(document.getElementById('neg-depth-select-2').value).toBe('random');
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-order-select').value).toBe('canonical');
    expect(document.getElementById('pos-order-select-2').value).toBe('canonical');
    expect(document.getElementById('neg-depth-select').value).toBe('prepend');
    expect(document.getElementById('neg-depth-select-2').value).toBe('prepend');
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

  test('reroll button switches select to random and shuffles', () => {
    document.body.innerHTML = `
      <select id="base-order-select">
        <option value="canonical">c</option>
        <option value="random">r</option>
      </select>
      <textarea id="base-order-input"></textarea>
      <button id="base-reroll" class="toggle-button random-button" data-select="base-order-select"></button>
    `;
    const orig = utils.shuffle;
    utils.shuffle = jest.fn(arr => {
      arr.reverse();
      return arr;
    });
    setupOrderControl('base-order-select', 'base-order-input', () => ['a', 'b', 'c']);
    setupRerollButton('base-reroll', 'base-order-select');
    document.getElementById('base-reroll').click();
    expect(document.getElementById('base-order-select').value).toBe('random');
    utils.shuffle = orig;
  });
  });

  test('rerollRandomOrders updates random selects', () => {
    document.body.innerHTML = `
      <select id="base-order-select">
        <option value="canonical">c</option>
        <option value="random">r</option>
      </select>
      <textarea id="base-order-input"></textarea>
      <textarea id="base-input">a,b</textarea>
    `;
    const orig = utils.shuffle;
    utils.shuffle = jest.fn(arr => {
      arr.reverse();
      return arr;
    });
    setupOrderControl('base-order-select', 'base-order-input', () => ['a', 'b']);
    document.getElementById('base-order-select').value = 'random';
    document.getElementById('base-order-select').dispatchEvent(new Event('change'));
    rerollRandomOrders();
    utils.shuffle = orig;
  });

  test('canonical base order updates when base input changes', () => {
    document.body.innerHTML = `
      <select id="base-order-select">
        <option value="canonical">c</option>
        <option value="random">r</option>
      </select>
      <textarea id="base-order-input"></textarea>
      <textarea id="base-input">a</textarea>
    `;
    setupOrderControl(
      'base-order-select',
      'base-order-input',
      () => utils.parseInput(document.getElementById('base-input').value, true),
      'base-input'
    );
    const baseInput = document.getElementById('base-input');
    baseInput.value = 'a,b,c';
    baseInput.dispatchEvent(new Event('input'));
    expect(document.getElementById('base-order-input').value).toBe('0, 1, 2');
  });

  test('canonical base order updates on change events', () => {
    document.body.innerHTML = `
      <select id="base-order-select">
        <option value="canonical">c</option>
      </select>
      <textarea id="base-order-input"></textarea>
      <textarea id="base-input">a</textarea>
    `;
    setupOrderControl(
      'base-order-select',
      'base-order-input',
      () => utils.parseInput(document.getElementById('base-input').value, true),
      'base-input'
    );
    const baseInput = document.getElementById('base-input');
    baseInput.value = 'a,b,c';
    baseInput.dispatchEvent(new Event('change'));
    expect(document.getElementById('base-order-input').value).toBe('0, 1, 2');
  });

  test('random base order updates when base input changes', () => {
    document.body.innerHTML = `
      <select id="base-order-select">
        <option value="canonical">c</option>
        <option value="random">r</option>
      </select>
      <textarea id="base-order-input"></textarea>
      <textarea id="base-input">a</textarea>
    `;
    const orig = utils.shuffle;
    utils.shuffle = jest.fn(arr => {
      arr.reverse();
      return arr;
    });
    setupOrderControl(
      'base-order-select',
      'base-order-input',
      () => utils.parseInput(document.getElementById('base-input').value, true),
      'base-input'
    );
    const sel = document.getElementById('base-order-select');
    sel.value = 'random';
    sel.dispatchEvent(new Event('change'));
    const baseInput = document.getElementById('base-input');
    baseInput.value = 'a,b,c';
    baseInput.dispatchEvent(new Event('input'));
    utils.shuffle = orig;
    expect(document.getElementById('base-order-input').value).not.toBe('0, 1, 2');
  });

  test('append depth updates when base input changes', () => {
    document.body.innerHTML = `
      <select id="pos-depth-select">
        <option value="prepend">p</option>
        <option value="append">a</option>
      </select>
      <textarea id="pos-depth-input"></textarea>
      <textarea id="base-input">foo bar,baz</textarea>
    `;
    setupDepthControl('pos-depth-select', 'pos-depth-input', 'base-input');
    const sel = document.getElementById('pos-depth-select');
    sel.value = 'append';
    sel.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-depth-input').value).toBe('2, 1');
    const baseInput = document.getElementById('base-input');
    baseInput.value = 'foo,baz qux quux';
    baseInput.dispatchEvent(new Event('input'));
    expect(document.getElementById('pos-depth-input').value).toBe('1, 3');
  });

  test('append depth uses modifier length', () => {
    document.body.innerHTML = `
      <select id="pos-depth-select">
        <option value="append">a</option>
      </select>
      <textarea id="pos-depth-input"></textarea>
      <textarea id="base-input">foo bar</textarea>
      <textarea id="pos-input">baz qux</textarea>
      <textarea id="pos-order-input">0</textarea>
    `;
    setupDepthControl('pos-depth-select', 'pos-depth-input', [
      'base-input',
      'pos-input',
      'pos-order-input'
    ]);
    const sel = document.getElementById('pos-depth-select');
    sel.value = 'append';
    sel.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-depth-input').value).toBe('2');
  });

  test('negative depth includes positive modifiers when enabled', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="neg-include-pos" checked>
      <select id="neg-depth-select">
        <option value="append">a</option>
      </select>
      <textarea id="neg-depth-input"></textarea>
      <textarea id="base-input">foo bar</textarea>
      <textarea id="neg-input">bad</textarea>
      <textarea id="neg-order-input">0</textarea>
      <textarea id="pos-input">good</textarea>
      <textarea id="pos-order-input">0</textarea>
    `;
    setupDepthControl('neg-depth-select', 'neg-depth-input', [
      'base-input',
      'neg-input',
      'neg-order-input',
      'neg-include-pos',
      'pos-input',
      'pos-order-input'
    ]);
    const sel = document.getElementById('neg-depth-select');
    sel.value = 'append';
    sel.dispatchEvent(new Event('change'));
    expect(document.getElementById('neg-depth-input').value).toBe('3');
  });

  const appendMap = [
    {
      desc: 'negative append depth for second stack reacts to positive changes',
      before: '3',
      after: '4',
      update() {
        const inp = document.getElementById('pos-input-2');
        inp.value = 'great job';
        inp.dispatchEvent(new Event('input'));
      }
    }
  ];

  appendMap.forEach(cfg => {
    test(cfg.desc, () => {
      document.body.innerHTML = `
        <input type="checkbox" id="pos-stack">
        <select id="pos-stack-size"><option value="2">2</option></select>
        <input type="checkbox" id="neg-stack">
        <select id="neg-stack-size"><option value="2">2</option></select>
        <input type="checkbox" id="neg-include-pos" checked>
        <div id="neg-depth-container">
          <select id="neg-depth-select"><option value="append">a</option></select>
          <div class="input-row"><textarea id="neg-depth-input"></textarea></div>
        </div>
        <div id="pos-stack-container"></div>
        <div id="neg-stack-container"></div>
        <textarea id="pos-input"></textarea>
        <textarea id="pos-order-input"></textarea>
        <textarea id="pos-input-2">good</textarea>
        <textarea id="pos-order-input-2"></textarea>
        <textarea id="neg-input"></textarea>
        <textarea id="neg-order-input"></textarea>
        <textarea id="neg-input-2"></textarea>
        <textarea id="neg-order-input-2"></textarea>
        <textarea id="base-input">foo bar</textarea>
        <select id="base-select"></select>
      `;
      setupDepthControl('neg-depth-select', 'neg-depth-input', [
        'base-input',
        'neg-input',
        'neg-order-input',
        'neg-include-pos',
        'pos-input',
        'pos-order-input'
      ]);
      document.getElementById('neg-stack-container').innerHTML =
        '<div class="stack-block" id="neg-stack-1"></div>';
      document.getElementById('pos-stack-container').innerHTML =
        '<div class="stack-block" id="pos-stack-1"></div>';
      const posStack = document.getElementById('pos-stack');
      posStack.checked = true;
      const negStack = document.getElementById('neg-stack');
      negStack.checked = true;
      updateStackBlocks('pos', 2);
      updateStackBlocks('neg', 2);
      setupDepthControl('neg-depth-select-2', 'neg-depth-input-2', [
        'base-input',
        'base-select',
        'neg-input-2',
        'neg-order-input-2',
        'neg-include-pos',
        'pos-input',
        'pos-order-input',
        'pos-input-2',
        'pos-order-input-2'
      ]);
      const sel = document.getElementById('neg-depth-select-2');
      sel.value = 'append';
      sel.dispatchEvent(new Event('change'));
      expect(document.getElementById('neg-depth-input-2').value).toBe(cfg.before);
      cfg.update();
      expect(document.getElementById('neg-depth-input-2').value).toBe(cfg.after);
    });
  });

  test('prepend depth populates zeros for each base term', () => {
    document.body.innerHTML = `
      <select id="pos-depth-select">
        <option value="prepend">p</option>
        <option value="append">a</option>
      </select>
      <textarea id="pos-depth-input"></textarea>
      <textarea id="base-input">foo bar,baz</textarea>
    `;
    setupDepthControl('pos-depth-select', 'pos-depth-input', 'base-input');
    const sel = document.getElementById('pos-depth-select');
    sel.value = 'prepend';
    sel.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-depth-input').value).toBe('0, 0');
  });

  test('depth populates when switching modes', () => {
    document.body.innerHTML = `
      <select id="pos-depth-select">
        <option value="prepend">p</option>
        <option value="append">a</option>
        <option value="random">r</option>
      </select>
      <textarea id="pos-depth-input"></textarea>
      <textarea id="base-input">foo bar,baz</textarea>
    `;
    setupDepthControl('pos-depth-select', 'pos-depth-input', 'base-input');
    const sel = document.getElementById('pos-depth-select');
    sel.value = 'append';
    sel.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-depth-input').value).toBe('2, 1');
    sel.value = 'random';
    sel.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-depth-input').value).not.toBe('');
  });

  test('append depth updates on change events', () => {
    document.body.innerHTML = `
      <select id="pos-depth-select">
        <option value="append">a</option>
      </select>
      <textarea id="pos-depth-input"></textarea>
      <textarea id="base-input">foo bar,baz</textarea>
    `;
    setupDepthControl('pos-depth-select', 'pos-depth-input', 'base-input');
    const sel = document.getElementById('pos-depth-select');
    sel.value = 'append';
    sel.dispatchEvent(new Event('change'));
    const baseInput = document.getElementById('base-input');
    baseInput.value = 'foo,baz qux quux';
    baseInput.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-depth-input').value).toBe('1, 3');
  });

  test('base order updates when selecting a preset', () => {
    importLists({
      presets: [
        { id: 'b', title: 'b', type: 'base', items: ['a', 'b', 'c'] }
      ]
    });
    document.body.innerHTML = `
      <select id="base-select"><option value="b">b</option></select>
      <textarea id="base-input"></textarea>
      <select id="base-order-select"><option value="canonical">c</option></select>
      <textarea id="base-order-input"></textarea>
    `;
    setupPresetListener('base-select', 'base-input', 'base');
    setupOrderControl(
      'base-order-select',
      'base-order-input',
      () => utils.parseInput(document.getElementById('base-input').value, true),
      'base-input'
    );
    const sel = document.getElementById('base-select');
    sel.value = 'b';
    sel.dispatchEvent(new Event('change'));
    expect(document.getElementById('base-order-input').value).toBe('0, 1, 2');
  });

  test('depth updates when selecting a base preset', () => {
    importLists({
      presets: [
        { id: 'b2', title: 'b2', type: 'base', items: ['foo bar', 'baz qux quux'] }
      ]
    });
    document.body.innerHTML = `
      <select id="base-select"><option value="b2">b2</option></select>
      <textarea id="base-input"></textarea>
      <select id="pos-depth-select">
        <option value="prepend">p</option>
        <option value="append">a</option>
      </select>
      <textarea id="pos-depth-input"></textarea>
    `;
    setupPresetListener('base-select', 'base-input', 'base');
    setupDepthControl('pos-depth-select', 'pos-depth-input', 'base-input');
    const depthSel = document.getElementById('pos-depth-select');
    depthSel.value = 'append';
    depthSel.dispatchEvent(new Event('change'));
    const baseSel = document.getElementById('base-select');
    baseSel.value = 'b2';
    baseSel.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-depth-input').value).toBe('2, 3');
  });

  test('rerollRandomOrders handles multiple order controls', () => {
    document.body.innerHTML = `
      <select id="pos-order-select">
        <option value="canonical">c</option>
        <option value="random">r</option>
      </select>
      <textarea id="pos-order-input"></textarea>
      <select id="pos-order-select-2">
        <option value="canonical">c</option>
        <option value="random">r</option>
      </select>
      <textarea id="pos-order-input-2"></textarea>
      <textarea id="pos-input">a,b</textarea>
    `;
    const orig = utils.shuffle;
    utils.shuffle = jest.fn(arr => {
      arr.reverse();
      return arr;
    });
    document.getElementById('pos-order-select').value = 'random';
    document.getElementById('pos-order-select-2').value = 'random';
    rerollRandomOrders();
    utils.shuffle = orig;
  });
  test('rerollRandomOrders randomizes depth for each stack', () => {
    document.body.innerHTML = `
      <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
      <textarea id="pos-depth-input"></textarea>
      <select id="pos-depth-select-2"><option value="prepend">p</option><option value="random">r</option></select>
      <textarea id="pos-depth-input-2"></textarea>
      <textarea id="base-input">foo bar</textarea>
    `;
    document.getElementById('pos-depth-select').value = 'random';
    document.getElementById('pos-depth-select-2').value = 'random';
    rerollRandomOrders();
    const d1 = document.getElementById('pos-depth-input').value;
    const d2 = document.getElementById('pos-depth-input-2').value;
    expect(d1).not.toBe('');
    expect(d2).not.toBe('');
  });

  test('rerollRandomOrders refreshes negative append depth when stacks randomize', () => {
    document.body.innerHTML = `
      <textarea id="base-input">foo bar</textarea>
      <input type="checkbox" id="pos-stack" checked>
      <select id="pos-stack-size"><option value="2">2</option></select>
      <div id="pos-stack-container"></div>
      <div id="pos-order-container"></div>
      <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <div class="input-row"><textarea id="pos-order-input"></textarea></div>
      <select id="pos-order-select-2"><option value="canonical">c</option><option value="random">r</option></select>
      <div class="input-row"><textarea id="pos-order-input-2"></textarea></div>
      <textarea id="pos-input">good</textarea>
      <textarea id="pos-input-2">great job</textarea>
      <input type="checkbox" id="neg-stack" checked>
      <select id="neg-stack-size"><option value="1">1</option></select>
      <input type="checkbox" id="neg-include-pos" checked>
      <div id="neg-depth-container">
        <select id="neg-depth-select"><option value="append">a</option></select>
        <div class="input-row"><textarea id="neg-depth-input"></textarea></div>
      </div>`;
    updateStackBlocks('pos', 2);
    updateDepthContainers('neg', 1);
    setupOrderControl('pos-order-select', 'pos-order-input', () => ['good', 'better']);
    setupOrderControl('pos-order-select-2', 'pos-order-input-2', () => ['good', 'great job']);
    setupDepthControl('neg-depth-select', 'neg-depth-input', depthWatchIds('neg', 1));
    document.getElementById('pos-order-select').value = 'random';
    document.getElementById('pos-order-select-2').value = 'random';
    document.getElementById('neg-depth-select').value = 'append';
    document.getElementById('neg-depth-select').dispatchEvent(new Event('change'));
    const before = document.getElementById('neg-depth-input').value;
    document.getElementById('neg-depth-input').value = '';
    rerollRandomOrders();
    const after = document.getElementById('neg-depth-input').value;
    expect(after).toBe('5');
  });

  test('advanced toggle shows and hides controls', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <select id="base-order-select"></select>
      <div class="input-row"><textarea id="base-order-input"></textarea></div>
      <div id="pos-order-container">
        <select id="pos-order-select">
          <option value="canonical">c</option>
          <option value="random">r</option>
        </select>
        <div class="input-row"><textarea id="pos-order-input"></textarea></div>
        <select id="pos-order-select-2">
          <option value="canonical">c</option>
          <option value="random">r</option>
        </select>
        <div class="input-row"><textarea id="pos-order-input-2"></textarea></div>
      </div>
      <button id="base-reroll"></button>
    `;
    setupAdvancedToggle();
    const cb = document.getElementById('advanced-mode');
    const select = document.getElementById('base-order-select');
    const taRow = document.getElementById('base-order-input').parentElement;
    const cont = document.getElementById('pos-order-container');
    const btn = document.getElementById('base-reroll');

    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    expect(select.style.display).toBe('');
    expect(taRow.style.display).toBe('');
    expect(cont.style.display).toBe('');
    expect(btn.style.display).toBe('');

    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    expect(select.style.display).toBe('none');
    expect(taRow.style.display).toBe('none');
    expect(cont.style.display).toBe('none');
    expect(btn.style.display).toBe('');
  });

  test('new stack order uses reroll state in simple mode', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <input type="checkbox" id="pos-stack">
      <button type="button" class="toggle-button" data-target="pos-stack" data-on="Stack On" data-off="Stack Off">Stack Off</button>
      <button type="button" class="toggle-button" data-target="pos-stack" data-on="Stack On" data-off="Stack Off">Stack Off</button>
      <button type="button" class="toggle-button" data-target="pos-stack" data-on="Stack On" data-off="Stack Off">Stack Off</button>
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <div id="pos-order-container">
            <select id="pos-order-select">
              <option value="canonical">c</option>
              <option value="random">r</option>
            </select>
            <div class="input-row"><textarea id="pos-order-input"></textarea></div>
          </div>
          <textarea id="pos-input">a,b</textarea>
        </div>
      </div>
      <button id="pos-reroll-1"></button>
    `;
    setupOrderControl('pos-order-select', 'pos-order-input', () => ['a', 'b']);
    setupRerollButton('pos-reroll-1', 'pos-order-select');
    setupStackControls();
    document.getElementById('pos-reroll-1').click();
    const stackCb = document.getElementById('pos-stack');
    stackCb.checked = true;
    stackCb.dispatchEvent(new Event('change'));
    const sel2 = document.getElementById('pos-order-select-2');
    const ta2 = document.getElementById('pos-order-input-2');
    expect(sel2.value).toBe('random');
    expect(ta2.value).toBe('');
  });

  test('reroll button syncs state on mode switch', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <div id="pos-order-container">
        <select id="pos-order-select">
          <option value="canonical">c</option>
          <option value="random">r</option>
        </select>
        <div class="input-row"><textarea id="pos-order-input"></textarea></div>
        <select id="pos-order-select-2">
          <option value="canonical">c</option>
          <option value="random">r</option>
        </select>
        <div class="input-row"><textarea id="pos-order-input-2"></textarea></div>
      </div>
      <button id="pos-reroll-1" class="random-button"></button>
    `;
    document.getElementById('pos-order-select').value = 'random';
    document.getElementById('pos-order-select-2').value = 'canonical';
    setupRerollButton('pos-reroll-1', 'pos-order-select');
    setupAdvancedToggle();
    const cb = document.getElementById('advanced-mode');
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    const btn = document.getElementById('pos-reroll-1');
    expect(btn.classList.contains('active')).toBe(true);
  });

  test('simple mode reroll toggles only its stack', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <div id="neg-order-container">
        <select id="neg-order-select">
          <option value="canonical">c</option>
          <option value="random">r</option>
        </select>
        <div class="input-row"><textarea id="neg-order-input"></textarea></div>
        <select id="neg-order-select-2">
          <option value="canonical">c</option>
          <option value="random">r</option>
        </select>
        <div class="input-row"><textarea id="neg-order-input-2"></textarea></div>
      </div>
      <button id="neg-reroll-1" class="random-button"></button>
    `;
    setupRerollButton('neg-reroll-1', 'neg-order-select');
    setupAdvancedToggle();
    const cb = document.getElementById('advanced-mode');
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    document.getElementById('neg-reroll-1').click();
    expect(document.getElementById('neg-order-select').value).toBe('random');
    expect(document.getElementById('neg-order-select-2').value).toBe('canonical');
  });

  test('advanced mode reroll toggles only its stack', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <div id="neg-order-container">
        <select id="neg-order-select">
          <option value="canonical">c</option>
          <option value="random">r</option>
        </select>
        <div class="input-row"><textarea id="neg-order-input"></textarea></div>
        <select id="neg-order-select-2">
          <option value="canonical">c</option>
          <option value="random">r</option>
        </select>
        <div class="input-row"><textarea id="neg-order-input-2"></textarea></div>
      </div>
      <button id="neg-reroll-1" class="random-button"></button>
    `;
    setupRerollButton('neg-reroll-1', 'neg-order-select');
    setupAdvancedToggle();
    const cb = document.getElementById('advanced-mode');
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    document.getElementById('neg-reroll-1').click();
    expect(document.getElementById('neg-order-select').value).toBe('random');
    expect(document.getElementById('neg-order-select-2').value).toBe('canonical');
  });

  test('reroll buttons toggle independently per stack', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <div id="pos-order-container">
        <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
        <div class="input-row"><textarea id="pos-order-input"></textarea></div>
        <select id="pos-order-select-2"><option value="canonical">c</option><option value="random">r</option></select>
        <div class="input-row"><textarea id="pos-order-input-2"></textarea></div>
      </div>
      <div id="pos-depth-container">
        <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
        <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
        <select id="pos-depth-select-2"><option value="prepend">p</option><option value="random">r</option></select>
        <div class="input-row"><textarea id="pos-depth-input-2"></textarea></div>
      </div>
      <button id="pos-reroll-1"></button>
      <button id="pos-reroll-2"></button>
    `;
    setupRerollButton('pos-reroll-1', 'pos-order-select');
    setupRerollButton('pos-reroll-2', 'pos-order-select-2');
    setupAdvancedToggle();
    document.getElementById('pos-reroll-1').click();
    expect(document.getElementById('pos-order-select').value).toBe('random');
    expect(document.getElementById('pos-order-select-2').value).toBe('canonical');
    expect(document.getElementById('pos-depth-select').value).toBe('random');
    expect(document.getElementById('pos-depth-select-2').value).toBe('prepend');
  });

  test('stack blocks added in simple mode hide advanced controls', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <input type="checkbox" id="pos-stack">
      <button type="button" class="toggle-button" data-target="pos-stack" data-on="Stack On" data-off="Stack Off">Stack Off</button>
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <select id="pos-select"></select>
          <div class="input-row"><textarea id="pos-input"></textarea></div>
          <div id="pos-order-container">
            <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="pos-order-input"></textarea></div>
          </div>
          <div id="pos-depth-container">
            <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
          </div>
        </div>
      </div>
    `;
    setupAdvancedToggle();
    setupStackControls();
    const adv = document.getElementById('advanced-mode');
    adv.checked = false;
    adv.dispatchEvent(new Event('change'));
    const cb = document.getElementById('pos-stack');
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    const orderSel = document.getElementById('pos-order-select-2');
    const orderCont = document.getElementById('pos-order-container-2');
    const depthSel = document.getElementById('pos-depth-select-2');
    const depthCont = document.getElementById('pos-depth-container-2');
    expect(orderSel.style.display).toBe('none');
    expect(orderCont.style.display).toBe('none');
    expect(depthSel.style.display).toBe('none');
    expect(depthCont.style.display).toBe('none');
  });

  test('stack blocks added in advanced mode keep advanced controls', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <input type="checkbox" id="pos-stack">
      <button type="button" class="toggle-button" data-target="pos-stack" data-on="Stack On" data-off="Stack Off">Stack Off</button>
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <select id="pos-select"></select>
          <div class="input-row"><textarea id="pos-input"></textarea></div>
          <div id="pos-order-container">
            <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="pos-order-input"></textarea></div>
          </div>
          <div id="pos-depth-container">
            <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
          </div>
        </div>
      </div>
    `;
    setupAdvancedToggle();
    setupStackControls();
    const adv = document.getElementById('advanced-mode');
    adv.checked = true;
    adv.dispatchEvent(new Event('change'));
    const cb = document.getElementById('pos-stack');
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    const orderSel = document.getElementById('pos-order-select-2');
    const depthSel = document.getElementById('pos-depth-select-2');
    expect(orderSel.style.display).toBe('');
    expect(depthSel.style.display).toBe('');
  });

  test('advanced mode stays on after enabling stack', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <select id="pos-select"></select>
          <div class="input-row"><textarea id="pos-input"></textarea></div>
          <div id="pos-order-container">
            <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="pos-order-input"></textarea></div>
          </div>
          <div id="pos-depth-container">
            <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
          </div>
        </div>
      </div>
    `;
    setupAdvancedToggle();
    setupStackControls();
    const adv = document.getElementById('advanced-mode');
    adv.checked = true;
    adv.dispatchEvent(new Event('change'));
    const cb = document.getElementById('pos-stack');
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    expect(adv.checked).toBe(true);
  });

  test('global advanced overrides section settings', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <button type="button" class="toggle-button" data-target="advanced-mode" data-on="Advanced" data-off="Simple">Simple</button>
      <input type="checkbox" id="pos-advanced">
      <button type="button" class="toggle-button" data-target="pos-advanced" data-on="Advanced" data-off="Simple">Simple</button>
      <input type="checkbox" id="neg-advanced">
      <button type="button" class="toggle-button" data-target="neg-advanced" data-on="Advanced" data-off="Simple">Simple</button>
    `;
    setupToggleButtons();
    setupSectionAdvanced('pos');
    setupSectionAdvanced('neg');
    setupAdvancedToggle();
    const globalCb = document.getElementById('advanced-mode');
    globalCb.checked = true;
    globalCb.dispatchEvent(new Event('change'));
    const posCb = document.getElementById('pos-advanced');
    posCb.checked = false;
    posCb.dispatchEvent(new Event('change'));
    globalCb.checked = false;
    globalCb.dispatchEvent(new Event('change'));
    globalCb.checked = true;
    globalCb.dispatchEvent(new Event('change'));
    expect(posCb.checked).toBe(true);
    const posBtn = document.querySelector('.toggle-button[data-target="pos-advanced"]');
    expect(posBtn.classList.contains('active')).toBe(true);
  });

  test('enabling negative stack keeps positive advanced state', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <input type="checkbox" id="pos-advanced">
      <input type="checkbox" id="neg-advanced">
      <input type="checkbox" id="neg-stack">
      <select id="neg-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="neg-shuffle">
      <div id="neg-stack-container">
        <div class="stack-block" id="neg-stack-1">
          <select id="neg-select"></select>
          <div class="input-row"><textarea id="neg-input"></textarea></div>
          <div id="neg-order-container">
            <select id="neg-order-select"><option value="canonical">c</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="neg-order-input"></textarea></div>
          </div>
          <div id="neg-depth-container">
            <select id="neg-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="neg-depth-input"></textarea></div>
          </div>
        </div>
      </div>
    `;
    setupSectionAdvanced('pos');
    setupSectionAdvanced('neg');
    setupAdvancedToggle();
    setupStackControls();
    const globalAdv = document.getElementById('advanced-mode');
    globalAdv.checked = true;
    globalAdv.dispatchEvent(new Event('change'));
    const posAdv = document.getElementById('pos-advanced');
    posAdv.checked = false;
    posAdv.dispatchEvent(new Event('change'));
    const negStack = document.getElementById('neg-stack');
    negStack.checked = true;
    negStack.dispatchEvent(new Event('change'));
    expect(posAdv.checked).toBe(false);
  });

  test('enabling positive stack keeps negative advanced state', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <input type="checkbox" id="pos-advanced">
      <input type="checkbox" id="neg-advanced">
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <select id="pos-select"></select>
          <div class="input-row"><textarea id="pos-input"></textarea></div>
          <div id="pos-order-container">
            <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="pos-order-input"></textarea></div>
          </div>
          <div id="pos-depth-container">
            <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
          </div>
        </div>
      </div>
    `;
    setupSectionAdvanced('pos');
    setupSectionAdvanced('neg');
    setupAdvancedToggle();
    setupStackControls();
    const globalAdv = document.getElementById('advanced-mode');
    globalAdv.checked = true;
    globalAdv.dispatchEvent(new Event('change'));
    const negAdv = document.getElementById('neg-advanced');
    negAdv.checked = false;
    negAdv.dispatchEvent(new Event('change'));
    const posStack = document.getElementById('pos-stack');
    posStack.checked = true;
    posStack.dispatchEvent(new Event('change'));
    expect(negAdv.checked).toBe(false);
  });

  test('disabling negative stack keeps positive advanced state', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="advanced-mode">
      <input type="checkbox" id="pos-advanced">
      <input type="checkbox" id="neg-advanced">
      <input type="checkbox" id="neg-stack">
      <select id="neg-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="neg-shuffle">
      <div id="neg-stack-container">
        <div class="stack-block" id="neg-stack-1">
          <select id="neg-select"></select>
          <div class="input-row"><textarea id="neg-input"></textarea></div>
          <div id="neg-order-container">
            <select id="neg-order-select"><option value="canonical">c</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="neg-order-input"></textarea></div>
          </div>
          <div id="neg-depth-container">
            <select id="neg-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="neg-depth-input"></textarea></div>
          </div>
        </div>
      </div>
    `;
    setupSectionAdvanced('pos');
    setupSectionAdvanced('neg');
    setupAdvancedToggle();
    setupStackControls();
    const globalAdv = document.getElementById('advanced-mode');
    globalAdv.checked = true;
    globalAdv.dispatchEvent(new Event('change'));
    const posAdv = document.getElementById('pos-advanced');
    posAdv.checked = false;
    posAdv.dispatchEvent(new Event('change'));
    const negStack = document.getElementById('neg-stack');
    negStack.checked = true;
    negStack.dispatchEvent(new Event('change'));
    negStack.checked = false;
    negStack.dispatchEvent(new Event('change'));
    expect(posAdv.checked).toBe(false);
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

  test('updateStackBlocks adds buttons for extra stacks', () => {
    document.body.innerHTML = `
      <select id="pos-select"></select>
      <select id="pos-order-select"></select>
      <select id="pos-depth-select"></select>
      <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1"></div>
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
      <select id="pos-order-select"></select>
      <select id="pos-depth-select"></select>
      <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <div class="label-row">
            <label>Stack 1</label>
            <div class="button-col">
              <input type="checkbox" id="pos-hide-1" data-targets="pos-input,pos-order-input,pos-depth-input" hidden>
              <button type="button" class="toggle-button hide-button" data-target="pos-hide-1" data-on="☰" data-off="✖">☰</button>
            </div>
          </div>
          <div class="input-row"><textarea id="pos-input"></textarea></div>
          <div class="input-row"><textarea id="pos-order-input"></textarea></div>
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
    const posDepth2 = document.getElementById('pos-depth-input-2');
    expect(posInput2.style.display).toBe('none');
    expect(posDepth2.style.display).toBe('none');
    allHide.checked = false;
    allHide.dispatchEvent(new Event('change'));
    expect(posInput2.style.display).toBe('');
    expect(posDepth2.style.display).toBe('');
  });

  test('section all-hide applies to new stack blocks', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="pos-all-hide">
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <select id="pos-select"></select>
      <select id="pos-order-select"></select>
      <select id="pos-depth-select"></select>
      <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <div class="label-row">
            <label>Stack 1</label>
            <div class="button-col">
              <input type="checkbox" id="pos-hide-1" data-targets="pos-input,pos-order-input,pos-depth-input" hidden>
              <button type="button" class="toggle-button hide-button" data-target="pos-hide-1" data-on="☰" data-off="✖">☰</button>
            </div>
          </div>
          <div class="input-row"><textarea id="pos-input"></textarea></div>
          <div class="input-row"><textarea id="pos-order-input"></textarea></div>
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
    const posDepth2 = document.getElementById('pos-depth-input-2');
    expect(posInput2.style.display).toBe('none');
    expect(posDepth2.style.display).toBe('none');
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
      <select id="pos-order-select"></select>
      <select id="pos-depth-select"></select>
      <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <div class="label-row">
            <label>Stack 1</label>
            <div class="button-col">
              <input type="checkbox" id="pos-hide-1" data-targets="pos-input,pos-order-input,pos-depth-input" hidden>
              <button type="button" class="toggle-button hide-button" data-target="pos-hide-1" data-on="☰" data-off="✖">☰</button>
            </div>
          </div>
          <div class="input-row"><textarea id="pos-input"></textarea></div>
          <div class="input-row"><textarea id="pos-order-input"></textarea></div>
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
    const posDepth2 = document.getElementById('pos-depth-input-2');
    expect(posInput2.style.display).toBe('');
    expect(posDepth2.style.display).toBe('');
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
      <select id="pos-order-select"></select>
      <select id="pos-depth-select"></select>
      <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <div class="label-row">
            <label>Stack 1</label>
            <div class="button-col">
              <input type="checkbox" id="pos-hide-1" data-targets="pos-input,pos-order-input,pos-depth-input" hidden>
              <button type="button" class="toggle-button hide-button" data-target="pos-hide-1" data-on="☰" data-off="✖">☰</button>
            </div>
          </div>
          <div class="input-row"><textarea id="pos-input"></textarea></div>
          <div class="input-row"><textarea id="pos-order-input"></textarea></div>
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
    expect(document.getElementById('pos-depth-input-2').style.display).toBe('none');
    hideBtn.click();
    expect(document.getElementById('pos-input-2').style.display).toBe('');
    expect(document.getElementById('pos-depth-input-2').style.display).toBe('');
  });

  test('hide buttons still work after toggling stacks on and off', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <select id="pos-select"></select>
      <select id="pos-order-select"></select>
      <select id="pos-depth-select"></select>
      <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <div class="label-row">
            <label>Stack 1</label>
            <div class="button-col">
              <input type="checkbox" id="pos-hide-1" data-targets="pos-input,pos-order-input,pos-depth-input" hidden>
              <button type="button" class="toggle-button hide-button" data-target="pos-hide-1" data-on="☰" data-off="✖">☰</button>
            </div>
          </div>
          <div class="input-row"><textarea id="pos-input"></textarea></div>
          <div class="input-row"><textarea id="pos-order-input"></textarea></div>
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
    expect(document.getElementById('pos-depth-input').style.display).toBe('none');
    hideCb.checked = false;
    hideCb.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-input').style.display).toBe('');
    expect(document.getElementById('pos-depth-input').style.display).toBe('');
  });

  test('stack toggle button can turn stack off again', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="pos-stack">
      <button type="button" class="toggle-button" data-target="pos-stack" data-on="Stack On" data-off="Stack Off">Stack Off</button>
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <select id="pos-select"></select>
      <select id="pos-order-select"></select>
      <select id="pos-depth-select"></select>
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
      <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
      <select id="neg-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
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
      <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
    `;
    setupSectionOrder('pos');
    const sel = document.getElementById('pos-order-select');
    sel.value = 'random';
    sel.dispatchEvent(new Event('change'));
    const dsel = document.getElementById('pos-depth-select');
    dsel.value = 'random';
    dsel.dispatchEvent(new Event('change'));
    const btn = document.querySelector('.toggle-button[data-target="pos-order-random"]');
    expect(btn.classList.contains('active')).toBe(true);
    dsel.value = 'prepend';
    dsel.dispatchEvent(new Event('change'));
    expect(btn.classList.contains('indeterminate')).toBe(true);
  });

  test('section random button text updates with state', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="pos-order-random">
      <button type="button" class="toggle-button" data-target="pos-order-random" data-on="Randomized" data-off="Canonical">Canonical</button>
      <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
    `;
    setupSectionOrder('pos');
    const btn = document.querySelector('.toggle-button[data-target="pos-order-random"]');
    const sel = document.getElementById('pos-order-select');
    const dsel = document.getElementById('pos-depth-select');
    sel.value = 'random';
    sel.dispatchEvent(new Event('change'));
    dsel.value = 'random';
    dsel.dispatchEvent(new Event('change'));
    expect(btn.textContent).toBe('Randomized');
    dsel.value = 'prepend';
    dsel.dispatchEvent(new Event('change'));
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
      <select id="divider-order-select"><option value="canonical">c</option><option value="random">r</option></select>
      <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
      <select id="neg-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
      <button id="base-reroll" class="toggle-button random-button"></button>
      <button id="pos-reroll-1" class="toggle-button random-button"></button>
      <button id="neg-reroll-1" class="toggle-button random-button"></button>
      <button id="divider-reroll" class="toggle-button random-button"></button>
    `;
    setupSectionOrder('pos');
    setupSectionOrder('neg');
    setupShuffleAll();
    setupRerollButton('base-reroll', 'base-order-select');
    setupRerollButton('pos-reroll-1', 'pos-order-select');
    setupRerollButton('neg-reroll-1', 'neg-order-select');
    setupRerollButton('divider-reroll', 'divider-order-select');
    document.getElementById('base-reroll').click();
    document.getElementById('pos-reroll-1').click();
    document.getElementById('neg-reroll-1').click();
    document.getElementById('divider-reroll').click();
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

