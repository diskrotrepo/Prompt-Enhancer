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
  buildDelimiterRegex
} = main;

describe('Chunking + mixing engine', () => {
  test('parseInput preserves delimiters', () => {
    expect(parseInput('a b ')).toEqual(['a ', 'b ']);
  });

  test('buildChunkList repeats chunks to reach limit', () => {
    const list = buildChunkList('a ', { regex: /\s+/, size: 1, sentenceMode: false }, 4, false, false);
    expect(list.join('')).toBe('a a ');
  });

  test('buildChunkList trims when exact length is on', () => {
    const list = buildChunkList('abc ', { regex: /\s+/, size: 1, sentenceMode: false }, 5, true, false);
    expect(list.join('')).toBe('abc a');
  });

  test('buildChunkList randomizes chunk order when enabled', () => {
    const orig = Math.random;
    Math.random = jest.fn().mockReturnValue(0);
    const list = buildChunkList('a b ', { regex: /\s+/, size: 1, sentenceMode: false }, 4, false, true);
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
});

describe('Delimiter regex', () => {
  test('buildDelimiterRegex defaults to whitespace', () => {
    expect(buildDelimiterRegex(' ')).toEqual(/\s+/);
  });
});
