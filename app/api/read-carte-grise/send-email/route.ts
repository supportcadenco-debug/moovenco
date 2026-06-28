import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html, pdfBase64, pdfName } = await req.json()

    const attachments = pdfBase64 ? [{
      filename: pdfName || 'document.pdf',
      content: pdfBase64,
    }] : []

    const { data, error } = await resend.emails.send({
      from: 'RGO Mobilités <noreply@rgomobilites.fr>',
      to: [to],
      subject,
      html,
      attachments,
    })

    if (error) return NextResponse.json({ error }, { status: 400 })
    return NextResponse.json({ success: true, id: data?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}