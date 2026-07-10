/**
 * Luna Firmament transit crypto (LUNA1) — matches firmament/crypto_box.py
 * HMAC-SHA256 keystream + encrypt-then-MAC. Zero dependencies.
 */

function b64urlEncode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(text) {
  const pad = "=".repeat((4 - (text.length % 4)) % 4);
  const b64 = (text + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concatBytes(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function importHmacKey(rawKey) {
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function hmacSha256(keyBytes, dataBytes) {
  const key = await importHmacKey(keyBytes);
  const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
  return new Uint8Array(sig);
}

async function sha256(bytes) {
  const dig = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(dig);
}

async function deriveEncMacKeys(transitKey) {
  const enc = await sha256(concatBytes(transitKey, new TextEncoder().encode("|enc")));
  const mac = await sha256(concatBytes(transitKey, new TextEncoder().encode("|mac")));
  return { enc, mac };
}

async function keystream(encKey, nonce, length) {
  const out = new Uint8Array(length);
  let offset = 0;
  let counter = 0;
  while (offset < length) {
    const ctr = new Uint8Array(8);
    const view = new DataView(ctr.buffer);
    // big-endian u64 counter (high 32 always 0 for practical sizes)
    view.setUint32(0, Math.floor(counter / 0x100000000), false);
    view.setUint32(4, counter >>> 0, false);
    const block = await hmacSha256(encKey, concatBytes(nonce, ctr));
    const n = Math.min(block.length, length - offset);
    out.set(block.subarray(0, n), offset);
    offset += n;
    counter += 1;
  }
  return out;
}

function xorBytes(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

export class LunaTransit {
  constructor(transitKeyB64) {
    this.ready = false;
    this._key = null;
    this._init = this._load(transitKeyB64);
  }

  async _load(b64) {
    if (!b64) return;
    try {
      this._key = b64urlDecode(b64);
      if (this._key.length < 16) {
        this._key = await sha256(this._key);
      } else if (this._key.length !== 32) {
        this._key = await sha256(this._key);
      }
      this.ready = true;
    } catch (_) {
      this.ready = false;
      this._key = null;
    }
  }

  async whenReady() {
    await this._init;
    return this.ready;
  }

  async seal(obj) {
    await this._init;
    if (!this.ready || !this._key) throw new Error("transit crypto not ready");
    const plain = new TextEncoder().encode(JSON.stringify(obj));
    const { enc, mac } = await deriveEncMacKeys(this._key);
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    const stream = await keystream(enc, nonce, plain.length);
    const ct = xorBytes(plain, stream);
    const tag = await hmacSha256(mac, concatBytes(nonce, ct));
    return {
      enc: true,
      v: 1,
      alg: "luna1",
      iv: b64urlEncode(nonce),
      tag: b64urlEncode(tag),
      ct: b64urlEncode(ct),
    };
  }

  async open(envelope) {
    await this._init;
    if (!envelope || envelope.enc !== true) return envelope;
    if (!this.ready || !this._key) throw new Error("transit crypto not ready");
    const nonce = b64urlDecode(String(envelope.iv || ""));
    const tag = b64urlDecode(String(envelope.tag || ""));
    const ct = b64urlDecode(String(envelope.ct || ""));
    const { enc, mac } = await deriveEncMacKeys(this._key);
    const expect = await hmacSha256(mac, concatBytes(nonce, ct));
    if (expect.length !== tag.length) throw new Error("MAC length mismatch");
    let diff = 0;
    for (let i = 0; i < tag.length; i++) diff |= expect[i] ^ tag[i];
    if (diff !== 0) throw new Error("MAC check failed");
    const stream = await keystream(enc, nonce, ct.length);
    const plain = xorBytes(ct, stream);
    return JSON.parse(new TextDecoder().decode(plain));
  }
}

/** Secure JSON POST for firmament chat/memory/converse. Falls back to plain if crypto off. */
export async function lunaSecurePost(url, body, transit) {
  const headers = { "Content-Type": "application/json" };
  let payload = body;
  if (transit && (await transit.whenReady())) {
    payload = await transit.seal(body);
    headers["X-Luna-Crypto"] = "1";
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error("invalid JSON response");
  }
  if (data && data.enc === true && transit && (await transit.whenReady())) {
    data = await transit.open(data);
  }
  return { res, data };
}

export function installGlobal(transitKeyB64) {
  const transit = new LunaTransit(transitKeyB64 || "");
  window.LunaTransit = LunaTransit;
  window.lunaTransit = transit;
  window.lunaSecurePost = (url, body) => lunaSecurePost(url, body, transit);
  return transit;
}
