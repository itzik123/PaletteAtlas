/** Letters that don't come apart into a base letter and an accent, and what they are read as. */
const LETTERS_READ_AS: Readonly<Record<string, string>> = { ø: 'o', œ: 'oe', æ: 'ae', ß: 'ss', ł: 'l', đ: 'd', þ: 'th', ı: 'i' };

/**
 * Text as names are compared and ordered: in lower case, without accents, and with every run of
 * anything but letters and digits (spaces, hyphens, apostrophes, periods) a single space.
 */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[øœæßłđþı]/g, (letter) => LETTERS_READ_AS[letter] ?? letter)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
