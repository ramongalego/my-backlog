/**
 * Hands the browser a file to save, under this name: it goes to the downloads
 * folder (or asks where), as a link to a file would.
 */
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Not at once: Safari can drop a save whose address is gone before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
