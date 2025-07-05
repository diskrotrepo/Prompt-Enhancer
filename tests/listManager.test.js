/** @jest-environment jsdom */

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const lists = require('../src/listManager');

global.__TEST__ = true;
if (typeof window !== 'undefined') window.__TEST__ = true;

test('loadPresets loads default JSON', async () => {
  await lists.loadPresets(path.join(__dirname, '..', 'src', 'default_list.json'));
  const data = JSON.parse(lists.exportLists());
  expect(data.presets.length).toBeGreaterThan(0);
});

function loadBrowserLists() {
  const code = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'listManager.js'),
    'utf8'
  );
  const context = {
    window: {
      document: {
        getElementById: () => null
      },
      promptUtils: require('../src/lib/promptUtils')
    }
  };
  vm.runInNewContext(code, context);
  return { api: context.window.listManager, ctx: context };
}

test('loadPresets uses fetch in browser', async () => {
  const sample = { presets: [{ id: 't', title: 'T', type: 'base', items: ['a'] }] };
  const mockFetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve(sample) })
  );
  global.__TEST_BROWSER__ = true;
  global.document = { getElementById: () => null };
  global.promptUtils = require('../src/lib/promptUtils');
  const origFetch = global.fetch;
  global.fetch = mockFetch;
  await lists.loadPresets('foo.json');
  expect(mockFetch).toHaveBeenCalledWith('foo.json');
  const data = JSON.parse(lists.exportLists());
  expect(data.presets[0].id).toBe('t');
  global.fetch = origFetch;
  delete global.document;
  delete global.promptUtils;
  delete global.__TEST_BROWSER__;
});

test('loadPresets falls back to XHR', async () => {
  const sample = { presets: [{ id: 'x', title: 'X', type: 'base', items: ['b'] }] };
  global.__TEST_BROWSER__ = true;
  global.document = { getElementById: () => null };
  global.promptUtils = require('../src/lib/promptUtils');
  const origFetch = global.fetch;
  global.fetch = jest.fn(() => Promise.reject(new Error('fail')));
  const origXhr = global.XMLHttpRequest;
  function MockXhr() {
    this.open = () => {};
    this.send = () => {
      this.responseText = JSON.stringify(sample);
    };
  }
  global.XMLHttpRequest = MockXhr;
  await lists.loadPresets('bar.json');
  const data = JSON.parse(lists.exportLists());
  expect(data.presets[0].id).toBe('x');
  global.fetch = origFetch;
  global.XMLHttpRequest = origXhr;
  delete global.document;
  delete global.promptUtils;
  delete global.__TEST_BROWSER__;
});
