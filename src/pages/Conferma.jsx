import { useLocation } from 'react-router-dom'

export default function Conferma() {
  const { state } = useLocation()
  const p = state?.prenotazione

  return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h1 style={{ color: '#15803d', marginBottom: 8 }}>Prenotazione confermata!</h1>
        {p && <p style={{ color: '#374151', fontSize: 15 }}>
          Ciao <strong>{p.nome}</strong>, abbiamo registrato la tua prenotazione per {p.num_adulti} adulti{p.num_bambini > 0 ? ` e ${p.num_bambini} bambini` : ''}.
        </p>}
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 16 }}>
          Controlla la tua email — riceverai il QR code da mostrare all'ingresso.
        </p>
      </div>
    </div>
  )
}
