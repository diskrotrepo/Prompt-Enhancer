const {
  parseInput,
  shuffle,
  equalizeLength,
  buildPrefixedList,
  buildVersions,
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
});
