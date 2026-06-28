'use client'

import { useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import { getCurrentProfile } from '../../src/lib/auth'

const ROLE_REDIRECT: any = {
  super_admin:  '/planning',
  directeur:    '/planning',
  exploitant:   '/planning',
  commercial:   '/commercial',
  secretaire:   '/comptabilite',
  mecanicien:   '/atelier',
  conducteur:   '/planning',
}

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login')

  async function handleSubmit() {
    setLoading(true)
    setError('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      // Récupérer le profil pour rediriger vers la bonne page
      const profile = await getCurrentProfile()
      const redirect = profile?.role ? (ROLE_REDIRECT[profile.role] || '/planning') : '/planning'
      window.location.href = redirect
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setError('Vérifiez votre email pour confirmer votre compte.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1A2130', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '36px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-.5px', color: '#1A2130' }}>
            Moov<span style={{ color: '#2EC971' }}>enco</span>
          </div>
          <div style={{ fontSize: '11px', color: '#8A95A3', marginTop: '4px' }}>
            Plateforme de gestion transport
          </div>
        </div>

        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1A2130', marginBottom: '20px', textAlign: 'center' }}>
          {mode === 'login' ? 'Connexion' : 'Créer un compte'}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '5px' }}>Adresse email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="votre@email.com" onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #D0D4DA', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '5px' }}>Mot de passe</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #D0D4DA', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {error && (
          <div style={{ background: error.includes('Vérifiez') ? '#E8F5E9' : '#FFEBEE', color: error.includes('Vérifiez') ? '#1A9E50' : '#C62828', fontSize: '11px', padding: '8px 12px', borderRadius: '6px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', padding: '10px', background: loading ? '#8A95A3' : '#0E5AA7', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {loading ? 'Connexion…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: '#8A95A3' }}>
          {mode === 'login' ? (
            <>Pas encore de compte ? <span onClick={() => setMode('signup')} style={{ color: '#0E5AA7', cursor: 'pointer', fontWeight: '600' }}>Créer un compte</span></>
          ) : (
            <>Déjà un compte ? <span onClick={() => setMode('login')} style={{ color: '#0E5AA7', cursor: 'pointer', fontWeight: '600' }}>Se connecter</span></>
          )}
        </div>
      </div>
    </div>
  )
}
