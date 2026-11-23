/** Spinner de página entera: el mismo que al entrar en la app y en los presupuestos públicos */
export function PageLoader() {
  return (
    <main className="min-h-screen bg-paper flex items-center justify-center" aria-busy="true" aria-label="Cargando">
      <div className="w-5 h-5 border border-ink border-t-transparent rounded-full animate-spin" />
    </main>
  )
}
