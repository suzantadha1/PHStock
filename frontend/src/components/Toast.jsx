import { useEffect, useState } from 'react'

function Toast({ message, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 10)
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: 32,
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? 0 : -20}px)`,
      opacity: visible ? 1 : 0,
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      background: 'var(--grade-a)',
      color: '#fff',
      padding: '12px 24px',
      borderRadius: 100,
      fontWeight: 600,
      fontSize: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 16 }}>✓</span>
      {message}
    </div>
  )
}

export default Toast
