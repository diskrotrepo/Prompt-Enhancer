/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { createDom, closeDom, registerDomCleanup } = require('./helpers/dom');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', 'index.html');
const SCRIPT_PATH = path.join(ROOT, 'src', 'script.js');
const INPUT_PATH = path.join(__dirname, 'sanity', 'prompt_sanity_input.json');
const EXPECTED_PATH = path.join(__dirname, 'sanity', 'prompt_sanity_expected.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Sanity harness: spin up the UI, optionally run scripted actions, then collect visible state.
// Inputs: testCase object from fixtures. Output: snapshot fields for expectations.
function runSanityCase(testCase) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const dom = createDom(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;

  if (window.localStorage) window.localStorage.clear();
  window.alert = () => {};

  // Capture downloads + prompts + clipboard to validate non-output behaviors.
  if (!window.URL) window.URL = {};
  if (typeof window.URL.createObjectURL !== 'function') {
    window.URL.createObjectURL = () => 'blob:mock';
  }
  if (typeof window.URL.revokeObjectURL !== 'function') {
    window.URL.revokeObjectURL = () => {};
  }
  const downloadNames = [];
  const originalCreate = window.document.createElement.bind(window.document);
  window.document.createElement = tagName => {
    const el = originalCreate(tagName);
    if (String(tagName).toLowerCase() === 'a') {
      el.click = () => {
        downloadNames.push(el.download);
      };
    }
    return el;
  };
  const promptResponses = Array.isArray(testCase.promptResponses) ? testCase.promptResponses.slice() : [];
  let promptCount = 0;
  window.prompt = () => {
    promptCount += 1;
    return promptResponses.length ? promptResponses.shift() : '';
  };
  const clipboardState = { last: '' };
  const clipboardShim = {
    writeText: text => {
      clipboardState.last = text;
      return {
        then: cb => {
          cb();
          return { catch: () => {} };
        }
      };
    }
  };
  try {
    window.navigator.clipboard = clipboardShim;
  } catch (err) {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: clipboardShim,
      configurable: true
    });
  }

  window.eval(fs.readFileSync(SCRIPT_PATH, 'utf8'));
  if (testCase.persistedState && window.localStorage) {
    const raw =
      typeof testCase.persistedState === 'string'
        ? testCase.persistedState
        : JSON.stringify(testCase.persistedState);
    window.localStorage.setItem('promptEnhancerMixData', raw);
  }
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }

  const randomFallback = typeof testCase.random === 'number' ? testCase.random : 0;
  const randomSequence = Array.isArray(testCase.randomSequence)
    ? testCase.randomSequence.filter(value => typeof value === 'number')
    : [];
  const setDeterministicRandom = () => {
    let randomIndex = 0;
    window.Math.random = () => {
      if (!randomSequence.length) return randomFallback;
      if (randomIndex < randomSequence.length) {
        const next = randomSequence[randomIndex];
        randomIndex += 1;
        return next;
      }
      return randomSequence[randomSequence.length - 1];
    };
  };

  // Normalize action tokens so fixtures can be short strings or full objects.
  const normalizeAction = action => {
    if (typeof action === 'string') return { type: action };
    if (action && typeof action === 'object') return action;
    return { type: '' };
  };
  const getActiveWindow = () =>
    window.document.querySelector('.app-window:not(.window-template)');
  const getActiveRoot = () => {
    const active = getActiveWindow();
    return active?.querySelector('.mix-root') || window.document.querySelector('.mix-root');
  };
  const runAction = (action, root, actionResults) => {
    const normalized = normalizeAction(action);
    const { type } = normalized;
    if (type === 'openWindow') {
      const windowType = typeof normalized.windowType === 'string' ? normalized.windowType : '';
      if (!windowType) return;
      const menuItem = window.document.querySelector(`.menu-item[data-window=\"${windowType}\"]`);
      if (menuItem) menuItem.click();
      return;
    }
    if (type === 'openPromptsWindow') {
      const menuItem = window.document.querySelector('.menu-item[data-window=\"prompts\"]');
      if (menuItem) menuItem.click();
      return;
    }
    if (type === 'menuSave' || type === 'menuSaveAs') {
      const actionKey = type === 'menuSaveAs' ? 'save-as' : 'save';
      const win = getActiveWindow();
      const item =
        win?.querySelector(`.prompt-menu-item[data-action=\"${actionKey}\"]`) ||
        window.document.querySelector(`.prompt-menu-item[data-action=\"${actionKey}\"]`);
      if (item) item.click();
      return;
    }
    if (type === 'copyMixOutput') {
      const btn = root?.querySelector('.mix-box .copy-output');
      if (btn) btn.click();
      actionResults.mixCopiedText = clipboardState.last;
      return;
    }
    if (type === 'copyChunkOutput') {
      const btn = root?.querySelector('.chunk-box .copy-input');
      if (btn) btn.click();
      actionResults.chunkCopiedText = clipboardState.last;
      return;
    }
    if (type === 'removeFirstVariable') {
      // Exercise delegated remove handlers through the real UI path.
      const btn = root?.querySelector('.variable-box .remove-box');
      if (btn) btn.click();
      return;
    }
    if (type === 'generate') {
      const btn =
        root?.closest('.app-window')?.querySelector('.generate-button') ||
        window.document.querySelector('.generate-button');
      if (btn) {
        btn.click();
      } else if (root) {
        window.PromptMixer.generate(root);
      }
      return;
    }
    if (type === 'setFirstChunkInput') {
      const chunkInput = root?.querySelector('.chunk-box .chunk-input');
      if (!chunkInput) return;
      chunkInput.value = typeof normalized.value === 'string' ? normalized.value : '';
      chunkInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    }
  };

  const actions = Array.isArray(testCase.actions) ? testCase.actions : [];
  const preActions = actions.filter(action => normalizeAction(action).type === 'openPromptsWindow');
  const preGenerateActions = actions.filter(action => normalizeAction(action).type === 'setFirstChunkInput');
  const postActions = actions.filter(action => {
    const type = normalizeAction(action).type;
    return type !== 'openPromptsWindow' && type !== 'setFirstChunkInput';
  });
  preActions.forEach(action => runAction(action));

  const root = getActiveRoot();
  if (!root) throw new Error('Missing mix root');
  if (testCase.state) {
    window.PromptMixer.applyMixState(testCase.state, root);
  }
  preGenerateActions.forEach(action => runAction(action, root));
  // Reset Math.random right before generation so fixture sequences only drive
  // evaluation behavior (state hydration can consume random values for colors).
  setDeterministicRandom();
  window.PromptMixer.generate(root);
  const actionResults = { mixCopiedText: '', chunkCopiedText: '' };
  // Run post-generate actions (copy, menu saves) so outputs are available.
  postActions.forEach(action => runAction(action, root, actionResults));

  const mixBox = root.querySelector('.mix-box');
  const chunkBox = root.querySelector('.chunk-box');
  const output = mixBox?.querySelector('.mix-output-text')?.textContent || '';
  const chunkOutput = chunkBox?.querySelector('.chunk-output-text')?.textContent || '';
  const chunkLengthMode = chunkBox?.querySelector('.length-mode')?.value || '';
  const chunkOrderMode = chunkBox?.querySelector('.order-mode')?.value || '';
  const chunkDelimiterMode = chunkBox?.querySelector('.delimiter-select')?.value || '';
  const chunkDelimiterDisabled = !!chunkBox?.querySelector('.delimiter-select')?.disabled;
  const lengthMode = mixBox?.querySelector('.length-mode')?.value || '';
  const mixOrderMode = mixBox?.querySelector('.order-mode')?.value || '';
  const preserve = mixBox?.querySelector('.delimiter-size')?.value === 'preserve';
  const firstChunkSelect = mixBox?.querySelector('.first-chunk-select');
  const firstChunkDisabled = !!(firstChunkSelect?.disabled || firstChunkSelect?.classList.contains('disabled'));
  const lengthLimitDisabled = !!mixBox?.querySelector('.length-input')?.disabled;
  const windowTitle =
    window.document.querySelector('.app-window:not(.window-template) .window-header .box-title')
      ?.textContent ||
    window.document.querySelector('.prompt-window .window-header .box-title')?.textContent ||
    '';
  const variableBox = root.querySelector('.variable-box') || window.document.querySelector('.variable-box');
  const variableTitle = variableBox?.querySelector('.box-title')?.textContent || '';
  const colorMode = mixBox?.dataset?.colorMode || '';
  const colorValue = mixBox?.dataset?.colorValue || '';
  const colorPreset = mixBox?.dataset?.colorPreset || '';
  const chunkColorMode = chunkBox?.dataset?.colorMode || '';
  const chunkColorValue = chunkBox?.dataset?.colorValue || '';
  const chunkColorPreset = chunkBox?.dataset?.colorPreset || '';
  const mixCount = root.querySelectorAll('.mix-box').length;
  const variableCount = root.querySelectorAll('.variable-box').length;
  const mixCollapsed = !!mixBox?.classList?.contains('is-collapsed');
  const chunkCollapsed = !!chunkBox?.classList?.contains('is-collapsed');
  const hasLoadPresetMenu = !!(
    getActiveWindow()?.querySelector('.prompt-menu-item[data-action="load-preset"]') ||
    window.document.querySelector('.prompt-window:not(.window-template) .prompt-menu-item[data-action="load-preset"]')
  );
  const hasOpenRouterMenu = !!window.document.querySelector('.menu-item[data-window="openrouter"]');
  const openRouterWindowCount = window.document.querySelectorAll('.openrouter-window:not(.window-template)').length;
  const hasOpenRouterEncryptedSettingsControls = !!(
    window.document.querySelector('.openrouter-save-settings') &&
    window.document.querySelector('.openrouter-load-settings') &&
    window.document.querySelector('.openrouter-load-settings-file') &&
    window.document.querySelector('.openrouter-settings-password')
  );
  const result = {
    id: testCase.id,
    output,
    chunkOutput,
    chunkLengthMode,
    chunkOrderMode,
    chunkDelimiterMode,
    chunkDelimiterDisabled,
    lengthMode,
    mixOrderMode,
    preserve,
    firstChunkDisabled,
    lengthLimitDisabled,
    windowTitle,
    variableTitle,
    colorMode,
    colorValue,
    colorPreset,
    chunkColorMode,
    chunkColorValue,
    chunkColorPreset,
    mixCount,
    variableCount,
    mixCollapsed,
    chunkCollapsed,
    hasLoadPresetMenu,
    hasOpenRouterMenu,
    openRouterWindowCount,
    hasOpenRouterEncryptedSettingsControls,
    mixCopiedText: actionResults.mixCopiedText,
    chunkCopiedText: actionResults.chunkCopiedText,
    promptCount,
    downloadNames
  };
  closeDom(dom);
  return result;
}

describe('Sanity regression via real UI flow', () => {
  test('sanity cases match curated outputs', () => {
    const inputData = readJson(INPUT_PATH);
    const expectedData = readJson(EXPECTED_PATH);
    const expectedMap = new Map(
      (expectedData.cases || []).map(entry => [entry.id, entry])
    );

    (inputData.cases || []).forEach(testCase => {
      const result = runSanityCase(testCase);
      const expected = expectedMap.get(result.id);
      if (!expected) {
        throw new Error(`Missing expected output for sanity case: ${result.id}`);
      }
      expect(result.output).toBe(expected.output);
      if (Object.prototype.hasOwnProperty.call(expected, 'lengthMode')) {
        expect(result.lengthMode).toBe(expected.lengthMode);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'preserve')) {
        expect(result.preserve).toBe(expected.preserve);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'firstChunkDisabled')) {
        expect(result.firstChunkDisabled).toBe(expected.firstChunkDisabled);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'lengthLimitDisabled')) {
        expect(result.lengthLimitDisabled).toBe(expected.lengthLimitDisabled);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'windowTitle')) {
        expect(result.windowTitle).toBe(expected.windowTitle);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'variableTitle')) {
        expect(result.variableTitle).toBe(expected.variableTitle);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'colorMode')) {
        expect(result.colorMode).toBe(expected.colorMode);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'colorValue')) {
        expect(result.colorValue).toBe(expected.colorValue);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'colorPreset')) {
        expect(result.colorPreset).toBe(expected.colorPreset);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkOutput')) {
        expect(result.chunkOutput).toBe(expected.chunkOutput);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkLengthMode')) {
        expect(result.chunkLengthMode).toBe(expected.chunkLengthMode);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkOrderMode')) {
        expect(result.chunkOrderMode).toBe(expected.chunkOrderMode);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkDelimiterMode')) {
        expect(result.chunkDelimiterMode).toBe(expected.chunkDelimiterMode);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkDelimiterDisabled')) {
        expect(result.chunkDelimiterDisabled).toBe(expected.chunkDelimiterDisabled);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'mixOrderMode')) {
        expect(result.mixOrderMode).toBe(expected.mixOrderMode);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'mixCopiedText')) {
        expect(result.mixCopiedText).toBe(expected.mixCopiedText);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkCopiedText')) {
        expect(result.chunkCopiedText).toBe(expected.chunkCopiedText);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'promptCount')) {
        expect(result.promptCount).toBe(expected.promptCount);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'downloadNames')) {
        expect(result.downloadNames).toEqual(expected.downloadNames);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkColorMode')) {
        expect(result.chunkColorMode).toBe(expected.chunkColorMode);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkColorValue')) {
        expect(result.chunkColorValue).toBe(expected.chunkColorValue);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkColorPreset')) {
        expect(result.chunkColorPreset).toBe(expected.chunkColorPreset);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'mixCount')) {
        expect(result.mixCount).toBe(expected.mixCount);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'variableCount')) {
        expect(result.variableCount).toBe(expected.variableCount);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'mixCollapsed')) {
        expect(result.mixCollapsed).toBe(expected.mixCollapsed);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'chunkCollapsed')) {
        expect(result.chunkCollapsed).toBe(expected.chunkCollapsed);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasLoadPresetMenu')) {
        expect(result.hasLoadPresetMenu).toBe(expected.hasLoadPresetMenu);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasOpenRouterMenu')) {
        expect(result.hasOpenRouterMenu).toBe(expected.hasOpenRouterMenu);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'openRouterWindowCount')) {
        expect(result.openRouterWindowCount).toBe(expected.openRouterWindowCount);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasOpenRouterEncryptedSettingsControls')) {
        expect(result.hasOpenRouterEncryptedSettingsControls).toBe(expected.hasOpenRouterEncryptedSettingsControls);
      }
    });
  });
});
// Centralized JSDOM teardown keeps tests from leaking handles.
registerDomCleanup();
