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

  useEffect(() => {
    if (id) caricaPrenotazione(id)
  }, [id])

  useEffect(() => {
    if (!scanning) return

    let cancelled = false
    const timeout = setTimeout(() => {
      if (cancelled) return
      const el = document.getElementById('qr-reader')
      if (!el) return
      
      const scanner = new Html5Qrcode('qr-reader')
      scannerInstanceRef.current = scanner

      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const match = decodedText.match(/\/check\/([a-f0-9-]{36})/)
          if (match) {
            scannerRunningRef.current = false
            scanner.stop().then(() => {
              setScanning(false)
              navigate(`/check/${match[1]}`)
            })
          }
        },
        () => {}
      ).then(() => {
        scannerRunningRef.current = true
      }).catch(err => {
        console.error('Scanner error:', err)
        scannerRunningRef.current = false
        setCameraError('Camera non disponibile. Usa il link diretto o concedi i permessi.')
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
      .select('*, eventi(*)')
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

  if (scanning) return (
    <div style={s.container}>
      <div style={s.card}>
        <h2 style={{ margin: '0 0 16px', color: '#0f172a' }}>Scanner QR Staff</h2>
        <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 20px' }}>Inquadra il QR code per validare l'ingresso.</p>
        {cameraError ? (
          <div style={{ background: '#fef2f2', borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <p style={{ color: '#dc2626', fontSize: 14, margin: '0 0 12px' }}>📷 {cameraError}</p>
            <button style={s.btnSecondary} onClick={() => { setCameraError(null); setScanning(true) }}>Riprova</button>
          </div>
        ) : (
          <div id="qr-reader" style={{ borderRadius: 12, overflow: 'hidden' }} />
        )}
        <button style={{ ...s.btnSecondary, marginTop: 20 }} onClick={() => navigate('/admin')}>Torna al pannello</button>
      </div>
    </div>
  )

  if (stato === 'loading') return (
    <div style={{ ...s.container, ...s.center }}><p>Verifica in corso...</p></div>
  )

  if (stato === 'non_trovato') return (
    <div style={{ ...s.container, ...s.center }}>
      <div style={{ ...s.card, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
        <h2 style={{ color: '#dc2626' }}>Codice non valido</h2>
        <button style={s.btnSecondary} onClick={() => { setScanning(true) }}>Scansiona altro</button>
      </div>
    </div>
  )

  if (stato === 'gia_arrivato' || stato === 'ok') {
    const ev = prenotazione?.eventi
    return (
      <div style={{ ...s.container, ...s.center }}>
        <div style={{ ...s.card, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{stato === 'gia_arrivato' ? '✅' : '👋'}</div>
          
          <h4 style={{ margin: 0, fontSize: 13, color: '#0284c7', textTransform: 'uppercase' }}>
            {ev ? `${new Date(ev.data).toLocaleDateString('it-IT')} — ${ev.titolo}` : 'Evento sconosciuto'}
          </h4>
          
          <h2 style={{ color: '#0f172a', margin: '4px 0 12px' }}>
            {prenotazione.nome} {prenotazione.cognome}
          </h2>
          
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <p style={{ margin: '0 0 4px', fontSize: 14 }}>👥 {prenotazione.num_adulti} Ad. + {prenotazione.num_bambini} Bamb.</p>
            {prenotazione.num_lettini > 0 && <p style={{ margin: 0, fontSize: 14 }}>⛱️ {prenotazione.num_lettini} Lettini</p>}
            <p style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 700, color: '#0369a1' }}>Totale: {prenotazione.prezzo_totale}€</p>
          </div>

          {prenotazione.note && (
            <div style={{ background: '#fef9c3', borderRadius: 8, padding: 10, marginBottom: 20, fontSize: 13, color: '#713f12' }}>
              📝 {prenotazione.note}
            </div>
          )}

          {stato === 'ok' ? (
            <button style={s.btnPrimary} onClick={confermaArrivo}>✅ Conferma Arrivo</button>
          ) : (
            <p style={{ color: '#16a34a', fontWeight: 600, marginBottom: 16 }}>INGRESSO GIÀ REGISTRATO</p>
          )}
          
          <button style={s.btnSecondary} onClick={() => navigate('/check')}>Prossimo cliente</button>
        </div>
      </div>
    )
  }

  return null
}

const s = {
  container: { minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: '#fff', borderRadius: 20, padding: 32, maxWidth: 400, width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' },
  btnPrimary: { display: 'block', width: '100%', padding: '16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 18, fontWeight: 700, cursor: 'pointer', marginBottom: 10 },
  btnSecondary: { display: 'block', width: '100%', padding: '12px', background: 'transparent', color: '#6b7280', border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: 15, cursor: 'pointer', marginTop: 8 }
}
