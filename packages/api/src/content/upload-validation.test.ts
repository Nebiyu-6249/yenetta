import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, validateUpload } from './upload-validation';

const file = (filename: string, buffer: Buffer, mimetype = 'application/octet-stream') => ({
  filename,
  mimetype,
  buffer,
});

describe('validateUpload', () => {
  it('accepts a real PDF (magic bytes match extension)', () => {
    expect(() => validateUpload(file('notes.pdf', Buffer.from('%PDF-1.7\n...')))).not.toThrow();
  });

  it('accepts plain text and markdown', () => {
    expect(() => validateUpload(file('notes.txt', Buffer.from('hello world')))).not.toThrow();
    expect(() => validateUpload(file('notes.md', Buffer.from('# Title')))).not.toThrow();
  });

  it('rejects a disallowed extension', () => {
    expect(() => validateUpload(file('evil.exe', Buffer.from('MZ...')))).toThrow(HttpException);
  });

  it('rejects a file whose content does not match its extension (fake PDF)', () => {
    // .pdf extension but the bytes are not a PDF
    expect(() => validateUpload(file('fake.pdf', Buffer.from('not a pdf at all')))).toThrow(
      HttpException,
    );
  });

  it('rejects binary content masquerading as text (NUL bytes)', () => {
    expect(() => validateUpload(file('sneaky.txt', Buffer.from([0x41, 0x00, 0x42])))).toThrow(
      HttpException,
    );
  });

  it('rejects an oversized file', () => {
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x41);
    expect(() => validateUpload(file('big.txt', big))).toThrow(HttpException);
  });

  it('rejects an empty file', () => {
    expect(() => validateUpload(file('empty.txt', Buffer.alloc(0)))).toThrow(HttpException);
  });
});
