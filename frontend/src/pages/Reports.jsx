import { useEffect, useState } from 'react'
import DatePicker from '../components/DatePicker'

const fmt = d => d ? d.split('-').reverse().join('/') : '—'
import { supabase } from '../supabaseClient'
import { Icon } from '../App'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart,
  BarChart, Bar, CartesianGrid, Cell,
} from 'recharts'

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

function offsetDate(days) {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  d.setDate(d.getDate() - days)
  return d.toLocaleDateString('en-CA')
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const GRADE_COLORS = { A: 'var(--grade-a)', B: 'var(--grade-b)', C: 'var(--grade-c)', D: 'var(--grade-d)' }
const INDEX_COLORS = ['var(--grade-a)', 'var(--grade-b)', 'var(--grade-c)', 'var(--grade-d)', 'var(--accent)']
function gradeColor(name, i = 0) {
  const letter = (name || '').trim()[0]?.toUpperCase()
  return GRADE_COLORS[letter] || INDEX_COLORS[i % INDEX_COLORS.length]
}

const RANGES = ['Daily', '7d', '14d', '30d', 'Season', 'Range']
const RANGE_DAYS = { '7d': 7, '14d': 14, '30d': 30, 'Season': 90 }

function KPI({ label, value, unit, delta, deltaLabel, dir }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-val display">
        <span>{value}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <div className="kpi-foot">
        <span className={'kpi-delta ' + (dir === 'up' ? 'up' : 'down')}>
          <Icon name={dir === 'up' ? 'up' : 'down'} size={12} /> {delta}
        </span>
        <span style={{ color: 'var(--ink-3)' }}>{deltaLabel}</span>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line-strong)',
      borderRadius: 'var(--radius-input)', padding: '8px 12px',
      fontSize: 12, boxShadow: 'var(--shadow-2)', minWidth: 140,
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.1em' }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: p.color }}>● {p.name}</span>
          <span className="num" style={{ fontWeight: 600 }}>{p.value} bags</span>
        </div>
      ))}
    </div>
  )
}

function DailyTimeline({ events, locations, loading }) {
  if (loading) {
    return (
      <div style={{ padding: '32px 22px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        Loading…
      </div>
    )
  }
  if (events.length === 0) {
    return (
      <div style={{ padding: '48px 22px', textAlign: 'center' }}>
        <div className="hint">No movements recorded today.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0 4px', position: 'relative' }}>
      {/* Vertical spine */}
      <div style={{
        position: 'absolute', left: 54, top: 0, bottom: 0, width: 1,
        background: 'var(--line)',
      }} />

      {events.map((ev, i) => {
        const locName = locations.find(l => l.id === ev.locId)?.name || ev.locId
        const color = gradeColor(ev.grade)
        return (
          <div key={ev.id} style={{
            display: 'grid',
            gridTemplateColumns: '54px 14px 1fr',
            gap: '0 16px',
            alignItems: 'flex-start',
            padding: '0 22px 0 22px',
            marginBottom: i < events.length - 1 ? 0 : 0,
          }}>
            {/* Time */}
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--ink-3)', letterSpacing: '.04em',
              paddingTop: 14, textAlign: 'right', paddingRight: 0,
            }}>
              {fmtTime(ev.createdAt)}
            </div>

            {/* Dot on spine */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: ev.kind === 'in' ? 'var(--grade-a)' : 'var(--warn)',
                border: '2px solid var(--surface)',
                outline: '1px solid ' + (ev.kind === 'in' ? 'var(--grade-a)' : 'var(--warn)'),
                flexShrink: 0, zIndex: 1,
              }} />
            </div>

            {/* Content row */}
            <div style={{
              borderBottom: i < events.length - 1 ? '1px solid var(--line)' : 'none',
              padding: '11px 0 11px',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              {/* Grade dot + name */}
              <span className="gradedot" style={{ color, fontWeight: 600, fontSize: 13 }}>
                {ev.grade}
              </span>

              {/* Bags pill */}
              <span className={'delta-pill ' + (ev.kind === 'in' ? 'in' : 'out')} style={{ fontSize: 12 }}>
                {ev.kind === 'in' ? '+' : '−'}{ev.bags}
              </span>

              {/* Location tag */}
              <span className="loc">{locName}</span>

              {/* Note if present */}
              {ev.note && (
                <span style={{ color: 'var(--ink-3)', fontSize: 12, marginLeft: 2 }}>{ev.note}</span>
              )}

              {/* Net weight */}
              {ev.unitWeight > 0 && (
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-num)', fontSize: 12, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
                  {(ev.bags * ev.unitWeight).toLocaleString()} kg
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Reports({ activeLoc, locations }) {
  const [range, setRange] = useState('Daily')
  const [rangeFrom, setRangeFrom] = useState(offsetDate(7))
  const [rangeTo, setRangeTo] = useState(today)
  const [trendData, setTrendData] = useState([])
  const [gradeData, setGradeData] = useState([])
  const [intakeGradeData, setIntakeGradeData] = useState([])
  const [outflowGradeData, setOutflowGradeData] = useState([])
  const [dailyEvents, setDailyEvents] = useState([])
  const [totIn, setTotIn] = useState(0)
  const [totOut, setTotOut] = useState(0)
  const [rawEntries, setRawEntries] = useState([])
  const [weightData, setWeightData] = useState({ totalIn: 0, totalOut: 0, byLoc: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchReport() }, [activeLoc, range, rangeFrom, rangeTo])

  async function fetchReport() {
    setLoading(true)

    const isDaily = range === 'Daily'
    const isRange = range === 'Range'
    const startDate = isDaily ? today : isRange ? rangeFrom : offsetDate(RANGE_DAYS[range] || 14)
    const endDate = isRange ? rangeTo : today

    let inQ = supabase
      .from('inbound_shipments')
      .select('id, date, created_at, cold_storage_id, inbound_items(grade, quantity, unit_weight)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('created_at', { ascending: true })
    let outQ = supabase
      .from('outbound_shipments')
      .select('id, date, created_at, cold_storage_id, outbound_items(grade, quantity, unit_weight)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('created_at', { ascending: true })

    if (activeLoc !== 'all') {
      inQ = inQ.eq('cold_storage_id', activeLoc)
      outQ = outQ.eq('cold_storage_id', activeLoc)
    }

    const [{ data: inShips }, { data: outShips }] = await Promise.all([inQ, outQ])

    // Raw entries for CSV export
    const allEntries = [
      ...(inShips || []).flatMap(s =>
        s.inbound_items.map(item => ({
          date: s.date,
          kind: 'in',
          locId: s.cold_storage_id,
          grade: item.grade,
          bags: item.quantity,
          unitWeight: item.unit_weight || 0,
        }))
      ),
      ...(outShips || []).flatMap(s =>
        s.outbound_items.map(item => ({
          date: s.date,
          kind: 'out',
          locId: s.cold_storage_id,
          grade: item.grade,
          bags: item.quantity,
          unitWeight: item.unit_weight || 0,
        }))
      ),
    ].sort((a, b) => b.date.localeCompare(a.date))
    setRawEntries(allEntries)

    // Totals
    const ti = (inShips || []).flatMap(s => s.inbound_items).reduce((s, i) => s + i.quantity, 0)
    const to = (outShips || []).flatMap(s => s.outbound_items).reduce((s, i) => s + i.quantity, 0)
    setTotIn(ti)
    setTotOut(to)

    // Weight aggregation per location
    const wByLoc = {}
    ;(inShips || []).forEach(s => {
      const lid = s.cold_storage_id
      if (!wByLoc[lid]) wByLoc[lid] = { locId: lid, weightIn: 0, weightOut: 0 }
      s.inbound_items.forEach(item => { wByLoc[lid].weightIn += item.quantity * (item.unit_weight || 0) })
    })
    ;(outShips || []).forEach(s => {
      const lid = s.cold_storage_id
      if (!wByLoc[lid]) wByLoc[lid] = { locId: lid, weightIn: 0, weightOut: 0 }
      s.outbound_items.forEach(item => { wByLoc[lid].weightOut += item.quantity * (item.unit_weight || 0) })
    })
    const byLoc = Object.values(wByLoc)
    setWeightData({
      totalIn: byLoc.reduce((s, l) => s + l.weightIn, 0),
      totalOut: byLoc.reduce((s, l) => s + l.weightOut, 0),
      byLoc,
    })

    // Grade totals — net, intake-only, outflow-only
    const gmap = {}, inMap = {}, outMap = {}
    ;(inShips || []).flatMap(s => s.inbound_items).forEach(item => {
      gmap[item.grade] = (gmap[item.grade] || 0) + item.quantity
      inMap[item.grade] = (inMap[item.grade] || 0) + item.quantity
    })
    ;(outShips || []).flatMap(s => s.outbound_items).forEach(item => {
      gmap[item.grade] = (gmap[item.grade] || 0) - item.quantity
      outMap[item.grade] = (outMap[item.grade] || 0) + item.quantity
    })
    const grades = Object.entries(gmap)
      .filter(([, v]) => v > 0)
      .map(([name, value], i) => ({ name, value, color: gradeColor(name, i) }))
    setGradeData(grades)
    setIntakeGradeData(
      Object.entries(inMap).map(([name, value], i) => ({ name, value, color: gradeColor(name, i) }))
    )
    setOutflowGradeData(
      Object.entries(outMap).map(([name, value], i) => ({ name, value, color: gradeColor(name, i) }))
    )

    if (isDaily) {
      // Build flat timeline events sorted by created_at
      const events = [
        ...(inShips || []).flatMap(s =>
          s.inbound_items.map(item => ({
            id: s.id + '-in-' + item.grade,
            createdAt: s.created_at,
            locId: s.cold_storage_id,
            grade: item.grade,
            bags: item.quantity,
            unitWeight: item.unit_weight || 0,
            kind: 'in',
          }))
        ),
        ...(outShips || []).flatMap(s =>
          s.outbound_items.map(item => ({
            id: s.id + '-out-' + item.grade,
            createdAt: s.created_at,
            locId: s.cold_storage_id,
            grade: item.grade,
            bags: item.quantity,
            unitWeight: item.unit_weight || 0,
            kind: 'out',
          }))
        ),
      ].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      setDailyEvents(events)
    } else {
      // Day-by-day trend for multi-day views
      const dayMap = {}
      ;(inShips || []).forEach(s => {
        if (!dayMap[s.date]) dayMap[s.date] = { date: s.date, in: 0, out: 0 }
        s.inbound_items.forEach(item => { dayMap[s.date].in += item.quantity })
      })
      ;(outShips || []).forEach(s => {
        if (!dayMap[s.date]) dayMap[s.date] = { date: s.date, in: 0, out: 0 }
        s.outbound_items.forEach(item => { dayMap[s.date].out += item.quantity })
      })
      setTrendData(Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)))
    }

    setLoading(false)
  }

  const net = totIn - totOut
  const totalStock = gradeData.reduce((s, g) => s + g.value, 0)
  const rangeLabel = range === 'Daily' ? 'today' : range === 'Range' ? `${fmt(rangeFrom)} – ${fmt(rangeTo)}` : range

  function exportPDF() {
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
    doc.text('Period Report', 14, 16)
    doc.text(today, W - 14, 16, { align: 'right' })

    // Meta
    doc.setTextColor(80, 80, 80)
    doc.setFontSize(9)
    const locLabel = activeLoc === 'all' ? 'All locations' : (locations.find(l => l.id === activeLoc)?.name || '')
    doc.text(`Period: ${rangeLabel}`, 14, 30)
    doc.text(`Location: ${locLabel}`, 14, 36)

    // KPI summary table
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Summary', 14, 46)

    autoTable(doc, {
      startY: 50,
      head: [['Total In', 'Total Out', 'Net Change']],
      body: [[
        totIn.toLocaleString() + ' bags',
        totOut.toLocaleString() + ' bags',
        (net >= 0 ? '+' : '−') + Math.abs(net).toLocaleString() + ' bags',
      ]],
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 11, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'center' } },
      margin: { left: 14, right: 14 },
    })

    // Intake by grade
    if (intakeGradeData.length > 0) {
      const y1 = doc.lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text('Intake by Grade', 14, y1)
      autoTable(doc, {
        startY: y1 + 4,
        head: [['Grade', 'Bags In']],
        body: intakeGradeData.map(g => [g.name, g.value.toLocaleString()]),
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
    }

    // Outflow by grade
    if (outflowGradeData.length > 0) {
      const y2 = doc.lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text('Outflow by Grade', 14, y2)
      autoTable(doc, {
        startY: y2 + 4,
        head: [['Grade', 'Bags Out']],
        body: outflowGradeData.map(g => [g.name, g.value.toLocaleString()]),
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
    }

    // Net by grade
    if (gradeData.length > 0) {
      const y3 = doc.lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text('Net Stock Change by Grade', 14, y3)
      autoTable(doc, {
        startY: y3 + 4,
        head: [['Grade', 'Net Bags']],
        body: gradeData.map(g => [g.name, g.value.toLocaleString()]),
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
    }

    // Day-by-day trend (multi-day views)
    if (trendData.length > 0) {
      const y4 = doc.lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text('Daily Breakdown', 14, y4)
      autoTable(doc, {
        startY: y4 + 4,
        head: [['Date', 'Bags In', 'Bags Out', 'Net']],
        body: trendData.map(d => [
          fmt(d.date),
          d.in.toLocaleString(),
          d.out.toLocaleString(),
          (d.in - d.out >= 0 ? '+' : '−') + Math.abs(d.in - d.out).toLocaleString(),
        ]),
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
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

    doc.save(`phstock-report-${range.toLowerCase()}-${today}.pdf`)
  }

  return (
    <div className="col">
      {/* Tabs + date pickers + export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="subtabs" style={{ padding: 0, border: 0, margin: 0 }}>
          {RANGES.map(r => (
            <button key={r} type="button" className={'subtab' + (range === r ? ' is-on' : '')} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>

        {range === 'Range' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DatePicker value={rangeFrom} onChange={setRangeFrom} style={{ width: 140 }} inputStyle={{ padding: '7px 12px', fontSize: 13 }} />
            <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>to</span>
            <DatePicker value={rangeTo} onChange={setRangeTo} style={{ width: 140 }} inputStyle={{ padding: '7px 12px', fontSize: 13 }} />
            <button
              type="button"
              className="btn"
              style={{ padding: '7px 10px', fontSize: 12 }}
              onClick={() => { setRangeFrom(offsetDate(7)); setRangeTo(today) }}
            >Reset</button>
          </div>
        )}

        <div className="tb-spacer" />
        <button type="button" className="btn" onClick={exportPDF} disabled={rawEntries.length === 0}><Icon name="download" /> PDF</button>
      </div>

      {/* KPIs */}
      <div className="grid-3">
        <KPI label={`Total in · ${rangeLabel}`} value={totIn.toLocaleString()} unit="bags" delta="intake" deltaLabel="in window" dir="up" />
        <KPI label={`Total out · ${rangeLabel}`} value={totOut.toLocaleString()} unit="bags" delta="outflow" deltaLabel="in window" dir="down" />
        <KPI
          label="Net change"
          value={(net >= 0 ? '+' : '−') + Math.abs(net).toLocaleString()}
          unit="bags"
          delta={net >= 0 ? 'building' : 'depleting'}
          deltaLabel="stock"
          dir={net >= 0 ? 'up' : 'down'}
        />
      </div>

      {/* Daily timeline OR multi-day chart */}
      {range === 'Daily' ? (
        <div className="card">
          <div className="card-hd">
            <div>
              <div className="card-eyebrow">{today}</div>
              <div className="card-title display">Today's movements</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
              {dailyEvents.length} {dailyEvents.length === 1 ? 'entry' : 'entries'}
            </div>
          </div>
          <div className="card-bd tight">
            <DailyTimeline events={dailyEvents} locations={locations} loading={loading} />
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-hd">
            <div>
              <div className="card-eyebrow">{rangeLabel} window</div>
              <div className="card-title display">Intake &amp; outflow over time</div>
            </div>
            <div className="legend-row" style={{ padding: 0 }}>
              <span className="li" style={{ '--c': 'var(--grade-a)' }}>Intake</span>
              <span className="li" style={{ '--c': 'var(--warn)' }}>Outflow</span>
            </div>
          </div>
          <div className="card-bd">
            {loading ? (
              <div style={{ height: 240, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                Loading…
              </div>
            ) : trendData.length === 0 ? (
              <div style={{ height: 140, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
                <div className="hint">No movement data in this window.</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--grade-a)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--grade-a)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)' }}
                    tickLine={false} axisLine={false}
                    tickFormatter={d => `${d.slice(8)}/${d.slice(5, 7)}`}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)' }}
                    tickLine={false} axisLine={false} width={36}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone" dataKey="in" name="Intake"
                    stroke="var(--grade-a)" strokeWidth={2} fill="url(#inGrad)"
                    dot={{ r: 3, fill: 'var(--grade-a)' }} activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone" dataKey="out" name="Outflow"
                    stroke="var(--warn)" strokeWidth={2} strokeDasharray="4 3"
                    dot={{ r: 2.5, fill: 'var(--warn)' }} activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Weight Summary */}
      <div className="card">
        <div className="card-hd">
          <div>
            <div className="card-eyebrow">weight</div>
            <div className="card-title display">Weight Summary</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{rangeLabel}</div>
        </div>
        <div className="card-bd">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: weightData.byLoc.length > 1 ? 24 : 0 }}>
            {[
              { label: 'Total Weight In', value: weightData.totalIn, color: 'var(--grade-a)', sign: null },
              { label: 'Total Weight Out', value: weightData.totalOut, color: 'var(--warn)', sign: null },
              { label: 'Difference', value: weightData.totalIn - weightData.totalOut, color: weightData.totalIn - weightData.totalOut >= 0 ? 'var(--grade-a)' : 'var(--warn)', sign: true },
            ].map(col => (
              <div key={col.label} style={{ textAlign: 'center', padding: '12px 0', borderRadius: 'var(--radius-card)', background: 'var(--surface-raised)' }}>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{col.label}</div>
                <div style={{ fontFamily: 'var(--font-num)', fontSize: 24, fontWeight: 700, color: col.color, lineHeight: 1 }}>
                  {col.sign ? (col.value >= 0 ? '+' : '−') : ''}{Math.abs(col.value).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>kg</div>
              </div>
            ))}
          </div>

          {weightData.byLoc.length > 1 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Location', 'Weight In (kg)', 'Weight Out (kg)', 'Difference (kg)'].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '6px 0', borderBottom: '1px solid var(--line)', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weightData.byLoc.map(row => {
                  const diff = row.weightIn - row.weightOut
                  const locName = locations.find(l => l.id === row.locId)?.name || row.locId
                  return (
                    <tr key={row.locId}>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', fontWeight: 500 }}>{locName}</td>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', textAlign: 'right', fontFamily: 'var(--font-num)', color: 'var(--grade-a)' }}>{row.weightIn.toLocaleString()}</td>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', textAlign: 'right', fontFamily: 'var(--font-num)', color: 'var(--warn)' }}>{row.weightOut.toLocaleString()}</td>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', textAlign: 'right', fontFamily: 'var(--font-num)', fontWeight: 600, color: diff >= 0 ? 'var(--grade-a)' : 'var(--warn)' }}>
                        {diff >= 0 ? '+' : '−'}{Math.abs(diff).toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Grade mix + intake + outflow breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
<div className="card">
          <div className="card-hd">
            <div>
              <div className="card-eyebrow">composition</div>
              <div className="card-title display">Quality mix</div>
            </div>
          </div>
          <div className="card-bd">
            {gradeData.length === 0 ? (
              <div className="hint">No grade data available.</div>
            ) : (
              <div className="barchart">
                {gradeData.map(g => {
                  const pct = totalStock ? (g.value / totalStock) * 100 : 0
                  return (
                    <div key={g.name} className="barrow">
                      <div className="blbl">
                        <span className="gradedot" style={{ color: g.color, fontWeight: 600 }}>{g.name}</span>
                      </div>
                      <div className="bartrack">
                        <div className="barseg" style={{ width: `${pct}%`, background: g.color }} />
                      </div>
                      <div className="bnum">{Math.round(pct)}%</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-hd">
            <div>
              <div className="card-eyebrow">intake</div>
              <div className="card-title display">Intake by grade</div>
            </div>
          </div>
          <div className="card-bd">
            {intakeGradeData.length === 0 ? (
              <div className="hint">No intake in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={intakeGradeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)' }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip formatter={(v) => [v + ' bags', 'Intake']} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-input)', fontSize: 12 }} />
                  <Bar dataKey="value" name="Intake" radius={[4, 4, 0, 0]}>
                    {intakeGradeData.map((g, i) => <Cell key={i} fill={g.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-hd">
            <div>
              <div className="card-eyebrow">outflow</div>
              <div className="card-title display">Outflow by grade</div>
            </div>
          </div>
          <div className="card-bd">
            {outflowGradeData.length === 0 ? (
              <div className="hint">No outflow in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={outflowGradeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)' }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip formatter={(v) => [v + ' bags', 'Outflow']} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-input)', fontSize: 12 }} />
                  <Bar dataKey="value" name="Outflow" radius={[4, 4, 0, 0]} fill="var(--warn)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Reports
