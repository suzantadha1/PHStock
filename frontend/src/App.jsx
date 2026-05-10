import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Dashboard from './pages/Dashboard'
import AddEntry from './pages/AddEntry'
import History from './pages/History'
import Reports from './pages/Reports'
import Login from './pages/Login'
import UserManagement from './pages/UserManagement'

const PAGE_META = {
  dashboard: { eyebrow: 'Overview',  title: 'Dashboard' },
  add:        { eyebrow: 'Action',    title: 'Add entry' },
  history:    { eyebrow: 'Ledger',    title: 'History' },
  reports:    { eyebrow: 'Insights',  title: 'Reports' },
  users:      { eyebrow: 'Admin',     title: 'Users' },
}

export function Icon({ name, size = 16 }) {
  const s = size
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" {...stroke}/><rect x="14" y="3" width="7" height="5" {...stroke}/><rect x="14" y="12" width="7" height="9" {...stroke}/><rect x="3" y="16" width="7" height="5" {...stroke}/></>,
    plus:      <><line x1="12" y1="5" x2="12" y2="19" {...stroke}/><line x1="5" y1="12" x2="19" y2="12" {...stroke}/></>,
    history:   <><circle cx="12" cy="12" r="9" {...stroke}/><polyline points="12,7 12,12 16,14" {...stroke}/></>,
    report:    <><path d="M4 4 H14 L20 10 V20 H4 Z" {...stroke}/><polyline points="14,4 14,10 20,10" {...stroke}/><line x1="8" y1="14" x2="16" y2="14" {...stroke}/><line x1="8" y1="17" x2="13" y2="17" {...stroke}/></>,
    search:    <><circle cx="11" cy="11" r="6" {...stroke}/><line x1="20" y1="20" x2="16" y2="16" {...stroke}/></>,
    filter:    <><polygon points="4,5 20,5 14,12 14,19 10,17 10,12" {...stroke}/></>,
    download:  <><line x1="12" y1="4" x2="12" y2="15" {...stroke}/><polyline points="7,11 12,16 17,11" {...stroke}/><line x1="5" y1="20" x2="19" y2="20" {...stroke}/></>,
    up:        <><polyline points="6,15 12,9 18,15" {...stroke}/></>,
    down:      <><polyline points="6,9 12,15 18,9" {...stroke}/></>,
    users:     <><circle cx="9" cy="7" r="4" {...stroke}/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" {...stroke}/><line x1="19" y1="8" x2="19" y2="14" {...stroke}/><line x1="16" y1="11" x2="22" y2="11" {...stroke}/></>,
  }
  return <svg className="icn" width={s} height={s} viewBox="0 0 24 24">{paths[name]}</svg>
}

function MobNav({ page, setPage, items }) {
  return (
    <nav className="mob-nav">
      {items.map(it => (
        <button
          key={it.id}
          type="button"
          className={'mob-nav-item' + (page === it.id ? ' is-active' : '')}
          onClick={() => setPage(it.id)}
        >
          <Icon name={it.icon} size={22} />
          <span>{it.name}</span>
        </button>
      ))}
    </nav>
  )
}

function Sidebar({ page, setPage, onSignOut, items, profile }) {
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'ST'
  const displayName = profile?.full_name || 'Suzan T.'
  const roleLabel = profile?.role === 'admin' ? 'Admin · PH' : 'Worker · PH'

  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="sb-mark display">
          <span>PHStock</span>
        </div>
      </div>

      <div className="sb-section-label">Workspace</div>
      {items.map(it => (
        <button
          key={it.id}
          type="button"
          className={'sb-item' + (page === it.id ? ' is-active' : '')}
          onClick={() => setPage(it.id)}
        >
          <Icon name={it.icon} />
          <span>{it.name}</span>
        </button>
      ))}

      <div className="sb-spacer" />

      <div className="sb-foot">
        <div className="sb-user">
          <div className="sb-avatar">{initials}</div>
          <div>
            <div className="sb-user-name">{displayName}</div>
            <div className="sb-user-role">{roleLabel}</div>
          </div>
        </div>
        <button type="button" className="sb-item" style={{ color: 'var(--warn)', marginTop: 4 }} onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </aside>
  )
}

function TopBar({ page, onNewEntry, onCancel, searchQ, setSearchQ }) {
  const meta = PAGE_META[page]
  return (
    <div className="topbar">
      <div className="tb-title-wrap">
        <div>
          <div className="tb-eyebrow">{meta.eyebrow}</div>
          <div className="tb-title display">{meta.title}</div>
        </div>
      </div>
      <div className="tb-spacer" />
      <div className="tb-search">
        <Icon name="search" />
        <input
          placeholder="Search grade, location, date…"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        {searchQ && (
          <button type="button" onClick={() => setSearchQ('')} style={{ lineHeight: 1, color: 'var(--ink-3)' }}>✕</button>
        )}
      </div>
      {page !== 'add' ? (
        <button type="button" className="tb-btn is-primary" onClick={onNewEntry}>
          <Icon name="plus" /> New entry
        </button>
      ) : (
        <button type="button" className="tb-btn is-ghost" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  )
}

function FilterBar({ locations, activeLoc, setActiveLoc }) {
  return (
    <div className="filterbar">
      <div className="fb-label">Cold storage</div>
      <button
        type="button"
        className={'chip' + (activeLoc === 'all' ? ' is-on' : '')}
        onClick={() => setActiveLoc('all')}
      >
        <span>All</span>
      </button>
      {locations.map(l => (
        <button
          key={l.id}
          type="button"
          className={'chip' + (activeLoc === l.id ? ' is-on' : '')}
          onClick={() => setActiveLoc(l.id)}
        >
          <span>{l.name}</span>
        </button>
      ))}
      <div className="tb-spacer" />
      <button type="button" className="chip" style={{ color: 'var(--ink-3)' }}>
        <Icon name="filter" size={12} />
        More filters
      </button>
    </div>
  )
}

const ADMIN_NAV = [
  { id: 'dashboard', name: 'Dashboard', icon: 'dashboard' },
  { id: 'add',       name: 'Add Entry', icon: 'plus' },
  { id: 'history',   name: 'History',   icon: 'history' },
  { id: 'reports',   name: 'Reports',   icon: 'report' },
  { id: 'users',     name: 'Users',     icon: 'users' },
]

const WORKER_NAV = [
  { id: 'add', name: 'Add Entry', icon: 'plus' },
]

function App() {
  const [page, setPage] = useState('dashboard')
  const [activeLoc, setActiveLoc] = useState('all')
  const [locations, setLocations] = useState([])
  const [searchQ, setSearchQ] = useState('')
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'field')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) fetchProfile()
  }, [session])

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('role, location_id, full_name')
      .eq('id', session.user.id)
      .single()
    if (data) {
      setProfile(data)
      if (data.role !== 'admin') setPage('add')
    }
  }

  useEffect(() => {
    supabase.from('locations').select('id, name').order('name').then(({ data }) => {
      if (data) setLocations(data)
    })
  }, [])

  function navigateTo(p) {
    setPage(p)
    setSearchQ('')
  }

  const isAdmin = profile?.role === 'admin'
  const navItems = isAdmin ? ADMIN_NAV : WORKER_NAV

  if (authLoading || (session && !profile)) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}>
      Loading…
    </div>
  )
  if (!session) return <Login />

  return (
    <div className="app">
      <Sidebar page={page} setPage={navigateTo} onSignOut={() => supabase.auth.signOut()} items={navItems} profile={profile} />
      <main className="main">
        <TopBar
          page={page}
          onNewEntry={() => navigateTo('add')}
          onCancel={() => navigateTo(isAdmin ? 'dashboard' : 'add')}
          searchQ={searchQ}
          setSearchQ={setSearchQ}
        />
        {page !== 'add' && page !== 'users' && isAdmin && (
          <FilterBar locations={locations} activeLoc={activeLoc} setActiveLoc={setActiveLoc} />
        )}
        <div className="pagebody">
          {page === 'dashboard' && isAdmin && <Dashboard activeLoc={activeLoc} locations={locations} onNavigate={navigateTo} />}
          {page === 'add'       && <AddEntry profile={profile} defaultLoc={activeLoc} locations={locations} onSaved={() => navigateTo(isAdmin ? 'dashboard' : 'add')} />}
          {page === 'history'   && isAdmin && <History activeLoc={activeLoc} locations={locations} searchQ={searchQ} profile={profile} />}
          {page === 'reports'   && isAdmin && <Reports activeLoc={activeLoc} locations={locations} />}
          {page === 'users'     && isAdmin && <UserManagement />}
        </div>
      </main>
      <MobNav page={page} setPage={navigateTo} items={navItems} />
    </div>
  )
}

export default App
