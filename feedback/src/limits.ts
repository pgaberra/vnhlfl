/**
 * What a submission may contain. The web form mirrors these in
 * web/src/app/pages/feedback/feedback.ts; change both together.
 *
 * Files stay small because every byte is base64-encoded for GitHub's API, and the Workers free
 * plan allows 10 ms of CPU per request. The form scales photos down before sending them.
 */
export const LIMITS = {
  titleMin: 4,
  titleMax: 120,
  descriptionMin: 10,
  descriptionMax: 5000,
  pageMax: 300,
  files: 5,
  fileBytes: 4 * 1024 * 1024,
  totalBytes: 10 * 1024 * 1024,
} as const;
