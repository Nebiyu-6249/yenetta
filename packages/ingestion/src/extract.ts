/**
 * "OCR" / text-extraction stage. For text uploads we use the bytes directly;
 * for PDFs we pull the embedded text layer via pdf-parse. Scanned-image OCR
 * (e.g. Tesseract) is a future drop-in here — the rest of the pipeline is
 * agnostic to how the text was produced.
 */

export interface UploadedFile {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

function isPdf(file: UploadedFile): boolean {
  return file.mimetype === 'application/pdf' || file.filename.toLowerCase().endsWith('.pdf');
}

export async function extractText(file: UploadedFile): Promise<string> {
  if (isPdf(file)) {
    // Import the implementation directly to avoid pdf-parse's debug entrypoint.
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (
      data: Buffer,
    ) => Promise<{ text: string }>;
    const parsed = await pdfParse(file.buffer);
    return parsed.text;
  }
  // Treat everything else (txt, md, csv...) as UTF-8 text.
  return file.buffer.toString('utf-8');
}
