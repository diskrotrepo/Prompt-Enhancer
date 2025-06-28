const {
  parseInput,
  shuffle,
  equalizeLength,
  buildPrefixedList,
  buildVersions,
  processLyrics,
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
      ['i.e., ']
    );
    expect(out.positive.includes('i.e.,')).toBe(true);
    expect(out.positive.startsWith('a, b, i.e., ')).toBe(true);
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
