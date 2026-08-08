const fs = require('fs');
const path = require('path');
const { createDom, registerDomCleanup } = require('./helpers/dom');

// Centralized JSDOM teardown keeps tests from leaking handles.
registerDomCleanup();

describe('New mixing layout', () => {
  test('mix and chunk templates exist', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const dom = createDom(html);
    expect(dom.window.document.getElementById('mix-box-template')).not.toBeNull();
    expect(dom.window.document.getElementById('chunk-box-template')).not.toBeNull();
    expect(dom.window.document.getElementById('variable-box-template')).not.toBeNull();
    expect(dom.window.document.querySelector('.append-save-file')).not.toBeNull();
    expect(dom.window.document.getElementById('mix-box-template').content.querySelector('.add-save-child')).not.toBeNull();
    expect(dom.window.document.querySelector('.add-root-save')).not.toBeNull();
  });

  test('tab buttons exist', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const dom = createDom(html);
    const menu = dom.window.document.getElementById('menu-bar');
    const glyph = dom.window.document.getElementById('menu-start');
    const prompts = dom.window.document.getElementById('window-prompts-template');
    const audio = dom.window.document.getElementById('window-audio-template');
    const openrouter = dom.window.document.getElementById('window-openrouter-template');
    const terminal = dom.window.document.getElementById('window-terminal-template');
    const about = dom.window.document.getElementById('window-about-template');
    expect(menu).not.toBeNull();
    expect(glyph).not.toBeNull();
    expect(prompts).not.toBeNull();
    expect(audio).not.toBeNull();
    expect(openrouter).not.toBeNull();
    expect(terminal).not.toBeNull();
    expect(about).not.toBeNull();
  });

  test('Help-enabled controls have specific copy and accessible icon labels', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const dom = createDom(html);
    const document = dom.window.document;
    const surfaces = [
      document.getElementById('window-prompts-template'),
      document.getElementById('window-openrouter-template'),
      document.getElementById('window-terminal-template'),
      document.getElementById('mix-box-template').content,
      document.getElementById('chunk-box-template').content,
      document.getElementById('variable-box-template').content
    ];
    const helpTargets = surfaces.flatMap(surface => Array.from(surface.querySelectorAll(
      'button, input:not([type="file"]), select, textarea, [role="menuitem"], .resize-handle'
    )));
    const missingCopy = helpTargets
      .filter(target => !target.dataset.help?.trim() || !target.dataset.helpDetail?.trim())
      .map(target => target.className || target.tagName);

    expect(missingCopy).toEqual([]);
    expect(helpTargets.some(target => target.dataset.helpDetail.includes('More detail coming soon'))).toBe(false);

    const iconButtons = surfaces.flatMap(surface => Array.from(surface.querySelectorAll('.icon-button')));
    expect(iconButtons.length).toBeGreaterThan(0);
    expect(iconButtons.every(button => button.getAttribute('aria-label')?.trim())).toBe(true);
    expect(iconButtons.every(button => button.dataset.help?.trim() && button.dataset.helpDetail?.trim())).toBe(true);

    const mixLengthHelp = document.getElementById('mix-box-template').content.querySelector('.length-mode');
    const mixOrderHelp = document.getElementById('mix-box-template').content.querySelector('.order-mode');
    expect(mixLengthHelp.dataset.helpDetail).toContain('Proportional Dropout');
    expect(mixLengthHelp.dataset.helpDetail).toContain('without changing child chunks');
    expect(mixOrderHelp.dataset.helpDetail).toContain('local progress window');

    const titleHelp = document.querySelector('.openrouter-title');
    const encryptedOpenHelp = document.querySelector('[data-action="load-settings"]');
    const encryptedSaveHelp = document.querySelector('[data-action="save-settings"]');
    expect(titleHelp.dataset.helpDetail).toContain('not included');
    expect(encryptedOpenHelp.dataset.helpDetail).toContain('Completion product kind and version');
    expect(encryptedOpenHelp.dataset.helpDetail).toContain('ready without another catalog request');
    expect(encryptedSaveHelp.dataset.helpDetail).toContain("every provider's endpoint, model, and API key");
    expect(encryptedSaveHelp.dataset.helpDetail).toContain('versioned Completion-only');

    const terminalTemplate = document.getElementById('window-terminal-template');
    const terminalKeyHelp = document.querySelector('.terminal-secret-input');
    const terminalTranscriptHelp = document.querySelector('.terminal-transcript');
    const terminalMessageHelp = document.querySelector('.terminal-message');
    const terminalFaceHelp = document.querySelector('.terminal-face-panel');
    expect(terminalTemplate.querySelector('.terminal-surface')).not.toBeNull();
    expect(terminalTemplate.querySelector('.terminal-connection-panel')).toBeNull();
    expect(terminalTemplate.querySelector('select')).toBeNull();
    expect(terminalTemplate.querySelectorAll('.terminal-app button')).toHaveLength(1);
    expect(terminalTemplate.querySelector('.terminal-send')).toBeNull();
    expect(terminalTemplate.querySelector('.terminal-session-readout')).toBeNull();
    expect(terminalKeyHelp.dataset.helpDetail).toContain('characters remain masked');
    expect(terminalKeyHelp.dataset.helpDetail).toContain('do not appear in the transcript');
    expect(terminalKeyHelp.dataset.helpDetail).toContain('Short menu choices are rejected');
    expect(terminalTranscriptHelp.dataset.helpDetail).toContain('Shows connection questions and the conversation');
    expect(terminalMessageHelp.rows).toBe(1);
    expect(terminalMessageHelp.dataset.helpDetail).toContain('Enter runs');
    expect(terminalMessageHelp.dataset.helpDetail).toContain('Shift+Enter');
    expect(terminalFaceHelp.dataset.helpDetail).toContain('synthesized murmur');
    expect(terminalFaceHelp.dataset.helpDetail).toContain('/sound off');
    expect(terminalTemplate.querySelector('.terminal-face-art').textContent).not.toMatch(/[\r\n]/);
    expect(terminalTemplate.querySelector('.terminal-face-vector').getAttribute('viewBox')).toBe('0 0 84 20');
    expect(terminalTemplate.querySelectorAll('.terminal-face-eye')).toHaveLength(2);
    expect(terminalTemplate.querySelectorAll('.terminal-face-mouth')).toHaveLength(1);
    expect(terminalTemplate.querySelector('.terminal-face-mouth').getAttribute('d')).toBe(
      'M 38.5 12 H 45.5'
    );

    const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'style.css'), 'utf8');
    const faceRule = css.match(/\.terminal-face-art\s*\{([\s\S]*?)\}/)?.[1] || '';
    const vectorRule = css.match(/\.terminal-face-vector\s*\{([\s\S]*?)\}/)?.[1] || '';
    const asciiRule = css.match(/\.terminal-face-ascii\s*\{([\s\S]*?)\}/)?.[1] || '';
    const mastheadRule = css.match(/\.terminal-masthead\s*\{([\s\S]*?)\}/)?.[1] || '';
    const speakingRule = css.match(/\.terminal-face\[data-speaking="true"\] \.terminal-face-art\s*\{([\s\S]*?)\}/)?.[1] || '';
    const inlineEntryRule = css.match(/\.terminal-message,\s*\.terminal-app input\.terminal-secret-input\s*\{([\s\S]*?)\}/)?.[1] || '';
    expect(faceRule).toContain('white-space: nowrap');
    expect(faceRule).toContain('cqi');
    expect(faceRule).toContain('inline-size: 7.5ch');
    expect(faceRule).toContain('block-size: 1.15em');
    expect(vectorRule).toContain('stroke: currentColor');
    expect(vectorRule).toContain('block-size: 100%');
    expect(asciiRule).toContain('clip-path: inset(50%)');
    expect(mastheadRule).toContain('justify-content: center');
    expect(speakingRule).toContain('terminal-voice-glow');
    expect(speakingRule).not.toContain('transform');
    expect(inlineEntryRule).toContain('background: transparent');
    expect(inlineEntryRule).toContain('border: 0');
  });
});
