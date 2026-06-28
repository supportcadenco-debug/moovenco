export default function AccesRefuse() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#ECEEF1', gap: '16px' }}>
      <div style={{ fontSize: '48px' }}>🔒</div>
      <div style={{ fontSize: '20px', fontWeight: '700', color: '#1A2130' }}>Accès refusé</div>
      <div style={{ fontSize: '13px', color: '#8A95A3' }}>Vous n'avez pas les droits pour accéder à cette page.</div>
      <a href="/planning" style={{ background: '#0E5AA7', color: 'white', padding: '8px 20px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>
        Retour à l'accueil
      </a>
    </div>
  )
}