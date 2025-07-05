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
