import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const EVENTO = import.meta.env.VITE_EVENTO_NOME
const LIDO   = import.meta.env.VITE_LIDO_NOME

export default function Prenota() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState(null)
  const [form, setForm] = useState({
    nome: '', cognome: '', email: '', telefono: '',
    num_adulti: 1, num_bambini: 0, note: ''
  })

  function handle(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setErrore(null)

    const { data, error } = await supabase
      .from('prenotazioni')
      .insert([{ ...form, status: 'confermata' }])
      .select()
      .single()

    if (error) {
      setErrore('Errore durante la prenotazione. Riprova.')
      setLoading(false)
      return
    }

    // Triggera invio email (Fase 3)
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
      // Non bloccare il flusso se l'email fallisce
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <p style={styles.subtitle}>{LIDO}</p>
        <h1 style={styles.title}>{EVENTO}</h1>
        <p style={styles.desc}>Compila il modulo per riservare il tuo posto. Riceverai una email di conferma con il QR code da mostrare all'ingresso.</p>

        <form onSubmit={submit}>
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
                {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Note (opzionale)</label>
            <textarea style={{...styles.input, height: 80, resize: 'vertical'}}
              name="note" value={form.note} onChange={handle}
              placeholder="Allergie, esigenze particolari..." />
          </div>

          {errore && <p style={styles.error}>{errore}</p>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Invio in corso...' : 'Prenota il tuo posto →'}
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
  row: { display: 'flex', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', marginBottom: 16, flex: 1 },
  label: { fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 },
  input: { padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 12 },
  button: { width: '100%', padding: '14px 20px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 4 }
}
