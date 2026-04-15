// Vercel Serverless Function — Invio email con QR code via Resend
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
  const lidoNome   = process.env.VITE_LIDO_NOME   || 'Key Beach'

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
      from: `${lidoNome} <onboarding@resend.dev>`,
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
