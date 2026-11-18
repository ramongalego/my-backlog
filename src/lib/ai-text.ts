// Web addresses and emails, in any form a model might write them.
const LINK_PATTERN =
  /\b(?:https?:\/\/|www\.)\S+|\b[\w.+-]+@[\w-]+\.[\w.-]+\b|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|gg|co|app|xyz|ru|info|biz|me|tv|ly|link|site|online|store|shop)\b(?:\/\S*)?/gi;

/**
 * A game's name is written by whoever published it: if one talks the model
 * into writing an address, it still isn't shown.
 */
export function stripLinks(text: string): string {
  return text
    .replace(LINK_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
