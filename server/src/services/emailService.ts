import nodemailer, { Transporter } from "nodemailer";
import { ENV } from "../config/env.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (
    !ENV.SMTP_HOST ||
    !ENV.SMTP_USER ||
    !ENV.SMTP_PASS ||
    !ENV.SMTP_FROM_EMAIL
  ) {
    if (ENV.NODE_ENV === "test") {
      return {
        verify: async () => true,
        sendMail: async () => ({ messageId: "test-mock-mail-id" }),
      } as unknown as Transporter;
    }
    throw new Error(
      "Email delivery is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM_EMAIL.",
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_SECURE,
      auth: { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS },
    });
  }

  return transporter;
}

export class EmailService {
  async verifyConfiguration(): Promise<void> {
    await getTransporter().verify();
  }

  async sendVerificationOTP(email: string, code: string): Promise<void> {
    await this.sendOTP(email, "verification", code);
  }

  async sendLoginOTP(email: string, code: string): Promise<void> {
    await this.sendOTP(email, "login", code);
  }

  async sendPasswordResetOTP(email: string, code: string): Promise<void> {
    await this.sendOTP(email, "password reset", code);
  }

  async sendAssessmentInvitation(
    email: string,
    assessmentTitle: string,
    assessmentUrl: string,
  ): Promise<void> {
    await this.send(
      email,
      `You are invited to take ${assessmentTitle} on Evalora`,
      `You have been invited to complete "${assessmentTitle}" on Evalora.\n\nOpen your assessment: ${assessmentUrl}\n\nPlease sign in to view the instructions and availability window.`,
    );
  }

  async sendAssessmentReminder(
    email: string,
    assessmentTitle: string,
    assessmentUrl: string,
  ): Promise<void> {
    await this.send(
      email,
      `Reminder: ${assessmentTitle} on Evalora`,
      `This is a reminder to complete "${assessmentTitle}" on Evalora.\n\nOpen your assessment: ${assessmentUrl}`,
    );
  }

  private async sendOTP(
    email: string,
    purpose: string,
    code: string,
  ): Promise<void> {
    await this.send(
      email,
      `Your Evalora ${purpose} code`,
      `Your Evalora ${purpose} verification code is ${code}.\n\nThis 6-digit code expires in ${ENV.OTP_EXPIRY_MINUTES} minutes and can be used only once. Do not share it with anyone.`,
    );
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    await getTransporter().sendMail({
      from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      text,
    });
  }
}

export const emailService = new EmailService();
