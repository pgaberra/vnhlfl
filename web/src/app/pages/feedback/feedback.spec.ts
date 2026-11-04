import { describe, expect, it } from 'vitest';
import { addFiles, errorMessage, formatBytes, LIMITS } from './feedback';

const file = (name: string, type: string, bytes = 10) =>
  new File([new Uint8Array(bytes)], name, { type });

describe('addFiles', () => {
  it('keeps images and PDFs and explains what it leaves out', () => {
    const { files, problems } = addFiles(
      [],
      [
        file('a.png', 'image/png'),
        file('b.pdf', 'application/pdf'),
        file('c.zip', 'application/zip'),
      ],
    );
    expect(files.map((f) => f.name)).toEqual(['a.png', 'b.pdf']);
    expect(problems).toEqual(['c.zip är varken en bild eller en PDF.']);
  });

  it('stops at the file count, the file size and the total size', () => {
    const many = Array.from({ length: LIMITS.files + 1 }, (_, i) => file(`${i}.png`, 'image/png'));
    expect(addFiles([], many).files).toHaveLength(LIMITS.files);

    const big = file('big.jpg', 'image/jpeg', LIMITS.fileBytes + 1);
    expect(addFiles([], [big]).problems).toEqual(['big.jpg är större än 4 MB.']);

    const full = [
      file('a.png', 'image/png', LIMITS.fileBytes),
      file('b.png', 'image/png', LIMITS.fileBytes),
    ];
    const { files, problems } = addFiles(full, [file('c.png', 'image/png', LIMITS.fileBytes)]);
    expect(files).toHaveLength(2);
    expect(problems[0]).toContain('högst 10 MB tillsammans');
  });
});

describe('formatBytes', () => {
  it('shows kB below a megabyte and MB with one decimal above', () => {
    expect(formatBytes(300)).toBe('1 kB');
    expect(formatBytes(512 * 1024)).toBe('512 kB');
    expect(formatBytes(3.45 * 1024 * 1024)).toBe('3,5 MB');
  });
});

describe('errorMessage', () => {
  it('translates known codes and falls back for the rest', () => {
    expect(errorMessage('captcha-failed')).toContain('Säkerhetskontrollen');
    expect(errorMessage('github-failed')).toContain('Försök igen om en stund');
    expect(errorMessage(undefined)).toContain('Försök igen om en stund');
  });
});
