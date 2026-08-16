import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

/** Max upload size (SECURITY.md section 4). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export interface UploadedLike {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

const isPdf = (b: Buffer): boolean => b.length >= 5 && b.toString('latin1', 0, 5) === '%PDF-';
const isPng = (b: Buffer): boolean =>
  b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const isJpg = (b: Buffer): boolean =>
  b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** Heuristic: reject binary (NUL bytes) in a file claiming to be text. */
function looksLikeText(b: Buffer): boolean {
  const sample = b.subarray(0, 8192);
  for (const byte of sample) {
    if (byte === 0) return false;
  }
  return true;
}

// Extension whitelist, each verified by content (magic bytes), not extension.
const RULES: Record<string, (b: Buffer) => boolean> = {
  pdf: isPdf,
  png: isPng,
  jpg: isJpg,
  jpeg: isJpg,
  txt: looksLikeText,
  md: looksLikeText,
  csv: looksLikeText,
};

/**
 * Validates an uploaded file by size and by CONTENT (magic bytes), not by the
 * client-supplied extension/mimetype alone (SECURITY.md section 4). Throws a
 * typed HTTP exception on rejection.
 */
export function validateUpload(file: UploadedLike): void {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Empty or missing file');
  }
  if (file.buffer.length > MAX_UPLOAD_BYTES) {
    throw new PayloadTooLargeException('File exceeds the 15MB limit');
  }
  const ext = file.filename.includes('.') ? file.filename.split('.').pop()!.toLowerCase() : '';
  const rule = RULES[ext];
  if (!rule) {
    throw new UnsupportedMediaTypeException(
      `File type ".${ext}" is not allowed (allowed: ${Object.keys(RULES).join(', ')})`,
    );
  }
  if (!rule(file.buffer)) {
    throw new UnsupportedMediaTypeException(`File content does not match its ".${ext}" extension`);
  }
}
