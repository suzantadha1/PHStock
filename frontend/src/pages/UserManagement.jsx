import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const label = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '.10em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
  fontWeight: 600,
  marginBottom: 6,
  display: 'block',
}

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-2)',
  overflow: 'hidden',
}

const cardHeader = {
  padding: '18px 24px',
  borderBottom: '1px solid var(--line)',
  background: 'var(--bg-2)',
  fontFamily: 'var(--font-display)',
  fontWeight: 'var(--weight-h)',
  fontSize: 15,
  letterSpacing: 'var(--display-tracking)',
  color: 'var(--ink)',
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function RoleBadge({ role }) {
  const isAdmin = role === 'admin'
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '.10em',
      textTransform: 'uppercase',
      padding: '2px 8px',
      borderRadius: 'var(--radius-pill)',
      background: isAdmin
        ? 'color-mix(in oklab, var(--primary) 12%, var(--surface))'
        : 'var(--bg-2)',
      color: isAdmin ? 'var(--primary)' : 'var(--ink-3)',
      border: '1px solid ' + (isAdmin
        ? 'color-mix(in oklab, var(--primary) 24%, transparent)'
        : 'var(--line)'),
    }}>
      {role}
    </span>
  )
}

function UserManagement() {
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [form, setForm] = useState({ username: '', password: '', role: 'worker', location_id: '' })
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchLocations()
  }, [])

  async function fetchUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, location_id, allowed_pages, locations(name)')
      .order('role')
    if (data) setUsers(data)
  }

  async function fetchLocations() {
    const { data } = await supabase.from('locations').select('id, name').order('name')
    if (data) setLocations(data)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('https://phstock-backend.onrender.com/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          location_id: form.role === 'worker' ? parseInt(form.location_id) : null
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setSuccess(`User "${form.username}" created.`)
      setForm({ username: '', password: '', role: 'worker', location_id: '' })
      fetchUsers()
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleUpdatePermissions(userId, page, grant) {
    const user = users.find(u => u.id === userId)
    const current = user?.allowed_pages || []
    const updated = grant
      ? [...new Set([...current, page])]
      : current.filter(p => p !== page)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, allowed_pages: updated } : u))
    const { error } = await supabase
      .from('profiles')
      .update({ allowed_pages: updated })
      .eq('id', userId)
    if (error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, allowed_pages: current } : u))
      setError('Failed to update permissions: ' + error.message)
    }
  }

  async function handleDelete(userId, username) {
    if (!confirm(`Delete user "${username}"?`)) return
    try {
      await fetch('https://phstock-backend.onrender.com/users/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })
      fetchUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="user-grid">

      {/* Create user */}
      <div style={card}>
        <div style={cardHeader}>Create user</div>
        <form onSubmit={handleCreate} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {success && (
            <div style={{
              fontSize: 13, color: 'var(--primary)',
              padding: '10px 14px',
              background: 'color-mix(in oklab, var(--primary) 8%, var(--surface))',
              border: '1px solid color-mix(in oklab, var(--primary) 20%, transparent)',
              borderRadius: 'var(--radius-input)',
            }}>
              {success}
            </div>
          )}
          {error && (
            <div style={{
              fontSize: 13, color: 'var(--warn)',
              padding: '10px 14px',
              background: 'color-mix(in oklab, var(--warn) 8%, var(--surface))',
              border: '1px solid color-mix(in oklab, var(--warn) 20%, transparent)',
              borderRadius: 'var(--radius-input)',
            }}>
              {error}
            </div>
          )}

          <div>
            <label style={label}>Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
              placeholder="username"
              className="field-input"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={label}>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              placeholder="••••••••"
              className="field-input"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={label}>Role</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['worker', 'admin'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm({ ...form, role: r, location_id: '' })}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-input)',
                    border: '1px solid ' + (form.role === r ? 'var(--primary)' : 'var(--line)'),
                    background: form.role === r
                      ? 'color-mix(in oklab, var(--primary) 10%, var(--surface))'
                      : 'var(--surface-2)',
                    color: form.role === r ? 'var(--primary)' : 'var(--ink-2)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all .15s var(--easing)',
                    textTransform: 'capitalize',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {form.role === 'worker' && (
            <div>
              <label style={label}>Assigned Location</label>
              <select
                value={form.location_id}
                onChange={e => setForm({ ...form, location_id: e.target.value })}
                required
                className="field-input"
                style={{ width: '100%' }}
              >
                <option value="">Select location</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px 0', fontSize: 14, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Creating…' : 'Create user'}
          </button>
        </form>
      </div>

      {/* Users list */}
      <div style={card}>
        <div style={{ ...cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>All users</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
            {users.length}
          </span>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {users.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--ink-3)', padding: '12px 8px' }}>No users yet.</p>
          )}
          {users.map(user => {
            const allowed = user.allowed_pages || []
            return (
            <div key={user.id} style={{
              borderRadius: 'var(--radius-input)',
              transition: 'background .12s var(--easing)',
            }}>
              {/* Main row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: user.role === 'admin'
                    ? 'color-mix(in oklab, var(--primary) 15%, var(--surface))'
                    : 'var(--bg-2)',
                  border: '1px solid ' + (user.role === 'admin'
                    ? 'color-mix(in oklab, var(--primary) 30%, transparent)'
                    : 'var(--line)'),
                  display: 'grid', placeItems: 'center',
                  fontSize: 11, fontWeight: 700,
                  color: user.role === 'admin' ? 'var(--primary)' : 'var(--ink-3)',
                  fontFamily: 'var(--font-sans)', flexShrink: 0,
                }}>
                  {initials(user.full_name)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>
                    {user.full_name}
                  </div>
                  {user.locations?.name && (
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                      {user.locations.name}
                    </div>
                  )}
                </div>

                <RoleBadge role={user.role} />

                <button
                  onClick={() => handleDelete(user.id, user.full_name)}
                  style={{
                    fontSize: 12, color: 'var(--ink-3)', fontWeight: 600,
                    padding: '4px 8px', borderRadius: 'var(--radius-input)',
                    transition: 'color .12s, background .12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--warn)'; e.currentTarget.style.background = 'color-mix(in oklab, var(--warn) 8%, transparent)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent' }}
                >
                  Delete
                </button>
              </div>

              {/* Permission toggles — workers only */}
              {user.role === 'worker' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '0 12px 12px 56px',
                }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', flexShrink: 0 }}>
                    View access
                  </span>
                  {[
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'history',   label: 'History' },
                    { id: 'reports',   label: 'Reports' },
                  ].map(({ id, label }) => {
                    const on = allowed.includes(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleUpdatePermissions(user.id, id, !on)}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 10px',
                          borderRadius: 'var(--radius-pill)',
                          border: '1px solid ' + (on ? 'color-mix(in oklab, var(--primary) 35%, transparent)' : 'var(--line)'),
                          background: on ? 'color-mix(in oklab, var(--primary) 12%, var(--surface))' : 'var(--surface-2)',
                          color: on ? 'var(--primary)' : 'var(--ink-3)',
                          cursor: 'pointer', transition: 'all .12s',
                        }}
                      >
                        {on ? '✓ ' : ''}{label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )})}

        </div>
      </div>

    </div>
  )
}

export default UserManagement
