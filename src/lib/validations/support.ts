import { z } from 'zod';
import { safeText } from './common';
import { SUPPORT_MESSAGE_MAX, SUPPORT_MESSAGE_MIN } from './support-limits';

export const supportTicketSchema = z.object({
  type: z.enum(['bug', 'feedback', 'support'], { message: 'Invalid type' }),
  message: safeText.pipe(
    z
      .string()
      .min(SUPPORT_MESSAGE_MIN, `Message must be at least ${SUPPORT_MESSAGE_MIN} characters`)
      .max(SUPPORT_MESSAGE_MAX, `Message must be at most ${SUPPORT_MESSAGE_MAX} characters`),
  ),
});
