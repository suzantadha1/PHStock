import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon } from '../App'
import DatePicker from '../components/DatePicker'
import Toast from '../components/Toast'

// Key for a daily-register row's verification (date + location + grade)
const vkey = (date, locId, grade) => `${date}|${locId}|${grade}`

const GRADE_COLORS = { A: 'var(--grade-a)', B: 'var(--grade-b)', C: 'var(--grade-c)', D: 'var(--grade-d)' }
const SAFE_HUES = [180, 270, 315, 98, 225, 335, 195, 250, 168, 290]
function buildGradeColorMap(names) {
  const map = {}; let ci = 0
  for (const name of names) {
    const key = (name || '').trim().toUpperCase()
    if (key === 'A' || key.startsWith('A ')) { map[name] = GRADE_COLORS.A; continue }
    if (key === 'B' || key.startsWith('B ')) { map[name] = GRADE_COLORS.B; continue }
    if (key === 'C' || key.startsWith('C ')) { map[name] = GRADE_COLORS.C; continue }
    if (key === 'D' || key.startsWith('D ')) { map[name] = GRADE_COLORS.D; continue }
    map[name] = `hsl(${SAFE_HUES[ci % SAFE_HUES.length]}, 62%, 40%)`
    ci++
  }
  return map
}
function gradeColor(name, colorMap = {}) {
  return colorMap[name] || '#888'
}

const FILTER_LABEL = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '.10em',
  color: 'var(--ink-3)',
  fontWeight: 600,
  marginBottom: 5,
  display: 'block',
}

const fmt = d => d ? d.split('-').reverse().join('/') : '—'

function buildRegister(entries) {
  const byLocGrade = {}
  for (const e of entries) {
    const lk = String(e.locId)
    if (!byLocGrade[lk]) byLocGrade[lk] = {}
    if (!byLocGrade[lk][e.grade]) byLocGrade[lk][e.grade] = {}
    if (!byLocGrade[lk][e.grade][e.date]) byLocGrade[lk][e.grade][e.date] = { in: 0, out: 0, remarks: [], noteNumbers: [], maxShipmentId: 0 }
    if (e.kind === 'in') byLocGrade[lk][e.grade][e.date].in += e.bags
    else byLocGrade[lk][e.grade][e.date].out += e.bags
    if (e.remarks) byLocGrade[lk][e.grade][e.date].remarks.push(e.remarks)
    if (e.noteNumber) byLocGrade[lk][e.grade][e.date].noteNumbers.push(String(e.noteNumber))
    if (e.shipmentId > byLocGrade[lk][e.grade][e.date].maxShipmentId) byLocGrade[lk][e.grade][e.date].maxShipmentId = e.shipmentId
  }
  const rows = []
  for (const [locId, gradeMap] of Object.entries(byLocGrade)) {
    for (const [grade, dateMap] of Object.entries(gradeMap)) {
      const dates = Object.keys(dateMap).sort()
      let closing = 0
      for (const date of dates) {
        const opening = closing
        const newStock = dateMap[date].in
        const sold = dateMap[date].out
        const total = opening + newStock
        closing = total - sold
        const remarks = [...new Set(dateMap[date].remarks)].join(', ')
        const noteNumbers = [...new Set(dateMap[date].noteNumbers)].join(', ')
        const maxShipmentId = dateMap[date].maxShipmentId
        rows.push({ date, locId, grade, opening, newStock, total, sold, closing, remarks, noteNumbers, maxShipmentId })
      }
    }
  }
  return rows
}

function Pagination({ page, total, count, onPrev, onNext }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px',
      borderTop: '1px solid var(--line)',
      background: 'var(--surface-2)',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
        {((page - 1) * 10) + 1}–{Math.min(page * 10, count)} of {count}
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn" onClick={onPrev} disabled={page === 1} style={{ padding: '4px 12px', fontSize: 13 }}>← Prev</button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)', alignSelf: 'center', minWidth: 60, textAlign: 'center' }}>
          {page} / {total}
        </span>
        <button className="btn" onClick={onNext} disabled={page === total} style={{ padding: '4px 12px', fontSize: 13 }}>Next →</button>
      </div>
    </div>
  )
}

function EditModal({ entry, locations, grades, onSave, onCancel }) {
  const [date, setDate] = useState(entry.date)
  const [noteNumber, setNoteNumber] = useState(entry.noteNumber || '')
  const [locId, setLocId] = useState(String(entry.locId))
  const [grade, setGrade] = useState(entry.grade)
  const [bags, setBags] = useState(entry.bags)
  const [unitWeight, setUnitWeight] = useState(entry.unitWeight ?? '')
  const [saving, setSaving] = useState(false)
  const colorMap = buildGradeColorMap(grades)

  async function handleSave() {
    setSaving(true)
    await onSave({ date, noteNumber, locId, grade, bags: Number(bags), unitWeight: unitWeight === '' ? null : Number(unitWeight) })
    setSaving(false)
  }

  const kindColor = entry.kind === 'in' ? 'var(--grade-a)' : 'var(--warn)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-2)',
        width: '100%', maxWidth: 440, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6 }}>
            Edit entry
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block', padding: '2px 8px',
              borderRadius: 4,
              background: `color-mix(in oklab, ${kindColor} 12%, var(--surface))`,
              border: `1px solid color-mix(in oklab, ${kindColor} 30%, transparent)`,
              color: kindColor,
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em',
            }}>
              {entry.kind === 'in' ? 'Intake' : 'Outflow'}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-h)', fontSize: 15, color: 'var(--ink)', letterSpacing: 'var(--display-tracking)' }}>
              {entry.grade} · {fmt(entry.date)}
            </span>
          </div>
        </div>

        {/* Form body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Row 1: Date + Note */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div className="field">
              <div className="field-label">Date</div>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div className="field">
              <div className="field-label">Reference number</div>
              <input type="number" className="field-input" value={noteNumber} onChange={e => setNoteNumber(e.target.value)} min="0" placeholder="—" />
            </div>
          </div>

          {/* Row 2: Location */}
          <div className="field">
            <div className="field-label">Location</div>
            <select className="field-input" value={locId} onChange={e => setLocId(e.target.value)}>
              {locations.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
            </select>
          </div>

          {/* Row 3: Grade pills */}
          <div className="field">
            <div className="field-label">Grade</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {grades.map(g => {
                const gc = gradeColor(g, colorMap)
                const active = grade === g
                return (
                  <button
                    key={g}
                    type="button"
                    className={'subtab' + (active ? ' is-on' : '')}
                    onClick={() => setGrade(g)}
                    style={active ? { color: gc, background: `color-mix(in oklab, ${gc} 12%, var(--surface))`, borderColor: `color-mix(in oklab, ${gc} 35%, transparent)` } : {}}
                  >
                    {g}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Row 4: Bags + Unit weight */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <div className="field-label">Bags</div>
              <input type="number" className="field-input" value={bags} onChange={e => setBags(e.target.value)} min="0" />
            </div>
            <div className="field">
              <div className="field-label">Unit weight (kg)</div>
              <input type="number" className="field-input" value={unitWeight} onChange={e => setUnitWeight(e.target.value)} min="0" placeholder="—" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({ entry, locations, onConfirm, onCancel }) {
  const locName = locations.find(l => l.id === entry.locId)?.name || '—'
  const totalKg = entry.bags * (entry.unitWeight || 0)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-2)',
        padding: '28px 28px 24px',
        maxWidth: 380, width: '100%',
        display: 'flex', flexDirection: 'column', gap: 20,
      }} onClick={e => e.stopPropagation()}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--warn)', fontWeight: 600, marginBottom: 8 }}>
            Delete entry
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-h)', fontSize: 16, color: 'var(--ink)', letterSpacing: 'var(--display-tracking)' }}>
            {entry.kind === 'in' ? 'Intake' : 'Outflow'} · {entry.grade}
          </div>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 1, background: 'var(--line)',
          border: '1px solid var(--line)', borderRadius: 'var(--radius-input)', overflow: 'hidden',
        }}>
          {[
            { label: 'Date', value: fmt(entry.date) },
            { label: 'Location', value: locName },
            { label: 'Bags', value: entry.bags.toLocaleString() },
            { label: 'Total weight', value: totalKg > 0 ? totalKg.toLocaleString() + ' kg' : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--surface-2)', padding: '10px 14px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.10em', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          This will permanently delete the shipment and all its items. This cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn" onClick={onConfirm} style={{ background: 'var(--warn)', color: '#fff', border: 'none' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

function History({ activeLoc, locations, searchQ = '', profile, isAdmin }) {
  const [entries, setEntries] = useState([])
  const [kind, setKind] = useState('all')
  const [loading, setLoading] = useState(true)
  const [hoveredRow, setHoveredRow] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [view, setView] = useState('register')
  const [editTarget, setEditTarget] = useState(null)

  // Supervisor verification of register rows
  const [regVerifs, setRegVerifs] = useState({})      // vkey -> { verified_name, verified_at, remark }
  const [verifyingKey, setVerifyingKey] = useState(null)
  const [pendingRow, setPendingRow] = useState(null)  // register row awaiting a remark in the popup
  const [verifyRemark, setVerifyRemark] = useState('')
  const [toast, setToast] = useState('')

  // Filters
  const [filterGrade, setFilterGrade] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [grades, setGrades] = useState([])

  // Pagination
  const PAGE_SIZE = 10
  const [movPage, setMovPage] = useState(1)
  const [regPage, setRegPage] = useState(1)

  useEffect(() => {
    fetchEntries()
  }, [activeLoc])

  useEffect(() => {
    supabase.from('grades').select('name').order('name').then(({ data }) => {
      if (data?.length) setGrades(data.map(g => g.name))
    })
  }, [])

  useEffect(() => { setMovPage(1) }, [filterGrade, filterFrom, filterTo, kind, searchQ, view])
  useEffect(() => { setRegPage(1) }, [filterGrade, filterFrom, filterTo, searchQ, view])

  // If the grades table is empty, derive grade options from loaded entries
  const gradeOptions = grades.length > 0
    ? grades
    : [...new Set(entries.map(e => e.grade))].sort()
  const colorMap = useMemo(() => buildGradeColorMap(gradeOptions), [gradeOptions])

  const closingByGrade = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      map[e.grade] = (map[e.grade] || 0) + (e.kind === 'in' ? e.bags : -e.bags)
    })
    return map
  }, [entries])

  async function fetchEntries() {
    setLoading(true)

    let inQ = supabase
      .from('inbound_shipments')
      .select('id, date, cold_storage_id, note_number, remarks, inbound_items(id, grade, quantity, unit_weight)')
      .order('date', { ascending: false }).order('id', { ascending: false })
    let outQ = supabase
      .from('outbound_shipments')
      .select('id, date, cold_storage_id, note_number, remarks, outbound_items(id, grade, quantity, unit_weight)')
      .order('date', { ascending: false }).order('id', { ascending: false })

    if (activeLoc !== 'all') {
      inQ = inQ.eq('cold_storage_id', activeLoc)
      outQ = outQ.eq('cold_storage_id', activeLoc)
    }

    const [{ data: inShips }, { data: outShips }] = await Promise.all([inQ, outQ])

    const rows = [
      ...(inShips || []).flatMap(s =>
        s.inbound_items.map(item => ({
          id: s.id + '-in-' + item.grade,
          itemId: item.id,
          shipmentId: s.id,
          date: s.date,
          locId: s.cold_storage_id,
          noteNumber: s.note_number,
          remarks: s.remarks || '',
          grade: item.grade,
          bags: item.quantity,
          unitWeight: item.unit_weight,
          kind: 'in',
        }))
      ),
      ...(outShips || []).flatMap(s =>
        s.outbound_items.map(item => ({
          id: s.id + '-out-' + item.grade,
          itemId: item.id,
          shipmentId: s.id,
          date: s.date,
          locId: s.cold_storage_id,
          noteNumber: s.note_number,
          remarks: s.remarks || '',
          grade: item.grade,
          bags: item.quantity,
          unitWeight: item.unit_weight,
          kind: 'out',
        }))
      ),
    ].sort((a, b) => b.date.localeCompare(a.date))

    setEntries(rows)
    setLoading(false)
  }

  const isFiltered = filterGrade || filterFrom || filterTo

  function clearFilters() {
    setFilterGrade('')
    setFilterFrom('')
    setFilterTo('')
  }

  const filtered = entries.filter(h => {
    if (kind !== 'all' && h.kind !== kind) return false
    if (filterGrade && h.grade !== filterGrade) return false
    if (filterFrom && h.date < filterFrom) return false
    if (filterTo && h.date > filterTo) return false
    if (searchQ) {
      const locName = locations.find(l => l.id === h.locId)?.name || ''
      const haystack = `${h.grade} ${locName} ${h.date} ${h.kind} ${h.bags} ${h.noteNumber || ''}`.toLowerCase()
      if (!haystack.includes(searchQ.toLowerCase())) return false
    }
    return true
  })

  async function confirmDelete() {
    if (!deleteTarget) return
    const isIn = deleteTarget.kind === 'in'
    const itemsTable = isIn ? 'inbound_items' : 'outbound_items'
    const shipmentsTable = isIn ? 'inbound_shipments' : 'outbound_shipments'

    await supabase.from(itemsTable).delete().eq('shipment_id', deleteTarget.shipmentId)
    const shipRes = await supabase.from(shipmentsTable).delete({ count: 'exact' }).eq('id', deleteTarget.shipmentId)

    if (shipRes.count === 0) {
      alert('Nothing was deleted — check your Supabase DELETE policy for ' + shipmentsTable)
      return
    }

    setDeleteTarget(null)
    fetchEntries()
  }

  async function handleEditSave({ date, noteNumber, locId, grade, bags, unitWeight }) {
    if (!editTarget) return
    const isIn = editTarget.kind === 'in'
    const itemsTable = isIn ? 'inbound_items' : 'outbound_items'
    const shipmentsTable = isIn ? 'inbound_shipments' : 'outbound_shipments'

    const { error: shipErr } = await supabase
      .from(shipmentsTable)
      .update({ date, cold_storage_id: locId, note_number: noteNumber ? Number(noteNumber) : null })
      .eq('id', editTarget.shipmentId)

    if (shipErr) {
      alert('Failed to update shipment: ' + shipErr.message)
      return
    }

    const itemFilter = editTarget.itemId ? { id: editTarget.itemId } : { shipment_id: editTarget.shipmentId }
    const { error: itemErr } = await supabase
      .from(itemsTable)
      .update({ grade, quantity: bags, unit_weight: unitWeight })
      .match(itemFilter)

    if (itemErr) {
      alert('Failed to update item: ' + itemErr.message)
      return
    }

    // Update in-place so the row keeps its position — re-fetching after a Supabase UPDATE
    // can return same-date rows in a different heap order and cause the entry to move.
    const newLocId = locations.find(l => String(l.id) === String(locId))?.id ?? locId
    setEntries(prev => prev.map(e => {
      if (e.shipmentId !== editTarget.shipmentId) return e
      const updated = { ...e, date, locId: newLocId, noteNumber }
      if (e.itemId === editTarget.itemId) {
        updated.grade = grade
        updated.bags = bags
        updated.unitWeight = unitWeight
        updated.id = `${e.shipmentId}-${e.kind}-${grade}`
      }
      return updated
    }))
    setEditTarget(null)
  }

  const totalIn = filtered.filter(h => h.kind === 'in').reduce((s, h) => s + h.bags, 0)
  const totalOut = filtered.filter(h => h.kind === 'out').reduce((s, h) => s + h.bags, 0)

  const registerRows = useMemo(() => {
    const all = buildRegister(entries)
    return all.filter(r => {
      if (filterGrade && r.grade !== filterGrade) return false
      if (filterFrom && r.date < filterFrom) return false
      if (filterTo && r.date > filterTo) return false
      if (searchQ) {
        const locName = locations.find(l => String(l.id) === String(r.locId))?.name || ''
        const haystack = `${r.grade} ${locName} ${r.date} ${r.noteNumbers}`.toLowerCase()
        if (!haystack.includes(searchQ.toLowerCase())) return false
      }
      return true
    }).sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date)
      return b.maxShipmentId - a.maxShipmentId
    })
  }, [entries, filterGrade, filterFrom, filterTo, searchQ, locations])

  const regTotalIn = registerRows.reduce((s, r) => s + r.newStock, 0)
  const regTotalSold = registerRows.reduce((s, r) => s + r.sold, 0)

  const movTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const regTotalPages = Math.max(1, Math.ceil(registerRows.length / PAGE_SIZE))
  const filteredPage = filtered.slice((movPage - 1) * PAGE_SIZE, movPage * PAGE_SIZE)
  const registerPage = registerRows.slice((regPage - 1) * PAGE_SIZE, regPage * PAGE_SIZE)

  // Load verification status for the register rows currently in view
  useEffect(() => {
    if (view !== 'register' || registerRows.length === 0) return
    let active = true
    const dates = [...new Set(registerRows.map(r => r.date))]
    supabase
      .from('register_verifications')
      .select('date, loc_id, grade, verified_name, verified_at, remark')
      .in('date', dates)
      .then(({ data }) => {
        if (!active) return
        const map = {}
        ;(data || []).forEach(v => { map[vkey(v.date, v.loc_id, v.grade)] = v })
        setRegVerifs(map)
      })
    return () => { active = false }
  }, [view, registerRows])

  async function handleVerifyRow(row, remark) {
    const key = vkey(row.date, row.locId, row.grade)
    if (verifyingKey) return
    setVerifyingKey(key)
    const { data: { user } } = await supabase.auth.getUser()
    const name = profile?.full_name || 'Supervisor'
    const trimmed = (remark || '').trim() || null
    const { error } = await supabase.from('register_verifications').insert({
      date: row.date,
      loc_id: row.locId,
      grade: row.grade,
      verified_by: user?.id ?? null,
      verified_name: name,
      remark: trimmed,
    })
    setVerifyingKey(null)
    if (error) { setToast('Could not verify: ' + error.message); return }
    setRegVerifs(prev => ({ ...prev, [key]: { verified_name: name, verified_at: new Date().toISOString(), remark: trimmed } }))
    setPendingRow(null)
    setVerifyRemark('')
    setToast('Row verified')
  }

  return (
    <>
    <div className="col">
      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { value: 'register', label: 'Register' },
          ...(isAdmin ? [{ value: 'movements', label: 'Movements' }] : []),
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

      {/* KPI strip */}
      <div className="grid-3">
        {view === 'movements' ? <>
          <div className="kpi">
            <div className="kpi-label">Entries</div>
            <div className="kpi-val display">{filtered.length}</div>
            <div className="kpi-foot"><span style={{ color: 'var(--ink-3)' }}>matching filter</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Bags in</div>
            <div className="kpi-val display">{totalIn.toLocaleString()}<span className="kpi-unit">bags</span></div>
            <div className="kpi-foot">
              <span className="kpi-delta up"><Icon name="up" size={12}/> Intake</span>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Bags out</div>
            <div className="kpi-val display">{totalOut.toLocaleString()}<span className="kpi-unit">bags</span></div>
            <div className="kpi-foot">
              <span className="kpi-delta down"><Icon name="down" size={12}/> Outflow</span>
            </div>
          </div>
        </> : <>
          <div className="kpi">
            <div className="kpi-label">Rows</div>
            <div className="kpi-val display">{registerRows.length}</div>
            <div className="kpi-foot"><span style={{ color: 'var(--ink-3)' }}>matching filter</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">New stock</div>
            <div className="kpi-val display">{regTotalIn.toLocaleString()}<span className="kpi-unit">bags</span></div>
            <div className="kpi-foot">
              <span className="kpi-delta up"><Icon name="up" size={12}/> Received</span>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Sold</div>
            <div className="kpi-val display">{regTotalSold.toLocaleString()}<span className="kpi-unit">bags</span></div>
            <div className="kpi-foot">
              <span className="kpi-delta down"><Icon name="down" size={12}/> Outflow</span>
            </div>
          </div>
        </>}
      </div>

      {/* Filter bar */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-1)',
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px 20px',
        alignItems: 'flex-end',
      }}>
        {/* Grade pills */}
        {gradeOptions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={FILTER_LABEL}>Grade</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['', ...gradeOptions].map(g => {
                const isActive = filterGrade === g
                const gc = gradeColor(g, colorMap)
                const closing = g ? (closingByGrade[g] || 0) : null
                return (
                  <button
                    key={g || 'all'}
                    type="button"
                    className={'subtab' + (isActive ? ' is-on' : '')}
                    onClick={() => setFilterGrade(g)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      ...(isActive ? (g
                        ? { color: gc, background: `color-mix(in oklab, ${gc} 12%, var(--surface))`, borderColor: `color-mix(in oklab, ${gc} 35%, transparent)` }
                        : { color: 'var(--ink)', background: 'var(--bg-2)', borderColor: 'var(--line-strong)' }
                      ) : {}),
                    }}
                  >
                    <span>{g || 'All'}</span>
                    {closing !== null && (
                      <span style={{
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        color: isActive ? 'inherit' : 'var(--ink-3)',
                        fontWeight: 600,
                        opacity: isActive ? 0.8 : 1,
                      }}>
                        {closing.toLocaleString()}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Date range + Type */}
        <div className="filter-date-type">
          <div className="date-range-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={FILTER_LABEL}>From</label>
              <DatePicker value={filterFrom} onChange={setFilterFrom} style={{ width: 130 }} inputStyle={{ fontSize: 13, padding: '7px 10px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={FILTER_LABEL}>To</label>
              <DatePicker value={filterTo} onChange={setFilterTo} style={{ width: 130 }} inputStyle={{ fontSize: 13, padding: '7px 10px' }} />
            </div>
          </div>

          {/* Type — movements view only */}
          {view === 'movements' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={FILTER_LABEL}>Type</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { value: 'all', label: 'All' },
                  { value: 'in',  label: 'In' },
                  { value: 'out', label: 'Out' },
                ].map(({ value, label }) => {
                  const isActive = kind === value
                  const activeStyle = value === 'in'
                    ? { color: 'var(--grade-a)', background: 'color-mix(in oklab, var(--grade-a) 12%, var(--surface))', borderColor: 'color-mix(in oklab, var(--grade-a) 35%, transparent)' }
                    : value === 'out'
                      ? { color: 'var(--warn)', background: 'color-mix(in oklab, var(--warn) 12%, var(--surface))', borderColor: 'color-mix(in oklab, var(--warn) 35%, transparent)' }
                      : { color: 'var(--ink)', background: 'var(--bg-2)', borderColor: 'var(--line-strong)' }
                  return (
                    <button
                      key={value}
                      type="button"
                      className={'subtab' + (isActive ? ' is-on' : '')}
                      onClick={() => setKind(value)}
                      style={isActive ? activeStyle : {}}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Clear */}
        {(isFiltered || kind !== 'all') && (
          <button
            type="button"
            className="btn"
            onClick={() => { clearFilters(); setKind('all') }}
            style={{ alignSelf: 'flex-end', fontSize: 13 }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Movements table */}
      {view === 'movements' && isAdmin && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card-hd" style={{ flexShrink: 0 }}>
            <div className="card-title display">All movements</div>
          </div>
          <div style={{ overflow: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '32px 22px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading…</div>
            ) : (
              <table className="tbl" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1, boxShadow: '0 1px 0 var(--line)' }}>
                  <tr>
                    <th>Date</th>
                    <th>Ref. No.</th>
                    <th>Storage</th>
                    <th>Grade</th>
                    <th style={{ textAlign: 'right' }}>Bags</th>
                    <th style={{ textAlign: 'right' }}>Unit kg</th>
                    <th style={{ textAlign: 'right' }}>Total kg</th>
                    <th>Remarks</th>
                    {profile?.role === 'admin' && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredPage.map(h => {
                    const locName = locations.find(l => l.id === h.locId)?.name || h.locId
                    const totalKg = h.bags * (h.unitWeight || 0)
                    return (
                      <tr
                        key={h.id}
                        className={h.kind === 'in' ? 'is-in' : 'is-out'}
                        onMouseEnter={() => setHoveredRow(h.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td><span className="num" style={{ color: 'var(--ink)' }}>{fmt(h.date)}</span></td>
                        <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>{h.noteNumber || '—'}</span></td>
                        <td><span className="loc">{locName}</span></td>
                        <td><span className="gradedot" style={{ color: gradeColor(h.grade, colorMap) }}>{h.grade}</span></td>
                        <td className="num right">
                          <span className={'delta-pill ' + (h.kind === 'in' ? 'in' : 'out')}>
                            {h.kind === 'in' ? '+' : '−'}{h.bags}
                          </span>
                        </td>
                        <td className="num right" style={{ color: 'var(--ink-2)' }}>{h.unitWeight ? h.unitWeight + ' kg' : '—'}</td>
                        <td className="num right" style={{ fontWeight: 500 }}>{totalKg > 0 ? totalKg.toLocaleString() + ' kg' : '—'}</td>
                        <td style={{ color: 'var(--ink-2)', fontSize: 13 }}>{h.remarks || <span style={{ color: 'var(--ink-3)' }}>—</span>}</td>
                        {profile?.role === 'admin' && (
                          <td style={{ width: 80, whiteSpace: 'nowrap' }}>
                            <div style={{
                              display: 'flex', gap: 4, justifyContent: 'flex-end',
                              opacity: hoveredRow === h.id ? 1 : 0,
                              transition: 'opacity .15s',
                            }}>
                              <button
                                onClick={() => setEditTarget(h)}
                                style={{
                                  background: 'var(--surface-2)', border: '1px solid var(--line)',
                                  borderRadius: 'var(--radius-input)',
                                  cursor: 'pointer', color: 'var(--ink-2)',
                                  fontSize: 11, fontFamily: 'var(--font-mono)',
                                  fontWeight: 600, letterSpacing: '.06em',
                                  padding: '3px 8px', lineHeight: 1.4,
                                }}
                              >Edit</button>
                              <button
                                onClick={() => setDeleteTarget(h)}
                                style={{
                                  background: 'color-mix(in oklab, var(--warn) 10%, var(--surface))',
                                  border: '1px solid color-mix(in oklab, var(--warn) 25%, transparent)',
                                  borderRadius: 'var(--radius-input)',
                                  cursor: 'pointer', color: 'var(--warn)',
                                  fontSize: 13, fontWeight: 600,
                                  padding: '3px 7px', lineHeight: 1.4,
                                }}
                              >×</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: '48px 22px', color: 'var(--ink-3)', textAlign: 'center' }}>
                <div className="hint">No entries match your filter.</div>
              </div>
            )}
            {!loading && movTotalPages > 1 && (
              <Pagination page={movPage} total={movTotalPages} count={filtered.length} onPrev={() => setMovPage(p => p - 1)} onNext={() => setMovPage(p => p + 1)} />
            )}
          </div>
        </div>
      )}

      {/* Register table */}
      {view === 'register' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card-hd" style={{ flexShrink: 0 }}>
            <div className="card-title display">Daily register</div>
          </div>
          <div style={{ overflow: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '32px 22px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading…</div>
            ) : (
              <table className="tbl" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1, boxShadow: '0 1px 0 var(--line)' }}>
                  <tr>
                    <th>Date</th>
                    <th>Location</th>
                    <th>Grade</th>
                    <th>Ref. No.</th>
                    <th style={{ textAlign: 'right' }}>Opening</th>
                    <th style={{ textAlign: 'right' }}>New Stock</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Sold</th>
                    <th style={{ textAlign: 'right' }}>Closing</th>
                    <th>Remarks</th>
                    <th style={{ textAlign: 'center' }}>Verify</th>
                    <th>Verification details</th>
                    <th>Supervisor remark</th>
                  </tr>
                </thead>
                <tbody>
                  {registerPage.map((r, i) => {
                    const locName = locations.find(l => String(l.id) === String(r.locId))?.name || r.locId
                    return (
                      <tr key={`${r.date}-${r.locId}-${r.grade}-${i}`}>
                        <td><span className="num" style={{ color: 'var(--ink)' }}>{fmt(r.date)}</span></td>
                        <td><span className="loc">{locName}</span></td>
                        <td><span className="gradedot" style={{ color: gradeColor(r.grade, colorMap) }}>{r.grade}</span></td>
                        <td style={{ color: 'var(--ink-2)', fontSize: 13 }}>{r.noteNumbers || <span style={{ color: 'var(--ink-3)' }}>—</span>}</td>
                        <td className="num right" style={{ color: 'var(--ink-2)' }}>{r.opening.toLocaleString()}</td>
                        <td className="num right">
                          {r.newStock > 0
                            ? <span className="delta-pill in">+{r.newStock.toLocaleString()}</span>
                            : <span style={{ color: 'var(--ink-3)' }}>—</span>}
                        </td>
                        <td className="num right" style={{ fontWeight: 600 }}>{r.total.toLocaleString()}</td>
                        <td className="num right">
                          {r.sold > 0
                            ? <span className="delta-pill out">−{r.sold.toLocaleString()}</span>
                            : <span style={{ color: 'var(--ink-3)' }}>—</span>}
                        </td>
                        <td className="num right" style={{ fontWeight: 700, color: r.closing < 0 ? 'var(--warn)' : 'var(--ink)' }}>
                          {r.closing.toLocaleString()}
                        </td>
                        <td style={{ color: 'var(--ink-2)', fontSize: 13 }}>{r.remarks || <span style={{ color: 'var(--ink-3)' }}>—</span>}</td>
                        {(() => {
                          const key = vkey(r.date, r.locId, r.grade)
                          const v = regVerifs[key]
                          return (
                            <>
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {v ? (
                                  <span style={{ color: 'var(--grade-a)', fontWeight: 700, fontSize: 12 }}>✓ Verified</span>
                                ) : isAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => { setPendingRow(r); setVerifyRemark('') }}
                                    disabled={verifyingKey === key}
                                    style={{
                                      fontSize: 11, fontWeight: 600, padding: '4px 12px',
                                      borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                                      border: '1px solid var(--primary)', color: 'var(--primary)',
                                      background: 'color-mix(in oklab, var(--primary) 8%, var(--surface))',
                                    }}
                                  >
                                    {verifyingKey === key ? '…' : 'Verify'}
                                  </button>
                                ) : (
                                  <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>Pending</span>
                                )}
                              </td>
                              <td style={{ fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                                {v ? (
                                  <span>
                                    <strong style={{ color: 'var(--ink)' }}>{v.verified_name}</strong>
                                    <span style={{ color: 'var(--ink-3)' }}> · {new Date(v.verified_at).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</span>
                                  </span>
                                ) : '—'}
                              </td>
                              <td style={{ fontSize: 13, color: v?.remark ? 'var(--ink)' : 'var(--ink-3)' }}>{v?.remark || '—'}</td>
                            </>
                          )
                        })()}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {!loading && registerRows.length === 0 && (
              <div style={{ padding: '48px 22px', color: 'var(--ink-3)', textAlign: 'center' }}>
                <div className="hint">No entries match your filter.</div>
              </div>
            )}
            {!loading && regTotalPages > 1 && (
              <Pagination page={regPage} total={regTotalPages} count={registerRows.length} onPrev={() => setRegPage(p => p - 1)} onNext={() => setRegPage(p => p + 1)} />
            )}
          </div>
        </div>
      )}
    </div>
    {editTarget && (
      <EditModal
        entry={editTarget}
        locations={locations}
        grades={gradeOptions}
        onSave={handleEditSave}
        onCancel={() => setEditTarget(null)}
      />
    )}
    {deleteTarget && (
      <ConfirmModal
        entry={deleteTarget}
        locations={locations}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    )}
    {pendingRow && (
      <div
        onClick={() => { if (!verifyingKey) { setPendingRow(null); setVerifyRemark('') } }}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-2)', width: '100%', maxWidth: 440, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div>
            <div className="card-title display">Verify register row</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
              {fmt(pendingRow.date)} · {locations.find(l => String(l.id) === String(pendingRow.locId))?.name || pendingRow.locId} · {pendingRow.grade}
            </div>
          </div>
          <textarea
            autoFocus
            value={verifyRemark}
            onChange={e => setVerifyRemark(e.target.value)}
            placeholder="Add a remark for this row (optional)…"
            rows={4}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius-input)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={() => { setPendingRow(null); setVerifyRemark('') }} disabled={!!verifyingKey}>
              Cancel
            </button>
            <button type="button" className="btn primary" onClick={() => handleVerifyRow(pendingRow, verifyRemark)} disabled={!!verifyingKey}>
              {verifyingKey ? 'Verifying…' : 'Verify & save'}
            </button>
          </div>
        </div>
      </div>
    )}
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}

export default History
