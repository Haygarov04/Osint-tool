import type { Lead, NewLead } from "../types";

// Скор за качество на лийда 0..100 — колкото повече канали и данни, толкова по-добре.
export function computeQualityScore(lead: Lead | NewLead): number {
  let score = 0;
  if (lead.phone) score += 20;
  if (lead.email) score += 25;
  if (lead.emailVerified === "valid") score += 10;
  if (lead.hasWebsite) score += 15;
  if (lead.rating && lead.rating > 0) score += 10;
  if (lead.reviewsCount && lead.reviewsCount >= 10) score += 10;
  if (lead.facebook || lead.instagram || lead.linkedin) score += 10;
  return Math.min(100, score);
}
