// Kept apart from zod, so the header's form can check the server's limits
// without bringing the validation library into every page.
export const SUPPORT_MESSAGE_MIN = 10;
export const SUPPORT_MESSAGE_MAX = 2000;
