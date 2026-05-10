import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon } from '../App'
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
  const [dailyEvents, setDailyEvents] = useState([])
  const [totIn, setTotIn] = useState(0)
  const [totOut, setTotOut] = useState(0)
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

    // Totals
    const ti = (inShips || []).flatMap(s => s.inbound_items).reduce((s, i) => s + i.quantity, 0)
    const to = (outShips || []).flatMap(s => s.outbound_items).reduce((s, i) => s + i.quantity, 0)
    setTotIn(ti)
    setTotOut(to)

    // Grade totals
    const gmap = {}
    ;(inShips || []).flatMap(s => s.inbound_items).forEach(item => {
      gmap[item.grade] = (gmap[item.grade] || 0) + item.quantity
    })
    ;(outShips || []).flatMap(s => s.outbound_items).forEach(item => {
      gmap[item.grade] = (gmap[item.grade] || 0) - item.quantity
    })
    const grades = Object.entries(gmap)
      .filter(([, v]) => v > 0)
      .map(([name, value], i) => ({ name, value, color: gradeColor(name, i) }))
    setGradeData(grades)

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
  const rangeLabel = range === 'Daily' ? 'today' : range === 'Range' ? `${rangeFrom} – ${rangeTo}` : range

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
            <input
              type="date"
              value={rangeFrom}
              max={rangeTo}
              onChange={e => setRangeFrom(e.target.value)}
              className="field-input"
              style={{ padding: '7px 12px', fontSize: 13, width: 148 }}
            />
            <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>to</span>
            <input
              type="date"
              value={rangeTo}
              min={rangeFrom}
              max={today}
              onChange={e => setRangeTo(e.target.value)}
              className="field-input"
              style={{ padding: '7px 12px', fontSize: 13, width: 148 }}
            />
          </div>
        )}

        <div className="tb-spacer" />
        <button type="button" className="btn"><Icon name="download" /> CSV</button>
      </div>

      {/* KPIs */}
      <div className="grid-3">
        <KPI label={`Total in · ${rangeLabel}`} value={totIn.toLocaleString()} unit="bags" delta="intake" deltaLabel="in window" dir="up" />
        <KPI label={`Total out · ${rangeLabel}`} value={totOut.toLocaleString()} unit="bags" delta="outflow" deltaLabel="in window" dir="down" />
        <KPI
          label="Net change"
          value={(net >= 0 ? '+' : '') + net}
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
                    tickFormatter={d => d.slice(5)}
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

      {/* Grade mix + bar chart */}
      <div className="report-grid">
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
              <div className="card-eyebrow">breakdown</div>
              <div className="card-title display">By grade (bags)</div>
            </div>
          </div>
          <div className="card-bd">
            {gradeData.length === 0 ? (
              <div className="hint">No data in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={gradeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)' }}
                    tickLine={false} axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)' }}
                    tickLine={false} axisLine={false} width={36}
                  />
                  <Tooltip
                    formatter={(v) => [v + ' bags', 'Bags']}
                    contentStyle={{
                      background: 'var(--surface)', border: '1px solid var(--line-strong)',
                      borderRadius: 'var(--radius-input)', fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" name="Bags" radius={[4, 4, 0, 0]}>
                    {gradeData.map((g, i) => <Cell key={i} fill={g.color} />)}
                  </Bar>
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
