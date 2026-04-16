import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const EVENTO = import.meta.env.VITE_EVENTO_NOME
const LIDO   = import.meta.env.VITE_LIDO_NOME

export default function Prenota() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState(null)
  const [confermato, setConfermato] = useState(false)
  const [form, setForm] = useState({
    nome: '', cognome: '', email: '', telefono: '',
    num_adulti: 1, num_bambini: 0, 
    pkg_10_adulti: 0, pkg_10_bambini: 0, pkg_20_adulti: 0,
    num_lettini: 0, note: '', prezzo_totale: 0
  })

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

    const { data, error } = await supabase
      .from('prenotazioni')
      .insert([{ ...form, status: 'confermata' }])
      .select()
      .single()

    if (error) {
      console.error(error)
      setErrore('Errore durante la prenotazione. Riprova.')
      setLoading(false)
      return
    }

    await sendEmail(data)
    navigate('/conferma', { state: { prenotazione: data } })
  }

  async function sendEmail(prenotazione) {
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prenotazione)
      })
    } catch (err) {
      console.error('Errore invio email:', err)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <p style={styles.subtitle}>{LIDO}</p>
        <h1 style={styles.title}>{EVENTO}</h1>
        <p style={styles.desc}>Riserva il tuo posto e scegli i pacchetti food & drink. Riceverai il QR code via email.</p>

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

          <h3 style={styles.sectionTitle}>Food & Drink (opzionali)</h3>
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

          <div style={styles.field}>
            <label style={styles.label}>Note (opzionale)</label>
            <textarea style={{...styles.input, height: 60, resize: 'vertical'}}
              name="note" value={form.note} onChange={handle}
              placeholder="Allergie o esigenze particolari..." />
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
            {loading ? 'Invio in corso...' : `Prenota ed effettua check-in all'arrivo →`}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f9ff', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px' },
  card: { background: '#fff', borderRadius: 16, padding: 32, maxWidth: 520, width: '100%', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' },
  subtitle: { color: '#0284c7', fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' },
  title: { fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#0f172a' },
  desc: { color: '#64748b', fontSize: 14, margin: '0 0 24px', lineHeight: 1.6 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: 8, marginTop: 24, marginBottom: 16 },
  row: { display: 'flex', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', marginBottom: 16, flex: 1 },
  label: { fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 },
  input: { padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
  totalBox: { background: '#f0f9ff', borderRadius: 12, padding: 16, textAlign: 'center', marginTop: 10, border: '1px dashed #0284c7' },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 12, fontWeight: 500 },
  button: { width: '100%', padding: '14px 20px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 4 }
}
