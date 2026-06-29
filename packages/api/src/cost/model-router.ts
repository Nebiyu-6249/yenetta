import { Injectable } from '@nestjs/common';
import { type LlmTier } from '../providers/llm/llm-provider.interface';

export type AiTask =
  'chat' | 'summary' | 'notes' | 'flashcards' | 'quiz' | 'classification' | 'deep_reasoning';

/**
 * Routes each task to the cheapest capable model tier (BUILD_BRIEF §4.1, §8).
 * Default everything to cheap; escalate only when explicitly needed.
 */
@Injectable()
export class ModelRouter {
  tierForTask(task: AiTask, opts: { hard?: boolean } = {}): LlmTier {
    if (opts.hard || task === 'deep_reasoning') return 'hard';
    if (task === 'quiz') return 'standard';
    return 'cheap';
  }
}
