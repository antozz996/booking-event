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
  const [eventi, setEventi] = useState([])
  const [activeTab, setActiveTab] = useState('prenotazioni')
  const [filtro, setFiltro] = useState('tutti')
  const [filtroEvento, setFiltroEvento] = useState('tutti')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  // Form Evento (Nuovo o Modifica)
  const [nuovoEvento, setNuovoEvento] = useState({ titolo: '', data: '', descrizione: '' })
  const [fileImmagine, setFileImmagine] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [savingEvento, setSavingEvento] = useState(false)

  function login() {
    if (inputPw === PASSWORD) { setAutenticato(true); setErrePw(false) }
    else setErrePw(true)
  }

  // Caricamento Dati
  useEffect(() => {
    if (!autenticato) return
    setLoading(true)
    
    // Fetch Prenotazioni
    const fetchPrenotazioni = supabase.from('prenotazioni').select('*').order('created_at', { ascending: false })
    // Fetch Eventi
    const fetchEventi = supabase.from('eventi').select('*').order('data', { ascending: true })

    Promise.all([fetchPrenotazioni, fetchEventi]).then(([resP, resE]) => {
      setDati(resP.data || [])
      setEventi(resE.data || [])
      setLoading(false)
    })
  }, [autenticato, refresh])

  function startEdit(ev) {
    setEditingId(ev.id)
    setNuovoEvento({ titolo: ev.titolo, data: ev.data, descrizione: ev.descrizione || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setNuovoEvento({ titolo: '', data: '', descrizione: '' })
    setFileImmagine(null)
  }

  async function salvaEvento(e) {
    e.preventDefault()
    if (!nuovoEvento.titolo || !nuovoEvento.data) return alert('Compila i campi obbligatori')
    setSavingEvento(true)

    let urlImmagine = editingId ? eventi.find(ev => ev.id === editingId)?.image_url : ''
    
    // Se c'è un nuovo file, caricalo
    if (fileImmagine) {
      const ext = fileImmagine.name.split('.').pop()
      const fileName = `${Math.random()}.${ext}`
      const { data, error } = await supabase.storage.from('event-images').upload(fileName, fileImmagine)
      if (error) {
        alert('Errore caricamento immagine: ' + error.message)
      } else {
        const { data: publicUrlData } = supabase.storage.from('event-images').getPublicUrl(fileName)
        urlImmagine = publicUrlData.publicUrl
      }
    }

    const payload = { ...nuovoEvento, image_url: urlImmagine }
    
    const { error } = editingId 
      ? await supabase.from('eventi').update(payload).eq('id', editingId)
      : await supabase.from('eventi').insert([payload])

    if (error) {
      alert('Errore salvataggio evento: ' + error.message)
    } else {
      resetForm()
      setRefresh(r => r + 1)
    }
    setSavingEvento(false)
  }

  async function eliminaEvento(id) {
    if (!confirm('Sei sicuro? Questo scollegherà le prenotazioni associate.')) return
    const { error } = await supabase.from('eventi').delete().eq('id', id)
    if (error) alert('Errore eliminazione: ' + error.message)
    else setRefresh(r => r + 1)
  }

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

  const filtrati = dati.filter(r => {
    const matchStatus = filtro === 'tutti' || r.status === filtro
    const matchEvento = filtroEvento === 'tutti' || r.id_evento === filtroEvento
    return matchStatus && matchEvento
  })

  const arrivati = filtrati.filter(r => r.status === 'arrivata').length
  const incassoPrevisto = filtrati.reduce((s, r) => s + (r.prezzo_totale || 0), 0)

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Lido Admin</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{dati.length} prenotazioni · {eventi.length} eventi</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setRefresh(r => r+1)} style={btnStyle('#f1f5f9','#374151')}>↻</button>
          <button onClick={() => setActiveTab('prenotazioni')} style={btnStyle(activeTab === 'prenotazioni' ? '#0284c7' : '#f1f5f9', activeTab === 'prenotazioni' ? '#fff' : '#374151')}>Prenotazioni</button>
          <button onClick={() => setActiveTab('eventi')} style={btnStyle(activeTab === 'eventi' ? '#0284c7' : '#f1f5f9', activeTab === 'eventi' ? '#fff' : '#374151')}>Calendario</button>
        </div>
      </div>

      {activeTab === 'prenotazioni' ? (
        <>
          {/* Contatori */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Incasso Previsto', val: `${incassoPrevisto}€`, color: '#0369a1' },
              { label: 'Arrivati', val: arrivati, color: '#16a34a' },
              { label: 'Adulti', val: filtrati.reduce((s,r) => s+r.num_adulti, 0), color: '#7c3aed' },
              { label: 'Bambini', val: filtrati.reduce((s,r) => s+r.num_bambini, 0), color: '#db2777' },
              { label: 'Lettini', val: filtrati.reduce((s,r) => s+r.num_lettini, 0), color: '#0f172a' },
            ].map(c => (
              <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 20px', flex: '1 1 150px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${c.color}` }}>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: c.color }}>{c.val}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{c.label}</p>
              </div>
            ))}
          </div>

          {/* Filtri */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['tutti','confermata','arrivata','annullata'].map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  style={btnStyle(filtro === f ? '#0284c7' : '#f8fafc', filtro === f ? '#fff' : '#374151', true)}>
                  {f === 'tutti' ? 'Tutti gli stati' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            
            <select value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)} 
              style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13 }}>
              <option value="tutti">Tutti gli eventi</option>
              {eventi.map(ev => (
                <option key={ev.id} value={ev.id}>{new Date(ev.data).toLocaleDateString('it-IT')} - {ev.titolo}</option>
              ))}
            </select>

            <button onClick={() => exportCSV(filtrati)} style={{ ...btnStyle('#0284c7','#fff'), marginLeft: 'auto' }}>Esporta CSV</button>
          </div>

          {/* Tabella */}
          {loading ? <p style={{ color: '#6b7280' }}>Caricamento...</p> : (
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {filtrati.length === 0 ? (
                <p style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>Nessuna prenotazione trovata</p>
              ) : filtrati.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 180px' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{r.nome} {r.cognome}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.email} · {r.telefono}</p>
                  </div>
                  
                  <div style={{ flex: '1 1 200px', fontSize: 12, color: '#374151' }}>
                    <div>👥 {r.num_adulti} + {r.num_bambini} | ⛱️ {r.num_lettini} lettini</div>
                    <div style={{ marginTop: 4, color: '#0369a1', fontWeight: 600 }}>
                      🍔 Pkg: {r.pkg_10_adulti}A, {r.pkg_10_bambini}B, {r.pkg_20_adulti}A
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
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
          {/* Form Evento */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', height: 'fit-content' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#0f172a' }}>{editingId ? 'Modifica Evento' : 'Aggiungi Evento'}</h3>
            <form onSubmit={salvaEvento}>
              <div style={inputGroup}>
                <label style={labelStyle}>Titolo Evento *</label>
                <input style={inputStyle} value={nuovoEvento.titolo} onChange={e => setNuovoEvento({...nuovoEvento, titolo: e.target.value})} placeholder="Es: Simba Party" />
              </div>
              <div style={inputGroup}>
                <label style={labelStyle}>Data *</label>
                <input type="date" style={inputStyle} value={nuovoEvento.data} onChange={e => setNuovoEvento({...nuovoEvento, data: e.target.value})} />
              </div>
              <div style={inputGroup}>
                <label style={labelStyle}>Immagine Copertina {editingId && '(Opzionale)'}</label>
                <input type="file" accept="image/*" onChange={e => setFileImmagine(e.target.files[0])} style={{ fontSize: 13 }} />
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{editingId ? 'Lascia vuoto per mantenere l\'attuale' : 'Salva nel bucket "event-images"'}</p>
              </div>
              <div style={inputGroup}>
                <label style={labelStyle}>Descrizione (opzionale)</label>
                <textarea style={{...inputStyle, height: 80, whiteSpace: 'pre-wrap'}} value={nuovoEvento.descrizione} onChange={e => setNuovoEvento({...nuovoEvento, descrizione: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={savingEvento} style={{ flex: 1, padding: 12, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                  {savingEvento ? 'Salvataggio...' : editingId ? 'Aggiorna Evento' : 'Salva Evento'}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} style={{ padding: 12, background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                    Annulla
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Lista Eventi */}
          <div style={{ display: 'grid', gap: 16 }}>
            {eventi.length === 0 ? <p style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>Nessun evento in calendario</p> : eventi.map(ev => (
              <div key={ev.id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', display: 'flex', border: editingId === ev.id ? '2px solid #0284c7' : 'none' }}>
                {ev.image_url ? (
                  <img src={ev.image_url} alt="" style={{ width: 140, height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 140, height: '100%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>No Image</div>
                )}
                <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>{new Date(ev.data).toLocaleDateString('it-IT')}</span>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button onClick={() => startEdit(ev)} style={{ padding: '2px 8px', color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Modifica</button>
                      <button onClick={() => eliminaEvento(ev.id)} style={{ padding: '2px 8px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Elimina</button>
                    </div>
                  </div>
                  <h4 style={{ margin: '4px 0', fontSize: 16, color: '#0f172a' }}>{ev.titolo}</h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b', flex: 1, whiteSpace: 'pre-wrap' }}>{ev.descrizione}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function btnStyle(bg, color, small = false) {
  return { padding: small ? '6px 12px' : '8px 16px', background: bg, color, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
}

const inputGroup = { marginBottom: 16 }
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }
const inputStyle = { width: '100%', padding: '10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }
