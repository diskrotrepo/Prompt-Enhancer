/** @jest-environment jsdom */

global.__TEST__ = true;
if (typeof window !== 'undefined') {
  window.__TEST__ = true;
}

const main = require('../src/script');

const {
  parseInput,
  buildChunkList,
  mixChunkLists,
  buildDelimiterRegex,
  dropChunksToLimit
} = main;

describe('Chunking + mixing engine', () => {
  test('parseInput preserves delimiters', () => {
    expect(parseInput('a b ')).toEqual(['a ', 'b ']);
  });

  test('parseInput keeps consecutive delimiters separate', () => {
    expect(parseInput('a   b', false, /\s/, 1)).toEqual(['a ', ' ', ' ', 'b']);
  });

  test('parseInput offsets the first grouped chunk size', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0.6);
    const parsed = parseInput('a b c d ', false, /\s/, 3);
    Math.random = orig;
    expect(parsed).toEqual(['a b ', 'c d ']);
  });

  test('parseInput keeps fixed grouping when first chunk behavior is size', () => {
    const parsed = parseInput('a b c d ', false, /\s/, 2, 'size');
    expect(parsed).toEqual(['a b ', 'c d ']);
  });

  test('parseInput rotates when first chunk behavior is random-start', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0.5);
    const parsed = parseInput('a b c d ', false, /\s/, 2, 'random-start');
    Math.random = orig;
    expect(parsed).toEqual(['c d ', 'a b ']);
  });

  test('buildChunkList repeats chunks to reach limit', () => {
    const list = buildChunkList('a ', { regex: /\s/, size: 1, sentenceMode: false }, 4, false, false);
    expect(list.join('')).toBe('a a ');
  });

  test('buildChunkList single-pass stops after one traversal', () => {
    const list = buildChunkList('a b ', { regex: /\s/, size: 1, sentenceMode: false }, 10, true, false, true);
    expect(list.join('')).toBe('a b ');
  });

  test('buildChunkList trims when exact length is on', () => {
    const list = buildChunkList('abc ', { regex: /\s/, size: 1, sentenceMode: false }, 5, true, false);
    expect(list.join('')).toBe('abc a');
  });

  test('buildChunkList randomizes chunk order when enabled', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0);
    const list = buildChunkList('a b ', { regex: /\s/, size: 1, sentenceMode: false }, 4, false, true);
    Math.random = orig;
    expect(list.join('')).toBe('b a ');
  });

  test('mixChunkLists interleaves lists in canonical order', () => {
    const mixed = mixChunkLists([['a '], ['b '], ['d ']], 6, false, false);
    expect(mixed.join('')).toBe('a b d ');
  });

  test('mixChunkLists randomizes list order per cycle', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0);
    const mixed = mixChunkLists([['a '], ['b '], ['c ']], 6, false, true);
    Math.random = orig;
    expect(mixed.join('')).toBe('b c a ');
  });

  test('mixChunkLists single-pass stops after one cycle', () => {
    const mixed = mixChunkLists([['a '], ['b ']], 100, false, false, true);
    expect(mixed.join('')).toBe('a b ');
  });

  test('mixChunkLists fit-smallest stops when the shortest list is exhausted', () => {
    const mixed = mixChunkLists([['a1 ', 'a2 ', 'a3 '], ['b1 ', 'b2 ']], 100, false, false, true, 'smallest');
    expect(mixed.join('')).toBe('a1 b1 a2 b2 ');
  });

  test('mixChunkLists fit-smallest emits nothing when any child list is empty', () => {
    const mixed = mixChunkLists([['a1 ', 'a2 '], []], 100, false, false, true, 'smallest');
    expect(mixed.join('')).toBe('');
  });

  test('mixChunkLists fit-largest repeats shorter lists until the longest list is exhausted', () => {
    const mixed = mixChunkLists([['a1 ', 'a2 ', 'a3 '], ['b1 ', 'b2 ']], 100, false, false, true, 'largest');
    expect(mixed.join('')).toBe('a1 b1 a2 b2 a3 b1 ');
  });

  test('dropout removes random chunks until output is under the limit', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0);
    const full = mixChunkLists(
      [['a1 ', 'a2 ', 'a3 '], ['b1 ', 'b2 ']],
      100,
      true,
      false,
      true,
      'largest'
    );
    const dropped = dropChunksToLimit(full, 9);
    Math.random = orig;
    expect(full.join('')).toBe('a1 b1 a2 b2 a3 b1 ');
    expect(dropped.join('')).toBe('b2 a3 b1 ');
  });

  test('dropout can remove all chunks when limit is below every chunk length', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0);
    const dropped = dropChunksToLimit(['abcd '], 2);
    Math.random = orig;
    expect(dropped).toEqual([]);
  });
});

describe('Delimiter regex', () => {
  test('buildDelimiterRegex defaults to whitespace', () => {
    expect(buildDelimiterRegex(' ')).toEqual(/\s/);
  });
});
