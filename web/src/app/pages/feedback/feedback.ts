/** Mirrors the Worker's feedback/src/limits.ts; change both together. */
export const LIMITS = {
  titleMin: 4,
  titleMax: 120,
  descriptionMin: 10,
  descriptionMax: 5000,
  files: 5,
  fileBytes: 4 * 1024 * 1024,
  totalBytes: 10 * 1024 * 1024,
} as const;

export const ACCEPTED_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
];

export type Kind = 'bug' | 'feature';

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  const mb = bytes / 1024 / 1024;
  return `${mb.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} MB`;
}

/** Adds picked, dropped or pasted files to the list, and says in Swedish what was left out. */
export function addFiles(
  current: readonly File[],
  incoming: readonly File[],
): { files: File[]; problems: string[] } {
  const files = [...current];
  const problems: string[] = [];
  let total = files.reduce((sum, f) => sum + f.size, 0);
  for (const file of incoming) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      problems.push(`${file.name} är varken en bild eller en PDF.`);
    } else if (file.size > LIMITS.fileBytes) {
      problems.push(`${file.name} är större än ${formatBytes(LIMITS.fileBytes)}.`);
    } else if (files.length >= LIMITS.files) {
      problems.push(`Högst ${LIMITS.files} filer, så ${file.name} kom inte med.`);
    } else if (total + file.size > LIMITS.totalBytes) {
      problems.push(
        `Filerna får vara högst ${formatBytes(LIMITS.totalBytes)} tillsammans, så ${file.name} kom inte med.`,
      );
    } else {
      files.push(file);
      total += file.size;
    }
  }
  return { files, problems };
}

const MESSAGES: Record<string, string> = {
  'missing-captcha': 'Vänta tills säkerhetskontrollen är klar och försök igen.',
  'captcha-failed': 'Säkerhetskontrollen gick inte igenom. Försök igen.',
  'too-many-files': `Du kan bifoga högst ${LIMITS.files} filer.`,
  'file-too-large': 'En av filerna är för stor. Ta bort den och försök igen.',
  'too-large': 'Filerna är för stora tillsammans. Ta bort någon och försök igen.',
  'unsupported-file': 'En av filerna är varken en bild eller en PDF.',
  'invalid-title': `Rubriken ska vara ${LIMITS.titleMin}–${LIMITS.titleMax} tecken.`,
  'invalid-description': `Beskrivningen ska vara ${LIMITS.descriptionMin}–${LIMITS.descriptionMax} tecken.`,
  network: 'Kunde inte nå servern. Kontrollera uppkopplingen och försök igen.',
};

/** The Worker's error code as a message for the member. */
export const errorMessage = (code: string | undefined) =>
  (code && MESSAGES[code]) || 'Det gick inte att skicka just nu. Försök igen om en stund.';
