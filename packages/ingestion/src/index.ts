import { APP_NAME } from '@yenetta/shared';
import { PIPELINE_STAGES } from './pipeline';

/**
 * Ingestion worker entrypoint (skeleton).
 * In M2 this connects to Redis/BullMQ and processes content jobs.
 */
function main(): void {
  console.log(
    `[${APP_NAME}] ingestion worker ready — pipeline stages: ${PIPELINE_STAGES.join(' → ')}`,
  );
}

main();
