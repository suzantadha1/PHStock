import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon } from '../App'

const GRADE_COLORS = { A: 'var(--grade-a)', B: 'var(--grade-b)', C: 'var(--grade-c)', D: 'var(--grade-d)' }
const INDEX_COLORS = ['var(--grade-a)', 'var(--grade-b)', 'var(--grade-c)', 'var(--grade-d)', 'var(--accent)']
function gradeColor(name, i = 0) {
  const letter = (name || '').trim()[0]?.toUpperCase()
  return GRADE_COLORS[letter] || INDEX_COLORS[i % INDEX_COLORS.length]
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
            { label: 'Date', value: entry.date },
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

function History({ activeLoc, locations, searchQ = '', profile }) {
  const [entries, setEntries] = useState([])
  const [kind, setKind] = useState('all')
  const [loading, setLoading] = useState(true)
  const [hoveredRow, setHoveredRow] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    fetchEntries()
  }, [activeLoc])

  async function fetchEntries() {
    setLoading(true)

    let inQ = supabase
      .from('inbound_shipments')
      .select('id, date, cold_storage_id, inbound_items(grade, quantity, unit_weight)')
      .order('date', { ascending: false })
    let outQ = supabase
      .from('outbound_shipments')
      .select('id, date, cold_storage_id, outbound_items(grade, quantity, unit_weight)')
      .order('date', { ascending: false })

    if (activeLoc !== 'all') {
      inQ = inQ.eq('cold_storage_id', activeLoc)
      outQ = outQ.eq('cold_storage_id', activeLoc)
    }

    const [{ data: inShips }, { data: outShips }] = await Promise.all([inQ, outQ])

    const rows = [
      ...(inShips || []).flatMap(s =>
        s.inbound_items.map(item => ({
          id: s.id + '-in-' + item.grade,
          shipmentId: s.id,
          date: s.date,
          locId: s.cold_storage_id,
          grade: item.grade,
          bags: item.quantity,
          unitWeight: item.unit_weight,
          kind: 'in',
        }))
      ),
      ...(outShips || []).flatMap(s =>
        s.outbound_items.map(item => ({
          id: s.id + '-out-' + item.grade,
          shipmentId: s.id,
          date: s.date,
          locId: s.cold_storage_id,
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

  const filtered = entries.filter(h => {
    if (kind !== 'all' && h.kind !== kind) return false
    if (searchQ) {
      const locName = locations.find(l => l.id === h.locId)?.name || ''
      const haystack = `${h.grade} ${locName} ${h.date} ${h.kind} ${h.bags}`.toLowerCase()
      if (!haystack.includes(searchQ.toLowerCase())) return false
    }
    return true
  })

  async function confirmDelete() {
    if (!deleteTarget) return
    const isIn = deleteTarget.kind === 'in'
    const itemsTable = isIn ? 'inbound_items' : 'outbound_items'
    const shipmentsTable = isIn ? 'inbound_shipments' : 'outbound_shipments'

    console.log('Deleting:', { kind: deleteTarget.kind, shipmentId: deleteTarget.shipmentId, itemsTable, shipmentsTable })

    const itemsRes = await supabase.from(itemsTable).delete({ count: 'exact' }).eq('shipment_id', deleteTarget.shipmentId)
    console.log('Items delete — count:', itemsRes.count, 'error:', itemsRes.error)

    const shipRes = await supabase.from(shipmentsTable).delete({ count: 'exact' }).eq('id', deleteTarget.shipmentId)
    console.log('Shipment delete — count:', shipRes.count, 'error:', shipRes.error)

    if (shipRes.count === 0) {
      alert('Nothing was deleted — check your Supabase DELETE policy for ' + shipmentsTable)
      return
    }

    setDeleteTarget(null)
    fetchEntries()
  }

  const totalIn = filtered.filter(h => h.kind === 'in').reduce((s, h) => s + h.bags, 0)
  const totalOut = filtered.filter(h => h.kind === 'out').reduce((s, h) => s + h.bags, 0)

  return (
    <>
    <div className="col">
      {/* KPI strip */}
      <div className="grid-3">
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
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="card-hd" style={{ flexShrink: 0 }}>
          <div>
            <div className="card-title display">All movements</div>
          </div>
          <div className="subtabs" style={{ padding: 0, border: 0, margin: 0 }}>
            <button type="button" className={'subtab' + (kind === 'all' ? ' is-on' : '')} onClick={() => setKind('all')}
              style={kind === 'all' ? { color: 'var(--ink)', background: 'var(--bg-2)', borderColor: 'var(--line-strong)' } : {}}>All</button>
            <button type="button" className={'subtab' + (kind === 'in' ? ' is-on' : '')} onClick={() => setKind('in')}
              style={kind === 'in' ? { color: 'var(--grade-a)', background: 'color-mix(in oklab, var(--grade-a) 10%, var(--surface))', borderColor: 'color-mix(in oklab, var(--grade-a) 30%, transparent)' } : {}}>In</button>
            <button type="button" className={'subtab' + (kind === 'out' ? ' is-on' : '')} onClick={() => setKind('out')}
              style={kind === 'out' ? { color: 'var(--warn)', background: 'color-mix(in oklab, var(--warn) 10%, var(--surface))', borderColor: 'color-mix(in oklab, var(--warn) 30%, transparent)' } : {}}>Out</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '32px 22px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading…</div>
          ) : (
            <table className="tbl" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1, boxShadow: '0 1px 0 var(--line)' }}>
                <tr>
                  <th>Date</th>
                  <th>Storage</th>
                  <th>Grade</th>
                  <th style={{ textAlign: 'right' }}>Bags</th>
                  <th style={{ textAlign: 'right' }}>Unit kg</th>
                  <th style={{ textAlign: 'right' }}>Total kg</th>
                  {profile?.role === 'admin' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(h => {
                  const locName = locations.find(l => l.id === h.locId)?.name || h.locId
                  const totalKg = h.bags * (h.unitWeight || 0)
                  return (
                    <tr
                      key={h.id}
                      className={h.kind === 'in' ? 'is-in' : 'is-out'}
                      onMouseEnter={() => setHoveredRow(h.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td><span className="num" style={{ color: 'var(--ink)' }}>{h.date}</span></td>
                      <td><span className="loc">{locName}</span></td>
                      <td><span className="gradedot" style={{ color: gradeColor(h.grade) }}>{h.grade}</span></td>
                      <td className="num right">
                        <span className={'delta-pill ' + (h.kind === 'in' ? 'in' : 'out')}>
                          {h.kind === 'in' ? '+' : '−'}{h.bags}
                        </span>
                      </td>
                      <td className="num right" style={{ color: 'var(--ink-2)' }}>{h.unitWeight ? h.unitWeight + ' kg' : '—'}</td>
                      <td className="num right" style={{ fontWeight: 500 }}>{totalKg > 0 ? totalKg.toLocaleString() + ' kg' : '—'}</td>
                      {profile?.role === 'admin' && (
                        <td style={{ width: 32, textAlign: 'center' }}>
                          <button
                            onClick={() => setDeleteTarget(h)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--warn)', fontSize: 16, padding: '0 4px',
                              opacity: hoveredRow === h.id ? 1 : 0,
                              transition: 'opacity .15s',
                            }}
                          >×</button>
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
        </div>
      </div>
    </div>
    {deleteTarget && (
      <ConfirmModal
        entry={deleteTarget}
        locations={locations}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    )}
    </>
  )
}

export default History
