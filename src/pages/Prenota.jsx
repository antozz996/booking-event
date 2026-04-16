import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const LIDO = import.meta.env.VITE_LIDO_NOME

export default function Prenota() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [fetchingEvents, setFetchingEvents] = useState(true)
  const [errore, setErrore] = useState(null)
  
  const [eventi, setEventi] = useState([])
  const [eventoScelto, setEventoScelto] = useState(null)
  
  const [confermato, setConfermato] = useState(false)
  const [form, setForm] = useState({
    nome: '', cognome: '', email: '', telefono: '',
    num_adulti: 1, num_bambini: 0, 
    pkg_10_adulti: 0, pkg_10_bambini: 0, pkg_20_adulti: 0,
    num_lettini: 0, note: '', prezzo_totale: 0
  })

  // Caricamento eventi disponibili
  useEffect(() => {
    supabase.from('eventi')
      .select('*')
      .eq('is_active', true)
      .gte('data', new Date().toISOString().split('T')[0])
      .order('data', { ascending: true })
      .then(({ data, error }) => {
        if (data && data.length > 0) {
          setEventi(data)
        }
        setFetchingEvents(false)
      })
  }, [])

  // Calcolo totale dinamico
  useEffect(() => {
    const totale = 
      (Number(form.pkg_10_adulti) * 10) +
      (Number(form.pkg_10_bambini) * 10) +
      (Number(form.pkg_20_adulti) * 20) +
      (Number(form.num_lettini) * 6)
    
    setForm(f => ({ ...f, prezzo_totale: totale }))
  }, [form.pkg_10_adulti, form.pkg_10_bambini, form.pkg_20_adulti, form.num_lettini])

  function handle(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!confermato) {
      setErrore('Devi confermare di aver preso visione delle modalità di pagamento.')
      return
    }
    setLoading(true)
    setErrore(null)

    const payload = {
      ...form,
      id_evento: eventoScelto.id,
      status: 'confermata'
    }

    const { data, error } = await supabase
      .from('prenotazioni')
      .insert([payload])
      .select()
      .single()

    if (error) {
      console.error(error)
      setErrore('Errore durante la prenotazione. Riprova.')
      setLoading(false)
      return
    }

    // Invia email includendo i dati dell'evento
    await sendEmail({ ...data, evento: eventoScelto })
    navigate('/conferma', { state: { prenotazione: data } })
  }

  async function sendEmail(payload) {
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch (err) {
      console.error('Errore invio email:', err)
    }
  }

  if (fetchingEvents) return (
    <div style={styles.container}>
      <p style={{ color: '#64748b' }}>Caricamento calendario...</p>
    </div>
  )

  if (eventi.length === 0) return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Al momento non ci sono eventi prenotabili</h1>
        <p style={styles.desc}>Torna a trovarci presto!</p>
      </div>
    </div>
  )

  // Schermo Selezione Data
  if (!eventoScelto) return (
    <div style={styles.container}>
      <div style={{ maxWidth: 600, width: '100%' }}>
        <p style={styles.subtitle}>{LIDO}</p>
        <h1 style={{ ...styles.title, fontSize: 28, marginBottom: 24 }}>Scegli una data</h1>
        <div style={{ display: 'grid', gap: 20 }}>
          {eventi.map(ev => (
            <div key={ev.id} onClick={() => setEventoScelto(ev)} style={styles.eventCard}>
              {ev.image_url && <img src={ev.image_url} alt="" style={{ ...styles.eventImg, objectPosition: `center ${ev.image_position}%` }} />}
              <div style={styles.eventContent}>
                <span style={styles.eventDate}>{new Date(ev.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</span>
                <h3 style={styles.eventTitle}>{ev.titolo}</h3>
                <p style={styles.eventDesc}>{ev.descrizione}</p>
                <div style={styles.eventBtn}>Prenota per questa data →</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // Schermo Form Prenotazione
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button onClick={() => setEventoScelto(null)} style={styles.backBtn}>← Cambia data</button>
        
        {eventoScelto.image_url && (
            <img 
              src={eventoScelto.image_url} 
              alt="" 
              style={{ 
                width: 'calc(100% + 64px)', 
                margin: '-32px -32px 24px', 
                aspectRatio: '1 / 1', 
                objectFit: 'cover',
                objectPosition: `center ${eventoScelto.image_position}%`
              }} 
            />
        )}
        
        <p style={styles.subtitle}>{LIDO}</p>
        <h1 style={styles.title}>{eventoScelto.titolo}</h1>
        <p style={styles.desc}>{eventoScelto.descrizione || 'Riserva il tuo posto e scegli i pacchetti food & drink.'}</p>
        <p style={{ ...styles.subtitle, color: '#0f172a', marginBottom: 24 }}>📅 {new Date(eventoScelto.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <form onSubmit={submit}>
          <h3 style={styles.sectionTitle}>Dati Personali</h3>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Nome *</label>
              <input style={styles.input} name="nome" value={form.nome}
                onChange={handle} required placeholder="Mario" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Cognome *</label>
              <input style={styles.input} name="cognome" value={form.cognome}
                onChange={handle} required placeholder="Rossi" />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email *</label>
            <input style={styles.input} name="email" type="email" value={form.email}
              onChange={handle} required placeholder="mario@email.com" />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Telefono *</label>
            <input style={styles.input} name="telefono" type="tel" value={form.telefono}
              onChange={handle} required placeholder="+39 333 1234567" />
          </div>

          <h3 style={styles.sectionTitle}>Numero Persone</h3>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Adulti *</label>
              <select style={styles.input} name="num_adulti" value={form.num_adulti} onChange={handle}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Bambini</label>
              <select style={styles.input} name="num_bambini" value={form.num_bambini} onChange={handle}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <h3 style={styles.sectionTitle}>Food & Drink</h3>
          <div style={styles.field}>
            <label style={styles.label}>Pacchetto 10€ ADULTI (Spritz incluso)</label>
            <select style={styles.input} name="pkg_10_adulti" value={form.pkg_10_adulti} onChange={handle}>
              {[0,1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Pacchetto 10€ BAMBINI (Laboratorio incluso)</label>
            <select style={styles.input} name="pkg_10_bambini" value={form.pkg_10_bambini} onChange={handle}>
              {[0,1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Pacchetto 20€ ADULTI (Acqua+Food+Patatine+Dolce)</label>
            <select style={styles.input} name="pkg_20_adulti" value={form.pkg_20_adulti} onChange={handle}>
              {[0,1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <h3 style={styles.sectionTitle}>Servizi Spiaggia</h3>
          <div style={styles.field}>
            <label style={styles.label}>Numero Lettini (6€ l'uno)</label>
            <select style={styles.input} name="num_lettini" value={form.num_lettini} onChange={handle}>
              {[0,1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div style={styles.totalBox}>
            <p style={{ margin: 0, fontSize: 14 }}>Totale da pagare all'arrivo:</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0369a1' }}>{form.prezzo_totale}€</p>
          </div>

          <div style={{ display: 'flex', gap: 10, margin: '20px 0', alignItems: 'flex-start' }}>
            <input type="checkbox" id="checkConferma" checked={confermato} 
              onChange={(e) => setConfermato(e.target.checked)} 
              style={{ marginTop: 4 }} />
            <label htmlFor="checkConferma" style={{ fontSize: 13, color: '#4b5563', cursor: 'pointer' }}>
              Confermo di aver compreso che il pagamento dei servizi selezionati avverrà direttamente al checkout della struttura.
            </label>
          </div>

          {errore && <p style={styles.error}>{errore}</p>}

          <button type="submit" disabled={loading} style={{...styles.button, opacity: loading ? 0.7 : 1}}>
            {loading ? 'Invio in corso...' : `Conferma Prenotazione →`}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px' },
  card: { background: '#fff', borderRadius: 24, padding: 32, maxWidth: 520, width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' },
  subtitle: { color: '#0284c7', fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' },
  title: { fontSize: 24, fontWeight: 800, margin: '0 0 8px', color: '#0f172a' },
  desc: { color: '#64748b', fontSize: 15, margin: '0 0 24px', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: 8, marginTop: 24, marginBottom: 16 },
  row: { display: 'flex', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', marginBottom: 16, flex: 1 },
  label: { fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 },
  input: { padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
  totalBox: { background: '#f0f9ff', borderRadius: 16, padding: 20, textAlign: 'center', marginTop: 10, border: '1px solid #bae6fd' },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 12, fontWeight: 500 },
  button: { width: '100%', padding: '16px 20px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  backBtn: { background: 'none', border: 'none', color: '#64748b', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 20 },
  eventCard: { background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', display: 'flex', cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid #f1f5f9' },
  eventImg: { width: 200, height: 200, objectFit: 'cover' },
  eventContent: { padding: 20, flex: 1 },
  eventDate: { fontSize: 12, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' },
  eventTitle: { margin: '4px 0', fontSize: 18, color: '#0f172a' },
  eventDesc: { margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.4, whiteSpace: 'pre-wrap' },
  eventBtn: { marginTop: 12, fontSize: 13, fontWeight: 600, color: '#0284c7' }
}
