export interface FileType {
  ext: 'png' | 'jpg' | 'gif' | 'webp' | 'pdf';
  image: boolean;
}

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

const startsWith = (bytes: Uint8Array, signature: number[], at = 0) =>
  signature.every((value, i) => bytes[at + i] === value);

/** The file's real type from its first bytes; the browser's MIME type is only the sender's claim. */
export function sniff(bytes: Uint8Array): FileType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ext: 'png', image: true };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ext: 'jpg', image: true };
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) {
    return { ext: 'gif', image: true };
  }
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) {
    return { ext: 'webp', image: true };
  }
  if (startsWith(bytes, ascii('%PDF-'))) return { ext: 'pdf', image: false };
  return null;
}

/** Base64 without a stack overflow: `String.fromCharCode(...bytes)` fails past ~100k arguments. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
