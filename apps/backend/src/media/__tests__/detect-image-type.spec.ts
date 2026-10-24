import { detectImageType } from '@/media/detect-image-type';

const PADDING = Buffer.alloc(16);

function withHeader(...header: (number | string)[]): Buffer {
  const bytes = header.flatMap((part) =>
    typeof part === 'string' ? [...Buffer.from(part, 'ascii')] : [part],
  );
  return Buffer.concat([Buffer.from(bytes), PADDING]);
}

describe('detectImageType', () => {
  it.each([
    ['JPEG', withHeader(0xff, 0xd8, 0xff, 0xe0), 'image/jpeg', 'jpg'],
    [
      'PNG',
      withHeader(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a),
      'image/png',
      'png',
    ],
    ['GIF87a', withHeader('GIF87a'), 'image/gif', 'gif'],
    ['GIF89a', withHeader('GIF89a'), 'image/gif', 'gif'],
    ['WebP', withHeader('RIFF', 0, 0, 0, 0, 'WEBP'), 'image/webp', 'webp'],
    ['AVIF', withHeader(0, 0, 0, 0x1c, 'ftypavif'), 'image/avif', 'avif'],
  ])('recognises %s by its magic bytes', (_name, data, contentType, ext) => {
    expect(detectImageType(data)).toEqual({ contentType, extension: ext });
  });

  it('returns null for a WAV file, which shares the RIFF prefix with WebP', () => {
    const wav = withHeader('RIFF', 0, 0, 0, 0, 'WAVE');

    expect(detectImageType(wav)).toBeNull();
  });

  it('returns null for SVG, since it can carry scripts', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    expect(detectImageType(svg)).toBeNull();
  });

  it('returns null for an HTML file renamed to look like an image', () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');

    expect(detectImageType(html)).toBeNull();
  });

  it('returns null for buffers too short to hold a header', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it('rejects a valid JPEG header one byte short of the minimum, and accepts it at the minimum', () => {
    const header = [0xff, 0xd8, 0xff, 0xe0];
    const atMinimum = Buffer.concat([Buffer.from(header), Buffer.alloc(8)]);

    expect(detectImageType(atMinimum.subarray(0, 11))).toBeNull();
    expect(detectImageType(atMinimum)).toEqual({
      contentType: 'image/jpeg',
      extension: 'jpg',
    });
  });

  it('returns null when only the first byte of the JPEG or PNG signature matches', () => {
    expect(detectImageType(withHeader(0xff, 0x00, 0x00))).toBeNull();
    expect(detectImageType(withHeader(0x89, 0x00, 0x00))).toBeNull();
    expect(detectImageType(withHeader(0x00, 0xd8, 0xff))).toBeNull();
  });

  it('returns null for RIFF without a WEBP tag, and for a WEBP tag without RIFF', () => {
    expect(detectImageType(withHeader('RIFF', 0, 0, 0, 0, 'AVI '))).toBeNull();
    expect(detectImageType(withHeader('RIFX', 0, 0, 0, 0, 'WEBP'))).toBeNull();
  });

  it('recognises the avis brand as AVIF', () => {
    expect(detectImageType(withHeader(0, 0, 0, 0x1c, 'ftypavis'))).toEqual({
      contentType: 'image/avif',
      extension: 'avif',
    });
  });

  it('returns null for an ftyp box with a non-AVIF brand, and for an AVIF brand without ftyp', () => {
    expect(detectImageType(withHeader(0, 0, 0, 0x1c, 'ftypmp42'))).toBeNull();
    expect(detectImageType(withHeader(0, 0, 0, 0x1c, 'moovavif'))).toBeNull();
  });
});
