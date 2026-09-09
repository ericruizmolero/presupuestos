export interface TimeProject {
  id: string
  companyId: string
  createdBy: string
  name: string        // "Web corporativa", "Mantenimiento septiembre"…
  clientName: string  // cliente al que se le comparte
  slug: string        // URL pública /horas/[slug]
  companyName?: string // snapshot para la vista pública
  logoUrl?: string     // snapshot para la vista pública
  archived?: boolean
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
  createdAt?: string
}

export type TimeProjectFormData = Omit<TimeProject, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'companyId'>
export type TimeEntryFormData = Omit<TimeEntry, 'id' | 'createdAt' | 'createdBy' | 'companyId'>
