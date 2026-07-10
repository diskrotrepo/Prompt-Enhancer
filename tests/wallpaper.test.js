/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { createDom, registerDomCleanup } = require('./helpers/dom');

global.__TEST__ = true;

const {
  buildWallpaperBand,
  sampleWallpaperPalette,
  normalizeWallpaperPosition,
  normalizeWallpaperWheelDelta,
  getWallpaperTextureDrift,
  contrastRatio,
  WALLPAPER_SHAPE_TYPES
} = require('../src/script');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', 'index.html');
const SCRIPT_PATH = path.join(ROOT, 'src', 'script.js');
const LEGACY_SHAPE_TYPES = [
  'disc',
  'ring',
  'bar',
  'diamond',
  'triangle',
  'zigzag',
  'capsule',
  'checker',
  'arc'
];

// Runtime harness: execute the real desktop shell while making its one-frame
// wallpaper render deterministic and synchronous for interaction assertions.
function setupDom() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const dom = createDom(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;
  window.alert = () => {};
  window.requestAnimationFrame = callback => {
    callback(0);
    return 1;
  };
  window.cancelAnimationFrame = () => {};
  window.matchMedia = jest.fn(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {}
  }));
  window.eval(fs.readFileSync(SCRIPT_PATH, 'utf8'));
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  return { window };
}

// Wheel helper models pixels, lines, and pages without depending on JSDOM's
// incomplete WheelEvent implementation.
function dispatchWheel(window, target, deltaY, deltaMode = 0) {
  const event = new window.Event('wheel', { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    deltaY: { value: deltaY },
    deltaMode: { value: deltaMode }
  });
  target.dispatchEvent(event);
  return event;
}

function readWallpaperState(window) {
  const layer = window.document.querySelector('.desktop-confetti');
  return {
    layer,
    ready: layer?.dataset.wallpaperReady || '',
    band: Number(layer?.dataset.wallpaperBand),
    offset: Number(layer?.dataset.wallpaperOffset),
    scene: layer?.dataset.wallpaperScene || '',
    theme: layer?.dataset.wallpaperTheme || '',
    poolSize: Number(layer?.dataset.wallpaperPoolSize)
  };
}

function circularHueDistance(first, second) {
  const raw = Math.abs(first - second) % 360;
  return Math.min(raw, 360 - raw);
}

describe('Procedural wallpaper model', () => {
  test('shape catalog keeps every original silhouette and adds new families', () => {
    expect(Array.isArray(WALLPAPER_SHAPE_TYPES)).toBe(true);
    LEGACY_SHAPE_TYPES.forEach(type => expect(WALLPAPER_SHAPE_TYPES).toContain(type));
    expect(new Set(WALLPAPER_SHAPE_TYPES).size).toBeGreaterThan(LEGACY_SHAPE_TYPES.length);
  });

  test('world bands are deterministic, directional, and structurally bounded', () => {
    const first = buildWallpaperBand(12, 1440, 900);
    const replay = buildWallpaperBand(12, 1440, 900);
    const next = buildWallpaperBand(13, 1440, 900);
    const previous = buildWallpaperBand(-12, 1440, 900);

    expect(replay).toEqual(first);
    expect(first).toMatchObject({ index: 12, width: 1440, height: 900 });
    expect(first.signature).toEqual(expect.any(String));
    expect(first.signature).not.toBe(next.signature);
    expect(first.signature).not.toBe(previous.signature);
    expect(first.shapes.length).toBeGreaterThanOrEqual(6);
    expect(first.shapes.length).toBeLessThanOrEqual(24);

    first.shapes.forEach(shape => {
      expect(WALLPAPER_SHAPE_TYPES).toContain(shape.type);
      expect(shape).toEqual(expect.objectContaining({
        pattern: expect.any(String),
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
        rotation: expect.any(Number),
        fill: expect.any(String),
        alt: expect.any(String),
        shadow: expect.any(String)
      }));
      expect(Number.isFinite(shape.x)).toBe(true);
      expect(Number.isFinite(shape.y)).toBe(true);
      expect(shape.x).toBeGreaterThanOrEqual(0);
      expect(shape.x).toBeLessThanOrEqual(first.width);
      expect(shape.y).toBeGreaterThanOrEqual(0);
      expect(shape.y).toBeLessThanOrEqual(first.height);
      expect(shape.width).toBeGreaterThan(0);
      expect(shape.height).toBeGreaterThan(0);
      // A shape can be a narrow bar, but one axis must remain visually substantial.
      expect(Math.max(shape.width, shape.height)).toBeGreaterThanOrEqual(56);
    });
  });

  test('a long deterministic sample offers novelty without a short repeat cycle', () => {
    const bands = Array.from({ length: 48 }, (_, index) =>
      buildWallpaperBand(index - 16, 1280, 800)
    );
    const signatures = new Set(bands.map(band => band.signature));
    const encounteredTypes = new Set(
      bands.flatMap(band => band.shapes.map(shape => shape.type))
    );

    expect(signatures.size).toBe(bands.length);
    expect(encounteredTypes.size).toBeGreaterThan(LEGACY_SHAPE_TYPES.length);
  });

  test('palette and texture state evolve gradually while accents remain legible', () => {
    const first = sampleWallpaperPalette(2.2);
    const replay = sampleWallpaperPalette(2.2);
    const nearby = sampleWallpaperPalette(2.21);
    const distant = sampleWallpaperPalette(18.2);

    expect(replay).toEqual(first);
    expect(first.signature).not.toBe(distant.signature);
    expect(first.accents.length).toBeGreaterThanOrEqual(5);
    expect(first.texture).toEqual(expect.any(String));
    expect(first.nextTexture).toEqual(expect.any(String));
    expect(first.textureMix).toBeGreaterThanOrEqual(0);
    expect(first.textureMix).toBeLessThanOrEqual(1);
    expect(circularHueDistance(first.background.h, nearby.background.h)).toBeLessThan(3);
    expect(Math.abs(first.background.s - nearby.background.s)).toBeLessThan(3);
    expect(Math.abs(first.background.l - nearby.background.l)).toBeLessThan(3);

    [first.background, first.backgroundLower, first.cream, ...first.accents].forEach(color => {
      expect(color).toEqual(expect.objectContaining({
        h: expect.any(Number),
        s: expect.any(Number),
        l: expect.any(Number),
        css: expect.any(String)
      }));
      expect(color.h).toBeGreaterThanOrEqual(0);
      expect(color.h).toBeLessThan(360);
      expect(color.s).toBeGreaterThanOrEqual(0);
      expect(color.s).toBeLessThanOrEqual(100);
      expect(color.l).toBeGreaterThanOrEqual(0);
      expect(color.l).toBeLessThanOrEqual(100);
    });

    first.accents.forEach(accent => {
      expect(contrastRatio(first.background, accent)).toBeGreaterThanOrEqual(2.3);
    });

    // Art-direction constraints are sampled well beyond the screenshots: the
    // ground stays shadow-friendly and every generated accent clears the same
    // contrast floor in distant positive and negative chapters.
    for (let worldScreens = -40; worldScreens <= 40; worldScreens += 0.5) {
      const sample = sampleWallpaperPalette(worldScreens);
      expect(sample.background.l).toBeGreaterThanOrEqual(24);
      expect(sample.background.l).toBeLessThanOrEqual(48);
      sample.accents.forEach(accent => {
        expect(contrastRatio(sample.background, accent)).toBeGreaterThanOrEqual(2.3);
      });
    }
  });

  test('band normalization supports arbitrarily large movement in both directions', () => {
    expect(normalizeWallpaperPosition(2, 250, 200)).toEqual({ band: 3, offset: 50 });
    expect(normalizeWallpaperPosition(2, -25, 200)).toEqual({ band: 1, offset: 175 });
    expect(normalizeWallpaperPosition(-1000, 400, 200)).toEqual({ band: -998, offset: 0 });
  });

  test('wheel deltas normalize pixels, lines, pages, and direction', () => {
    const pixelDelta = normalizeWallpaperWheelDelta({ deltaY: 5, deltaMode: 0 }, 800);
    const lineDelta = normalizeWallpaperWheelDelta({ deltaY: 5, deltaMode: 1 }, 800);
    const pageDelta = normalizeWallpaperWheelDelta({ deltaY: 1, deltaMode: 2 }, 800);
    const reverseDelta = normalizeWallpaperWheelDelta({ deltaY: -1, deltaMode: 2 }, 800);

    expect(pixelDelta).toBeGreaterThan(0);
    expect(lineDelta).toBeGreaterThan(pixelDelta);
    expect(pageDelta).toBeGreaterThan(lineDelta);
    expect(pageDelta).toBeLessThanOrEqual(800);
    expect(reverseDelta).toBe(-pageDelta);
  });

  test('texture phase follows continuous world distance across a band boundary', () => {
    const before = getWallpaperTextureDrift(799.9, 'weave');
    const after = getWallpaperTextureDrift(800.1, 'weave');
    expect(Math.abs(after - before)).toBeLessThan(0.1);
    expect(getWallpaperTextureDrift(2400 + 85 / 0.05, 'scanline')).toBeCloseTo(
      getWallpaperTextureDrift(2400, 'scanline'),
      8
    );
  });

  test('contrast ratio is symmetric and follows the standard black-white range', () => {
    const black = { h: 0, s: 0, l: 0 };
    const white = { h: 0, s: 0, l: 100 };
    expect(contrastRatio(black, black)).toBeCloseTo(1, 6);
    expect(contrastRatio(black, white)).toBeCloseTo(21, 1);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 1);
  });
});

describe('Procedural wallpaper runtime', () => {
  test('bare desktop wheel movement changes the scene without growing its pool', () => {
    const { window } = setupDom();
    const area = window.document.getElementById('window-area');
    const initial = readWallpaperState(window);
    const randomSpy = jest.fn(() => 0.5);
    window.Math.random = randomSpy;

    expect(initial.ready).toBe('true');
    expect(initial.scene).not.toBe('');
    expect(initial.theme).not.toBe('');
    expect(initial.poolSize).toBeGreaterThan(0);
    for (let index = 0; index < 5; index += 1) {
      dispatchWheel(window, area, 900);
    }
    const moved = readWallpaperState(window);

    expect(moved.band !== initial.band || moved.offset !== initial.offset).toBe(true);
    expect(moved.scene).not.toBe(initial.scene);
    expect(moved.theme).not.toBe(initial.theme);
    expect(moved.poolSize).toBe(initial.poolSize);
    expect(Number.isFinite(moved.band)).toBe(true);
    expect(Number.isFinite(moved.offset)).toBe(true);
    expect(randomSpy).not.toHaveBeenCalled();
  });

  test('reverse movement returns to the same deterministic world position', () => {
    const { window } = setupDom();
    const area = window.document.getElementById('window-area');
    const initial = readWallpaperState(window);

    dispatchWheel(window, area, 997);
    dispatchWheel(window, area, -997);
    const restored = readWallpaperState(window);

    expect(restored.band).toBe(initial.band);
    expect(restored.offset).toBeCloseTo(initial.offset, 6);
    expect(restored.scene).toBe(initial.scene);
    expect(restored.theme).toBe(initial.theme);
  });

  test('wheel movement inside an app window is ignored and remains uncancelled', () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="prompts"]').click();
    const promptBody = window.document.querySelector(
      '.app-window[data-window="prompts"]:not(.window-template) .prompt-body'
    );
    const initial = readWallpaperState(window);

    const event = dispatchWheel(window, promptBody, 1800);
    const after = readWallpaperState(window);

    expect(after).toEqual(initial);
    expect(event.defaultPrevented).toBe(false);
  });

  test('multi-touch background gestures remain available for browser pinch zoom', () => {
    const { window } = setupDom();
    const area = window.document.getElementById('window-area');
    const initial = readWallpaperState(window);
    const start = new window.Event('touchstart', { bubbles: true, cancelable: true });
    const move = new window.Event('touchmove', { bubbles: true, cancelable: true });
    const touches = [
      { identifier: 1, clientX: 100, clientY: 200 },
      { identifier: 2, clientX: 180, clientY: 280 }
    ];
    Object.defineProperties(start, {
      touches: { value: touches },
      changedTouches: { value: touches }
    });
    Object.defineProperties(move, {
      touches: { value: touches },
      changedTouches: { value: touches }
    });

    area.dispatchEvent(start);
    area.dispatchEvent(move);

    expect(start.defaultPrevented).toBe(false);
    expect(move.defaultPrevented).toBe(false);
    expect(readWallpaperState(window)).toEqual(initial);
  });

  test('long travel recycles one bounded pool while continuing to produce novelty', () => {
    const { window } = setupDom();
    const area = window.document.getElementById('window-area');
    const initial = readWallpaperState(window);
    const scenes = new Set([initial.scene]);
    const themes = new Set([initial.theme]);

    for (let index = 0; index < 40; index += 1) {
      dispatchWheel(window, area, 1500);
      const current = readWallpaperState(window);
      expect(current.poolSize).toBe(initial.poolSize);
      expect(Number.isFinite(current.band)).toBe(true);
      expect(Number.isFinite(current.offset)).toBe(true);
      scenes.add(current.scene);
      themes.add(current.theme);
    }

    expect(scenes.size).toBeGreaterThan(35);
    expect(themes.size).toBeGreaterThan(12);
  });
});

registerDomCleanup();
