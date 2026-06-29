import { type IngestionOverrides } from './run-pipeline';

export const INGESTION_QUEUE = 'content-ingestion';

/** Job payload enqueued by the API and consumed by the worker (queue mode). */
export interface IngestionJobData {
  documentId: string;
  file: {
    filename: string;
    mimetype: string;
    /** base64-encoded file bytes (small uploads only). */
    bufferBase64: string;
  };
  overrides?: IngestionOverrides;
}
