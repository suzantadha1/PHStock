import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { Icon } from '../App'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const GRADE_COLORS = { A: 'var(--grade-a)', B: 'var(--grade-b)', C: 'var(--grade-c)', D: 'var(--grade-d)' }
const INDEX_COLORS = ['var(--grade-a)', 'var(--grade-b)', 'var(--grade-c)', 'var(--grade-d)', 'var(--accent)', 'var(--ink-2)']

const fmt = d => d ? d.split('-').reverse().join('/') : '—'

function gradeColor(name, i = 0) {
  const letter = (name || '').trim()[0]?.toUpperCase()
  return GRADE_COLORS[letter] || INDEX_COLORS[i % INDEX_COLORS.length]
}

function Spark({ values, color = 'var(--ink-2)', w = 96, h = 36 }) {
  if (!values || values.length < 2) return null
  const max = Math.max(...values), min = Math.min(...values)
  const range = max - min || 1
  const x = i => (i / (values.length - 1)) * w
  const y = v => h - ((v - min) / range) * h
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const a = `${d} L ${w} ${h} L 0 ${h} Z`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="kpi-spark">
      <path d={a} fill={color} opacity=".12" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  )
}

function Donut({ data, size = 260, thickness = 36, hot, onHot }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = size / 2
  const inner = r - thickness
  let acc = -Math.PI / 2
  const gap = 0.012
  const paths = data.map(d => {
    const frac = d.value / total
    const start = acc + gap / 2
    const end = acc + Math.PI * 2 * frac - gap / 2
    acc += Math.PI * 2 * frac
    if (d.value === 0) return null
    const large = end - start > Math.PI ? 1 : 0
    const x1 = r + Math.cos(start) * r
    const y1 = r + Math.sin(start) * r
    const x2 = r + Math.cos(end) * r
    const y2 = r + Math.sin(end) * r
    const xi1 = r + Math.cos(end) * inner
    const yi1 = r + Math.sin(end) * inner
    const xi2 = r + Math.cos(start) * inner
    const yi2 = r + Math.sin(start) * inner
    const dStr = [`M ${x1} ${y1}`, `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, `L ${xi1} ${yi1}`, `A ${inner} ${inner} 0 ${large} 0 ${xi2} ${yi2}`, 'Z'].join(' ')
    return { key: d.key, dStr, color: d.color, value: d.value }
  }).filter(Boolean)

  return (
    <svg
      className={'donut' + (hot ? ' has-hover' : '')}
      viewBox={`0 0 ${size} ${size}`}
      style={{ width: '100%', aspectRatio: '1', maxWidth: size }}
    >
      {paths.map(p => (
        <path
          key={p.key}
          d={p.dStr}
          fill={p.color}
          className={hot === p.key ? 'is-hot' : ''}
          onMouseEnter={() => onHot && onHot(p.key)}
          onMouseLeave={() => onHot && onHot(null)}
        />
      ))}
    </svg>
  )
}

function KPI({ label, value, unit, delta, deltaLabel, dir, spark, sparkColor }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-val">
        <span>{value}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <div className="kpi-foot">
        <span className={'kpi-delta ' + (dir === 'up' ? 'up' : 'down')}>
          <Icon name={dir === 'up' ? 'up' : 'down'} size={12} /> {delta}
        </span>
        <span style={{ color: 'var(--ink-3)' }}>{deltaLabel}</span>
      </div>
      {spark && <Spark values={spark} color={sparkColor || 'var(--grade-a)'} />}
    </div>
  )
}

function LocBar({ label, segments, total, max }) {
  const [tip, setTip] = useState(false)
  const active = segments.filter(s => s.value > 0)
  const trackPct = total > 0 && max > 0 ? (total / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 88, flexShrink: 0,
        fontSize: 12, fontWeight: 500, color: 'var(--ink)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
      <div
        style={{ flex: 1, position: 'relative', cursor: 'default' }}
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        onClick={() => setTip(t => !t)}
      >
        <div className="loc-bar-track" style={{ borderRadius: 8, overflow: 'hidden', background: 'var(--surface-2)', display: 'flex' }}>
          {active.map(s => {
            const w = (s.value / total) * trackPct
            return (
              <div
                key={s.key}
                style={{
                  width: `${w}%`, height: '100%', background: s.color, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}
              >
                {w > 5 && (
                  <span className="loc-bar-num" style={{
                    fontSize: 10, color: '#fff', fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    textShadow: '0 1px 2px rgba(0,0,0,.3)',
                    whiteSpace: 'nowrap', pointerEvents: 'none',
                  }}>
                    {s.value.toLocaleString()}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {tip && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            background: 'var(--surface)',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--radius-input)',
            padding: '8px 12px',
            boxShadow: 'var(--shadow-2)',
            zIndex: 10,
            minWidth: 160,
            pointerEvents: 'none',
          }}>
            {active.map(s => (
              <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: s.color, fontWeight: 600 }}>● {s.key}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.value.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--ink-3)' }}>Total</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{total.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
      <div style={{
        width: 52, flexShrink: 0, textAlign: 'right',
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--ink-2)',
      }}>
        {total.toLocaleString()}
      </div>
    </div>
  )
}

function Dashboard({ activeLoc, locations, onNavigate }) {
  const [stockByGrade, setStockByGrade] = useState([])
  const [recent, setRecent] = useState([])
  const [locData, setLocData] = useState([])
  const [hot, setHot] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [activeLoc, locations])

  async function fetchData() {
    setLoading(true)

    let inQ = supabase.from('inbound_shipments').select('cold_storage_id, inbound_items(grade, quantity)')
    let outQ = supabase.from('outbound_shipments').select('cold_storage_id, outbound_items(grade, quantity)')

    if (activeLoc !== 'all') {
      inQ = inQ.eq('cold_storage_id', activeLoc)
      outQ = outQ.eq('cold_storage_id', activeLoc)
    }

    const [{ data: inShips }, { data: outShips }] = await Promise.all([inQ, outQ])

    const gradeMap = {}
    ;(inShips || []).flatMap(s => s.inbound_items.map(i => ({ ...i, loc: s.cold_storage_id }))).forEach(item => {
      gradeMap[item.grade] = (gradeMap[item.grade] || 0) + item.quantity
    })
    ;(outShips || []).flatMap(s => s.outbound_items.map(i => ({ ...i, loc: s.cold_storage_id }))).forEach(item => {
      gradeMap[item.grade] = (gradeMap[item.grade] || 0) - item.quantity
    })

    const grades = Object.entries(gradeMap)
      .map(([name, value], i) => ({ key: name, name, value, color: gradeColor(name, i) }))
    setStockByGrade(grades)

    // Per-location breakdown for all-locations view
    if (activeLoc === 'all') {
      // flat key avoids nested-object lookup bugs
      const flat = {} // "locId|grade" -> net bags
      const gradeNames = new Set()
      ;(inShips || []).forEach(s => {
        const lid = String(s.cold_storage_id)
        s.inbound_items.forEach(item => {
          gradeNames.add(item.grade)
          const k = lid + '|' + item.grade
          flat[k] = (flat[k] || 0) + item.quantity
        })
      })
      ;(outShips || []).forEach(s => {
        const lid = String(s.cold_storage_id)
        s.outbound_items.forEach(item => {
          gradeNames.add(item.grade)
          const k = lid + '|' + item.grade
          flat[k] = (flat[k] || 0) - item.quantity
        })
      })
      const allGrades = [...gradeNames].sort()
      const ld = locations.map(l => {
        const lid = String(l.id)
        const segs = allGrades.map((gname, i) => ({
          key: gname,
          value: Math.max(0, flat[lid + '|' + gname] || 0),
          color: gradeColor(gname, i),
        }))
        const total = segs.reduce((s, g) => s + g.value, 0)
        return { id: l.id, label: l.name, segments: segs, total }
      }).filter(l => l.total > 0)
      setLocData(ld)
    }

    // Recent activity
    let recentQ = supabase.from('inbound_shipments')
      .select('id, date, cold_storage_id, inbound_items(grade, quantity)')
      .order('date', { ascending: false })
      .limit(5)
    let recentOutQ = supabase.from('outbound_shipments')
      .select('id, date, cold_storage_id, outbound_items(grade, quantity)')
      .order('date', { ascending: false })
      .limit(5)

    if (activeLoc !== 'all') {
      recentQ = recentQ.eq('cold_storage_id', activeLoc)
      recentOutQ = recentOutQ.eq('cold_storage_id', activeLoc)
    }

    const [{ data: rIn }, { data: rOut }] = await Promise.all([recentQ, recentOutQ])

    const recentEntries = [
      ...(rIn || []).flatMap(s => s.inbound_items.map(item => ({
        id: s.id + '-' + item.grade,
        date: s.date,
        loc: s.cold_storage_id,
        grade: item.grade,
        bags: item.quantity,
        kind: 'in',
      }))),
      ...(rOut || []).flatMap(s => s.outbound_items.map(item => ({
        id: s.id + '-' + item.grade,
        date: s.date,
        loc: s.cold_storage_id,
        grade: item.grade,
        bags: item.quantity,
        kind: 'out',
      }))),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)

    setRecent(recentEntries)
    setLoading(false)
  }

  const total = useMemo(() => stockByGrade.reduce((s, g) => s + g.value, 0), [stockByGrade])
  const maxLoc = useMemo(() => Math.max(...locData.map(l => l.total), 1), [locData])
  const locName = activeLoc === 'all' ? 'All locations' : (locations.find(l => l.id === activeLoc)?.name || '')
  const positiveData = stockByGrade.filter(d => d.value > 0)
  const negativeData = stockByGrade.filter(d => d.value < 0)
  const positiveTotal = positiveData.reduce((s, g) => s + g.value, 0)
  const aGrade = stockByGrade.find(g => /^a/i.test(g.name))
  const aPct = positiveTotal > 0 && aGrade ? Math.round((aGrade.value / positiveTotal) * 100) : 0

  function exportPDF() {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()

    // Header band
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, W, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('PHStock', 14, 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Current Stock Snapshot', 14, 16)
    doc.text(today, W - 14, 16, { align: 'right' })

    // Meta row
    doc.setTextColor(80, 80, 80)
    doc.setFontSize(9)
    doc.text(`Location: ${locName}`, 14, 30)
    doc.text(`Total stock: ${positiveTotal.toLocaleString()} bags`, 14, 36)

    // Grade breakdown table
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Stock by Grade', 14, 46)

    autoTable(doc, {
      startY: 50,
      head: [['Grade', 'Bags', 'Share']],
      body: [
        ...stockByGrade.map(g => {
          const pct = positiveTotal > 0 && g.value > 0 ? Math.round((g.value / positiveTotal) * 100) : 0
          return [g.name, g.value.toLocaleString(), g.value > 0 ? `${pct}%` : '—']
        }),
        ['Total', positiveTotal.toLocaleString(), '100%'],
      ],
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      foot: [],
      didParseCell(data) {
        if (data.section === 'body' && data.row.index === stockByGrade.length) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [226, 232, 240]
        }
      },
      margin: { left: 14, right: 14 },
    })

    // Location breakdown (all-locations view only)
    if (activeLoc === 'all' && locData.length > 0) {
      const afterGrade = doc.lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text('Stock by Location', 14, afterGrade)

      autoTable(doc, {
        startY: afterGrade + 4,
        head: [['Location', 'Bags']],
        body: locData.map(l => [l.label, l.total.toLocaleString()]),
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
    }

    // Footer
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Generated by PHStock · ${today}`, 14, pageH - 10)

    doc.save(`phstock-stock-${today}.pdf`)
  }

  if (loading) {
    return (
      <div style={{ padding: '48px 0', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  return (
    <div className="col">
      {/* KPI row */}
      <div className="grid-4">
        <KPI
          label="Total stock"
          value={total.toLocaleString()}
          unit="bags"
          delta={aPct + '% grade A'}
          deltaLabel="quality share"
          dir="up"
          sparkColor="var(--grade-a)"
        />
        <KPI
          label="Grade A bags"
          value={(aGrade?.value || 0).toLocaleString()}
          unit="bags"
          delta="premium"
          deltaLabel="market-ready"
          dir="up"
          sparkColor="var(--grade-a)"
        />
        <KPI
          label="Grade count"
          value={stockByGrade.length.toString()}
          unit="grades"
          delta="active"
          deltaLabel="in stock"
          dir="up"
        />
        <KPI
          label="Locations"
          value={(activeLoc === 'all' ? locations.length : 1).toString()}
          unit={activeLoc === 'all' ? 'sites' : 'site'}
          delta="tracked"
          deltaLabel="cold storages"
          dir="up"
        />
      </div>

      {/* Stock breakdown + by location */}
      {stockByGrade.length > 0 ? (
        <div className="grid-dash">
          <div className="card">
            <div className="card-hd">
              <div>
                <div className="card-eyebrow">{locName} · current stock</div>
                <div className="card-title display">Stock by grade</div>
              </div>
              <button className="btn" type="button" onClick={exportPDF} disabled={stockByGrade.length === 0}>
                <Icon name="download" /> PDF
              </button>
            </div>
            <div className="card-bd">
              <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                <div className="donut-wrap" style={{ flex: '0 1 240px', minWidth: 0 }}>
                  <Donut data={positiveData} size={240} thickness={32} hot={hot} onHot={setHot} />
                  <div className="donut-center">
                    <div style={{ textAlign: 'center' }}>
                      <div className="lbl">{hot || 'Total'}</div>
                      <div className="val display">
                        {hot
                          ? (positiveData.find(g => g.key === hot)?.value || 0).toLocaleString()
                          : positiveTotal.toLocaleString()
                        }
                      </div>
                      <div className="sub">
                        {hot
                          ? Math.round(((positiveData.find(g => g.key === hot)?.value || 0) / Math.max(1, positiveTotal)) * 100) + '% of stock'
                          : locName
                        }
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div className="gradetable">
                    {stockByGrade.map((g) => {
                      const isNeg = g.value < 0
                      const p = !isNeg && positiveTotal ? Math.round((g.value / positiveTotal) * 100) : 0
                      return (
                        <div
                          key={g.key}
                          className={'graderow' + (hot === g.key ? ' is-hot' : '')}
                          onMouseEnter={() => !isNeg && setHot(g.key)}
                          onMouseLeave={() => setHot(null)}
                        >
                          <div className="swatch" style={{ background: isNeg ? 'var(--warn)' : g.color }} />
                          <div className="gname" style={{ color: isNeg ? 'var(--warn)' : undefined }}>{g.name}</div>
                          <div className="gpct num">{isNeg ? '—' : p + '%'}</div>
                          <div className="gnum" style={{ color: isNeg ? 'var(--warn)' : undefined }}>{g.value.toLocaleString()}</div>
                        </div>
                      )
                    })}
                  </div>
                  {negativeData.length > 0 && (
                    <div style={{
                      marginTop: 16, padding: '12px 16px', borderRadius: 8,
                      background: 'color-mix(in oklab, var(--warn) 10%, var(--surface))',
                      border: '1px solid var(--warn)',
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)', marginBottom: 8 }}>
                        ⚠ Negative stock detected — check entries
                      </p>
                      {negativeData.map(d => (
                        <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--warn)' }}>
                          <span>{d.name}</span>
                          <span style={{ fontWeight: 700 }}>{d.value} bags</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {activeLoc === 'all' && (
            <div className="card">
              <div className="card-hd">
                <div>
                  <div className="card-eyebrow">across cold storages</div>
                  <div className="card-title display">By location</div>
                </div>
              </div>
              <div className="card-bd">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {locData.map(l => (
                    <LocBar
                      key={l.id}
                      label={l.label}
                      segments={l.segments}
                      total={l.total}
                      max={maxLoc}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="card-bd" style={{ padding: '48px 22px', color: 'var(--ink-3)', textAlign: 'center' }}>
            <div className="hint">No stock data for this location.</div>
          </div>
        </div>
      )}

      {/* Recent activity — full width */}
      <div className="card">
        <div className="card-hd">
          <div>
            <div className="card-eyebrow">last 5 movements</div>
            <div className="card-title display">Recent activity</div>
          </div>
          <button className="btn" type="button" onClick={() => onNavigate?.('history')}>View all</button>
        </div>
        <div className="card-bd tight">
          {recent.length === 0 && (
            <div style={{ padding: '32px 22px', color: 'var(--ink-3)', fontSize: 13 }}>
              No activity for this location.
            </div>
          )}
          {recent.map(h => {
            const locName = locations.find(l => l.id === h.loc)?.name || h.loc
            return (
              <div key={h.id} className="actrow">
                <div className="when">{fmt(h.date)}</div>
                <div className="desc">
                  <div>
                    {h.kind === 'in' ? 'Intake' : 'Outflow'}{' '}
                    <strong className="num">{h.bags}</strong> bags ·{' '}
                    <span style={{ color: gradeColor(h.grade, 0), fontWeight: 600 }}>{h.grade}</span>
                  </div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 2 }}>{locName}</div>
                </div>
                <div className={'delta-pill ' + (h.kind === 'in' ? 'in' : 'out')}>
                  {h.kind === 'in' ? '+' : '−'}{h.bags}
                </div>
                <div className="loc">{locName.slice(0, 4).toUpperCase()}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
