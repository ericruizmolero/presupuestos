/** Quién puede entrar en la app y leer datos internos (Holded, conector). Solo el estudio. */
export const ALLOWED_EMAILS = ['ericruizmolero@treseiscero.app', 'andoni@treseiscero.app']

export function isAllowedEmail(email?: string | null): boolean {
  return !!email && ALLOWED_EMAILS.includes(email.trim().toLowerCase())
}
