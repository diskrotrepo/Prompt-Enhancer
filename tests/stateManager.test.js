/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

global.__TEST__ = true;
if (typeof window !== 'undefined') window.__TEST__ = true;

const main = require('../src/script');

function loadBody() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
  document.documentElement.innerHTML = html;
}

function runGeneratedOutput(state, randomSequence = [0]) {
  loadBody();
  const root = document.querySelector('.mix-root');
  main.applyMixState(state, root);
  const originalRandom = Math.random;
  let randomIndex = 0;
  Math.random = () => {
    if (randomIndex < randomSequence.length) {
      const next = randomSequence[randomIndex];
      randomIndex += 1;
      return next;
    }
    return randomSequence[randomSequence.length - 1] || 0;
  };
  try {
    main.generate(root);
  } finally {
    Math.random = originalRandom;
  }
  return root.querySelector('.mix-box .mix-output-text')?.textContent || '';
}

function runGeneratedChunkOutput(state, randomSequence = [0]) {
  loadBody();
  const root = document.querySelector('.mix-root');
  main.applyMixState(state, root);
  const originalRandom = Math.random;
  let randomIndex = 0;
  Math.random = () => {
    if (randomIndex < randomSequence.length) {
      const next = randomSequence[randomIndex];
      randomIndex += 1;
      return next;
    }
    return randomSequence[randomSequence.length - 1] || 0;
  };
  try {
    main.generate(root);
  } finally {
    Math.random = originalRandom;
  }
  return root.querySelector('.chunk-box .chunk-output-text')?.textContent || '';
}

function runGeneratedOutputs(state, randomSequence = [0]) {
  loadBody();
  const root = document.querySelector('.mix-root');
  main.applyMixState(state, root);
  const originalRandom = Math.random;
  let randomIndex = 0;
  Math.random = () => {
    if (randomIndex < randomSequence.length) {
      const next = randomSequence[randomIndex];
      randomIndex += 1;
      return next;
    }
    return randomSequence[randomSequence.length - 1] || 0;
  };
  try {
    main.generate(root);
  } finally {
    Math.random = originalRandom;
  }
  return Array.from(root.querySelectorAll('.mix-box .mix-output-text')).map(node => node.textContent || '');
}

describe('Mix state roundtrip', () => {
  test('exportMixState and applyMixState preserve structure', () => {
    loadBody();
    const inputState = {
      colorPresets: [
        { id: 'storm', name: 'Storm', color: '#445566' }
      ],
      mixes: [
        {
          type: 'mix',
          title: 'One',
          limit: 12,
          exact: true,
          singlePass: true,
          firstChunkBehavior: 'size',
          color: '2',
          colorMode: 'preset',
          colorPreset: 'storm',
          colorValue: '#445566',
          preserve: true,
          randomize: false,
          delimiter: { mode: 'whitespace', size: 1 },
          children: [
            { type: 'chunk', text: 'a ', limit: 12, exact: true, singlePass: true, firstChunkBehavior: 'size', colorMode: 'custom', colorValue: '#112233', randomize: false, delimiter: { mode: 'whitespace', size: 1 } },
            { type: 'chunk', text: 'b ', limit: 12, exact: true, singlePass: true, firstChunkBehavior: 'size', randomize: false, delimiter: { mode: 'whitespace', size: 1 } }
          ]
        }
      ]
    };
    main.applyMixState(inputState);
    const exported = main.exportMixState();
    expect(exported.mixes.length).toBe(1);
    expect(exported.mixes[0].children.length).toBe(2);
    expect(exported.colorPresets.length).toBe(1);
    expect(exported.colorPresets[0].name).toBe('Storm');
    expect(exported.mixes[0].colorMode).toBe('preset');
    expect(exported.mixes[0].colorPreset).toBe('storm');
    expect(exported.mixes[0].children[0].colorMode).toBe('custom');
    expect(exported.mixes[0].singlePass).toBe(true);
    expect(exported.mixes[0].firstChunkBehavior).toBe('size');
    expect(exported.mixes[0].children[0].singlePass).toBe(true);
    expect(exported.mixes[0].children[0].firstChunkBehavior).toBe('size');
    const root = document.querySelector('.mix-root');
    main.applyMixState(exported, root);
    expect(root.querySelectorAll('.chunk-box').length).toBe(2);
  });

  test('dropout length mode roundtrips through export and re-apply', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({
      mixes: [
        {
          type: 'mix',
          title: 'Dropout',
          limit: 9,
          lengthMode: 'dropout',
          preserve: true,
          randomize: false,
          delimiter: { mode: 'whitespace', size: 1 },
          children: [
            { type: 'chunk', text: 'a b c ', limit: 1000, exact: true, singlePass: true, delimiter: { mode: 'whitespace', size: 1 } },
            { type: 'chunk', text: 'x y ', limit: 1000, exact: true, singlePass: true, delimiter: { mode: 'whitespace', size: 1 } }
          ]
        }
      ]
    }, root);
    const exported = main.exportMixState(root);
    expect(exported.mixes[0].lengthMode).toBe('dropout');
    main.applyMixState(exported, root);
    expect(root.querySelector('.mix-box .length-mode')?.value).toBe('dropout');
  });

  test('string dropout length mode roundtrips through export and re-apply', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({
      mixes: [
        {
          type: 'chunk',
          title: 'Dropout String',
          text: 'a b c x y ',
          limit: 6,
          lengthMode: 'dropout',
          exact: true,
          randomize: false,
          delimiter: { mode: 'whitespace', size: 1 }
        }
      ]
    }, root);
    const exported = main.exportMixState(root);
    expect(exported.mixes[0].type).toBe('chunk');
    expect(exported.mixes[0].lengthMode).toBe('dropout');
    main.applyMixState(exported, root);
    expect(root.querySelector('.chunk-box .length-mode')?.value).toBe('dropout');
  });

  test('string dropout uses one-pass seed before random removal', () => {
    const output = runGeneratedChunkOutput(
      {
        mixes: [
          {
            type: 'chunk',
            title: 'Short Dropout String',
            text: 'a b ',
            limit: 7,
            lengthMode: 'dropout',
            orderMode: 'canonical',
            delimiter: { mode: 'whitespace', size: 1 }
          }
        ]
      },
      [0]
    );
    expect(output).toBe('a b ');
  });

  test('mix dropout uses one-pass seed before random removal', () => {
    const output = runGeneratedOutput(
      {
        mixes: [
          {
            type: 'mix',
            title: 'Short Dropout Mix',
            limit: 7,
            lengthMode: 'dropout',
            preserve: true,
            orderMode: 'canonical',
            delimiter: { mode: 'whitespace', size: 1 },
            children: [
              {
                type: 'chunk',
                text: 'a ',
                lengthMode: 'exact-once',
                orderMode: 'canonical',
                delimiter: { mode: 'whitespace', size: 1 }
              },
              {
                type: 'chunk',
                text: 'b ',
                lengthMode: 'exact-once',
                orderMode: 'canonical',
                delimiter: { mode: 'whitespace', size: 1 }
              }
            ]
          }
        ]
      },
      [0]
    );
    expect(output).toBe('a b ');
  });

  test('visible mix output reflects the rechunked result when preserve is off', () => {
    const output = runGeneratedOutput(
      {
        mixes: [
          {
            type: 'mix',
            title: 'Visible Rechunk',
            lengthMode: 'fit-smallest',
            preserve: false,
            orderMode: 'canonical',
            firstChunkBehavior: 'random-start',
            delimiter: { mode: 'whitespace', size: 1 },
            children: [
              {
                type: 'chunk',
                text: 'a b c d ',
                lengthMode: 'exact-once',
                orderMode: 'canonical',
                firstChunkBehavior: 'size',
                delimiter: { mode: 'whitespace', size: 1 }
              }
            ]
          }
        ]
      },
      [0.5]
    );
    expect(output).toBe('c d a b ');
  });

  test('full randomize shuffles the final rechunked chunk list', () => {
    const output = runGeneratedOutput(
      {
        mixes: [
          {
            type: 'mix',
            title: 'Full Random Rechunk',
            limit: 1000,
            lengthMode: 'fit-smallest',
            preserve: false,
            orderMode: 'full-randomize',
            firstChunkBehavior: 'size',
            delimiter: { mode: 'whitespace', size: 2 },
            children: [
              {
                type: 'chunk',
                text: 'a1 a2 a3 a4 ',
                lengthMode: 'exact-once',
                orderMode: 'canonical',
                firstChunkBehavior: 'size',
                delimiter: { mode: 'whitespace', size: 1 }
              },
              {
                type: 'chunk',
                text: 'b1 b2 b3 b4 ',
                lengthMode: 'exact-once',
                orderMode: 'canonical',
                firstChunkBehavior: 'size',
                delimiter: { mode: 'whitespace', size: 1 }
              }
            ]
          }
        ]
      },
      [0]
    );
    // Rechunking creates pairs first; Full randomize then shuffles those returned chunks.
    expect(output).toBe('a2 b2 a3 b3 a4 b4 a1 b1 ');
  });

  test('mix dropout skips exhausted exact-once children instead of wrapping them', () => {
    const output = runGeneratedOutput(
      {
        mixes: [
          {
            type: 'mix',
            id: 'host',
            title: 'Dropout Reroll Probe',
            limit: 1000,
            lengthMode: 'dropout',
            preserve: true,
            orderMode: 'canonical',
            delimiter: { mode: 'whitespace', size: 1 },
            children: [
              {
                type: 'chunk',
                id: 'lyrics',
                text: 'L1 L2 L3 L4 ',
                lengthMode: 'exact-once',
                orderMode: 'canonical',
                delimiter: { mode: 'whitespace', size: 1 }
              },
              {
                type: 'chunk',
                id: 'spacer',
                text: 'a b ',
                lengthMode: 'exact-once',
                orderMode: 'full-randomize',
                delimiter: { mode: 'whitespace', size: 1 }
              }
            ]
          }
        ]
      },
      [0]
    );
    // The short randomized child contributes its one shuffled pass, then longer siblings keep going.
    expect(output).toBe('L1 b L2 a L3 L4 ');
  });

  test('order mode roundtrips for mixes and strings', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({
      mixes: [
        {
          type: 'mix',
          title: 'Ordered Mix',
          orderMode: 'full-randomize',
          preserve: true,
          children: [
            { type: 'chunk', text: 'a b ' }
          ]
        },
        {
          type: 'chunk',
          title: 'Ordered String',
          text: 'x y ',
          orderMode: 'full-randomize'
        }
      ]
    }, root);
    const exported = main.exportMixState(root);
    expect(exported.mixes[0].orderMode).toBe('full-randomize');
    expect(exported.mixes[1].orderMode).toBe('full-randomize');
    main.applyMixState(exported, root);
    const mixOrder = root.querySelector('.mix-box .order-mode');
    const chunkOrder = Array.from(root.querySelectorAll('.chunk-box'))
      .find(box => box.querySelector('.box-title')?.value === 'Ordered String')
      ?.querySelector('.order-mode');
    expect(mixOrder?.value).toBe('full-randomize');
    expect(chunkOrder?.value).toBe('full-randomize');
  });

  test('preserve mode exports the remembered first-chunk behavior', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({
      mixes: [
        {
          type: 'mix',
          title: 'Latent First Chunk',
          preserve: true,
          firstChunkBehavior: 'random-start',
          delimiter: { mode: 'whitespace', size: 3 },
          children: []
        }
      ]
    }, root);
    const select = root.querySelector('.mix-box .first-chunk-select');
    expect(select?.disabled).toBe(true);
    expect(select?.value).toBe('size');
    expect(select?.dataset.prevValue).toBe('random-start');
    const exported = main.exportMixState(root);
    expect(exported.mixes[0].firstChunkBehavior).toBe('random-start');
  });

  test('blank strings export the delimiter that will resume after typing', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({
      mixes: [
        {
          type: 'chunk',
          title: 'Latent Delimiter',
          text: '',
          firstChunkBehavior: 'random-start',
          delimiter: { mode: 'custom-any', custom: ',.', size: 3 }
        }
      ]
    }, root);
    const chunk = root.querySelector('.chunk-box');
    expect(chunk?.querySelector('.delimiter-select')?.value).toBe('empty-chunk');
    expect(chunk?.querySelector('.delimiter-select')?.dataset.prevValue).toBe('custom-any');
    expect(chunk?.querySelector('.delimiter-custom')?.value).toBe(',.');
    const exported = main.exportMixState(root);
    expect(exported.mixes[0].delimiter).toEqual({ mode: 'custom-any', custom: ',.', size: 3 });
    expect(exported.mixes[0].firstChunkBehavior).toBe('random-start');
  });

  test('collapsed state roundtrips for mixes and strings', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({
      mixes: [
        {
          type: 'mix',
          title: 'Collapsed Mix',
          collapsed: true,
          preserve: true,
          children: [
            { type: 'chunk', title: 'Open Child', text: 'a ' }
          ]
        },
        {
          type: 'chunk',
          title: 'Collapsed String',
          text: 'x ',
          collapsed: true
        }
      ]
    }, root);
    const exported = main.exportMixState(root);
    expect(exported.mixes[0].collapsed).toBe(true);
    expect(exported.mixes[1].collapsed).toBe(true);
    expect(exported.mixes[0].minimized).toBe(true);
    expect(exported.mixes[1].minimized).toBe(true);
    expect(exported.mixes[0].maximized).toBe(false);
    expect(exported.mixes[1].maximized).toBe(false);
    main.applyMixState(exported, root);
    const mixBox = root.querySelector('.mix-box');
    const collapsedString = Array.from(root.querySelectorAll('.chunk-box'))
      .find(box => box.querySelector('.box-title')?.value === 'Collapsed String');
    expect(mixBox?.classList.contains('is-collapsed')).toBe(true);
    expect(collapsedString?.classList.contains('is-collapsed')).toBe(true);
  });

  test('legacy randomize booleans map to order modes on load', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({
      mixes: [
        {
          type: 'mix',
          title: 'Legacy Mix',
          randomize: true,
          preserve: true,
          children: [{ type: 'chunk', text: 'a ' }]
        },
        {
          type: 'chunk',
          title: 'Legacy String',
          text: 'x ',
          randomize: true
        }
      ]
    }, root);
    const mixOrder = root.querySelector('.mix-box .order-mode');
    const chunkOrder = Array.from(root.querySelectorAll('.chunk-box'))
      .find(box => box.querySelector('.box-title')?.value === 'Legacy String')
      ?.querySelector('.order-mode');
    expect(mixOrder?.value).toBe('randomize-interleave');
    expect(chunkOrder?.value).toBe('full-randomize');
  });

  test('fit-largest rerolls wrapped randomized child mixes instead of replaying one cycle', () => {
    const state = {
      mixes: [
        {
          type: 'mix',
          id: 'host',
          title: 'Host',
          limit: 1000,
          lengthMode: 'fit-largest',
          preserve: true,
          orderMode: 'canonical',
          delimiter: { mode: 'whitespace', size: 1 },
          children: [
            {
              type: 'chunk',
              id: 'lyrics',
              text: 'L1 L2 L3 L4 ',
              lengthMode: 'exact-once',
              orderMode: 'canonical',
              delimiter: { mode: 'whitespace', size: 1 }
            },
            {
              type: 'mix',
              id: 'spacer-source',
              title: 'Spacer Source',
              lengthMode: 'fit-smallest',
              preserve: true,
              orderMode: 'full-randomize',
              delimiter: { mode: 'whitespace', size: 1 },
              children: [
                {
                  type: 'chunk',
                  id: 'spacer-a',
                  text: 'a ',
                  lengthMode: 'exact-once',
                  orderMode: 'canonical',
                  delimiter: { mode: 'whitespace', size: 1 }
                },
                {
                  type: 'chunk',
                  id: 'spacer-b',
                  text: 'b ',
                  lengthMode: 'exact-once',
                  orderMode: 'canonical',
                  delimiter: { mode: 'whitespace', size: 1 }
                }
              ]
            }
          ]
        }
      ]
    };
    const output = runGeneratedOutput(state, [0, 0.99]);
    expect(output).toBe('L1 b L2 a L3 a L4 b ');
  });

  test('mix variable output matches duplicated submix output for randomized order modes', () => {
    const buildSourceMix = orderMode => ({
      type: 'mix',
      id: 'source',
      title: 'Source',
      limit: 1000,
      lengthMode: 'fit-smallest',
      preserve: true,
      orderMode,
      delimiter: { mode: 'whitespace', size: 1 },
      children: [
        {
          type: 'chunk',
          id: 'source-chunk-a',
          text: 'a b c ',
          lengthMode: 'exact-once',
          orderMode: 'canonical',
          delimiter: { mode: 'whitespace', size: 1 }
        },
        {
          type: 'chunk',
          id: 'source-chunk-x',
          text: 'x y z ',
          lengthMode: 'exact-once',
          orderMode: 'canonical',
          delimiter: { mode: 'whitespace', size: 1 }
        }
      ]
    });
    const buildHost = children => ({
      type: 'mix',
      id: 'host',
      title: 'Host',
      limit: 1000,
      lengthMode: 'fit-smallest',
      preserve: true,
      orderMode: 'canonical',
      delimiter: { mode: 'whitespace', size: 1 },
      children
    });
    const randomSequence = [0, 0, 0, 0.99, 0.99, 0.99, 0.2, 0.8, 0.1, 0.7];

    ['randomize-interleave', 'full-randomize'].forEach(orderMode => {
      const sourceForVariable = buildSourceMix(orderMode);
      const sourceForDuplicate = buildSourceMix(orderMode);
      const variableState = {
        mixes: [
          buildHost([
            sourceForVariable,
            { type: 'variable', id: 'source-variable', targetId: 'source' }
          ])
        ]
      };
      const duplicatedState = {
        mixes: [
          buildHost([
            sourceForDuplicate,
            {
              ...JSON.parse(JSON.stringify(sourceForDuplicate)),
              id: 'source-copy',
              title: 'Source Copy'
            }
          ])
        ]
      };

      const viaVariable = runGeneratedOutput(variableState, randomSequence);
      const viaDuplicate = runGeneratedOutput(duplicatedState, randomSequence);
      expect(viaVariable).toBe(viaDuplicate);
    });
  });

  test('duplicate loaded ids are rekeyed so sibling mixes do not share cached output', () => {
    const state = {
      mixes: [
        {
          type: 'mix',
          id: 'host',
          title: 'Host',
          limit: 1000,
          lengthMode: 'fit-smallest',
          preserve: true,
          orderMode: 'canonical',
          delimiter: { mode: 'whitespace', size: 1 },
          children: [
            {
              type: 'mix',
              id: 'dup-mix',
              title: 'Source A',
              limit: 1000,
              lengthMode: 'fit-smallest',
              preserve: true,
              orderMode: 'canonical',
              delimiter: { mode: 'whitespace', size: 1 },
              children: [
                {
                  type: 'chunk',
                  id: 'dup-chunk',
                  text: 'A ',
                  lengthMode: 'exact-once',
                  orderMode: 'canonical',
                  delimiter: { mode: 'whitespace', size: 1 }
                }
              ]
            },
            {
              type: 'mix',
              id: 'dup-mix',
              title: 'Source B',
              limit: 1000,
              lengthMode: 'fit-smallest',
              preserve: true,
              orderMode: 'canonical',
              delimiter: { mode: 'whitespace', size: 1 },
              children: [
                {
                  type: 'chunk',
                  id: 'dup-chunk',
                  text: 'B ',
                  lengthMode: 'exact-once',
                  orderMode: 'canonical',
                  delimiter: { mode: 'whitespace', size: 1 }
                }
              ]
            }
          ]
        }
      ]
    };
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState(state, root);
    const ids = Array.from(root.querySelectorAll('.mix-box, .chunk-box, .variable-box'))
      .map(box => box.dataset.boxId)
      .filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    main.generate(root);
    expect(root.querySelector('.mix-box .mix-output-text')?.textContent || '').toBe('A B ');
  });

  test('top-level mixes with duplicate child ids stay isolated after hydration', () => {
    const outputs = runGeneratedOutputs({
      mixes: [
        {
          type: 'mix',
          id: 'mix-a',
          title: 'Mix A',
          limit: 1000,
          lengthMode: 'fit-smallest',
          preserve: true,
          orderMode: 'canonical',
          delimiter: { mode: 'whitespace', size: 1 },
          children: [
            {
              type: 'chunk',
              id: 'dup-chunk',
              text: 'A1 A2 ',
              lengthMode: 'exact-once',
              orderMode: 'canonical',
              delimiter: { mode: 'whitespace', size: 1 }
            }
          ]
        },
        {
          type: 'mix',
          id: 'mix-b',
          title: 'Mix B',
          limit: 1000,
          lengthMode: 'fit-smallest',
          preserve: true,
          orderMode: 'canonical',
          delimiter: { mode: 'whitespace', size: 1 },
          children: [
            {
              type: 'chunk',
              id: 'dup-chunk',
              text: 'B1 B2 ',
              lengthMode: 'exact-once',
              orderMode: 'canonical',
              delimiter: { mode: 'whitespace', size: 1 }
            }
          ]
        }
      ]
    });
    expect(outputs).toEqual(['A1 A2 ', 'B1 B2 ']);
  });

  test('appendMixState inserts a saved list at the requested mix level and remaps variable targets', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({
      mixes: [
        {
          type: 'mix',
          id: 'host',
          title: 'Host',
          limit: 1000,
          lengthMode: 'fit-smallest',
          preserve: true,
          orderMode: 'canonical',
          delimiter: { mode: 'whitespace', size: 1 },
          children: [
            {
              type: 'chunk',
              id: 'source',
              title: 'Existing Source',
              text: 'old ',
              lengthMode: 'exact-once',
              orderMode: 'canonical',
              delimiter: { mode: 'whitespace', size: 1 }
            }
          ]
        }
      ]
    }, root);

    const hostChildren = root.querySelector('.mix-box .mix-children');
    const added = main.appendMixState({
      mixes: [
        {
          type: 'chunk',
          id: 'source',
          title: 'Imported Source',
          text: 'new ',
          lengthMode: 'exact-once',
          orderMode: 'canonical',
          delimiter: { mode: 'whitespace', size: 1 }
        },
        {
          type: 'variable',
          id: 'imported-variable',
          targetId: 'source'
        }
      ]
    }, hostChildren, root);

    expect(added).toBe(2);
    const ids = Array.from(root.querySelectorAll('.mix-box, .chunk-box, .variable-box'))
      .map(box => box.dataset.boxId)
      .filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);

    const importedVariable = root.querySelector('.variable-box');
    const remappedTarget = importedVariable?.dataset.targetId || '';
    expect(remappedTarget).not.toBe('source');
    expect(root.querySelector(`[data-box-id="${remappedTarget}"] .chunk-input`)?.value).toBe('new ');

    main.generate(root);
    expect(root.querySelector('.mix-box .mix-output-text')?.textContent || '').toBe('old new new ');
  });
});
