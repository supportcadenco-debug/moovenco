import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { to, subject, html, pdfBase64, pdfName } = await req.json()

    const attachments = pdfBase64 ? [{
      filename: pdfName || 'document.pdf',
      content: Buffer.from(pdfBase64, 'base64'),
    }] : []

    const { data, error } = await resend.emails.send({
      from: 'RGO Mobilités <onboarding@resend.dev>',
      to: ['support.cadenco@gmail.com'], // ← TOUS LES MAILS VONT ICI PENDANT LES TESTS
      // to: [to], // ← décommenter quand on passe en production
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
