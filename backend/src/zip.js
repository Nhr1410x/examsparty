import zlib from "node:zlib";

/**
 * Creates a standard PKWARE ZIP archive in memory using Node.js built-in zlib.
 * @param {Array<{ name: string, data: Buffer }>} files
 * @returns {Buffer}
 */
export function createZipArchive(files) {
  const parts = [];
  const cdParts = [];
  let offset = 0;
  const usedNames = new Set();

  for (const file of files) {
    let safeName = (file.name || "document.pdf")
      .replace(/[\/\\]/g, "_")
      .trim();
    if (!safeName) safeName = "document.pdf";

    // Deduplicate filename if multiple files share the exact same name
    let finalName = safeName;
    let counter = 1;
    while (usedNames.has(finalName)) {
      const dotIdx = safeName.lastIndexOf(".");
      if (dotIdx > 0) {
        finalName = `${safeName.substring(0, dotIdx)}_${counter}${safeName.substring(dotIdx)}`;
      } else {
        finalName = `${safeName}_${counter}`;
      }
      counter++;
    }
    usedNames.add(finalName);

    const data = Buffer.isBuffer(file.data)
      ? file.data
      : Buffer.from(file.data);
    const compressed = zlib.deflateRawSync(data);
    const crc = zlib.crc32(data);
    const nameBuf = Buffer.from(finalName, "utf8");

    // Local file header (30 bytes + name length)
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // LFH signature
    lfh.writeUInt16LE(20, 4); // Min version (2.0)
    lfh.writeUInt16LE(0x0800, 6); // Flags: UTF-8 filename (bit 11)
    lfh.writeUInt16LE(8, 8); // Method: Deflate
    lfh.writeUInt16LE(0, 10); // File last mod time
    lfh.writeUInt16LE(0, 12); // File last mod date
    lfh.writeUInt32LE(crc, 14); // CRC-32
    lfh.writeUInt32LE(compressed.length, 18); // Compressed size
    lfh.writeUInt32LE(data.length, 22); // Uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26); // Filename length
    lfh.writeUInt16LE(0, 28); // Extra field length

    // Central directory header (46 bytes + name length)
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); // CD signature
    cdh.writeUInt16LE(20, 4); // Version made by (2.0)
    cdh.writeUInt16LE(20, 6); // Min version needed (2.0)
    cdh.writeUInt16LE(0x0800, 8); // Flags: UTF-8 filename
    cdh.writeUInt16LE(8, 10); // Method: Deflate
    cdh.writeUInt16LE(0, 12); // File last mod time
    cdh.writeUInt16LE(0, 14); // File last mod date
    cdh.writeUInt32LE(crc, 16); // CRC-32
    cdh.writeUInt32LE(compressed.length, 20); // Compressed size
    cdh.writeUInt32LE(data.length, 24); // Uncompressed size
    cdh.writeUInt16LE(nameBuf.length, 28); // Filename length
    cdh.writeUInt16LE(0, 30); // Extra field length
    cdh.writeUInt16LE(0, 32); // Comment length
    cdh.writeUInt16LE(0, 34); // Disk number start
    cdh.writeUInt16LE(0, 36); // Internal file attributes
    cdh.writeUInt32LE(0, 38); // External file attributes
    cdh.writeUInt32LE(offset, 42); // Relative offset of local header

    parts.push(lfh, nameBuf, compressed);
    cdParts.push(cdh, nameBuf);
    offset += lfh.length + nameBuf.length + compressed.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const part of cdParts) {
    cdSize += part.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // Number of this disk
  eocd.writeUInt16LE(0, 6); // Disk where CD starts
  eocd.writeUInt16LE(files.length, 8); // Number of CD records on this disk
  eocd.writeUInt16LE(files.length, 10); // Total number of CD records
  eocd.writeUInt32LE(cdSize, 12); // Size of central directory
  eocd.writeUInt32LE(cdOffset, 16); // Offset of start of central directory
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...parts, ...cdParts, eocd]);
}
