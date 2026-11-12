// How long a support message can be. On their own (no zod), so the form in the
// header can show and check the same limits the server enforces without
// bringing the validation library into every page.
export const SUPPORT_MESSAGE_MIN = 10;
export const SUPPORT_MESSAGE_MAX = 2000;
