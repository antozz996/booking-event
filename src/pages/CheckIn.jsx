import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Html5Qrcode } from 'html5-qrcode'

export default function CheckIn() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [stato, setStato] = useState('idle') // idle | loading | ok | gia_arrivato | non_trovato | errore
  const [prenotazione, setPrenotazione] = useState(null)
  const [scanning, setScanning] = useState(!id)
  const [cameraError, setCameraError] = useState(null)
  const scannerInstanceRef = useRef(null)
  const scannerRunningRef = useRef(false)

  // Se c'è un UUID nell'URL, carica subito i dati
  useEffect(() => {
    if (id) caricaPrenotazione(id)
  }, [id])

  // Avvia scanner camera se non c'è UUID
  useEffect(() => {
    if (!scanning) return

    let cancelled = false

    // Piccolo delay per assicurarsi che il div sia renderizzato
    const timeout = setTimeout(() => {
      if (cancelled) return
      const el = document.getElementById('qr-reader')
      if (!el) {
        setCameraError('Elemento scanner non trovato.')
        return
      }

      const scanner = new Html5Qrcode('qr-reader')
      scannerInstanceRef.current = scanner

      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Estrai UUID dall'URL scansionato
          const match = decodedText.match(/\/check\/([a-f0-9-]{36})/)
          if (match) {
            scannerRunningRef.current = false
            scanner.stop().then(() => {
              setScanning(false)
              navigate(`/check/${match[1]}`)
            })
          }
        },
        () => {} // ignora errori di frame
      ).then(() => {
        scannerRunningRef.current = true
      }).catch(err => {
        console.error('Scanner error:', err)
        scannerRunningRef.current = false
        setCameraError('Camera non disponibile. Usa il link diretto dal QR code o concedi i permessi alla camera.')
      })
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      if (scannerInstanceRef.current && scannerRunningRef.current) {
        scannerRunningRef.current = false
        scannerInstanceRef.current.stop().catch(() => {})
      }
    }
  }, [scanning, navigate])

  async function caricaPrenotazione(uuid) {
    setStato('loading')
    const { data, error } = await supabase
      .from('prenotazioni')
      .select('*')
      .eq('id', uuid)
      .single()

    if (error || !data) { setStato('non_trovato'); return }
    setPrenotazione(data)
    setStato(data.status === 'arrivata' ? 'gia_arrivato' : 'ok')
  }

  async function confermaArrivo() {
    if (!prenotazione) return
    setStato('loading')
    const { error } = await supabase
      .from('prenotazioni')
      .update({ status: 'arrivata', checked_in_at: new Date().toISOString() })
      .eq('id', prenotazione.id)

    setStato(error ? 'errore' : 'gia_arrivato')
    if (!error) setPrenotazione(p => ({ ...p, status: 'arrivata' }))
  }

  // ---- UI ----

  if (scanning) return (
    <div style={s.container}>
      <div style={s.card}>
        <h2 style={{ margin: '0 0 16px', color: '#0f172a' }}>Scanner QR</h2>
        <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 20px' }}>Inquadra il QR code del cliente</p>
        {cameraError ? (
          <div style={{ background: '#fef2f2', borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <p style={{ color: '#dc2626', fontSize: 14, margin: '0 0 12px' }}>📷 {cameraError}</p>
            <button style={s.btnSecondary} onClick={() => { setCameraError(null); setScanning(true) }}>
              Riprova
            </button>
          </div>
        ) : (
          <div id="qr-reader" style={{ borderRadius: 12, overflow: 'hidden' }} />
        )}
      </div>
    </div>
  )

  if (stato === 'loading') return (
    <div style={{ ...s.container, ...s.center }}>
      <p style={{ color: '#6b7280' }}>Verifica in corso...</p>
    </div>
  )

  if (stato === 'non_trovato') return (
    <div style={{ ...s.container, ...s.center }}>
      <div style={{ ...s.card, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
        <h2 style={{ color: '#dc2626' }}>QR non valido</h2>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Nessuna prenotazione trovata con questo codice.</p>
        <button style={s.btnSecondary} onClick={() => { setScanning(true) }}>Riprova</button>
      </div>
    </div>
  )

  if (stato === 'gia_arrivato') return (
    <div style={{ ...s.container, ...s.center }}>
      <div style={{ ...s.card, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <h2 style={{ color: '#15803d' }}>Già registrato</h2>
        {prenotazione && (
          <p style={{ color: '#374151', fontSize: 15 }}>
            <strong>{prenotazione.nome} {prenotazione.cognome}</strong><br/>
            {prenotazione.num_adulti} adulti · {prenotazione.num_bambini} bambini
          </p>
        )}
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          Check-in: {prenotazione?.checked_in_at
            ? new Date(prenotazione.checked_in_at).toLocaleTimeString('it-IT')
            : '—'}
        </p>
        <button style={s.btnSecondary} onClick={() => navigate('/check')}>Prossimo cliente</button>
      </div>
    </div>
  )

  if (stato === 'ok' && prenotazione) return (
    <div style={{ ...s.container, ...s.center }}>
      <div style={{ ...s.card, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>👋</div>
        <h2 style={{ color: '#0f172a', margin: '0 0 4px' }}>
          {prenotazione.nome} {prenotazione.cognome}
        </h2>
        <p style={{ color: '#0284c7', fontSize: 14, margin: '0 0 20px' }}>
          {prenotazione.num_adulti} adulti · {prenotazione.num_bambini} bambini
        </p>
        {prenotazione.note && (
          <div style={{ background: '#fef9c3', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#713f12' }}>
            📝 {prenotazione.note}
          </div>
        )}
        <button style={s.btnPrimary} onClick={confermaArrivo}>
          ✅ Conferma arrivo
        </button>
        <button style={s.btnSecondary} onClick={() => navigate('/check')}>Annulla</button>
      </div>
    </div>
  )

  return null
}

const s = {
  container: { minHeight: '100vh', background: '#f0f9ff', padding: '24px 16px' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: '#fff', borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' },
  btnPrimary: { display: 'block', width: '100%', padding: '16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 18, fontWeight: 700, cursor: 'pointer', marginBottom: 10 },
  btnSecondary: { display: 'block', width: '100%', padding: '12px', background: 'transparent', color: '#6b7280', border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: 15, cursor: 'pointer', marginTop: 8 }
}
