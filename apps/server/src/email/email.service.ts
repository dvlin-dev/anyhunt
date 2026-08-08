import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { Resend } from 'resend';

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;
  private readonly smtp: Transporter | null = null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const smtpUrl = this.configService.get<string>('SMTP_URL');
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (smtpUrl) {
      this.smtp = createTransport(smtpUrl);
    } else if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn(
        'Email transport not configured, email sending disabled',
      );
    }
    this.from =
      this.configService.get<string>('EMAIL_FROM') ||
      'Anyhunt <noreply@anyhunt.app>';
  }

  /**
   * 发送自定义邮件
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    options?: { headers?: Record<string, string> },
  ): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('Email service not configured, skipping email');
      return;
    }

    try {
      await this.send({
        to,
        subject,
        html,
        headers: options?.headers,
      });
      this.logger.log('Email sent');
    } catch (error) {
      this.logger.error(`Failed to send email: ${error}`);
      throw error;
    }
  }

  isConfigured(): boolean {
    return this.smtp !== null || this.resend !== null;
  }

  /**
   * 发送验证码邮件
   */
  async sendOTP(email: string, otp: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('Email service not configured, skipping OTP');
      return;
    }

    try {
      await this.send({
        to: email,
        subject: 'Your Verification Code',
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; margin-bottom: 20px;">Verification Code</h2>
            <p style="color: #666; margin-bottom: 20px;">Your verification code is:</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otp}</span>
            </div>
            <p style="color: #999; font-size: 14px;">This code will expire in 5 minutes.</p>
            <p style="color: #999; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      });
      this.logger.log('OTP email sent');
    } catch (error) {
      this.logger.error(`Failed to send OTP email: ${error}`);
      throw error;
    }
  }

  private async send(message: EmailMessage): Promise<void> {
    const payload = {
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      ...(message.headers ? { headers: message.headers } : {}),
    };

    if (this.smtp) {
      await this.smtp.sendMail(payload);
      return;
    }

    if (this.resend) {
      await this.resend.emails.send(payload);
    }
  }
}
