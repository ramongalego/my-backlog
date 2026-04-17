import { z } from 'zod';

export const appIdSchema = z.number().int().positive();

export const syncSingleRequestSchema = z.object({
  appId: appIdSchema,
  name: z.string().trim().min(1).max(500).optional(),
});

export const MAX_BULK_APP_IDS = 2000;

export const syncBulkRequestSchema = z.object({
  appIds: z.array(appIdSchema).min(1).max(MAX_BULK_APP_IDS),
});

export const queueAddRequestSchema = z.object({
  appId: appIdSchema,
});

export const queueReorderRequestSchema = z.object({
  order: z.array(z.number().int().positive()).min(1),
});
