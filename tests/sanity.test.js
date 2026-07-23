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
  // Wallpaper renders are event-driven; execute their single queued frame now
  // so fixture observations describe the state produced by each wheel action.
  window.requestAnimationFrame = callback => {
    callback(0);
    return 1;
  };
  window.cancelAnimationFrame = () => {};

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
    if (type === 'scrollWallpaper') {
      if (!actionResults) return;
      const wallpaper = window.document.querySelector('.desktop-confetti');
      const target = normalized.target === 'window'
        ? window.document.querySelector(
            '.app-window:not(.window-template) .prompt-body, .app-window:not(.window-template) > .box-body'
          )
        : window.document.getElementById('window-area');
      if (!wallpaper || !target) return;
      const readState = () => ({
        band: Number(wallpaper.dataset.wallpaperBand),
        offset: Number(wallpaper.dataset.wallpaperOffset),
        scene: wallpaper.dataset.wallpaperScene || '',
        theme: wallpaper.dataset.wallpaperTheme || '',
        poolSize: Number(wallpaper.dataset.wallpaperPoolSize)
      });
      const before = readState();
      const repeat = Math.max(1, Math.floor(Number(normalized.repeat) || 1));
      for (let index = 0; index < repeat; index += 1) {
        const wheel = new window.Event('wheel', { bubbles: true, cancelable: true });
        Object.defineProperties(wheel, {
          deltaY: { value: Number(normalized.deltaY) || 0 },
          deltaMode: { value: Number(normalized.deltaMode) || 0 }
        });
        target.dispatchEvent(wheel);
      }
      const after = readState();
      actionResults.wallpaperMoved =
        after.band !== before.band || after.offset !== before.offset;
      actionResults.wallpaperSceneChanged = after.scene !== before.scene;
      actionResults.wallpaperThemeChanged = after.theme !== before.theme;
      actionResults.wallpaperPoolStable =
        Number.isFinite(before.poolSize) && after.poolSize === before.poolSize;
      actionResults.wallpaperOffsetFinite =
        Number.isFinite(after.band) && Number.isFinite(after.offset);
      return;
    }
    if (type === 'flingWallpaper') {
      if (!actionResults) return;
      const wallpaper = window.document.querySelector('.desktop-confetti');
      const area = window.document.getElementById('window-area');
      if (!wallpaper || !area) return;
      const readState = () => ({
        band: Number(wallpaper.dataset.wallpaperBand),
        offset: Number(wallpaper.dataset.wallpaperOffset),
        scene: wallpaper.dataset.wallpaperScene || '',
        poolSize: Number(wallpaper.dataset.wallpaperPoolSize),
        momentum: wallpaper.dataset.wallpaperMomentum || ''
      });
      const previousRequestFrame = window.requestAnimationFrame;
      const previousCancelFrame = window.cancelAnimationFrame;
      const frameQueue = [];
      const canceledFrames = new Set();
      let frameId = 0;
      let frameTime = 0;
      window.requestAnimationFrame = callback => {
        frameId += 1;
        frameQueue.push({ id: frameId, callback });
        return frameId;
      };
      window.cancelAnimationFrame = id => canceledFrames.add(id);
      const flushFrames = limit => {
        let flushed = 0;
        while (frameQueue.length && flushed < limit) {
          const frame = frameQueue.shift();
          if (canceledFrames.has(frame.id)) continue;
          frameTime += 1000 / 60;
          frame.callback(frameTime);
          flushed += 1;
        }
      };
      const dispatchTouch = (eventType, touches, changedTouches, timeStamp) => {
        const touchEvent = new window.Event(eventType, { bubbles: true, cancelable: true });
        Object.defineProperties(touchEvent, {
          touches: { value: touches },
          changedTouches: { value: changedTouches },
          timeStamp: { value: timeStamp }
        });
        area.dispatchEvent(touchEvent);
      };
      const before = readState();
      const start = { identifier: 41, clientX: 180, clientY: 620 };
      const firstMove = { identifier: 41, clientX: 180, clientY: 530 };
      const secondMove = { identifier: 41, clientX: 180, clientY: 440 };
      dispatchTouch('touchstart', [start], [start], 100);
      dispatchTouch('touchmove', [firstMove], [firstMove], 116);
      dispatchTouch('touchmove', [secondMove], [secondMove], 132);
      const afterDrag = readState();
      dispatchTouch('touchend', [], [secondMove], 148);
      const released = readState();
      flushFrames(1);
      const afterReleaseFrame = readState();
      // Sample the middle of the coast separately from the final rest. This
      // guards the deliberately leisurely feel as well as eventual cleanup.
      flushFrames(89);
      const longTail = readState();
      flushFrames(240);
      const settled = readState();
      window.requestAnimationFrame = previousRequestFrame;
      window.cancelAnimationFrame = previousCancelFrame;
      actionResults.wallpaperMoved =
        settled.band !== before.band || settled.offset !== before.offset;
      actionResults.wallpaperMomentumContinued =
        released.momentum === 'active' && afterReleaseFrame.scene !== afterDrag.scene;
      actionResults.wallpaperMomentumLongTail = longTail.momentum === 'active';
      actionResults.wallpaperMomentumSettled = settled.momentum === 'idle';
      actionResults.wallpaperPoolStable = settled.poolSize === before.poolSize;
      actionResults.wallpaperOffsetFinite =
        Number.isFinite(settled.band) && Number.isFinite(settled.offset);
      return;
    }
    if (type === 'activateFirstPromptBody') {
      const body = window.document.querySelector(
        '.app-window[data-window=\"prompts\"]:not(.window-template) .prompt-body'
      );
      if (!body) return;
      body.dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
      return;
    }
    if (type === 'snapFirstPromptWindow') {
      if (!actionResults) return;
      const area = window.document.getElementById('window-area');
      const win = window.document.querySelector(
        '.app-window[data-window="prompts"]:not(.window-template)'
      );
      const header = win?.querySelector('.window-header');
      if (!area || !win || !header) return;
      area.getBoundingClientRect = () => ({
        left: 0,
        top: 42,
        width: 1200,
        height: 900,
        right: 1200,
        bottom: 942
      });
      win.getBoundingClientRect = () => ({
        left: 220,
        top: 200,
        width: 640,
        height: 420,
        right: 860,
        bottom: 620
      });
      const dispatchPointer = (target, eventType, clientX, clientY) => {
        const pointerEvent = new window.Event(eventType, { bubbles: true, cancelable: true });
        Object.defineProperties(pointerEvent, {
          clientX: { value: clientX },
          clientY: { value: clientY },
          pointerId: { value: 77 }
        });
        target.dispatchEvent(pointerEvent);
      };
      dispatchPointer(header, 'pointerdown', 260, 230);
      dispatchPointer(window.document, 'pointermove', 1199, 400);
      dispatchPointer(window.document, 'pointerup', 1199, 400);
      const left = parseFloat(win.style.left) || 0;
      const top = parseFloat(win.style.top) || 0;
      const width = parseFloat(win.style.width) || 0;
      const height = parseFloat(win.style.height) || 0;
      actionResults.windowSnapTarget = win.dataset.snapTarget || '';
      actionResults.snapAssistSlotCount = area.querySelectorAll('.window-snap-assist-slot').length;
      actionResults.snappedFrameFlush =
        left + width === 1200 && top === 0 && height === 900;
      return;
    }
    if (type === 'snapSecondPromptWindowIntoExistingLayout') {
      if (!actionResults) return;
      const area = window.document.getElementById('window-area');
      const windows = Array.from(window.document.querySelectorAll(
        '.app-window[data-window="prompts"]:not(.window-template)'
      ));
      const [rightWindow, leftWindow] = windows;
      const header = leftWindow?.querySelector('.window-header');
      if (!area || !rightWindow || !leftWindow || !header) return;
      leftWindow.getBoundingClientRect = () => ({
        left: 260,
        top: 230,
        width: 640,
        height: 420,
        right: 900,
        bottom: 650
      });
      const dispatchPointer = (target, eventType, clientX, clientY) => {
        const pointerEvent = new window.Event(eventType, { bubbles: true, cancelable: true });
        Object.defineProperties(pointerEvent, {
          clientX: { value: clientX },
          clientY: { value: clientY },
          pointerId: { value: 78 }
        });
        target.dispatchEvent(pointerEvent);
      };
      dispatchPointer(header, 'pointerdown', 300, 250);
      dispatchPointer(window.document, 'pointermove', 0, 400);
      dispatchPointer(window.document, 'pointerup', 0, 400);
      const sharedBoundary = parseFloat(leftWindow.style.left) + parseFloat(leftWindow.style.width);
      actionResults.existingLayoutAssistSuppressed = !area.querySelector('.window-snap-assist');
      actionResults.snapDividerCount = area.querySelectorAll('.window-snap-divider').length;
      actionResults.sharedSnapBoundaryFlush =
        leftWindow.dataset.snapTarget === 'left' &&
        rightWindow.dataset.snapTarget === 'right' &&
        sharedBoundary === parseFloat(rightWindow.style.left) &&
        sharedBoundary + parseFloat(rightWindow.style.width) === 1200;
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
    if (type === 'addVariableToMix') {
      const mixId = typeof normalized.mixId === 'string' ? normalized.mixId : '';
      const mixBox = Array.from(root?.querySelectorAll('.mix-box') || [])
        .find(box => !mixId || box.dataset.boxId === mixId);
      const body = Array.from(mixBox?.children || [])
        .find(child => child.classList?.contains('box-body'));
      const actionRow = Array.from(body?.children || [])
        .find(child => child.classList?.contains('mix-actions'));
      const btn = actionRow?.querySelector('.add-variable-child');
      if (btn) btn.click();
      return;
    }
    if (type === 'selectVariableSource') {
      const variableId = typeof normalized.variableId === 'string' ? normalized.variableId : '';
      const targetId = typeof normalized.targetId === 'string' ? normalized.targetId : '';
      const variableBox = Array.from(root?.querySelectorAll('.variable-box') || [])
        .find(box => !variableId || box.dataset.boxId === variableId);
      const select = variableBox?.querySelector('.variable-select');
      if (!select || !targetId) return;
      select.value = targetId;
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
      return;
    }
    if (type === 'appendSaveToFirstMix') {
      const win = getActiveWindow();
      const btn = root?.querySelector('.mix-box .add-save-child');
      const input = win?.querySelector('.append-save-file') || window.document.querySelector('.append-save-file');
      if (!btn || !input) return;
      const saveState = normalized.state && typeof normalized.state === 'object'
        ? normalized.state
        : { mixes: [] };
      const previousFileReader = window.FileReader;
      window.FileReader = class {
        readAsText(file) {
          this.result = file?.content || '';
          if (typeof this.onload === 'function') this.onload();
        }
      };
      btn.click();
      Object.defineProperty(input, 'files', {
        value: [
          {
            name: normalized.fileName || 'append-save.json',
            content: JSON.stringify(saveState)
          }
        ],
        configurable: true
      });
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
      window.FileReader = previousFileReader;
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
  const actionResults = {
    mixCopiedText: '',
    chunkCopiedText: '',
    wallpaperMoved: false,
    wallpaperSceneChanged: false,
    wallpaperThemeChanged: false,
    wallpaperPoolStable: false,
    wallpaperOffsetFinite: false,
    wallpaperMomentumContinued: false,
    wallpaperMomentumLongTail: false,
    wallpaperMomentumSettled: false,
    windowSnapTarget: '',
    snapAssistSlotCount: 0,
    snappedFrameFlush: false,
    existingLayoutAssistSuppressed: false,
    snapDividerCount: 0,
    sharedSnapBoundaryFlush: false
  };
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
  const patternedBoxes = Array.from(root.querySelectorAll('.mix-box, .chunk-box, .variable-box'));
  const boxPatternCount = patternedBoxes.filter(box => box.dataset.pattern).length;
  const boxPatternPaletteReady = patternedBoxes.every(box =>
    Boolean(box.style.getPropertyValue('--box-pattern-paper'))
  );
  const boxPatternHierarchyDistinct = patternedBoxes.every(box => {
    const parentBox = box.parentElement?.closest?.('.mix-box, .chunk-box, .variable-box');
    return !parentBox || parentBox.dataset.pattern !== box.dataset.pattern;
  });
  const boxPatternDensityReady = patternedBoxes.every(box => {
    const profile = window.PromptMixer.BOX_PATTERN_PROFILES[box.dataset.pattern];
    const unit = parseInt(box.style.getPropertyValue('--box-pattern-unit'), 10);
    const span = parseInt(box.style.getPropertyValue('--box-pattern-span'), 10);
    return profile &&
      unit >= profile.unit[0] && unit <= profile.unit[1] &&
      span >= profile.span[0] && span <= profile.span[1];
  });
  const hasLoadPresetMenu = !!(
    getActiveWindow()?.querySelector('.prompt-menu-item[data-action="load-preset"]') ||
    window.document.querySelector('.prompt-window:not(.window-template) .prompt-menu-item[data-action="load-preset"]')
  );
  // File parity is partly structural: both breakpoints consume this one glyph +
  // label launcher. CSS regression checks separately ensure mobile adds no
  // pseudo-arrow or divergent chrome on top of the shared markup.
  const fileLauncher = getActiveWindow()?.querySelector('.prompt-menu-start');
  const hasSharedFileLauncherMarkup = !!(
    fileLauncher &&
    fileLauncher.children.length === 2 &&
    fileLauncher.querySelector(':scope > .prompt-menu-glyph')?.textContent === '///' &&
    fileLauncher.querySelector(':scope > .prompt-menu-label')?.textContent === 'file'
  );
  const hasOpenRouterMenu = !!window.document.querySelector('.menu-item[data-window="openrouter"]');
  const openRouterWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
  const openRouterWindowCount = window.document.querySelectorAll('.openrouter-window:not(.window-template)').length;
  const promptWindowCount = window.document.querySelectorAll('.app-window[data-window="prompts"]:not(.window-template)').length;
  const taskbarButtonCount = window.document.querySelectorAll('#taskbar .taskbar-button').length;
  const focusedWindowInstance =
    window.document.querySelector('.app-window.is-focused:not(.window-template)')?.dataset?.instance || '';
  const hasOpenRouterEncryptedSettingsControls = !!(
    window.document.querySelector('.openrouter-menu-start') &&
    window.document.querySelector('.openrouter-menu-dropdown .prompt-menu-item[data-action="save-settings"]') &&
    window.document.querySelector('.openrouter-menu-dropdown .prompt-menu-item[data-action="load-settings"]') &&
    window.document.querySelector('.openrouter-load-settings-file')
  );
  const hasOpenRouterHelpMode = !!(
    openRouterWindow?.querySelector('.help-toggle') &&
    openRouterWindow?.querySelector('.help-overlay') &&
    openRouterWindow?.dataset?.helpReady === 'true'
  );
  // Help copy is a UI contract: every visible control intercepted by the
  // overlay needs a short label plus concrete detail, and glyph-only controls
  // also need an accessible name outside Help Mode.
  const helpWindow = getActiveWindow();
  const helpTargets = helpWindow
    ? Array.from(helpWindow.querySelectorAll(
        'button, input:not([type="file"]), select, textarea, [role="menuitem"], .resize-handle'
      ))
    : [];
  const hasCompleteHelpCopy = !!(
    helpTargets.length &&
    helpTargets.every(target => target.dataset.help?.trim() && target.dataset.helpDetail?.trim())
  );
  const helpIconButtons = helpWindow ? Array.from(helpWindow.querySelectorAll('.icon-button')) : [];
  const hasAccessibleIconHelp = !!(
    helpIconButtons.length &&
    helpIconButtons.every(button =>
      button.getAttribute('aria-label')?.trim() &&
      button.dataset.help?.trim() &&
      button.dataset.helpDetail?.trim()
    )
  );
  const proportionalLengthHelp = helpWindow?.querySelector('.mix-box .length-mode');
  const proportionalOrderHelp = helpWindow?.querySelector('.mix-box .order-mode');
  const hasProportionalDropoutHelp = !!(
    proportionalLengthHelp?.value === 'proportional-dropout' &&
    proportionalLengthHelp.dataset.helpDetail?.includes('Proportional Dropout') &&
    proportionalLengthHelp.dataset.helpDetail?.includes('without changing child chunks') &&
    proportionalOrderHelp?.dataset.helpDetail?.includes('local progress window')
  );
  const openRouterTitleHelp = openRouterWindow?.querySelector('.openrouter-title');
  const openRouterLoadHelp = openRouterWindow?.querySelector('[data-action="load-settings"]');
  const openRouterSaveHelp = openRouterWindow?.querySelector('[data-action="save-settings"]');
  const openRouterTopKHelp = openRouterWindow?.querySelector('.openrouter-top-k');
  const openRouterStatusHelp = openRouterWindow?.querySelector('.openrouter-status');
  const hasAccurateOpenRouterHelp = !!(
    openRouterTitleHelp?.dataset.helpDetail?.includes('not included') &&
    openRouterLoadHelp?.dataset.helpDetail?.includes('asks for its password') &&
    !openRouterLoadHelp?.dataset.helpDetail?.includes('password field') &&
    openRouterSaveHelp?.dataset.helpDetail?.includes('all sampling controls') &&
    openRouterTopKHelp?.dataset.helpDetail?.includes('omitted for Hyperbolic') &&
    openRouterStatusHelp?.dataset.helpDetail?.includes('input/output tokens')
  );
  const hasOpenRouterSharedCopyControl = !!(
    openRouterWindow?.querySelector('.openrouter-output > .openrouter-output-header .copy-output.openrouter-copy-output')
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
    boxPatternCount,
    boxPatternPaletteReady,
    boxPatternHierarchyDistinct,
    boxPatternDensityReady,
    hasLoadPresetMenu,
    hasSharedFileLauncherMarkup,
    hasOpenRouterMenu,
    openRouterWindowCount,
    promptWindowCount,
    taskbarButtonCount,
    focusedWindowInstance,
    hasOpenRouterEncryptedSettingsControls,
    hasOpenRouterHelpMode,
    hasCompleteHelpCopy,
    hasAccessibleIconHelp,
    hasProportionalDropoutHelp,
    hasAccurateOpenRouterHelp,
    hasOpenRouterSharedCopyControl,
    wallpaperMoved: actionResults.wallpaperMoved,
    wallpaperSceneChanged: actionResults.wallpaperSceneChanged,
    wallpaperThemeChanged: actionResults.wallpaperThemeChanged,
    wallpaperPoolStable: actionResults.wallpaperPoolStable,
    wallpaperOffsetFinite: actionResults.wallpaperOffsetFinite,
    wallpaperMomentumContinued: actionResults.wallpaperMomentumContinued,
    wallpaperMomentumLongTail: actionResults.wallpaperMomentumLongTail,
    wallpaperMomentumSettled: actionResults.wallpaperMomentumSettled,
    windowSnapTarget: actionResults.windowSnapTarget,
    snapAssistSlotCount: actionResults.snapAssistSlotCount,
    snappedFrameFlush: actionResults.snappedFrameFlush,
    existingLayoutAssistSuppressed: actionResults.existingLayoutAssistSuppressed,
    snapDividerCount: actionResults.snapDividerCount,
    sharedSnapBoundaryFlush: actionResults.sharedSnapBoundaryFlush,
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
      if (Object.prototype.hasOwnProperty.call(expected, 'boxPatternCount')) {
        expect(result.boxPatternCount).toBe(expected.boxPatternCount);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'boxPatternPaletteReady')) {
        expect(result.boxPatternPaletteReady).toBe(expected.boxPatternPaletteReady);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'boxPatternHierarchyDistinct')) {
        expect(result.boxPatternHierarchyDistinct).toBe(expected.boxPatternHierarchyDistinct);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'boxPatternDensityReady')) {
        expect(result.boxPatternDensityReady).toBe(expected.boxPatternDensityReady);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasLoadPresetMenu')) {
        expect(result.hasLoadPresetMenu).toBe(expected.hasLoadPresetMenu);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasSharedFileLauncherMarkup')) {
        expect(result.hasSharedFileLauncherMarkup).toBe(expected.hasSharedFileLauncherMarkup);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasOpenRouterMenu')) {
        expect(result.hasOpenRouterMenu).toBe(expected.hasOpenRouterMenu);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'openRouterWindowCount')) {
        expect(result.openRouterWindowCount).toBe(expected.openRouterWindowCount);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasCompleteHelpCopy')) {
        expect(result.hasCompleteHelpCopy).toBe(expected.hasCompleteHelpCopy);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasAccessibleIconHelp')) {
        expect(result.hasAccessibleIconHelp).toBe(expected.hasAccessibleIconHelp);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasProportionalDropoutHelp')) {
        expect(result.hasProportionalDropoutHelp).toBe(expected.hasProportionalDropoutHelp);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasAccurateOpenRouterHelp')) {
        expect(result.hasAccurateOpenRouterHelp).toBe(expected.hasAccurateOpenRouterHelp);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'promptWindowCount')) {
        expect(result.promptWindowCount).toBe(expected.promptWindowCount);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'taskbarButtonCount')) {
        expect(result.taskbarButtonCount).toBe(expected.taskbarButtonCount);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'focusedWindowInstance')) {
        expect(result.focusedWindowInstance).toBe(expected.focusedWindowInstance);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasOpenRouterEncryptedSettingsControls')) {
        expect(result.hasOpenRouterEncryptedSettingsControls).toBe(expected.hasOpenRouterEncryptedSettingsControls);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasOpenRouterHelpMode')) {
        expect(result.hasOpenRouterHelpMode).toBe(expected.hasOpenRouterHelpMode);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'hasOpenRouterSharedCopyControl')) {
        expect(result.hasOpenRouterSharedCopyControl).toBe(expected.hasOpenRouterSharedCopyControl);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'wallpaperMoved')) {
        expect(result.wallpaperMoved).toBe(expected.wallpaperMoved);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'wallpaperSceneChanged')) {
        expect(result.wallpaperSceneChanged).toBe(expected.wallpaperSceneChanged);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'wallpaperThemeChanged')) {
        expect(result.wallpaperThemeChanged).toBe(expected.wallpaperThemeChanged);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'wallpaperPoolStable')) {
        expect(result.wallpaperPoolStable).toBe(expected.wallpaperPoolStable);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'wallpaperOffsetFinite')) {
        expect(result.wallpaperOffsetFinite).toBe(expected.wallpaperOffsetFinite);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'wallpaperMomentumContinued')) {
        expect(result.wallpaperMomentumContinued).toBe(expected.wallpaperMomentumContinued);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'wallpaperMomentumLongTail')) {
        expect(result.wallpaperMomentumLongTail).toBe(expected.wallpaperMomentumLongTail);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'wallpaperMomentumSettled')) {
        expect(result.wallpaperMomentumSettled).toBe(expected.wallpaperMomentumSettled);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'windowSnapTarget')) {
        expect(result.windowSnapTarget).toBe(expected.windowSnapTarget);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'snapAssistSlotCount')) {
        expect(result.snapAssistSlotCount).toBe(expected.snapAssistSlotCount);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'snappedFrameFlush')) {
        expect(result.snappedFrameFlush).toBe(expected.snappedFrameFlush);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'existingLayoutAssistSuppressed')) {
        expect(result.existingLayoutAssistSuppressed).toBe(expected.existingLayoutAssistSuppressed);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'snapDividerCount')) {
        expect(result.snapDividerCount).toBe(expected.snapDividerCount);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'sharedSnapBoundaryFlush')) {
        expect(result.sharedSnapBoundaryFlush).toBe(expected.sharedSnapBoundaryFlush);
      }
    });
  });
});
// Centralized JSDOM teardown keeps tests from leaking handles.
registerDomCleanup();
