export interface DetectedImageType {
  contentType: string;
  extension: string;
}

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF_SIGNATURES = ['GIF87a', 'GIF89a'];
const AVIF_BRANDS = ['avif', 'avis'];

// Shortest header any recognised format needs: RIFF....WEBP / ....ftypavif.
const MIN_HEADER_BYTES = 12;

function startsWithBytes(data: Buffer, signature: number[]): boolean {
  return signature.every((byte, index) => data[index] === byte);
}

function asciiAt(data: Buffer, start: number, length: number): string {
  return data.subarray(start, start + length).toString('ascii');
}

/**
 * Sniffs the real format from the file's leading bytes instead of trusting the
 * client-supplied MIME type or filename. Only raster formats browsers render
 * safely are recognised — SVG is deliberately excluded (it can carry scripts).
 */
export function detectImageType(data: Buffer): DetectedImageType | null {
  if (data.length < MIN_HEADER_BYTES) return null;

  if (startsWithBytes(data, JPEG_SIGNATURE)) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }
  if (startsWithBytes(data, PNG_SIGNATURE)) {
    return { contentType: 'image/png', extension: 'png' };
  }
  if (GIF_SIGNATURES.includes(asciiAt(data, 0, 6))) {
    return { contentType: 'image/gif', extension: 'gif' };
  }
  if (asciiAt(data, 0, 4) === 'RIFF' && asciiAt(data, 8, 4) === 'WEBP') {
    return { contentType: 'image/webp', extension: 'webp' };
  }
  if (
    asciiAt(data, 4, 4) === 'ftyp' &&
    AVIF_BRANDS.includes(asciiAt(data, 8, 4))
  ) {
    return { contentType: 'image/avif', extension: 'avif' };
  }
  return null;
}
