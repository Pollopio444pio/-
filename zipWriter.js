/**
 * zipWriter.js
 * ------------------------------------------------------------------------
 * A minimal, dependency-free ZIP file builder.
 *
 * Only the "STORE" (method 0, no compression) entry type is implemented.
 * That is intentional, not a shortcut: PNG already applies its own
 * lossless DEFLATE compression internally, so re-compressing the bytes
 * inside a DEFLATE-based ZIP entry would waste CPU for no size benefit
 * and risks the app depending on a large external compression library
 * the brief explicitly asks to avoid ("no usar librerías pesadas si no
 * son necesarias").
 *
 * Implements just enough of the PKZIP spec (APPNOTE.TXT) for archives
 * that every mainstream unzip tool (Windows Explorer, macOS Archive
 * Utility, 7-Zip, Linux `unzip`) reads without complaint:
 *   - one Local File Header + raw bytes per entry
 *   - one Central Directory Header per entry
 *   - a single End Of Central Directory record
 * ------------------------------------------------------------------------
 */

const CRC_TABLE = buildCrcTable();

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

/** Standard CRC-32 (used by ZIP's local/central headers for integrity). */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Converts a JS Date into the packed 16-bit MS-DOS date/time ZIP expects. */
function toDosDateTime(date) {
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}
function writeUint32(view, offset, value) {
  view.setUint32(offset, value, true);
}

/**
 * Builds a ZIP archive Blob from a list of named byte buffers.
 * @param {Array<{name: string, data: Uint8Array}>} entries
 * @returns {Blob}
 */
export function createZip(entries) {
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = toDosDateTime(new Date());

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = new ArrayBuffer(30);
    const lv = new DataView(localHeader);
    writeUint32(lv, 0, 0x04034b50); // local file header signature
    writeUint16(lv, 4, 20); // version needed to extract
    writeUint16(lv, 6, 0x0800); // general purpose flag: UTF-8 filename
    writeUint16(lv, 8, 0); // compression method: 0 = store
    writeUint16(lv, 10, dosTime);
    writeUint16(lv, 12, dosDate);
    writeUint32(lv, 14, crc);
    writeUint32(lv, 18, data.length); // compressed size
    writeUint32(lv, 22, data.length); // uncompressed size
    writeUint16(lv, 26, nameBytes.length);
    writeUint16(lv, 28, 0); // extra field length

    localParts.push(new Uint8Array(localHeader), nameBytes, data);

    const centralHeader = new ArrayBuffer(46);
    const cv = new DataView(centralHeader);
    writeUint32(cv, 0, 0x02014b50); // central directory header signature
    writeUint16(cv, 4, 20); // version made by
    writeUint16(cv, 6, 20); // version needed to extract
    writeUint16(cv, 8, 0x0800);
    writeUint16(cv, 10, 0);
    writeUint16(cv, 12, dosTime);
    writeUint16(cv, 14, dosDate);
    writeUint32(cv, 16, crc);
    writeUint32(cv, 20, data.length);
    writeUint32(cv, 24, data.length);
    writeUint16(cv, 28, nameBytes.length);
    writeUint16(cv, 30, 0); // extra field length
    writeUint16(cv, 32, 0); // comment length
    writeUint16(cv, 34, 0); // disk number start
    writeUint16(cv, 36, 0); // internal file attributes
    writeUint32(cv, 38, 0); // external file attributes
    writeUint32(cv, 42, offset); // relative offset of local header

    centralParts.push(new Uint8Array(centralHeader), nameBytes);

    offset += localHeader.byteLength + nameBytes.length + data.length;
  }

  const centralDirSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralDirOffset = offset;

  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  writeUint32(ev, 0, 0x06054b50); // end of central directory signature
  writeUint16(ev, 4, 0); // disk number
  writeUint16(ev, 6, 0); // disk with central directory
  writeUint16(ev, 8, entries.length); // entries on this disk
  writeUint16(ev, 10, entries.length); // total entries
  writeUint32(ev, 12, centralDirSize);
  writeUint32(ev, 16, centralDirOffset);
  writeUint16(ev, 20, 0); // comment length

  return new Blob([...localParts, ...centralParts, new Uint8Array(eocd)], {
    type: 'application/zip',
  });
}
