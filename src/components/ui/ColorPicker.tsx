'use client'

import { useState, useRef, useEffect } from 'react'

// ── Color math ───────────────────────────────────────────────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  s /= 100; v /= 100
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0)
  }
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)]
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }
  return [h, max === 0 ? 0 : Math.round((d / max) * 100), Math.round(max * 100)]
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return null
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return isNaN(r) || isNaN(g) || isNaN(b) ? null : [r, g, b]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
    .join('').toUpperCase()
}

function parseValue(value: string): { r: number; g: number; b: number; a: number } {
  const m = value.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/)
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 }
  const rgb = hexToRgb(value)
  if (rgb) return { r: rgb[0], g: rgb[1], b: rgb[2], a: 1 }
  return { r: 26, g: 26, b: 26, a: 1 }
}

function buildOutput(r: number, g: number, b: number, a: number): string {
  if (a >= 1) return rgbToHex(r, g, b)
  return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// ── Slider ───────────────────────────────────────────────────────────────────

function Slider({
  value, min = 0, max = 100,
  trackStyle,
  thumbColor,
  onChange,
}: {
  value: number
  min?: number
  max?: number
  trackStyle: React.CSSProperties
  thumbColor: string
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="relative h-3 rounded-full overflow-hidden select-none" style={trackStyle}>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full pointer-events-none border-2 border-white"
        style={{
          left: `${pct}%`,
          background: thumbColor,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.18)',
        }}
      />
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const parsed = parseValue(value)
  const [hsv, setHsv] = useState<[number, number, number]>(() => rgbToHsv(parsed.r, parsed.g, parsed.b))
  const [alpha, setAlpha] = useState(parsed.a)
  const [hexInput, setHexInput] = useState(() => rgbToHex(parsed.r, parsed.g, parsed.b).slice(1))
  const [rgba, setRgba] = useState({ r: parsed.r, g: parsed.g, b: parsed.b })
  const [mode, setMode] = useState<'hex' | 'rgba'>('hex')

  const fieldRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  useEffect(() => {
    if (open) return
    const p = parseValue(value)
    const h = rgbToHsv(p.r, p.g, p.b)
    setHsv(h); setAlpha(p.a)
    setHexInput(rgbToHex(p.r, p.g, p.b).slice(1))
    setRgba({ r: p.r, g: p.g, b: p.b })
  }, [value, open])

  const [r, g, b] = hsvToRgb(...hsv)

  function commit(newHsv: [number, number, number], newAlpha: number) {
    const [nr, ng, nb] = hsvToRgb(...newHsv)
    setHexInput(rgbToHex(nr, ng, nb).slice(1))
    setRgba({ r: nr, g: ng, b: nb })
    onChange(buildOutput(nr, ng, nb, newAlpha))
  }

  function updateField(cx: number, cy: number) {
    const el = fieldRef.current; if (!el) return
    const rect = el.getBoundingClientRect()
    const s = clamp(Math.round(((cx - rect.left) / rect.width) * 100), 0, 100)
    const v = clamp(Math.round(100 - ((cy - rect.top) / rect.height) * 100), 0, 100)
    const newHsv: [number, number, number] = [hsv[0], s, v]
    setHsv(newHsv); commit(newHsv, alpha)
  }

  function startFieldDrag(e: React.MouseEvent) {
    e.preventDefault(); dragging.current = true; updateField(e.clientX, e.clientY)
    const onMove = (e: MouseEvent) => { if (dragging.current) updateField(e.clientX, e.clientY) }
    const onUp = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function openPicker(e: React.MouseEvent) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pickerH = 360
    const top = rect.bottom + 8 + pickerH > window.innerHeight ? rect.top - pickerH - 8 : rect.bottom + 8
    let left = rect.left
    if (left + 240 > window.innerWidth) left = window.innerWidth - 248
    setPos({ top, left }); setOpen(true)
  }

  return (
    <>
      <button
        onClick={openPicker}
        className="w-10 h-10 rounded-md border border-line transition-transform hover:scale-105 shrink-0 focus:outline-none"
        style={{ background: value }}
      />

      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-paper border border-line rounded-md shadow-[0_4px_16px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden"
            style={{ top: pos.top, left: pos.left, width: 236 }}
            onClick={(e) => e.stopPropagation()}
          >

            {/* ── Color field ── */}
            <div
              ref={fieldRef}
              className="relative w-full cursor-crosshair select-none"
              style={{ height: 140, background: `hsl(${hsv[0]}, 100%, 50%)` }}
              onMouseDown={startFieldDrag}
            >
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
              <div
                className="absolute w-3.5 h-3.5 rounded-full border-2 border-white pointer-events-none"
                style={{
                  left: `${hsv[1]}%`, top: `${100 - hsv[2]}%`,
                  transform: 'translate(-50%, -50%)',
                  background: `rgb(${r},${g},${b})`,
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.14), 0 2px 4px rgba(0,0,0,0.2)',
                }}
              />
            </div>

            {/* ── Controls ── */}
            <div className="border-t border-line px-4 pt-3 pb-4 space-y-3">

              {/* Sliders */}
              <div className="space-y-2">
                <Slider
                  value={hsv[0]} min={0} max={360}
                  trackStyle={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
                  thumbColor={`hsl(${hsv[0]}, 100%, 50%)`}
                  onChange={(v) => { const n: [number, number, number] = [v, hsv[1], hsv[2]]; setHsv(n); commit(n, alpha) }}
                />
                {/* Alpha — checkerboard base + color overlay */}
                <div className="relative h-3 rounded-full overflow-hidden select-none">
                  <div className="absolute inset-0" style={{ background: 'repeating-conic-gradient(#e0e0e0 0% 25%, white 0% 50%) 0 0 / 8px 8px' }} />
                  <div className="absolute inset-0" style={{ background: `linear-gradient(to right, transparent, rgb(${r},${g},${b}))` }} />
                  <input
                    type="range" min={0} max={100} value={Math.round(alpha * 100)}
                    onChange={(e) => { const a = +e.target.value / 100; setAlpha(a); commit(hsv, a) }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full pointer-events-none border-2 border-white"
                    style={{
                      left: `${alpha * 100}%`,
                      background: `rgba(${r},${g},${b},${alpha})`,
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.18)',
                    }}
                  />
                </div>
              </div>

              {/* Preview + mode toggle */}
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded border border-line shrink-0"
                  style={{ background: buildOutput(r, g, b, alpha) }}
                />
                <div className="flex gap-3 border-b border-line pb-0 flex-1">
                  {(['hex', 'rgba'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`pb-1.5 text-[10px] font-medium tracking-widest uppercase transition-colors border-b-[1.5px] -mb-px ${
                        mode === m ? 'text-ink border-ink' : 'text-ink-40 border-transparent hover:text-ink-60'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inputs */}
              {mode === 'hex' ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-40 font-mono select-none leading-none">#</span>
                  <input
                    type="text"
                    value={hexInput}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
                      setHexInput(raw)
                      if (raw.length === 6) {
                        const rgb = hexToRgb('#' + raw)
                        if (rgb) {
                          const newHsv = rgbToHsv(...rgb)
                          setHsv(newHsv); setRgba({ r: rgb[0], g: rgb[1], b: rgb[2] })
                          onChange(buildOutput(rgb[0], rgb[1], rgb[2], alpha))
                        }
                      }
                    }}
                    className="flex-1 text-xs font-mono border border-line rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:border-input uppercase tracking-wider placeholder-ink-40"
                    placeholder="1A1A1A"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {(['r', 'g', 'b'] as const).map((ch) => (
                    <div key={ch} className="flex flex-col items-center gap-1">
                      <input
                        type="number" min={0} max={255} value={rgba[ch]}
                        onChange={(e) => {
                          const v = clamp(+e.target.value || 0, 0, 255)
                          const next = { ...rgba, [ch]: v }
                          setRgba(next)
                          const newHsv = rgbToHsv(next.r, next.g, next.b)
                          setHsv(newHsv); setHexInput(rgbToHex(next.r, next.g, next.b).slice(1))
                          onChange(buildOutput(next.r, next.g, next.b, alpha))
                        }}
                        className="w-full text-xs font-mono border border-line rounded-md px-1 py-1.5 bg-surface text-center focus:outline-none focus:border-input [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-ink-40 font-medium tracking-widest uppercase">{ch}</span>
                    </div>
                  ))}
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="number" min={0} max={100} value={Math.round(alpha * 100)}
                      onChange={(e) => { const a = clamp(+e.target.value || 0, 0, 100) / 100; setAlpha(a); commit(hsv, a) }}
                      className="w-full text-xs font-mono border border-line rounded-md px-1 py-1.5 bg-surface text-center focus:outline-none focus:border-input [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[10px] text-ink-40 font-medium tracking-widest uppercase">A%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
