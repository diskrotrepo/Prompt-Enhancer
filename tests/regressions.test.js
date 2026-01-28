/** @jest-environment jsdom */

const setupBaseDom = () => {
  document.body.innerHTML = `
    <select id="neg-select"></select>
    <textarea id="neg-input"></textarea>
    <select id="pos-select"></select>
    <textarea id="pos-input"></textarea>
    <select id="length-select"></select>
    <input id="length-input">
    <select id="divider-select"></select>
    <textarea id="divider-input"></textarea>
    <select id="base-select"></select>
    <textarea id="base-input"></textarea>
    <select id="lyrics-select"></select>
    <textarea id="lyrics-input"></textarea>
    <select id="lyrics-insert-select"></select>
    <textarea id="lyrics-insert-input"></textarea>
    <select id="base-order-select"></select>
    <select id="pos-order-select"></select>
    <select id="neg-order-select"></select>
    <button id="generate"></button>
  `;
};

const setupCopyDom = () => {
  document.body.innerHTML = `
    <textarea id="base-input">alpha</textarea>
    <button type="button" class="copy-button" data-target="base-input">Copy</button>
  `;
};

const loadModule = () => {
  jest.resetModules();
  global.__TEST__ = true;
  if (typeof window !== 'undefined') {
    window.__TEST__ = true;
  }
  return require('../src/script');
};

describe('Regression coverage for list/order handling', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    delete global.DEFAULT_LIST;
    delete global.DEFAULT_DATA;
  });

  test('importLists drops order presets', () => {
    setupBaseDom();
    const main = loadModule();
    const lists = main;
    lists.importLists({
      presets: [{ id: 'order-1', title: 'Order 1', type: 'order', items: '1,0' }]
    });
    const remaining = JSON.parse(lists.exportLists())
      .presets
      .filter(p => p.type === 'order');
    expect(remaining).toHaveLength(0);
  });

  test('additive imports also drop order presets', () => {
    setupBaseDom();
    const main = loadModule();
    const lists = main;
    lists.importLists({
      presets: [{ id: 'order-1', title: 'Order 1', type: 'order', items: '1,0' }]
    });
    lists.importLists(
      { presets: [{ id: 'base-1', title: 'Base', type: 'base', items: 'x' }] },
      true
    );
    const remaining = JSON.parse(lists.exportLists())
      .presets
      .filter(p => p.type === 'order');
    expect(remaining).toHaveLength(0);
  });

  test('order dropdowns stay built-in after import', () => {
    setupBaseDom();
    const main = loadModule();
    const lists = main;
    const ui = main;
    lists.importLists({ presets: [] });
    ui.initializeUI();
    const select = document.getElementById('base-order-select');
    const initial = Array.from(select.options).map(o => o.value);
    expect(initial).toEqual(['canonical', 'random']);
    lists.importLists({
      presets: [{ id: 'order-2', title: 'Order 2', type: 'order', items: '0,1' }]
    });
    const updated = Array.from(select.options).map(o => o.value);
    expect(updated).toEqual(['canonical', 'random']);
  });

  test('copy buttons fall back to execCommand when clipboard API is unavailable', async () => {
    setupCopyDom();
    const main = loadModule();
    const ui = main;
    document.execCommand = jest.fn().mockReturnValue(true);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    if ('clipboard' in navigator) {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    }
    ui.setupCopyButtons();
    document.querySelector('.copy-button').click();
    await Promise.resolve();
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    errorSpy.mockRestore();
  });

  test('copy buttons fall back to execCommand when clipboard writes reject', async () => {
    setupCopyDom();
    const main = loadModule();
    const ui = main;
    document.execCommand = jest.fn().mockReturnValue(true);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockRejectedValue(new Error('blocked')) },
      configurable: true
    });
    ui.setupCopyButtons();
    document.querySelector('.copy-button').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    errorSpy.mockRestore();
  });
});
