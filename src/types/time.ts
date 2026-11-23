export interface TimeProject {
  id: string
  companyId: string
  createdBy: string
  name: string        // "Web corporativa", "Mantenimiento septiembre"…
  clientName: string  // cliente al que se le comparte
  slug: string        // URL pública /horas/[slug]
  companyName?: string // snapshot para la vista pública
  logoUrl?: string     // snapshot para la vista pública
  language?: 'es' | 'en' // idioma de la vista pública (heredado del presupuesto del cliente)
  hourlyRate?: number    // €/h, heredado del presupuesto del cliente si existe
  archived?: boolean
  subprojects?: string[] // p. ej. Farco: SurePayroll, Wisable, Farco (se factura junto, las horas van por separado)
  createdAt?: string
  updatedAt?: string
}

export interface TimeEntry {
  id: string
  companyId: string
  createdBy: string
  projectId: string
  person: string      // quién imputó las horas ("Eric", "Andoni"…)
  date: string        // ISO yyyy-mm-dd
  hours: number
  description: string
  subproject?: string // uno de project.subprojects
  createdAt?: string
}

export type TimeProjectFormData = Omit<TimeProject, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'companyId'>
export type TimeEntryFormData = Omit<TimeEntry, 'id' | 'createdAt' | 'createdBy' | 'companyId'>
