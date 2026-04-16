import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

function exportCSV(righe) {
  const headers = ['Nome','Cognome','Email','Telefono','Adulti','Bambini','Pkg 10A','Pkg 10B','Pkg 20A','Lettini','Totale (€)','Status','Prenotato il','Check-in']
  const rows = righe.map(r => [
    r.nome, r.cognome, r.email, r.telefono,
    r.num_adulti, r.num_bambini, 
    r.pkg_10_adulti, r.pkg_10_bambini, r.pkg_20_adulti,
    r.num_lettini, r.prezzo_totale,
    r.status,
    new Date(r.created_at).toLocaleString('it-IT'),
    r.checked_in_at ? new Date(r.checked_in_at).toLocaleString('it-IT') : ''
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'prenotazioni_simba.csv'; a.click()
}

export default function Admin() {
  const [autenticato, setAutenticato] = useState(false)
  const [inputPw, setInputPw] = useState('')
  const [errePw, setErrePw] = useState(false)
  const [dati, setDati] = useState([])
  const [filtro, setFiltro] = useState('tutti')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  function login() {
    if (inputPw === PASSWORD) { setAutenticato(true); setErrePw(false) }
    else setErrePw(true)
  }

  useEffect(() => {
    if (!autenticato) return
    setLoading(true)
    supabase.from('prenotazioni').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setDati(data || []); setLoading(false) })
  }, [autenticato, refresh])

  if (!autenticato) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, maxWidth: 360, width: '100%', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <h2 style={{ margin: '0 0 20px' }}>Accesso staff</h2>
        <input type="password" value={inputPw} onChange={e => setInputPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          placeholder="Password" style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 16, marginBottom: 12, boxSizing: 'border-box' }} />
        {errePw && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 12px' }}>Password errata</p>}
        <button onClick={login} style={{ width: '100%', padding: 14, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
          Accedi
        </button>
      </div>
    </div>
  )

  const filtrati = filtro === 'tutti' ? dati : dati.filter(r => r.status === filtro)
  const arrivati = dati.filter(r => r.status === 'arrivata').length
  const incassoPrevisto = filtrati.reduce((s, r) => s + (r.prezzo_totale || 0), 0)

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Dashboard Simba</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{dati.length} prenotazioni · {arrivati} arrivati</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setRefresh(r => r+1)} style={btnStyle('#f1f5f9','#374151')}>↻ Aggiorna</button>
          <button onClick={() => exportCSV(filtrati)} style={btnStyle('#0284c7','#fff')}>⬇ CSV</button>
        </div>
      </div>

      {/* Contatori */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Totale Incasso', val: `${incassoPrevisto}€`, color: '#0369a1' },
          { label: 'Arrivati', val: arrivati, color: '#16a34a' },
          { label: 'Adulti', val: dati.reduce((s,r) => s+r.num_adulti, 0), color: '#7c3aed' },
          { label: 'Bambini', val: dati.reduce((s,r) => s+r.num_bambini, 0), color: '#db2777' },
          { label: 'Lettini', val: dati.reduce((s,r) => s+r.num_lettini, 0), color: '#0f172a' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 20px', flex: '1 1 150px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${c.color}` }}>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: c.color }}>{c.val}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['tutti','confermata','arrivata','annullata'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={btnStyle(filtro === f ? '#0284c7' : '#f1f5f9', filtro === f ? '#fff' : '#374151')}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Tabella */}
      {loading ? <p style={{ color: '#6b7280' }}>Caricamento...</p> : (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {filtrati.length === 0 ? (
            <p style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>Nessuna prenotazione</p>
          ) : filtrati.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 180px' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{r.nome} {r.cognome}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.email} · {r.telefono}</p>
              </div>
              
              <div style={{ flex: '1 1 200px', fontSize: 12, color: '#374151' }}>
                <div>👥 {r.num_adulti} + {r.num_bambini} | ⛱️ {r.num_lettini} lettini</div>
                <div style={{ marginTop: 4, color: '#0369a1', fontWeight: 600 }}>
                  🍔 Pkg: {r.pkg_10_adulti}A(10€), {r.pkg_10_bambini}B(10€), {r.pkg_20_adulti}A(20€)
                </div>
              </div>

              <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0369a1' }}>{r.prezzo_totale}€</p>
                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: r.status === 'arrivata' ? '#dcfce7' : r.status === 'annullata' ? '#fee2e2' : '#e0f2fe',
                  color: r.status === 'arrivata' ? '#15803d' : r.status === 'annullata' ? '#dc2626' : '#0284c7'
                }}>
                  {r.status}
                </span>
              </div>

              <div style={{ flex: '0 0 auto', fontSize: 11, color: '#94a3b8', width: 80, textAlign: 'right' }}>
                {new Date(r.created_at).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'})}<br/>
                {new Date(r.created_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function btnStyle(bg, color) {
  return { padding: '8px 16px', background: bg, color, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
}
