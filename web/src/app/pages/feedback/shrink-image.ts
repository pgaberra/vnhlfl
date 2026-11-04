import { LIMITS } from './feedback';

const MAX_SIDE = 2560;

/**
 * Re-encodes photos before they leave the device: the copy has no EXIF data (GPS position,
 * camera), which would otherwise end up in the public repository, and is scaled down to fit the
 * size limit. Screenshots (PNG) pass through untouched unless they are too large.
 */
export async function shrinkImage(file: File): Promise<File> {
  const tooLarge = file.size > LIMITS.fileBytes;
  const reencode = file.type === 'image/jpeg' || (file.type.startsWith('image/') && tooLarge);
  if (!reencode) return file;
  try {
    // createImageBitmap applies the EXIF rotation, so portrait photos stay upright.
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.88));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
