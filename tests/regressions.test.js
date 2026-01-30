/** @jest-environment jsdom */

const main = require('../src/script');
const { buildChunkList, mixChunkLists } = main;

describe('Mixing regressions', () => {
  test('basic spacing with divider chunks remains intact', () => {
    const lists = [
      buildChunkList('a ', { regex: /\s+/, size: 1, sentenceMode: false }, 6, false, false),
      buildChunkList('b ', { regex: /\s+/, size: 1, sentenceMode: false }, 6, false, false),
      buildChunkList('d ', { regex: /\s+/, size: 1, sentenceMode: false }, 6, false, false)
    ];
    const mixed = mixChunkLists(lists, 6, false, false).join('');
    expect(mixed).toBe('a b d ');
  });

  test('exact length trims final chunk without injecting delimiters', () => {
    const list = buildChunkList('ab ', { regex: /\s+/, size: 1, sentenceMode: false }, 3, true, false).join('');
    expect(list).toBe('ab ');
  });
});
