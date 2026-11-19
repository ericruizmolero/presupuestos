/** Vuelta de Webflow tras autorizar. No pide sesión de Savvia: el state ya identifica la conexión */
import { NextRequest } from 'next/server'
import { finishConnect } from '@/lib/webflow'

export const runtime = 'nodejs'
export const maxDuration = 60

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function page(title: string, text: string, ok: boolean) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500&display=swap" rel="stylesheet">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F7F5F2;color:#1C1917;font-family:Satoshi,system-ui,sans-serif}
main{max-width:420px;padding:32px;text-align:center}h1{font-size:20px;font-weight:500;margin:0 0 8px}p{font-size:14px;color:#57534E;line-height:1.5;margin:0}
.dot{width:10px;height:10px;border-radius:50%;background:${ok ? '#16A34A' : '#B91C1C'};margin:0 auto 16px}</style></head>
<body><main><div class="dot"></div><h1>${esc(title)}</h1><p>${esc(text)}</p></main>
${ok ? '<script>try{window.opener&&window.opener.postMessage("webflow-connected","https://client.savvia.studio")}catch(e){}</script>' : ''}</body></html>`
  return new Response(html, { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const state = q.get('state') || ''
  const code = q.get('code') || ''
  if (q.get('error')) return page('No se ha conectado', 'Webflow no dio permiso. Puedes cerrar esta ventana y volver a intentarlo desde Savvia.', false)
  if (!state || !code) return page('Enlace incompleto', 'Vuelve a empezar la conexión desde Savvia.', false)
  try {
    const name = await finishConnect(state, code)
    return page(`Conectado: ${name}`, 'Ya puedes cerrar esta ventana. Claude puede usar esta cuenta desde el conector de Savvia.', true)
  } catch (e) {
    console.error('[webflow] callback:', e instanceof Error ? e.message : e)
    return page('No se ha conectado', e instanceof Error && !e.message.startsWith('token') ? e.message : 'Webflow no aceptó la autorización. Vuelve a intentarlo desde Savvia.', false)
  }
}
