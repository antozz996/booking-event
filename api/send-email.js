// Vercel Serverless Function — Invio email con QR code via Resend
import QRCode from 'qrcode'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { 
    id, nome, cognome, email, telefono, 
    num_adulti, num_bambini, 
    pkg_10_adulti, pkg_10_bambini, pkg_20_adulti, 
    num_lettini, prezzo_totale 
  } = req.body

  const appUrl  = process.env.VITE_APP_URL || process.env.APP_URL
  const checkUrl = `${appUrl}/check/${id}`

  const qrBase64 = await QRCode.toDataURL(checkUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' }
  })
  const qrData = qrBase64.replace(/^data:image\/png;base64,/, '')

  const eventoNome = process.env.VITE_EVENTO_NOME || 'Evento'
  const lidoNome   = process.env.VITE_LIDO_NOME   || 'Key Beach'

  // Costruisci riepilogo costi
  const riepilogoItems = []
  if (pkg_10_adulti > 0) riepilogoItems.push(`<li>${pkg_10_adulti}x Pkg Adulti (10€): <strong>${pkg_10_adulti * 10}€</strong></li>`)
  if (pkg_10_bambini > 0) riepilogoItems.push(`<li>${pkg_10_bambini}x Pkg Bambini (10€): <strong>${pkg_10_bambini * 10}€</strong></li>`)
  if (pkg_20_adulti > 0) riepilogoItems.push(`<li>${pkg_20_adulti}x Pkg Food (20€): <strong>${pkg_20_adulti * 20}€</strong></li>`)
  if (num_lettini > 0) riepilogoItems.push(`<li>${num_lettini}x Lettini (6€): <strong>${num_lettini * 6}€</strong></li>`)

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
      <p style="color:#0284c7;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">${lidoNome}</p>
      <h1 style="font-size:22px;color:#0f172a;margin:0 0-16px">La tua prenotazione è confermata ✅</h1>
      <p style="color:#374151;font-size:15px;margin:0 0 8px">Ciao <strong>${nome} ${cognome}</strong>,</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px">
        La tua prenotazione per <strong>${eventoNome}</strong> è stata registrata con successo.<br>
        Persone: <strong>${num_adulti} adult${num_adulti === 1 ? 'o' : 'i'}${num_bambini > 0 ? `, ${num_bambini} bambin${num_bambini === 1 ? 'o' : 'i'}` : ''}</strong>
      </p>

      <div style="background:#f0f9ff;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #bae6fd">
        <h3 style="margin:0 0 12px;font-size:14px;color:#0369a1;text-transform:uppercase">Riepilogo Costi all'Arrivo</h3>
        <ul style="margin:0;padding:0 0 0 20px;font-size:14px;color:#374151">
          ${riepilogoItems.length > 0 ? riepilogoItems.join('') : '<li>Solo entry prenotata</li>'}
        </ul>
        <p style="margin:12px 0 0;font-size:18px;font-weight:700;color:#0369a1;border-top:1px solid #bae6fd;padding-top:12px">
          Totale stimato: ${prezzo_totale}€
        </p>
        <p style="margin:8px 0 0;font-size:12px;color:#64748b">
          * Il pagamento verrà effettuato direttamente in struttura.
        </p>
      </div>

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
