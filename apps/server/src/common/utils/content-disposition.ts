/**
 * [INPUT]: Download filename
 * [OUTPUT]: RFC 5987 Content-Disposition value
 * [POS]: Shared safe download-header formatter
 */

export function getContentDisposition(filename: string): string {
  const encodedFilename = encodeURIComponent(filename).replace(
    /['()]/g,
    escape,
  );
  return `attachment; filename*=UTF-8''${encodedFilename}`;
}
