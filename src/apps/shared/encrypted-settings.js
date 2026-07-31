(() => {
  'use strict';

  // Table of contents:
  // - Browser crypto and byte conversion helpers
  // - PBKDF2/AES-GCM envelope creation and reading
  // - File download/read and password-prompt conveniences
  // - Shared window registration

  const ENVELOPE_VERSION = 1;
  const PBKDF2_ITERATIONS = 250000;

  function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function getWebCrypto() {
    if (typeof globalThis === 'undefined') return null;
    return globalThis.crypto || null;
  }

  function isSupported() {
    const cryptoApi = getWebCrypto();
    return !!(cryptoApi?.subtle && typeof cryptoApi.getRandomValues === 'function');
  }

  function bytesToBase64(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = '';
    for (let index = 0; index < view.length; index += 1) {
      binary += String.fromCharCode(view[index]);
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(String(value || ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function utf8ToBytes(text) {
    const encoded = unescape(encodeURIComponent(String(text)));
    const bytes = new Uint8Array(encoded.length);
    for (let index = 0; index < encoded.length; index += 1) {
      bytes[index] = encoded.charCodeAt(index);
    }
    return bytes;
  }

  function bytesToUtf8(bytes) {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return decodeURIComponent(escape(binary));
  }

  async function deriveAesKey(password, saltBytes, usages) {
    const cryptoApi = getWebCrypto();
    const keyMaterial = await cryptoApi.subtle.importKey(
      'raw',
      utf8ToBytes(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return cryptoApi.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      usages
    );
  }

  // Both Completion API and Terminal write this exact versioned envelope.
  // Product-specific settings remain only inside the authenticated ciphertext,
  // so a downloaded JSON file exposes neither API keys nor configuration text.
  async function encrypt(password, settings) {
    if (!isSupported()) throw new Error('Browser crypto support is unavailable.');
    const cryptoApi = getWebCrypto();
    const salt = cryptoApi.getRandomValues(new Uint8Array(16));
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const key = await deriveAesKey(password, salt, ['encrypt']);
    const plaintext = utf8ToBytes(JSON.stringify(settings));
    const encrypted = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return {
      version: ENVELOPE_VERSION,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: PBKDF2_ITERATIONS,
        salt: bytesToBase64(salt)
      },
      cipher: {
        name: 'AES-GCM',
        iv: bytesToBase64(iv),
        data: bytesToBase64(encrypted)
      }
    };
  }

  async function decrypt(password, payload) {
    const validEnvelope = payload?.version === ENVELOPE_VERSION &&
      payload?.kdf?.name === 'PBKDF2' &&
      payload?.kdf?.hash === 'SHA-256' &&
      payload?.kdf?.iterations === PBKDF2_ITERATIONS &&
      payload?.cipher?.name === 'AES-GCM';
    if (!validEnvelope) throw new Error('Unsupported encrypted settings format.');
    try {
      const salt = base64ToBytes(payload.kdf.salt);
      const iv = base64ToBytes(payload.cipher.iv);
      const encrypted = base64ToBytes(payload.cipher.data);
      const key = await deriveAesKey(password, salt, ['decrypt']);
      const decrypted = await getWebCrypto().subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
      return JSON.parse(bytesToUtf8(new Uint8Array(decrypted)));
    } catch (err) {
      throw new Error('Invalid password or corrupted encrypted settings.');
    }
  }

  function download(payload, fileName) {
    if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = toTrimmedString(fileName) || 'yolk-encrypted-settings.json';
      anchor.click();
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      return false;
    }
  }

  async function readFile(file) {
    if (!file) throw new Error('No file selected.');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || ''));
          if (!parsed || typeof parsed !== 'object') {
            reject(new Error('Selected file does not contain valid encrypted settings JSON.'));
            return;
          }
          resolve(parsed);
        } catch (err) {
          reject(new Error('Selected file does not contain valid JSON.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read selected settings file.'));
      reader.readAsText(file);
    });
  }

  function promptForPassword(action) {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') return null;
    const message = action === 'save'
      ? 'Enter a password to encrypt settings:'
      : 'Enter the password to decrypt settings:';
    return window.prompt(message, '');
  }

  if (typeof window !== 'undefined') {
    window.YolkEncryptedSettings = Object.freeze({
      envelopeVersion: ENVELOPE_VERSION,
      iterations: PBKDF2_ITERATIONS,
      isSupported,
      encrypt,
      decrypt,
      download,
      readFile,
      promptForPassword
    });
  }
})();
