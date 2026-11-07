/** Quién puede entrar en la app y leer datos internos (Holded, conector). Solo el estudio. */
export const ALLOWED_EMAILS = ['ericruizmolero@savvia.studio', 'andoni@savvia.studio', 'ericruizmolero@treseiscero.app', 'andoni@treseiscero.app']

/** Empresa compartida del estudio: cualquier cuenta del equipo que entre por primera vez se engancha a ella */
export const STUDIO_COMPANY_ID = 'company_AT73jo2HOr'

export function isAllowedEmail(email?: string | null): boolean {
  return !!email && ALLOWED_EMAILS.includes(email.trim().toLowerCase())
}
