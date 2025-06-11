const {
  parseInput,
  shuffle,
  equalizeLength,
  buildPrefixedList,
  buildVersions,
} = require('../src/script');

describe('Utility functions', () => {
  test('parseInput keeps delimiters', () => {
    const input = 'a, b; c\nd';
    expect(parseInput(input)).toEqual(['a,', 'b;', 'c\n', 'd']);
  });

  test('parseInput recognizes various delimiters', () => {
    const input = 'hello! world? great: yes.';
    expect(parseInput(input)).toEqual(['hello!', 'world?', 'great:', 'yes.']);
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
    const out = buildVersions(['cat'], ['bad'], ['good'], false, false, false, 20);
    expect(out).toEqual({ positive: 'good cat, good cat', negative: 'bad cat, bad cat' });
  });

  test('buildVersions can include positive terms for negatives', () => {
    const out = buildVersions(['cat'], ['bad'], ['good'], false, false, false, 20, true);
    expect(out).toEqual({ positive: 'good cat', negative: 'bad good cat' });
  });
});
