// Utility functions

export function parseInput(raw, keepDelim = false) {
  if (!raw) return [];

  if (!keepDelim) {
    const normalized = raw.replace(/;/g, ',').replace(/\s*,\s*/g, ',');
    return normalized
      .split(/[,\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  const normalized = raw.replace(/\r\n/g, '\n');
  const delims = [',', '.', ';', ':', '!', '?', '\n'];
  const items = [];
  let current = '';

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    current += ch;
    if (delims.includes(ch)) {
      let natural = /[,.!:;?\n]/.test(ch);
      while (i + 1 < normalized.length) {
        const next = normalized[i + 1];
        if (delims.includes(next)) {
          if (/[,.!:;?\n]/.test(next)) natural = true;
          current += next;
          i++;
          continue;
        }
        if (next === ' ' && natural) {
          current += ' ';
          i++;
          continue;
        }
        break;
      }
      items.push(current);
      current = '';
    }
  }

  if (current) {
    if (!/[,.!:;?\n]\s*$/.test(current)) {
      current += '. ';
    }
    items.push(current);
  }

  return items.filter(Boolean);
}

export function parseDividerInput(raw) {
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(line => line !== '');
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function equalizeLength(a, b) {
  const len = Math.min(a.length, b.length);
  return [a.slice(0, len), b.slice(0, len)];
}
