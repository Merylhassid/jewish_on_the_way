/**
 * Normalize synagogue names for consistent deduplication and comparison.
 *
 * Transformations:
 * - Unicode normalization (NFKD)
 * - Convert to lowercase
 * - Remove diacritics (accents)
 * - Remove punctuation
 * - Collapse multiple spaces
 */
export function normalizeNameForDedup(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  return (
    name
      // Unicode normalization: decompose accented characters
      .normalize('NFKD')
      // Remove diacritics (accents)
      .replace(/[\u0300-\u036f]/g, '')
      // Lowercase
      .toLowerCase()
      // Remove punctuation including hyphens, but keep spaces and alphanumeric (Unicode-aware)
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      // Trim leading/trailing spaces
      .trim()
  );
}
