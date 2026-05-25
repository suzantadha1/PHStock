import { useState, useRef, useEffect } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function parseISO(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return { year: y, month: m - 1, day: d }
}

function buildISO(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function fmtDisplay(p) {
  if (!p) return ''
  return `${String(p.day).padStart(2,'0')}/${String(p.month + 1).padStart(2,'0')}/${p.year}`
}

function CalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ display: 'block', pointerEvents: 'none' }}>
      <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4.5 1v2M9.5 1v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <rect x="3" y="7.5" width="2" height="1.8" rx=".4" fill="currentColor"/>
      <rect x="6.5" y="7.5" width="2" height="1.8" rx=".4" fill="currentColor"/>
      <rect x="3" y="10" width="2" height="1.8" rx=".4" fill="currentColor"/>
      <rect x="6.5" y="10" width="2" height="1.8" rx=".4" fill="currentColor"/>
    </svg>
  )
}

export default function DatePicker({ value, onChange, placeholder = 'DD/MM/YYYY', className = 'field-input', style, inputStyle }) {
  const parsed = parseISO(value)
  const now = new Date()
  const todayY = now.getFullYear(), todayM = now.getMonth(), todayD = now.getDate()

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(parsed?.year ?? todayY)
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? todayM)
  const ref = useRef(null)

  useEffect(() => {
    if (parsed) { setViewYear(parsed.year); setViewMonth(parsed.month) }
  }, [value])

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }
  function select(day) { onChange(buildISO(viewYear, viewMonth, day)); setOpen(false) }
  function goToday() { onChange(buildISO(todayY, todayM, todayD)); setOpen(false) }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const isSel = d => parsed && d === parsed.day && viewMonth === parsed.month && viewYear === parsed.year
  const isToday = d => d === todayD && viewMonth === todayM && viewYear === todayY

  const navBtn = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--ink-2)', fontSize: 18, lineHeight: 1,
    padding: '2px 8px', borderRadius: 4,
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'block', width: '100%', ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          readOnly
          value={fmtDisplay(parsed)}
          placeholder={placeholder}
          className={className}
          onClick={() => setOpen(o => !o)}
          style={{ cursor: 'pointer', paddingRight: 32, width: '100%', boxSizing: 'border-box', ...inputStyle }}
        />
        <span
          onClick={() => setOpen(o => !o)}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <CalIcon />
        </span>
      </div>

      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 1000,
            background: 'var(--surface)', border: '1px solid var(--line-strong)',
            borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-2)',
            padding: 14, width: 256,
          }}
        >
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" style={navBtn} onClick={prevMonth}>‹</button>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" style={navBtn} onClick={nextMonth}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '2px 0 4px' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {cells.map((day, i) => day === null ? <div key={i} /> : (
              <button
                key={i}
                type="button"
                onClick={() => select(day)}
                style={{
                  textAlign: 'center', fontSize: 12, padding: '6px 0',
                  borderRadius: 4,
                  border: isToday(day) && !isSel(day) ? '1px solid var(--line-strong)' : '1px solid transparent',
                  cursor: 'pointer',
                  background: isSel(day) ? 'var(--primary, #2563eb)' : 'transparent',
                  color: isSel(day) ? '#fff' : isToday(day) ? 'var(--primary, #2563eb)' : 'var(--ink)',
                  fontWeight: isSel(day) ? 700 : isToday(day) ? 600 : 400,
                }}
                onMouseEnter={e => { if (!isSel(day)) e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { if (!isSel(day)) e.currentTarget.style.background = 'transparent' }}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Today shortcut */}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 8, textAlign: 'center' }}>
            <button
              type="button"
              onClick={goToday}
              style={{ fontSize: 11, color: 'var(--primary, #2563eb)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '.06em' }}
            >
              TODAY
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
