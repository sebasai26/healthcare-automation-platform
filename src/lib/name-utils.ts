/**
 * Fix U+FFFD (�), ◆ and other replacement characters from bad CSV encoding.
 * Uses contextual pattern matching for Spanish accented characters.
 */
export function fixReplacementChars(str: string): string {
  const replacementPattern = /[\uFFFD\u25C6\u2666\uFFFE]/g;
  return str.replace(replacementPattern, (_, offset, full) => {
    const after = full[offset + 1]?.toLowerCase() || '';
    const before = full[offset - 1]?.toLowerCase() || '';
    const twoAfter = full[offset + 2]?.toLowerCase() || '';
    const twoBefore = full[offset - 2]?.toLowerCase() || '';

    // --- Ñ patterns ---
    if (before === 'u' && after === 'o' && twoBefore === 'm') return 'Ñ'; // MUÑOZ
    if ((before === 'a' && after === 'o') ||
        (before === 'o' && after === 'o') ||
        (before === 'a' && after === 'a') ||
        (before === 'e' && after === 'a') ||
        (before === 'i' && after === 'a') ||
        (before === 'u' && after === 'a') ||
        (before === 'o' && after === 'e') ||
        (before === 'i' && after === 'o') ||
        (before === 'a' && after === 'e')
       ) return 'Ñ';

    // --- É patterns ---
    if (before === 'r' && after === 's') return 'É'; // ANDRÉS
    if (before === 'n' && after === 's') return 'É'; // INÉS
    if (before === 'p' && after === 'r') return 'É'; // PÉREZ
    if (before === 'c' && after === 's') return 'É'; // CÉSAR

    // --- Í patterns ---
    if (before === 'c' && after === 'a') return 'Í'; // GARCÍA, LUCÍA
    if (before === 'r' && after === 'a') return 'Í'; // MARÍA
    if (before === 'f' && after === 'a') return 'Í'; // SOFÍA
    if (before === 'l' && after === 'a') return 'Í'; // ELÍAS
    if (before === 'a' && after === 'c') return 'Í'; // RAÍCES
    if (before === 'g' && after === 'a') return 'Í'; // MEGÍA

    // --- Á patterns ---
    if (after === 'l' && twoAfter === 'v') return 'Á'; // ÁLVAREZ
    if (after === 'n' && twoAfter === 'g') return 'Á'; // ÁNGEL
    if (before === 'z' && after === 'l') return 'Á'; // GONZÁLEZ
    if (before === '' && after === 'r') return 'Á';  // ÁREA
    if (before === 'u' && after === 'r') return 'Á'; // SUÁREZ
    if (before === 'm' && after === 'r') return 'Á'; // AMÁRQUEZ

    // --- Ó patterns ---
    if (after === 's' && twoAfter === 'c') return 'Ó'; // ÓSCAR
    if (before === 'g' && after === 'm') return 'Ó'; // GÓMEZ
    if (before === 'l' && after === 'p') return 'Ó'; // LÓPEZ
    if (before === 'm' && after === 'n') return 'Ó'; // RAMÓN

    // --- Ú patterns ---
    if (before === 'a' && after === 'l') return 'Ú'; // RAÚL
    if (before === 's' && after === 's') return 'Ú'; // JESÚS
    if (before === 'l' && after === 'c') return 'Ú'; // LÚCIA

    // --- Mª pattern ---
    if (before === 'm' && (after === ' ' || after === '')) return 'ª';

    // Default
    return 'Ñ';
  });
}

export function toTitleCase(str: string): string {
  return fixReplacementChars(str)
    .toLowerCase()
    .replace(/(?:^|\s|[-'(])\S/g, (match) => match.toUpperCase());
}
