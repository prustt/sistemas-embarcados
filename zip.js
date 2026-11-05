/* Zip sem compressão (método 0) para entregar vários arquivos de uma vez. GPL-2.0-or-later. */
(function (root) {
  "use strict";
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++)
      c = table[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function make(entries, now = new Date()) {
    const enc = new TextEncoder();
    const time =
      (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date =
      ((now.getFullYear() - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate();
    const files = [],
      central = [];
    let offset = 0;
    for (const { name, data } of entries) {
      const nameBytes = enc.encode(name);
      const body =
        typeof data === "string" ? enc.encode(data) : Uint8Array.from(data);
      const crc = crc32(body);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // nomes em UTF-8
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, body.length, true);
      local.setUint32(22, body.length, true);
      local.setUint16(26, nameBytes.length, true);
      const dir = new DataView(new ArrayBuffer(46));
      dir.setUint32(0, 0x02014b50, true);
      dir.setUint16(4, 20, true);
      dir.setUint16(6, 20, true);
      dir.setUint16(8, 0x0800, true);
      dir.setUint16(12, time, true);
      dir.setUint16(14, date, true);
      dir.setUint32(16, crc, true);
      dir.setUint32(20, body.length, true);
      dir.setUint32(24, body.length, true);
      dir.setUint16(28, nameBytes.length, true);
      dir.setUint32(42, offset, true);
      files.push(new Uint8Array(local.buffer), nameBytes, body);
      central.push(new Uint8Array(dir.buffer), nameBytes);
      offset += 30 + nameBytes.length + body.length;
    }
    const dirSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, dirSize, true);
    end.setUint32(16, offset, true);
    const parts = [...files, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let pos = 0;
    for (const part of parts) {
      out.set(part, pos);
      pos += part.length;
    }
    return out;
  }
  root.LabZip = { make, crc32 };
})(typeof globalThis !== "undefined" ? globalThis : window);
