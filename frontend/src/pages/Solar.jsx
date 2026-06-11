import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { Icon } from '../App'
import Toast from '../components/Toast'
import DatePicker from '../components/DatePicker'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const SUN = 'var(--grade-b)'
const BEST = 'var(--grade-a)'
const WORST = 'var(--warn)'

// Distinct, stable colors assigned to each storage/site (by alphabetical order)
// Warm earth tones to match the field theme
const SITE_PALETTE = ['#c98a1b', '#b5632f', '#7a8b2e', '#a8472a', '#4f7a3f', '#9c5a3c', '#c9a227', '#87632b', '#6b8e23', '#a0521d']

const PERIODS = [
  { days: 1,  label: 'Day' },
  { days: 7,  label: 'Week' },
  { days: 30, label: 'Month' },
]

const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

// UTC-based date math so window buckets never drift across timezones
function shiftDate(iso, deltaDays) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

const fmtDate = d => d ? d.split('-').reverse().join('/') : '—'
const fmtNum = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString()

function KPI({ label, value, unit }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-val">
        <span>{value}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
    </div>
  )
}

function SiteRow({ label, energy, capacity, ratio, max, rank, color }) {
  const pct = max > 0 ? (energy / max) * 100 : 0
  const barColor = rank === 'best' ? BEST : rank === 'worst' ? WORST : (color || SUN)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 96, flexShrink: 0, fontSize: 12, fontWeight: 500,
        color: rank === 'best' ? BEST : rank === 'worst' ? WORST : 'var(--ink)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {rank === 'best' && <span title="Best">▲</span>}
        {rank === 'worst' && <span title="Least">▼</span>}
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color || SUN, flexShrink: 0 }} />
        {label}
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <div className="loc-bar-track" style={{ borderRadius: 8, overflow: 'hidden', background: 'var(--surface-2)', height: 22 }}>
          <div style={{
            width: `${pct}%`, height: '100%', background: barColor,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            paddingRight: 6, minWidth: pct > 0 ? 2 : 0,
          }}>
            {pct > 14 && (
              <span style={{
                fontSize: 10, color: '#1a1205', fontWeight: 700, fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap', pointerEvents: 'none',
              }}>
                {fmtNum(energy)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div style={{ width: 96, flexShrink: 0, textAlign: 'right' }}>
        {capacity > 0 ? (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
              {fmtNum(ratio)} <span style={{ fontSize: 9, color: 'var(--ink-3)', fontWeight: 500 }}>kWh/kWp·d</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
              {fmtNum(capacity)} kW
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--warn)', fontWeight: 600 }}>set capacity</div>
        )}
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const items = payload.filter(p => p.value > 0)
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line-strong)',
      borderRadius: 'var(--radius-input)', padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-2)', minWidth: 140,
    }}>
      <div style={{ color: 'var(--ink-3)', marginBottom: 4 }}>{fmtDate(label)}</div>
      {items.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 2 }}>
          <span style={{ color: p.color || p.fill, fontWeight: 600 }}>● {p.name}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtNum(p.value)}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--line)', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--ink-3)' }}>Total</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmtNum(total)} kWh</span>
      </div>
    </div>
  )
}

function Solar({ isAdmin, profile }) {
  const [sites, setSites] = useState([])           // { id, name, capacity_kw }
  const [readings, setReadings] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(7)
  const [siteFilter, setSiteFilter] = useState('all')
  const [view, setView] = useState('dashboard') // 'dashboard' | 'report' | 'sites' (admin)

  // Report tab
  const [reportPeriod, setReportPeriod] = useState(30)
  const [verifs, setVerifs] = useState({})            // date -> { verified_name, verified_at, remark }
  const [verifyingDate, setVerifyingDate] = useState(null)
  const [pendingDate, setPendingDate] = useState(null) // date awaiting a remark in the popup
  const [remarkDraft, setRemarkDraft] = useState('')

  // Log reading form
  const [showLog, setShowLog] = useState(false)
  const [logSite, setLogSite] = useState(null)
  const [logDate, setLogDate] = useState(istToday)
  const [logEnergy, setLogEnergy] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')

  // Manage sites (admin)
  const [siteDraft, setSiteDraft] = useState({}) // id -> { name, capacity }
  const [newName, setNewName] = useState('')
  const [newCap, setNewCap] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const since = shiftDate(istToday(), -29) // widest (30-day) window

    const [{ data: sData }, { data: rData }] = await Promise.all([
      supabase.from('solar_sites').select('id, name, capacity_kw').order('name'),
      supabase.from('solar_readings')
        .select('id, site_id, date, energy_kwh, remarks')
        .gte('date', since)
        .order('date', { ascending: false }),
    ])

    const siteList = (sData || []).map(s => ({ ...s, capacity_kw: s.capacity_kw == null ? null : Number(s.capacity_kw) }))
    setSites(siteList)
    setReadings(rData || [])
    setSiteDraft(Object.fromEntries(siteList.map(s => [s.id, { name: s.name, capacity: s.capacity_kw == null ? '' : String(s.capacity_kw) }])))
    setLoading(false)
  }

  const capacityOf = id => sites.find(s => s.id === id)?.capacity_kw || 0
  const scopeSites = useMemo(
    () => siteFilter === 'all' ? sites : sites.filter(s => s.id === siteFilter),
    [siteFilter, sites],
  )

  // Stable color per storage (sites arrive ordered by name)
  const siteColors = useMemo(() => {
    const m = {}
    sites.forEach((s, i) => { m[s.id] = SITE_PALETTE[i % SITE_PALETTE.length] })
    return m
  }, [sites])

  // ---- Derived: window buckets + per-site aggregates ----
  const windowDays = useMemo(() => {
    const today = istToday()
    return Array.from({ length: period }, (_, i) => shiftDate(today, -(period - 1 - i)))
  }, [period])

  const windowSet = useMemo(() => new Set(windowDays), [windowDays])
  const scopeIds = useMemo(() => new Set(scopeSites.map(s => s.id)), [scopeSites])
  const inWindow = useMemo(
    () => readings.filter(r => windowSet.has(r.date) && scopeIds.has(r.site_id)),
    [readings, windowSet, scopeIds],
  )

  // Stacked-by-site series: each day carries one `s_<id>` value per scoped storage
  const trend = useMemo(() => {
    const k = (sid, date) => sid + '|' + date
    const byKey = {}
    inWindow.forEach(r => { byKey[k(r.site_id, r.date)] = (byKey[k(r.site_id, r.date)] || 0) + Number(r.energy_kwh) })
    return windowDays.map(date => {
      const row = { date }
      scopeSites.forEach(s => { row['s_' + s.id] = byKey[k(s.id, date)] || 0 })
      return row
    })
  }, [inWindow, windowDays, scopeSites])

  const perSite = useMemo(() => {
    const rows = scopeSites.map(s => {
      const energy = inWindow
        .filter(r => r.site_id === s.id)
        .reduce((acc, r) => acc + Number(r.energy_kwh), 0)
      const capacity = s.capacity_kw || 0
      const ratio = capacity > 0 ? energy / (capacity * period) : 0
      return { id: s.id, label: s.name, energy, capacity, ratio, rank: null }
    }).sort((a, b) => b.energy - a.energy)

    // Tag best (most generated) green and least red — only when 2+ sites have output
    const withOutput = rows.filter(r => r.energy > 0)
    if (withOutput.length >= 2) {
      withOutput[0].rank = 'best'
      withOutput[withOutput.length - 1].rank = 'worst'
    }
    return rows
  }, [scopeSites, inWindow, period])

  const periodEnergy = useMemo(() => perSite.reduce((s, x) => s + x.energy, 0), [perSite])
  const totalCapacity = useMemo(() => scopeSites.reduce((s, x) => s + (x.capacity_kw || 0), 0), [scopeSites])
  const latestEnergy = useMemo(() => {
    if (inWindow.length === 0) return 0
    const latest = inWindow.reduce((a, b) => (a.date > b.date ? a : b)).date
    return inWindow.filter(r => r.date === latest).reduce((s, r) => s + Number(r.energy_kwh), 0)
  }, [inWindow])
  const avgRatio = totalCapacity > 0 ? periodEnergy / (totalCapacity * period) : 0
  const maxSiteEnergy = useMemo(() => Math.max(...perSite.map(s => s.energy), 1), [perSite])

  const recent = useMemo(
    () => readings.filter(r => scopeIds.has(r.site_id)).slice(0, 6),
    [readings, scopeIds],
  )
  const periodLabel = (PERIODS.find(p => p.days === period)?.label || `${period}d`).toLowerCase()
  const scopeName = siteFilter === 'all' ? 'All sites' : (sites.find(s => s.id === siteFilter)?.name || '')

  // ---- Report sheet: rows = dates, columns = sites, cell = kWh per kW (energy ÷ capacity) ----
  const reportDays = useMemo(() => {
    const today = istToday()
    return Array.from({ length: reportPeriod }, (_, i) => shiftDate(today, -i)) // newest first
  }, [reportPeriod])

  const reportRows = useMemo(() => {
    const byKey = {}
    readings.forEach(r => { byKey[r.site_id + '|' + r.date] = r })
    return reportDays.map(date => {
      const cells = sites.map(s => {
        const reading = byKey[s.id + '|' + date] || null
        const cap = s.capacity_kw || 0
        const ratio = (reading && cap > 0) ? Number(reading.energy_kwh) / cap : null
        return { siteId: s.id, reading, ratio, rank: null }
      })
      const vals = cells.filter(c => c.ratio != null).map(c => c.ratio)
      if (vals.length >= 2) {
        const max = Math.max(...vals), min = Math.min(...vals)
        if (max !== min) cells.forEach(c => {
          if (c.ratio === max) c.rank = 'best'
          else if (c.ratio === min) c.rank = 'worst'
        })
      }
      return { date, cells, hasData: cells.some(c => c.reading) }
    }).filter(row => row.hasData)
  }, [reportDays, readings, sites])

  // Fetch per-day verification status for the displayed report rows
  useEffect(() => {
    if (view !== 'report') return
    let active = true
    supabase
      .from('solar_report_verifications')
      .select('date, verified_name, verified_at, remark')
      .in('date', reportDays)
      .then(({ data }) => {
        if (active) setVerifs(Object.fromEntries((data || []).map(v => [v.date, v])))
      })
    return () => { active = false }
  }, [view, reportDays])

  async function handleVerifyDate(date, remark) {
    if (verifyingDate) return
    setVerifyingDate(date)
    const { data: { user } } = await supabase.auth.getUser()
    const name = profile?.full_name || 'Supervisor'
    const trimmed = (remark || '').trim() || null
    const { error } = await supabase.from('solar_report_verifications').insert({
      date,
      verified_by: user?.id ?? null,
      verified_name: name,
      remark: trimmed,
    })
    setVerifyingDate(null)
    if (error) { setToast('Could not verify: ' + error.message); return }
    setVerifs(prev => ({ ...prev, [date]: { date, verified_name: name, verified_at: new Date().toISOString(), remark: trimmed } }))
    setPendingDate(null)
    setRemarkDraft('')
    setToast(`${fmtDate(date)} verified`)
  }

  // Live ratio preview in the log form
  const logCapacity = logSite != null ? capacityOf(logSite) : 0
  const logRatio = logCapacity > 0 && logEnergy !== '' ? Number(logEnergy) / logCapacity : null

  async function handleLogSubmit() {
    if (saving) return
    setFormError('')
    if (logSite == null) return setFormError('Select a site')
    if (logEnergy === '' || Number(logEnergy) < 0) return setFormError('Enter the energy generated (kWh)')
    setSaving(true)
    const { error } = await supabase
      .from('solar_readings')
      .upsert(
        { site_id: logSite, date: logDate, energy_kwh: Number(logEnergy) },
        { onConflict: 'site_id,date' },
      )
    setSaving(false)
    if (error) { setFormError(error.message); return }
    setToast('Reading logged')
    setShowLog(false)
    setLogSite(null)
    setLogEnergy('')
    setLogDate(istToday())
    fetchData()
  }

  async function handleSaveSite(id) {
    const draft = siteDraft[id]
    const name = (draft?.name || '').trim()
    if (!name) { setToast('Site name required'); return }
    const cap = draft.capacity === '' ? null : Number(draft.capacity)
    if (cap != null && !(cap > 0)) { setToast('Capacity must be a positive number'); return }
    const { error } = await supabase.from('solar_sites').update({ name, capacity_kw: cap }).eq('id', id)
    if (error) { setToast('Could not save: ' + error.message); return }
    setSites(prev => prev.map(s => s.id === id ? { ...s, name, capacity_kw: cap } : s))
    setToast('Site saved')
  }

  async function handleAddSite() {
    const name = newName.trim()
    if (!name) return
    const cap = newCap === '' ? null : Number(newCap)
    if (cap != null && !(cap > 0)) { setToast('Capacity must be a positive number'); return }
    const { error } = await supabase.from('solar_sites').insert({ name, capacity_kw: cap })
    if (error) { setToast('Could not add: ' + error.message); return }
    setNewName('')
    setNewCap('')
    setToast('Site added')
    fetchData()
  }

  async function handleDeleteSite(id, name) {
    if (!confirm(`Delete solar site "${name}"? Its readings will also be removed.`)) return
    const { error } = await supabase.from('solar_sites').delete().eq('id', id)
    if (error) { setToast('Could not delete: ' + error.message); return }
    if (siteFilter === id) setSiteFilter('all')
    setToast('Site deleted')
    fetchData()
  }

  async function handleDeleteReading(r) {
    const siteName = sites.find(s => s.id === r.site_id)?.name || r.site_id
    if (!confirm(`Delete the reading for ${siteName} on ${fmtDate(r.date)} (${fmtNum(r.energy_kwh)} kWh)?`)) return
    const { error } = await supabase.from('solar_readings').delete().eq('id', r.id)
    if (error) { setToast('Could not delete: ' + error.message); return }
    setReadings(prev => prev.filter(x => x.id !== r.id))
    setToast('Reading deleted')
  }

  if (loading) {
    return (
      <div style={{ padding: '48px 0', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  const showDashboard = view === 'dashboard'

  return (
    <div className="col">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { value: 'dashboard', label: 'Dashboard' },
          { value: 'report', label: 'Report' },
          ...(isAdmin ? [{ value: 'sites', label: 'Sites' }] : []),
        ].map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={'subtab' + (view === value ? ' is-on' : '')}
            onClick={() => setView(value)}
            style={view === value ? { color: 'var(--ink)', background: 'var(--bg-2)', borderColor: 'var(--line-strong)' } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Action bar — just the Log reading action; graph filters live below */}
      {showDashboard && (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button type="button" className="btn primary" onClick={() => setShowLog(v => !v)} disabled={sites.length === 0}>
            <Icon name="plus" /> Log reading
          </button>
        </div>
      )}

      {/* Manage sites + capacity (admin only) */}
      {isAdmin && view === 'sites' && (
        <div className="card">
          <div className="card-hd">
            <div>
              <div className="card-title display">Manage sites & capacity</div>
            </div>
          </div>
          <div className="card-bd" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sites.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="field-input"
                  style={{ flex: 1, minWidth: 0 }}
                  value={siteDraft[s.id]?.name ?? ''}
                  onChange={e => setSiteDraft(d => ({ ...d, [s.id]: { ...d[s.id], name: e.target.value } }))}
                  placeholder="Site name"
                />
                <input
                  type="number"
                  className="field-input field-num"
                  style={{ width: 110 }}
                  value={siteDraft[s.id]?.capacity ?? ''}
                  onChange={e => setSiteDraft(d => ({ ...d, [s.id]: { ...d[s.id], capacity: e.target.value } }))}
                  placeholder="kW"
                  min="0"
                />
                <button type="button" className="btn" onClick={() => handleSaveSite(s.id)}>Save</button>
                <button
                  type="button"
                  className="btn"
                  style={{ color: 'var(--warn)' }}
                  onClick={() => handleDeleteSite(s.id, s.name)}
                >
                  Delete
                </button>
              </div>
            ))}

            {/* Add site */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <input
                className="field-input"
                style={{ flex: 1, minWidth: 0 }}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSite()}
                placeholder="New site name (e.g. STM)"
              />
              <input
                type="number"
                className="field-input field-num"
                style={{ width: 110 }}
                value={newCap}
                onChange={e => setNewCap(e.target.value)}
                placeholder="kW (opt.)"
                min="0"
              />
              <button type="button" className="btn primary" onClick={handleAddSite}>+ Add site</button>
            </div>
          </div>
        </div>
      )}

      {/* Log reading form */}
      {showDashboard && showLog && (
        <div className="card">
          <div className="card-hd">
            <div>
              <div className="card-title display">Log daily reading</div>
            </div>
          </div>
          <div className="card-bd" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 560 }}>
            <div className="field">
              <div className="field-label">Site</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sites.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={'chip' + (logSite === s.id ? ' is-on' : '')}
                    onClick={() => setLogSite(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <div className="field-label">Date</div>
              <DatePicker value={logDate} onChange={setLogDate} />
            </div>

            <div className="field">
              <div className="field-label">Energy generated (kWh)</div>
              <input
                type="number"
                className="field-input field-num"
                value={logEnergy}
                onChange={e => setLogEnergy(e.target.value === '' ? '' : Math.max(0, +e.target.value))}
                placeholder="e.g. 420"
                min="0"
              />
            </div>

            {/* Live ratio preview */}
            <div style={{
              display: 'flex', gap: 0, background: 'var(--surface-2)',
              border: '1px solid var(--line)', borderRadius: 'var(--radius-input)', overflow: 'hidden',
            }}>
              {[
                { label: 'Capacity', value: logCapacity > 0 ? fmtNum(logCapacity) + ' kW' : '— not set' },
                { label: 'Generation ratio', value: logRatio != null ? fmtNum(logRatio) + ' kWh/kWp' : '—' },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, padding: '12px 14px', borderRight: i === 0 ? '1px solid var(--line)' : 'none' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-3)', marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {formError && <div style={{ color: 'var(--warn)', fontSize: 13 }}>{formError}</div>}

            <button
              type="button"
              className="btn primary"
              style={{ justifyContent: 'center', padding: '12px 0', fontSize: 14 }}
              onClick={handleLogSubmit}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save reading'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state when no sites yet */}
      {showDashboard && sites.length === 0 && (
        <div className="card">
          <div className="card-bd" style={{ padding: '48px 22px', color: 'var(--ink-3)', textAlign: 'center' }}>
            <div className="hint">
              No solar sites yet.{isAdmin ? ' Use “Manage sites” to add one (e.g. STM, Mijaba, Needa).' : ' Ask an admin to add sites.'}
            </div>
          </div>
        </div>
      )}

      {showDashboard && sites.length > 0 && (
        <>
          {/* Graph filters — site + period (control the charts below) */}
          <div className="filterbar">
            <div className="fb-label">Solar site</div>
            <button type="button" className={'chip' + (siteFilter === 'all' ? ' is-on' : '')} onClick={() => setSiteFilter('all')}>
              <span>All</span>
            </button>
            {sites.map(s => (
              <button key={s.id} type="button" className={'chip' + (siteFilter === s.id ? ' is-on' : '')} onClick={() => setSiteFilter(s.id)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: siteColors[s.id], flexShrink: 0 }} />
                  {s.name}
                </span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {PERIODS.map(p => (
              <button
                key={p.days}
                type="button"
                className={'chip' + (period === p.days ? ' is-on' : '')}
                onClick={() => setPeriod(p.days)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* KPI row */}
          <div className="grid-4">
            <KPI label={`Generation · ${periodLabel}`} value={fmtNum(periodEnergy)} unit="kWh" hint={scopeName} />
            <KPI label="Latest day" value={fmtNum(latestEnergy)} unit="kWh" hint="most recent reading" />
            <KPI label="Installed capacity" value={fmtNum(totalCapacity)} unit="kW" hint={`${scopeSites.length} site${scopeSites.length === 1 ? '' : 's'}`} />
            <KPI label="Avg generation ratio" value={fmtNum(avgRatio)} unit="kWh/kWp·d" hint="energy ÷ capacity ÷ days" />
          </div>

          {/* Trend + by site */}
          <div className="grid-dash">
            <div className="card">
              <div className="card-hd">
                <div>
                  <div className="card-title display">Daily generation</div>
                </div>
              </div>
              <div className="card-bd">
                {periodEnergy > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={d => d.slice(8) + '/' + d.slice(5, 7)}
                        tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)' }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)' }} tickLine={false} axisLine={false} width={36} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'color-mix(in oklab, var(--ink) 6%, transparent)' }} />
                      {scopeSites.map((s, i) => (
                        <Bar
                          key={s.id}
                          dataKey={'s_' + s.id}
                          name={s.name}
                          stackId="gen"
                          fill={siteColors[s.id]}
                          radius={i === scopeSites.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                          maxBarSize={48}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ padding: '48px 22px', color: 'var(--ink-3)', textAlign: 'center', fontSize: 13 }}>
                    No readings in this window.
                  </div>
                )}
                {periodEnergy > 0 && scopeSites.length > 1 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 12 }}>
                    {scopeSites.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: siteColors[s.id], display: 'inline-block' }} />
                        <span style={{ color: 'var(--ink-2)' }}>{s.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-hd">
                <div>
                  <div className="card-title display">By site</div>
                </div>
                {perSite.some(s => s.rank) && (
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 600 }}>
                    <span style={{ color: BEST }}>▲ Best</span>
                    <span style={{ color: WORST }}>▼ Least</span>
                  </div>
                )}
              </div>
              <div className="card-bd">
                {perSite.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {perSite.map(s => (
                      <SiteRow key={s.id} label={s.label} energy={s.energy} capacity={s.capacity} ratio={s.ratio} max={maxSiteEnergy} rank={s.rank} color={siteColors[s.id]} />
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '32px 22px', color: 'var(--ink-3)', fontSize: 13 }}>No sites to show.</div>
                )}
              </div>
            </div>
          </div>

          {/* Recent readings */}
          <div className="card">
            <div className="card-hd">
              <div>
                <div className="card-title display">Recent readings</div>
              </div>
            </div>
            <div className="card-bd tight">
              {recent.length === 0 && (
                <div style={{ padding: '32px 22px', color: 'var(--ink-3)', fontSize: 13 }}>No readings yet.</div>
              )}
              {recent.map(r => {
                const siteName = sites.find(s => s.id === r.site_id)?.name || r.site_id
                const cap = capacityOf(r.site_id)
                const ratio = cap > 0 ? Number(r.energy_kwh) / cap : null
                return (
                  <div key={r.id} className="actrow">
                    <div className="when">{fmtDate(r.date)}</div>
                    <div className="desc">
                      <div>
                        <strong className="num">{fmtNum(r.energy_kwh)}</strong> kWh
                        {ratio != null && <span style={{ color: 'var(--ink-3)' }}> · {fmtNum(ratio)} kWh/kWp</span>}
                      </div>
                      <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 2 }}>{siteName}</div>
                    </div>
                    <div className="delta-pill in" style={{ background: 'color-mix(in oklab, ' + (siteColors[r.site_id] || SUN) + ' 16%, var(--surface))', color: 'var(--ink)' }}>
                      {fmtNum(r.energy_kwh)}
                    </div>
                    <div className="loc" style={{ color: siteColors[r.site_id] }}>{String(siteName).slice(0, 4).toUpperCase()}</div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReading(r)}
                        title="Delete reading"
                        style={{
                          fontSize: 12, fontWeight: 600, color: 'var(--ink-3)',
                          padding: '4px 8px', borderRadius: 'var(--radius-input)', cursor: 'pointer',
                          transition: 'color .12s, background .12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--warn)'; e.currentTarget.style.background = 'color-mix(in oklab, var(--warn) 8%, transparent)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent' }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Report sheet */}
      {view === 'report' && (
        sites.length === 0 ? (
          <div className="card">
            <div className="card-bd" style={{ padding: '48px 22px', color: 'var(--ink-3)', textAlign: 'center' }}>
              <div className="hint">No solar sites yet.</div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-hd">
              <div>
                <div className="card-title display">Generation report</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {PERIODS.filter(p => p.days > 1).map(p => (
                  <button
                    key={p.days}
                    type="button"
                    className={'chip' + (reportPeriod === p.days ? ' is-on' : '')}
                    onClick={() => setReportPeriod(p.days)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-bd">
              <div style={{ display: 'flex', gap: 14, fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
                <span style={{ color: BEST }}>■ Best of day</span>
                <span style={{ color: WORST }}>■ Worst of day</span>
              </div>

              {reportRows.length === 0 ? (
                <div style={{ padding: '32px 22px', color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
                  No readings in this period.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', left: 0, background: 'var(--bg-2)', border: '1px solid var(--line)', padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                          Date
                        </th>
                        {sites.map(s => (
                          <th key={s.id} style={{ border: '1px solid var(--line)', padding: '8px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {s.name}
                          </th>
                        ))}
                        <th style={{ border: '1px solid var(--line)', padding: '8px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                          Verify
                        </th>
                        <th style={{ border: '1px solid var(--line)', padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                          Verification details
                        </th>
                        <th style={{ border: '1px solid var(--line)', padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', minWidth: 160 }}>
                          Remark
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.map(row => (
                        <tr key={row.date}>
                          <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', border: '1px solid var(--line)', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {fmtDate(row.date)}
                          </td>
                          {row.cells.map(c => {
                            const tint = c.rank === 'best'
                              ? { background: 'color-mix(in oklab, ' + BEST + ' 20%, var(--surface))', color: BEST, fontWeight: 700 }
                              : c.rank === 'worst'
                              ? { background: 'color-mix(in oklab, ' + WORST + ' 18%, var(--surface))', color: WORST, fontWeight: 700 }
                              : {}
                            const deletable = isAdmin && c.reading && c.ratio != null
                            return (
                              <td
                                key={c.siteId}
                                title={deletable ? 'Click to delete this reading (also removes it from the dashboard)' : undefined}
                                onClick={deletable ? () => handleDeleteReading(c.reading) : undefined}
                                style={{ border: '1px solid var(--line)', padding: '8px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', cursor: deletable ? 'pointer' : 'default', ...tint }}
                              >
                                {c.ratio == null ? '—' : fmtNum(c.ratio)}
                              </td>
                            )
                          })}
                          {(() => {
                            const v = verifs[row.date]
                            return (
                              <>
                                <td style={{ border: '1px solid var(--line)', padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  {v ? (
                                    <span style={{ color: BEST, fontWeight: 700, fontSize: 12 }}>✓ Verified</span>
                                  ) : isAdmin ? (
                                    <button
                                      type="button"
                                      onClick={() => { setPendingDate(row.date); setRemarkDraft('') }}
                                      disabled={verifyingDate === row.date}
                                      style={{
                                        fontSize: 11, fontWeight: 600, padding: '4px 12px',
                                        borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                                        border: '1px solid var(--primary)', color: 'var(--primary)',
                                        background: 'color-mix(in oklab, var(--primary) 8%, var(--surface))',
                                      }}
                                    >
                                      {verifyingDate === row.date ? '…' : 'Verify'}
                                    </button>
                                  ) : (
                                    <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>Pending</span>
                                  )}
                                </td>
                                <td style={{ border: '1px solid var(--line)', padding: '6px 12px', fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                                  {v ? (
                                    <span>
                                      <strong style={{ color: 'var(--ink)' }}>{v.verified_name}</strong>
                                      <span style={{ color: 'var(--ink-3)' }}> · {new Date(v.verified_at).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</span>
                                    </span>
                                  ) : '—'}
                                </td>
                                <td style={{ border: '1px solid var(--line)', padding: '6px 12px', fontSize: 12, color: v?.remark ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'normal', minWidth: 160 }}>
                                  {v?.remark || '—'}
                                </td>
                              </>
                            )
                          })()}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* Verify remark popup */}
      {pendingDate && (
        <div
          onClick={() => { if (!verifyingDate) { setPendingDate(null); setRemarkDraft('') } }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-2)',
              width: '100%', maxWidth: 440, padding: 24,
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            <div>
              <div className="card-title display">Remark of the day</div>
            </div>
            <textarea
              autoFocus
              value={remarkDraft}
              onChange={e => setRemarkDraft(e.target.value)}
              placeholder="Add a remark for this day (e.g. panels cleaned, partial outage at STM, clear weather)…"
              rows={4}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid var(--line)',
                borderRadius: 'var(--radius-input)', background: 'var(--surface-2)',
                color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => { setPendingDate(null); setRemarkDraft('') }}
                disabled={!!verifyingDate}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => handleVerifyDate(pendingDate, remarkDraft)}
                disabled={!!verifyingDate}
              >
                {verifyingDate ? 'Verifying…' : 'Verify & save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}

export default Solar
