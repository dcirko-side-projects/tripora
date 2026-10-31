export function actionError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : '';
  const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
  if (/ENOSPC|SQLITE_FULL|database or disk is full|no space left|not enough (?:disk )?space/i.test(code + ' ' + message))
    return 'Nema dovoljno prostora na uređaju. Oslobodi prostor i ponovi spremanje. Prethodno spremljeni podaci i red za slanje ostaju sačuvani.';
  return message || 'Radnja nije uspjela. Pokušaj ponovno.';
}
