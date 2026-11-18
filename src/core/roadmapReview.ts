import { setSetting } from './db';

export const ROADMAP_REVIEW_PREFIX = 'tr.readingReview.';

interface ReviewChoice {
  at: number;
  queued: boolean;
}

export function readReviewChoice(value: unknown): ReviewChoice | undefined {
  if (!value || typeof value !== 'object' || !('at' in value) || !('queued' in value)) return;
  if (typeof value.at !== 'number' || !Number.isFinite(value.at) || value.at <= 0 || typeof value.queued !== 'boolean') return;
  return { at: value.at, queued: value.queued };
}

export function setRoadmapReview(id: string, queued: boolean): Promise<void> {
  return setSetting(ROADMAP_REVIEW_PREFIX + id, { at: Date.now(), queued });
}
