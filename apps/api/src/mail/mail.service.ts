import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class MailService {
  private readonly transportMode: 'smtp' | 'resend';
  private readonly from: string;
  private readonly smtpTransport: Transporter | null;
  private readonly resendApiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.transportMode = config.getOrThrow<'smtp' | 'resend'>('EMAIL_TRANSPORT');
    this.from = config.getOrThrow<string>('EMAIL_FROM');
    this.resendApiKey = config.get<string>('RESEND_API_KEY');

    this.smtpTransport =
      this.transportMode === 'smtp'
        ? nodemailer.createTransport({
            host: config.getOrThrow<string>('SMTP_HOST'),
            port: config.getOrThrow<number>('SMTP_PORT'),
            secure: false,
          })
        : null;
  }

  async send(input: MailInput): Promise<void> {
    if (this.transportMode === 'smtp') {
      await this.smtpTransport!.sendMail({
        from: this.from,
        ...input,
      });
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend fallo con HTTP ${response.status}`);
    }
  }

  async sendVerificationEmail(email: string, link: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Verifica tu correo para iRec',
      text: `Verifica tu correo abriendo este enlace: ${link}`,
      html: `<p>Confirma tu correo para continuar en iRec.</p><p><a href="${link}">Verificar correo</a></p><p>El enlace expira pronto.</p>`,
    });
  }

  async sendRecoveryEmail(email: string, link: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Recupera tu acceso a iRec',
      text: `Continua la recuperacion abriendo este enlace: ${link}`,
      html: `<p>Se solicito recuperar el TOTP de tu cuenta iRec.</p><p><a href="${link}">Continuar recuperacion</a></p><p>Si no fuiste tu, ignora este correo.</p>`,
    });
  }
}
