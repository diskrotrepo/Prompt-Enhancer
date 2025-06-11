const {
  parseInput,
  shuffle,
  equalizeLength,
  buildPrefixedList,
  buildVersions,
} = require('../src/script');

describe('Utility functions', () => {
  test('parseInput keeps delimiters and spaces', () => {
    const input = 'a, b; c\nd';
    expect(parseInput(input)).toEqual(['a, ', 'b; ', 'c\n', 'd']);
  });

  test('parseInput recognizes various delimiters', () => {
    const input = 'hello! world? great: yes.';
    expect(parseInput(input)).toEqual(['hello! ', 'world? ', 'great: ', 'yes.']);
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

  test('buildVersions builds positive and negative prompts', () => {
    const items = parseInput('cat, dog');
    const out = buildVersions(items, ['bad'], ['good'], false, false, false, 25);
    expect(out).toEqual({ positive: 'good cat, good dog', negative: 'bad cat, bad dog' });
  });

  test('buildVersions repeats items with trailing delimiter', () => {
    const items = parseInput('1, 2, 3, ');
    const out = buildVersions(items, [], [], false, false, false, 40);
    expect(out.positive.startsWith('1, 2, 3, 1, 2, 3,'))
      .toBe(true);
    expect(out.positive.length).toBeLessThanOrEqual(40);
  });

  test('buildVersions applies long positive list', () => {
    const fs = require('fs');
    const vm = require('vm');
    const src = fs.readFileSync(require.resolve('../src/lists/good_lists.js'), 'utf8');
    const context = {};
    vm.runInNewContext(src + ';this.POSITIVE_LISTS = POSITIVE_LISTS;', context);
    const posMods = context.POSITIVE_LISTS.presets.find(p => p.id === 'image-positive').items;
    const items = parseInput('1, 2, 3, ');
    const out = buildVersions(items, [], posMods, false, false, false, 200);
    expect(out.positive.startsWith('masterpiece 1, best quality 2, high quality 3, top quality 1,'))
      .toBe(true);
  });

  test('buildVersions can include positive terms for negatives', () => {
    const out = buildVersions(['cat'], ['bad'], ['good'], false, false, false, 20, true);
    expect(out).toEqual({ positive: 'good cat, ', negative: 'bad good cat, ' });
  });
});
