import Link from 'next/link'

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#1A2130',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '24px',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{fontSize: '32px', fontWeight: '800', color: 'white', letterSpacing: '-1px'}}>
        Moov<span style={{color: '#2EC971'}}>enco</span>
      </div>
      <div style={{fontSize: '14px', color: 'rgba(255,255,255,0.5)'}}>
        Plateforme de gestion transport
      </div>
      <Link href="/planning" style={{
        background: '#0E5AA7',
        color: 'white',
        padding: '10px 24px',
        borderRadius: '8px',
        textDecoration: 'none',
        fontWeight: '600',
        fontSize: '13px'
      }}>
        Accéder au planning →
      </Link>
    </div>
  )
}