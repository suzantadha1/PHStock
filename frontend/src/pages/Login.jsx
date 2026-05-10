import { useState } from 'react'
import { supabase } from '../supabaseClient'

const DOMAIN = '@phstock.local'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const email = username.trim().toLowerCase() + DOMAIN
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Invalid username or password')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-2)',
        border: '1px solid var(--line)',
        overflow: 'hidden',
      }}>

        {/* Header strip */}
        <div style={{
          padding: '32px 32px 28px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg-2)',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 'var(--weight-h)',
            letterSpacing: 'var(--display-tracking)',
            color: 'var(--ink)',
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            lineHeight: 1,
          }}>
            PHStock
            <span style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--primary)',
              transform: 'translateY(-4px)',
            }} />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{
          padding: '28px 32px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '.10em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              fontWeight: 600,
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              placeholder="username"
              autoComplete="username"
              autoFocus
              className="field-input"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '.10em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              fontWeight: 600,
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
              className="field-input"
            />
          </div>

          {error && (
            <div style={{
              fontSize: 13,
              color: 'var(--warn)',
              padding: '10px 14px',
              background: 'color-mix(in oklab, var(--warn) 8%, var(--surface))',
              border: '1px solid color-mix(in oklab, var(--warn) 20%, transparent)',
              borderRadius: 'var(--radius-input)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '11px 0',
              fontSize: 14,
              marginTop: 4,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
