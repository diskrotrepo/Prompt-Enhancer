/** @jest-environment jsdom */

const path = require('path');
const lists = require('../src/listManager');

global.__TEST__ = true;
if (typeof window !== 'undefined') window.__TEST__ = true;

test('loadPresets loads default JSON', async () => {
  global.__TEST__ = false;
  if (typeof window !== 'undefined') window.__TEST__ = false;
  await lists.loadPresets(path.join(__dirname, '..', 'src', 'default_list.json'));
  const data = JSON.parse(lists.exportLists());
  expect(data.presets.length).toBeGreaterThan(0);
  global.__TEST__ = true;
  if (typeof window !== 'undefined') window.__TEST__ = true;
});

test('loadPresets falls back when fetch fails', async () => {
  const json = require('fs').readFileSync(
    path.join(__dirname, '..', 'src', 'default_list.json'),
    'utf8'
  );
  const oldFetch = global.fetch;
  const oldXHR = global.XMLHttpRequest;
  global.fetch = jest.fn(() => Promise.reject(new Error('fail')));
  function XHR() {
    this.open = jest.fn();
    this.send = jest.fn(() => {
      this.status = 200;
      this.responseText = json;
    });
  }
  global.XMLHttpRequest = XHR;
  await lists.loadPresets(path.join(__dirname, '..', 'src', 'default_list.json'));
  const data = JSON.parse(lists.exportLists());
  expect(data.presets.length).toBeGreaterThan(0);
  global.fetch = oldFetch;
  global.XMLHttpRequest = oldXHR;
});
