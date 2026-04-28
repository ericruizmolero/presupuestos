'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RichTextEditor } from '@/components/quote/RichTextEditor'
import { upsertCompany, getUserCompanyId, setUserCompanyId } from '@/lib/firestore/companies'
import { uploadLogo } from '@/lib/storage'
import { nanoid } from 'nanoid'
import { Check } from 'lucide-react'
import type { Company } from '@/types/quote'

const SECTION_LABEL = 'text-xs font-medium tracking-widest uppercase text-ink-40 mb-6'
const FIELD_LABEL = 'block text-sm font-medium text-ink mb-2'
const INPUT_CLASS = 'w-full px-4 py-3 border border-input rounded-md text-base text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors'

export default function SettingsPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <SettingsContent />
      </DashboardLayout>
    </AuthGuard>
  )
}

function SettingsContent() {
  const { user, company, refreshCompany } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<Omit<Company, 'id'>>({
    name: '',
    logoUrl: '',
    email: '',
    address: '',
    taxId: '',
    description: '',
    defaultConditions: {
      paymentTerms: '',
      acceptanceCriteria: '',
      clientResponsibilities: '',
      penaltyClause: '',
      dataProtection: '',
    },
    fonts: [],
    defaultFontName: '',
    paletteId: '',
  })

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || '',
        logoUrl: company.logoUrl || '',
        email: company.email || '',
        address: company.address || '',
        taxId: company.taxId || '',
        description: company.description || '',
        defaultConditions: company.defaultConditions || {
          paymentTerms: '',
          acceptanceCriteria: '',
          clientResponsibilities: '',
          penaltyClause: '',
          dataProtection: '',
        },
        fonts: company.fonts || [],
        defaultFontName: company.defaultFontName || '',
        paletteId: company.paletteId || '',
      })
    }
  }, [company])

  async function getOrCreateCompanyId(): Promise<string> {
    if (!user) throw new Error('No user')
    let cid = await getUserCompanyId(user.uid)
    if (!cid) {
      cid = `company_${nanoid(10)}`
      await setUserCompanyId(user.uid, cid)
    }
    return cid
  }

  async function handleSave() {
    setSaving(true)
    try {
      const cid = await getOrCreateCompanyId()
      await upsertCompany(cid, form)
      await refreshCompany()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingLogo(true)
    try {
      const cid = await getOrCreateCompanyId()
      const url = await uploadLogo(cid, file)
      setForm((f) => ({ ...f, logoUrl: url }))
    } finally {
      setUploadingLogo(false)
    }
  }

  function setField(key: keyof Omit<Company, 'id' | 'defaultConditions' | 'fonts' | 'defaultFontName'>, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setCondition(key: keyof Company['defaultConditions'], value: string) {
    setForm((f) => ({ ...f, defaultConditions: { ...f.defaultConditions, [key]: value } }))
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-2xl font-medium tracking-tight text-ink">Configuración</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-md hover:-translate-y-px transition-all disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)] bg-accent text-on-accent hover:bg-accent-hover"
        >
          {saved ? <><Check size={14} /> Guardado</> : saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Empresa emisora */}
      <section className="mb-12">
        <p className={SECTION_LABEL}>Empresa emisora</p>
        <div className="space-y-6">
          <div className="flex items-start gap-6">
            <div
              className="w-20 h-20 border border-line rounded-md flex items-center justify-center bg-surface cursor-pointer hover:border-input transition-colors overflow-hidden shrink-0"
              onClick={() => logoInputRef.current?.click()}
            >
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <span className="text-xs text-ink-40">{uploadingLogo ? '...' : 'Logo'}</span>
              )}
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <div className="flex-1 space-y-4">
              <div>
                <label className={FIELD_LABEL}>Nombre de la empresa</label>
                <input className={INPUT_CLASS} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Nombre S.L." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={FIELD_LABEL}>Email</label>
                  <input className={INPUT_CLASS} type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="hola@empresa.com" />
                </div>
                <div>
                  <label className={FIELD_LABEL}>CIF / NIF</label>
                  <input className={INPUT_CLASS} value={form.taxId} onChange={(e) => setField('taxId', e.target.value)} placeholder="B12345678" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className={FIELD_LABEL}>Dirección</label>
            <input className={INPUT_CLASS} value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Calle, número, ciudad" />
          </div>

          <div>
            <label className={FIELD_LABEL}>Descripción de la empresa</label>
            <RichTextEditor
              value={form.description}
              onChange={(v) => setForm((f) => ({ ...f, description: v }))}
              placeholder="Describe tu empresa, especialidades, propuesta de valor..."
              minHeight="100px"
            />
          </div>
        </div>
      </section>


      <hr className="border-t border-line mb-12" />

      {/* Condiciones por defecto */}
      <section className="mb-12">
        <p className={SECTION_LABEL}>Condiciones por defecto</p>
        <p className="text-sm text-ink-60 mb-6">Se precargan en cada presupuesto nuevo. Puedes editarlas por presupuesto.</p>
        <div className="space-y-6">
          {([
            ['paymentTerms', 'Forma de pago'],
            ['acceptanceCriteria', 'Criterios de aceptación'],
            ['clientResponsibilities', 'Responsabilidades del cliente'],
            ['penaltyClause', 'Cláusula de penalización'],
            ['dataProtection', 'Tratamiento de datos personales'],
          ] as [keyof Company['defaultConditions'], string][]).map(([key, label]) => (
            <div key={key}>
              <label className={FIELD_LABEL}>{label}</label>
              <RichTextEditor
                value={form.defaultConditions[key]}
                onChange={(v) => setCondition(key, v)}
                placeholder={`${label}...`}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
