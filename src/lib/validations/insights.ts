import { z } from 'zod';

export const insightRequestSchema = z.object({
  tone: z.enum(['profile', 'roast']),
});
