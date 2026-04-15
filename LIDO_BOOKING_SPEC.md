# LIDO BOOKING SYSTEM — Specifiche Antigravity
**Stack:** React + Vite · Supabase · Resend · Vercel  
**Deploy target:** Vercel (gratuito)  
**Obiettivo:** Form prenotazione eventi lido, email con QR univoco, check-in via scanner camera, dashboard admin.

---

## STRUTTURA PROGETTO

```
lido-booking/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── pages/
│   │   ├── Prenota.jsx        ← form pubblico (iframe in WordPress)
│   │   ├── Conferma.jsx       ← pagina post-submit
│   │   ├── CheckIn.jsx        ← scanner QR staff
│   │   └── Admin.jsx          ← dashboard prenotazioni
│   ├── components/
│   │   ├── QrScanner.jsx
│   │   └── PrenotazioneCard.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   └── resend.js          ← wrapper chiamata API
│   └── styles/
│       └── global.css
├── .env.local                 ← NON committare
├── vite.config.js
└── package.json
```

---

## SCHEMA DATABASE — Supabase

```sql
-- Eseguire nella SQL Editor di Supabase

create table prenotazioni (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),

  -- Dati cliente
  nome        text not null,
  cognome     text not null,
  email       text not null,
  telefono    text not null,

  -- Dati evento
  num_adulti  integer not null default 1,
  num_bambini integer not null default 0,
  note        text,

  -- Stato
  status      text not null default 'attesa'
              check (status in ('attesa', 'confermata', 'arrivata', 'annullata')),
  checked_in_at timestamptz
);

-- RLS: permetti insert pubblico (form clienti)
alter table prenotazioni enable row level security;

create policy "chiunque può prenotare"
  on prenotazioni for insert
  with check (true);

create policy "solo admin legge tutto"
  on prenotazioni for select
  using (true);   -- per semplicità; in prod usa auth

create policy "solo admin aggiorna"
  on prenotazioni for update
  using (true);
```

---

## VARIABILI D'AMBIENTE

```env
# .env.local
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
VITE_RESEND_API_KEY=re_...
VITE_APP_URL=https://tuaapp.vercel.app
VITE_ADMIN_PASSWORD=scegli_una_password_sicura
VITE_EVENTO_NOME=Evento Famiglie - Domenica 20 Luglio
VITE_LIDO_NOME=Lido [Nome]
```

> ⚠️ Su Vercel aggiungere le stesse variabili in Settings → Environment Variables.

---

---

# FASE 1 — Setup progetto e connessione Supabase

**Obiettivo:** progetto Vite funzionante, connessione DB verificata, routing base.

## Dipendenze da installare

```bash
npm create vite@latest lido-booking -- --template react
cd lido-booking
npm install @supabase/supabase-js react-router-dom
```

## File: `src/lib/supabase.js`

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

## File: `src/App.jsx`

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Prenota    from './pages/Prenota'
import Conferma   from './pages/Conferma'
import CheckIn    from './pages/CheckIn'
import Admin      from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Prenota />} />
        <Route path="/prenota"   element={<Prenota />} />
        <Route path="/conferma"  element={<Conferma />} />
        <Route path="/check/:id" element={<CheckIn />} />
        <Route path="/admin"     element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}
```

## File: `src/pages/Prenota.jsx` (placeholder Fase 1)

```jsx
import { supabase } from '../lib/supabase'
import { useState } from 'react'

export default function Prenota() {
  const [status, setStatus] = useState('idle')

  async function test() {
    setStatus('testing...')
    const { error } = await supabase.from('prenotazioni').select('id').limit(1)
    setStatus(error ? '❌ ' + error.message : '✅ Supabase connesso')
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Test connessione</h1>
      <button onClick={test}>Testa Supabase</button>
      <p>{status}</p>
    </div>
  )
}
```

## ✅ CHECKLIST FASE 1

Eseguire questi controlli prima di procedere alla Fase 2:

- [ ] `npm run dev` avvia senza errori in console
- [ ] Cliccando "Testa Supabase" appare `✅ Supabase connesso`
- [ ] Navigare su `/admin`, `/check/test`, `/conferma` — nessun crash (pagine vuote ok per ora)
- [ ] Tabella `prenotazioni` visibile in Supabase → Table Editor
- [ ] Le policy RLS sono attive (icona lucchetto verde su Supabase)

**🛑 NON procedere alla Fase 2 se Supabase dà errore di connessione.**  
Cause comuni: URL o ANON_KEY sbagliata nel `.env.local`, oppure il file non è stato salvato prima di avviare il server.

---

---

# FASE 2 — Form prenotazione completo

**Obiettivo:** form funzionante che salva una prenotazione su Supabase e reindirizza a `/conferma`.

## File: `src/pages/Prenota.jsx` (versione completa)

```jsx
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
    // Placeholder — viene implementato in Fase 3
    console.log('Email da inviare per:', prenotazione.id)
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
```

## File: `src/pages/Conferma.jsx`

```jsx
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
```

## ✅ CHECKLIST FASE 2

- [ ] Il form si visualizza correttamente su `/prenota`
- [ ] Tutti i campi obbligatori mostrano l'alert del browser se vuoti
- [ ] Submit senza errori → redirect a `/conferma` con nome mostrato
- [ ] In Supabase → Table Editor → `prenotazioni`: la riga è presente con `status = 'confermata'`
- [ ] Il campo `id` è un UUID ben formato (es. `550e8400-e29b-41d4-a716-446655440000`)
- [ ] In console NON ci sono errori rossi (solo il log `Email da inviare per: [uuid]`)

**🛑 NON procedere alla Fase 3 se il record non appare in Supabase.**

---

---

# FASE 3 — Email con QR code (Resend)

**Obiettivo:** dopo la prenotazione, il cliente riceve un'email con il QR code come immagine inline e un link di backup.

## Come funziona il QR

Il QR code encode l'URL: `https://tuaapp.vercel.app/check/[uuid]`  
Viene generato server-side tramite l'API di Resend usando la libreria `qrcode` in una Vercel Serverless Function.

## Vercel Serverless Function: `api/send-email.js`

```js
// Crea la cartella `api/` nella root del progetto (non in src/)
// File: api/send-email.js

import QRCode from 'qrcode'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { id, nome, cognome, email, num_adulti, num_bambini } = req.body

  const appUrl  = process.env.VITE_APP_URL || process.env.APP_URL
  const checkUrl = `${appUrl}/check/${id}`

  // Genera QR come PNG base64
  const qrBase64 = await QRCode.toDataURL(checkUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' }
  })
  // Rimuovi il prefisso data:image/png;base64,
  const qrData = qrBase64.replace(/^data:image\/png;base64,/, '')

  const eventoNome = process.env.VITE_EVENTO_NOME || 'Evento'
  const lidoNome   = process.env.VITE_LIDO_NOME   || 'Lido'

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
      <p style="color:#0284c7;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">${lidoNome}</p>
      <h1 style="font-size:22px;color:#0f172a;margin:0 0 16px">La tua prenotazione è confermata ✅</h1>
      <p style="color:#374151;font-size:15px;margin:0 0 8px">Ciao <strong>${nome} ${cognome}</strong>,</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px">
        La tua prenotazione per <strong>${eventoNome}</strong> è stata registrata con successo.<br>
        Posti: <strong>${num_adulti} adult${num_adulti === 1 ? 'o' : 'i'}${num_bambini > 0 ? `, ${num_bambini} bambin${num_bambini === 1 ? 'o' : 'i'}` : ''}</strong>
      </p>

      <div style="background:#f8fafc;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <p style="color:#6b7280;font-size:13px;margin:0 0 12px">Mostra questo QR code all'ingresso</p>
        <img src="cid:qrcode" alt="QR Code" width="200" height="200"
          style="border-radius:8px;display:block;margin:0 auto 12px"/>
        <p style="font-family:monospace;font-size:11px;color:#94a3b8;margin:0;word-break:break-all">${id}</p>
      </div>

      <p style="color:#6b7280;font-size:13px;text-align:center">
        Problemi con il QR? <a href="${checkUrl}" style="color:#0284c7">Usa questo link</a>
      </p>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0">
        ${lidoNome} · In caso di problemi rispondi a questa email
      </p>
    </div>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VITE_RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${lidoNome} <noreply@tuodominio.com>`,
      to: [email],
      subject: `Conferma prenotazione — ${eventoNome}`,
      html,
      attachments: [{
        filename: 'qrcode.png',
        content: qrData,
        content_id: 'qrcode',
        content_type: 'image/png'
      }]
    })
  })

  const result = await response.json()
  if (!response.ok) return res.status(500).json({ error: result })
  return res.status(200).json({ ok: true, emailId: result.id })
}
```

## Dipendenza aggiuntiva

```bash
npm install qrcode
```

## Aggiornare `sendEmail` in `Prenota.jsx`

```js
// Sostituire la funzione sendEmail placeholder con:
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
```

## ✅ CHECKLIST FASE 3

- [ ] Compila e submitti il form con una **email reale** (tua o del tuo amico)
- [ ] L'email arriva entro 30 secondi
- [ ] Il QR code è visibile nell'email come immagine (non come allegato)
- [ ] Aprendo il link nell'email (o cliccando sul QR dal telefono) si raggiunge `/check/[uuid]` (pagina ancora vuota — ok per ora)
- [ ] Nella dashboard Resend (resend.com) il log dell'email mostra `delivered`
- [ ] Se l'email NON arriva: controlla i log della serverless function su Vercel → Functions → Logs

**Note su Resend:**
- Il piano gratuito permette 3.000 email/mese e 100/giorno
- Per inviare da `noreply@tuodominio.com` bisogna verificare il dominio su Resend (10 minuti)
- In alternativa si può usare temporaneamente `onboarding@resend.dev` (solo per test)

**🛑 NON procedere alla Fase 4 se l'email non arriva o il QR non è leggibile.**

---

---

# FASE 4 — Check-in QR scanner (pannello staff)

**Obiettivo:** il personale apre `/check/:id` da smartphone, la pagina legge l'UUID dall'URL (dopo scansione QR), mostra i dati del cliente e permette di confermare l'arrivo con un tap.

> Nota: questa pagina funziona in DUE modalità:
> 1. **Link diretto** — quando il cliente mostra il QR e il personale lo scansiona con la camera di sistema (apre il browser sul link `/check/[uuid]`)
> 2. **Scanner integrato** — la pagina `/check` senza UUID attiva la camera per scansionare

## Dipendenza

```bash
npm install html5-qrcode
```

## File: `src/pages/CheckIn.jsx`

```jsx
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
  const scannerRef = useRef(null)
  const scannerInstanceRef = useRef(null)

  // Se c'è un UUID nell'URL, carica subito i dati
  useEffect(() => {
    if (id) caricaPrenotazione(id)
  }, [id])

  // Avvia scanner camera se non c'è UUID
  useEffect(() => {
    if (!scanning) return
    const scanner = new Html5Qrcode('qr-reader')
    scannerInstanceRef.current = scanner
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        // Estrai UUID dall'URL scansionato
        const match = decodedText.match(/\/check\/([a-f0-9-]{36})/)
        if (match) {
          scanner.stop().then(() => {
            setScanning(false)
            navigate(`/check/${match[1]}`)
          })
        }
      },
      () => {} // ignora errori di frame
    ).catch(err => console.error('Scanner error:', err))
    return () => { scanner.stop().catch(() => {}) }
  }, [scanning])

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
        <div id="qr-reader" style={{ borderRadius: 12, overflow: 'hidden' }} />
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
```

## ✅ CHECKLIST FASE 4

**Test da desktop:**
- [ ] Vai su `/check` (senza UUID) → appare la schermata scanner con camera attiva
- [ ] Vai su `/check/[uuid-di-una-prenotazione-reale]` → appare la card con nome e dati
- [ ] Clic su "Conferma arrivo" → la card diventa verde con "Già registrato"
- [ ] Su Supabase: il record ha `status = 'arrivata'` e `checked_in_at` valorizzato
- [ ] Riaprendo lo stesso UUID: mostra "Già registrato" (non permette doppio check-in)

**Test da smartphone (fondamentale):**
- [ ] Apri `https://tuaapp.vercel.app/check` da Chrome mobile
- [ ] Dai il permesso alla camera
- [ ] Scansiona il QR code dell'email di test → si apre la card del cliente
- [ ] Tap "Conferma arrivo" → funziona

**🛑 NON procedere alla Fase 5 se lo scanner non legge il QR o il check-in non aggiorna Supabase.**

---

---

# FASE 5 — Dashboard admin

**Obiettivo:** pagina protetta da password con lista prenotazioni, contatori, filtri e export CSV.

## File: `src/pages/Admin.jsx`

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

function exportCSV(righe) {
  const headers = ['Nome','Cognome','Email','Telefono','Adulti','Bambini','Status','Prenotato il','Check-in']
  const rows = righe.map(r => [
    r.nome, r.cognome, r.email, r.telefono,
    r.num_adulti, r.num_bambini, r.status,
    new Date(r.created_at).toLocaleString('it-IT'),
    r.checked_in_at ? new Date(r.checked_in_at).toLocaleString('it-IT') : ''
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'prenotazioni.csv'; a.click()
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
  const totAdulti = filtrati.reduce((s, r) => s + r.num_adulti, 0)
  const totBambini = filtrati.reduce((s, r) => s + r.num_bambini, 0)
  const arrivati = dati.filter(r => r.status === 'arrivata').length

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Prenotazioni</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{dati.length} totali · {arrivati} arrivati</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setRefresh(r => r+1)} style={btnStyle('#f1f5f9','#374151')}>↻ Aggiorna</button>
          <button onClick={() => exportCSV(filtrati)} style={btnStyle('#0284c7','#fff')}>⬇ CSV</button>
        </div>
      </div>

      {/* Contatori */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Prenotazioni', val: dati.length, color: '#0284c7' },
          { label: 'Arrivati', val: arrivati, color: '#16a34a' },
          { label: 'In attesa', val: dati.length - arrivati, color: '#d97706' },
          { label: 'Adulti', val: dati.reduce((s,r) => s+r.num_adulti, 0), color: '#7c3aed' },
          { label: 'Bambini', val: dati.reduce((s,r) => s+r.num_bambini, 0), color: '#db2777' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 20px', flex: '1 1 120px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${c.color}` }}>
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
              <div style={{ flex: '1 1 160px' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{r.nome} {r.cognome}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.email}</p>
              </div>
              <div style={{ flex: '0 0 auto', fontSize: 13, color: '#374151' }}>
                👥 {r.num_adulti} + 🧒 {r.num_bambini}
              </div>
              {r.note && <div style={{ flex: '1 1 100px', fontSize: 12, color: '#92400e', background: '#fef9c3', padding: '4px 8px', borderRadius: 6 }}>📝 {r.note}</div>}
              <div style={{ flex: '0 0 auto' }}>
                <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: r.status === 'arrivata' ? '#dcfce7' : r.status === 'annullata' ? '#fee2e2' : '#e0f2fe',
                  color: r.status === 'arrivata' ? '#15803d' : r.status === 'annullata' ? '#dc2626' : '#0284c7'
                }}>
                  {r.status}
                </span>
              </div>
              <div style={{ flex: '0 0 auto', fontSize: 11, color: '#94a3b8' }}>
                {new Date(r.created_at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
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
```

## ✅ CHECKLIST FASE 5

- [ ] Vai su `/admin` → appare la schermata di login
- [ ] Password sbagliata → messaggio di errore
- [ ] Password corretta → accede alla dashboard
- [ ] Le prenotazioni di test create nelle fasi precedenti sono visibili
- [ ] I contatori (totali, arrivati, adulti, bambini) sono corretti
- [ ] Il filtro "arrivata" mostra solo i check-in confermati
- [ ] Il pulsante "↻ Aggiorna" ricarica i dati senza refresh pagina
- [ ] Il pulsante "⬇ CSV" scarica un file con tutte le prenotazioni visibili
- [ ] Apri il CSV in Excel/Numbers: le colonne sono ben formate

**🛑 NON procedere alla Fase 6 se la dashboard mostra dati sbagliati o il CSV è malformato.**

---

---

# FASE 6 — Deploy Vercel + Integrazione WordPress

**Obiettivo:** la webapp è online, il form è integrato nel sito WordPress, tutto funziona da mobile.

## Deploy su Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Oppure collega il repo GitHub a Vercel dal pannello web (consigliato).

**Aggiungere le variabili d'ambiente su Vercel:**  
Vercel → progetto → Settings → Environment Variables → aggiungere le stesse del `.env.local`

> ⚠️ Su Vercel le variabili devono essere senza il prefisso `VITE_` per le serverless functions.  
> Aggiungile **con** e **senza** prefisso per sicurezza:
> - `VITE_SUPABASE_URL` e `SUPABASE_URL` → stesso valore
> - `VITE_RESEND_API_KEY` e `RESEND_API_KEY` → stesso valore

## Integrazione WordPress

Nel sito WordPress del tuo amico, aggiungere questo snippet HTML dove si vuole il form (editor a blocchi → blocco HTML personalizzato):

```html
<style>
  .lido-booking-frame {
    width: 100%;
    min-height: 680px;
    border: none;
    border-radius: 16px;
    overflow: hidden;
  }
  @media (max-width: 600px) {
    .lido-booking-frame { min-height: 800px; border-radius: 0; }
  }
</style>
<iframe
  class="lido-booking-frame"
  src="https://tuaapp.vercel.app/prenota"
  title="Prenotazione evento"
  loading="lazy"
  allow="payment">
</iframe>
```

## CORS — configurazione Vite

Aggiungere al `vite.config.js` per evitare problemi di iframe cross-origin:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': "frame-ancestors *"
    }
  }
})
```

E su Vercel, creare `vercel.json` nella root:

```json
{
  "headers": [
    {
      "source": "/prenota",
      "headers": [
        { "key": "X-Frame-Options", "value": "ALLOWALL" },
        { "key": "Content-Security-Policy", "value": "frame-ancestors *" }
      ]
    }
  ]
}
```

## ✅ CHECKLIST FASE 6 (finale)

**Deploy:**
- [ ] `https://tuaapp.vercel.app/prenota` carica il form
- [ ] `https://tuaapp.vercel.app/admin` carica la dashboard
- [ ] `https://tuaapp.vercel.app/check` attiva la camera (richiesta permesso)
- [ ] Test completo da zero: form → email → QR → check-in → dashboard aggiornata

**WordPress:**
- [ ] L'iframe nel sito WordPress mostra il form senza barre di scroll strane
- [ ] Su mobile il form è usabile (testa da iPhone e Android)
- [ ] Submit da WordPress → email arriva → check-in funziona

**Test finale end-to-end (fare prima dell'evento):**
- [ ] Crea 3-4 prenotazioni di test con email diverse
- [ ] Verifica che arrivino tutte le email
- [ ] Fai il check-in di 2 su 3 dal telefono dello staff
- [ ] Apri la dashboard → contatori corretti → export CSV → apri in Excel

---

---

# FASE 7 (futura) — Pagamenti Stripe

> Da implementare per gli eventi successivi. Schema da aggiungere a questa spec quando si è pronti.

**Cosa cambia nel flow:**
1. Submit form → crea `prenotazione` con `status = 'bozza'`
2. Redirect a Stripe Checkout (con `price_id` configurato nel pannello Stripe)
3. Webhook `payment_intent.succeeded` → serverless function aggiorna `status = 'confermata'` + triggera email con QR
4. Il cliente che non paga non riceve il QR e la prenotazione rimane in `bozza`

**Dipendenze da aggiungere:**
```bash
npm install stripe @stripe/stripe-js
```

**Variabili da aggiungere:**
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_STRIPE_PRICE_ID=price_...
```

---

*Fine specifiche — LIDO_BOOKING_SYSTEM v1.0*  
*Generato per Antigravity IDE*
