import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Toast from '../components/Toast'

const GRADE_COLORS = { A: 'var(--grade-a)', B: 'var(--grade-b)', C: 'var(--grade-c)', D: 'var(--grade-d)' }
const INDEX_COLORS = ['var(--grade-a)', 'var(--grade-b)', 'var(--grade-c)', 'var(--grade-d)', 'var(--accent)']
function gradeColor(name, i = 0) {
  const letter = (name || '').trim()[0]?.toUpperCase()
  return GRADE_COLORS[letter] || INDEX_COLORS[i % INDEX_COLORS.length]
}

function AddEntry({ profile, defaultLoc, locations, onSaved }) {
  const [kind, setKind] = useState(null)
  const [locId, setLocId] = useState(null)
  const [grades, setGrades] = useState([])
  const [grade, setGrade] = useState(null)
  const [bags, setBags] = useState('')
  const [bagW, setBagW] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))
  const [noteNumber, setNoteNumber] = useState('')
  const [remarks, setRemarks] = useState('')
  const [saved, setSaved] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [newGradeName, setNewGradeName] = useState('')
  const [addingGrade, setAddingGrade] = useState(false)
  const [newLocName, setNewLocName] = useState('')
  const [addingLoc, setAddingLoc] = useState(false)
  const [localLocations, setLocalLocations] = useState(null)
  const [manageLocs, setManageLocs] = useState(false)
  const [manageGrades, setManageGrades] = useState(false)

  useEffect(() => {
    if (profile?.role === 'worker' && locations.length > 0) {
      const workerLoc = locations.find(l => l.id === profile.location_id)
      if (workerLoc) {
        setLocalLocations([workerLoc])
        setLocId(workerLoc.id)
      }
    }
  }, [profile, defaultLoc, locations])

  useEffect(() => {
    supabase.from('grades').select('id, name').order('name').then(({ data }) => {
      if (data && data.length > 0) {
        setGrades(data)
      }
    })
  }, [])

  async function handleAddLocation() {
    const name = newLocName.trim()
    if (!name) return
    const { data, error } = await supabase.from('locations').insert([{ name }]).select().single()
    if (error) { setError(error.message); return }
    if (data) {
      const { data: all } = await supabase.from('locations').select('id, name').order('name')
      if (all) setLocalLocations(all)
      setLocId(data.id)
      setNewLocName('')
      setAddingLoc(false)
    }
  }

  async function handleAddGrade() {
    const name = newGradeName.trim()
    if (!name) return
    const { data, error } = await supabase.from('grades').insert([{ name }]).select().single()
    if (error) { setError(error.message); return }
    if (data) {
      const { data: all } = await supabase.from('grades').select('id, name').order('name')
      if (all) setGrades(all)
      setGrade(data.id)
      setNewGradeName('')
      setAddingGrade(false)
    }
  }

  async function handleDeleteLocation(id) {
    const snapshot = visibleLocations
    const remaining = snapshot.filter(l => l.id !== id)
    setLocalLocations(remaining)
    if (locId === id) setLocId(remaining[0]?.id ?? null)

    // Delete any profiles assigned to this location first
    const { error: profErr } = await supabase.from('profiles').delete().eq('location_id', id)
    if (profErr) {
      setLocalLocations(snapshot)
      if (locId === id) setLocId(id)
      alert('Could not delete worker: ' + profErr.message)
      return
    }

    const { error: err, count } = await supabase
      .from('locations').delete({ count: 'exact' }).eq('id', id)
    if (err || count === 0) {
      setLocalLocations(snapshot)
      if (locId === id) setLocId(id)
      alert('Could not delete location: ' + (err?.message || 'Delete blocked — check DELETE policy on locations table in Supabase.'))
    }
  }

  async function handleDeleteGrade(id) {
    const snapshot = grades
    const remaining = snapshot.filter(g => g.id !== id)
    setGrades(remaining)
    if (grade === id) setGrade(remaining[0]?.id ?? null)
    const { error: err, count } = await supabase
      .from('grades').delete({ count: 'exact' }).eq('id', id)
    if (err || count === 0) {
      setGrades(snapshot)
      if (grade === id) setGrade(id)
      alert(err ? err.message : 'Delete blocked — go to Supabase → Authentication → Policies and add a DELETE policy for the grades table.')
    }
  }

  async function handleSubmit() {
    if (submitting) return
    const errs = {}
    if (!kind) errs.kind = 'Select a movement type'
    if (!noteNumber.trim()) errs.noteNumber = 'Enter a reference number'
    if (!grade) errs.grade = 'Select a grade'
    if (!bags) errs.bags = 'Enter bag count'
    if (!bagW) errs.bagW = 'Enter bag weight'
    if (!locId) errs.locId = 'Select a location'
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
    setError('')
    setSubmitting(true)
    const gradeObj = grades.find(g => g.id === grade)
    if (!gradeObj) { setSubmitting(false); return }

    try {
      if (kind === 'in') {
        const { data: shipment, error: se } = await supabase
          .from('inbound_shipments')
          .insert([{ date, cold_storage_id: locId, note_number: noteNumber.trim(), remarks: remarks.trim() || null }])
          .select('id')
          .single()
        if (se) throw new Error(se.message)
        if (!shipment?.id) throw new Error('Shipment created but ID not returned — check Supabase SELECT policy on inbound_shipments')
        const { error: ie } = await supabase.from('inbound_items').insert([{
          shipment_id: shipment.id,
          grade: gradeObj.name,
          quantity: bags,
          unit_weight: bagW,
        }])
        if (ie) throw new Error(ie.message)
      } else {
        const { data: shipment, error: se } = await supabase
          .from('outbound_shipments')
          .insert([{ date, cold_storage_id: locId, note_number: noteNumber.trim(), remarks: remarks.trim() || null }])
          .select('id')
          .single()
        if (se) throw new Error(se.message)
        if (!shipment?.id) throw new Error('Shipment created but ID not returned — check Supabase SELECT policy on outbound_shipments')
        const { error: ie } = await supabase.from('outbound_items').insert([{
          shipment_id: shipment.id,
          grade: gradeObj.name,
          quantity: bags,
          unit_weight: bagW,
        }])
        if (ie) throw new Error(ie.message)
      }

      setSaved(true)
      setShowToast(true)
      setTimeout(() => { setSaved(false); if (onSaved) onSaved() }, 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const visibleLocations = localLocations ?? locations
  const gradeObj = grades.find(g => g.id === grade)
  const locObj = visibleLocations.find(l => l.id === locId)

  const xBtn = (onClick) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'absolute', top: -6, right: -6,
        width: 18, height: 18, borderRadius: '50%',
        background: 'var(--warn)', color: '#fff',
        border: '1.5px solid var(--surface)',
        cursor: 'pointer', fontSize: 11, lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, zIndex: 1,
      }}
    >×</button>
  )

  const FieldError = ({ field }) => fieldErrors[field] ? (
    <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 6 }}>{fieldErrors[field]}</div>
  ) : null

  const manageToggleStyle = (active) => ({
    fontSize: 11,
    color: active ? 'var(--warn)' : 'var(--ink-3)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 2px',
    fontFamily: 'var(--font-mono)',
  })

  return (
    <>
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="card">
        <div className="card-bd" style={{ padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Movement type */}
          <div className="field">
            <div className="field-label">Movement type</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              {[
                { id: 'in',  label: 'Intake',  desc: 'Adding stock' },
                { id: 'out', label: 'Outflow', desc: 'Removing stock' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setKind(opt.id); setFieldErrors(e => ({ ...e, kind: null })) }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-input)',
                    border: '1px solid ' + (kind === opt.id ? (opt.id === 'in' ? 'var(--grade-a)' : 'var(--warn)') : 'var(--line)'),
                    background: kind === opt.id
                      ? (opt.id === 'in' ? 'color-mix(in oklab, var(--grade-a) 10%, var(--surface))' : 'color-mix(in oklab, var(--warn) 10%, var(--surface))')
                      : 'var(--surface-2)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all .15s var(--easing)',
                  }}
                >
                  <div style={{
                    fontWeight: 600, fontSize: 14,
                    color: kind === opt.id ? (opt.id === 'in' ? 'var(--grade-a)' : 'var(--warn)') : 'var(--ink)',
                  }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
            <FieldError field="kind" />
          </div>

          {/* Date */}
          <div className="field">
            <div className="field-label">Date</div>
            <input
              type="date"
              className="field-input"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* Reference Number */}
          <div className="field">
            <div className="field-label">Reference Number</div>
            <input
              type="number"
              className="field-input field-num"
              value={noteNumber}
              onChange={e => { setNoteNumber(e.target.value); setFieldErrors(f => ({ ...f, noteNumber: null })) }}
              placeholder="e.g. 1001"
              min="0"
            />
            <FieldError field="noteNumber" />
          </div>

          {/* Cold storage — pill buttons (admins only) */}
          {profile?.role !== 'worker' && <div className="field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="field-label" style={{ marginBottom: 0 }}>Cold storage</div>
              {visibleLocations.length > 0 && (
                <button type="button" style={manageToggleStyle(manageLocs)} onClick={() => setManageLocs(v => !v)}>
                  {manageLocs ? 'Done' : 'Manage'}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {visibleLocations.map(l => (
                <div key={l.id} style={{ position: 'relative', display: 'inline-flex' }}>
                  <button
                    type="button"
                    className={'chip' + (locId === l.id ? ' is-on' : '')}
                    onClick={() => { if (!manageLocs) { setLocId(l.id); setFieldErrors(e => ({ ...e, locId: null })) } }}
                    style={manageLocs ? { opacity: 0.75, cursor: 'default' } : {}}
                  >
                    {l.name}
                  </button>
                  {manageLocs && xBtn((e) => { e.stopPropagation(); handleDeleteLocation(l.id) })}
                </div>
              ))}
              {!manageLocs && (
                <button
                  type="button"
                  className="chip"
                  style={{ borderStyle: 'dashed', color: 'var(--ink-3)' }}
                  onClick={() => setAddingLoc(true)}
                >
                  + Add location
                </button>
              )}
            </div>
            <FieldError field="locId" />
            {addingLoc && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  className="field-input"
                  style={{ flex: 1 }}
                  placeholder="Location name (e.g. Rezaa)"
                  value={newLocName}
                  onChange={e => setNewLocName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddLocation()}
                  autoFocus
                />
                <button type="button" className="btn primary" onClick={handleAddLocation}>Add</button>
                <button type="button" className="btn" onClick={() => { setAddingLoc(false); setNewLocName('') }}>Cancel</button>
              </div>
            )}
          </div>}

          {/* Grade — visual cards */}
          <div className="field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="field-label" style={{ marginBottom: 0 }}>Grade</div>
              {grades.length > 0 && (
                <button type="button" style={manageToggleStyle(manageGrades)} onClick={() => setManageGrades(v => !v)}>
                  {manageGrades ? 'Done' : 'Manage'}
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
              {grades.map((g, i) => {
                const color = gradeColor(g.name, i)
                const selected = grade === g.id
                return (
                  <div key={g.id} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => { if (!manageGrades) { setGrade(g.id); setFieldErrors(e => ({ ...e, grade: null })) } }}
                      style={{
                        width: '100%',
                        padding: '14px 12px',
                        borderRadius: 'var(--radius-input)',
                        border: '1.5px solid ' + (selected ? color : 'var(--line)'),
                        background: selected ? 'color-mix(in oklab, ' + color + ' 12%, var(--surface))' : 'var(--surface-2)',
                        textAlign: 'left',
                        cursor: manageGrades ? 'default' : 'pointer',
                        transition: 'all .15s var(--easing)',
                        display: 'flex', flexDirection: 'column', gap: 8,
                        opacity: manageGrades ? 0.75 : 1,
                      }}
                    >
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: color,
                        boxShadow: selected ? '0 0 0 3px color-mix(in oklab, ' + color + ' 20%, transparent)' : 'none',
                        transition: 'box-shadow .15s var(--easing)',
                      }} />
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 'var(--weight-h)',
                        fontSize: 18,
                        letterSpacing: 'var(--display-tracking)',
                        color: selected ? color : 'var(--ink)',
                        lineHeight: 1,
                      }}>
                        {g.name}
                      </div>
                    </button>
                    {manageGrades && xBtn((e) => { e.stopPropagation(); handleDeleteGrade(g.id) })}
                  </div>
                )
              })}

              {/* Add grade card */}
              {!manageGrades && (
                <button
                  type="button"
                  onClick={() => setAddingGrade(true)}
                  style={{
                    padding: '14px 12px',
                    borderRadius: 'var(--radius-input)',
                    border: '1.5px dashed var(--line-strong)',
                    background: 'transparent',
                    textAlign: 'left', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    color: 'var(--ink-3)',
                    transition: 'border-color .15s var(--easing)',
                  }}
                >
                  <div style={{ fontSize: 18, lineHeight: 1, fontWeight: 300 }}>+</div>
                  <div style={{ fontSize: 12 }}>Add grade</div>
                </button>
              )}
            </div>

            <FieldError field="grade" />
            {addingGrade && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  className="field-input"
                  style={{ flex: 1 }}
                  placeholder="Grade name (e.g. A-Grade)"
                  value={newGradeName}
                  onChange={e => setNewGradeName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddGrade()}
                  autoFocus
                />
                <button type="button" className="btn primary" onClick={handleAddGrade}>Add</button>
                <button type="button" className="btn" onClick={() => { setAddingGrade(false); setNewGradeName('') }}>Cancel</button>
              </div>
            )}
          </div>

          {/* Bag count */}
          <div className="field">
            <div className="field-label">Bag count</div>
            <input
              type="number"
              className="field-input field-num"
              value={bags}
              onChange={e => { setBags(Math.max(0, +e.target.value || 0)); setFieldErrors(f => ({ ...f, bags: null })) }}
            />
            <FieldError field="bags" />
          </div>

          {/* Bag weight */}
          <div className="field">
            <div className="field-label">Avg. bag weight (kg)</div>
            <input
              type="number"
              className="field-input field-num"
              value={bagW}
              onChange={e => { setBagW(Math.max(0, +e.target.value || 0)); setFieldErrors(f => ({ ...f, bagW: null })) }}
            />
            <FieldError field="bagW" />
          </div>

          {/* Remarks */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>Remarks</label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Optional notes…"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-input)',
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Summary strip */}
          {locObj && gradeObj && (
            <div style={{
              display: 'flex', gap: 0,
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-input)',
              overflow: 'hidden',
            }}>
              {[
                { label: kind === 'in' ? 'Intake' : 'Outflow', value: locObj.name },
                { label: 'Grade', value: gradeObj.name, color: gradeColor(gradeObj.name) },
                { label: 'Bags', value: bags.toLocaleString() },
                { label: 'Net weight', value: (bags * bagW).toLocaleString() + ' kg' },
              ].map((item, i, arr) => (
                <div key={i} style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRight: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-3)', marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: item.color || 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--warn)', fontSize: 13 }}>{error}</div>
          )}

          {/* Submit */}
          <button
            type="button"
            className="btn primary"
            style={{ width: '100%', justifyContent: 'center', padding: '13px 0', fontSize: 14 }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {saved ? 'Saved ✓' : submitting ? 'Saving…' : kind === 'in' ? 'Record intake' : kind === 'out' ? 'Record outflow' : 'Record entry'}
          </button>

        </div>
      </div>
    </div>
      {showToast && (
        <Toast
          message="Entry recorded successfully!"
          onClose={() => setShowToast(false)}
        />
      )}
    </>
  )
}

export default AddEntry
