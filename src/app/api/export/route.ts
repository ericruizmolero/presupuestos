export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'

function findChrome(): string {
  const candidates =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        ]
      : process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ]
      : ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium']

  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error('Chrome not found at any expected path')
  return found
}

export async function POST(request: NextRequest) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null

  try {
    const { html, filename } = (await request.json()) as { html: string; filename: string }
    if (!html) return NextResponse.json({ error: 'Missing html' }, { status: 400 })

    const executablePath = findChrome()
    console.log('[export] Chrome:', executablePath)

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 794, height: 1123 })

    // Activate print media BEFORE loading content so @media print rules,
    // break-before: page and .no-print{display:none} are all in effect from the start
    await page.emulateMediaType('print')

    // Fonts are base64-embedded — no external URLs, 'load' is enough
    await page.setContent(html, { waitUntil: 'load' })

    // Wait for @font-face fonts (base64 data URIs) to finish loading
    await page.evaluate(() => document.fonts.ready)

    // ?screenshot=1 → return PNG for debugging what Puppeteer actually renders
    const isDebug = new URL(request.url).searchParams.get('screenshot') === '1'
    if (isDebug) {
      const png = await page.screenshot({ fullPage: true })
      return new NextResponse(Buffer.from(png), { headers: { 'Content-Type': 'image/png' } })
    }

    console.log('[export] Generating PDF...')
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '25mm', bottom: '25mm', left: '20mm', right: '20mm' },
    })

    const safe = (filename || 'presupuesto.pdf').replace(/[^\w.\-]/g, '_')
    console.log('[export] Done:', safe)

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safe}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[export] ERROR:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    await browser?.close()
  }
}
