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
      // Fail promptly when the SMTP host is unreachable instead of leaving
      // the login request (and its loading indicator) open indefinitely.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  return transporter;
}

export class EmailService {
  async verifyConfiguration(): Promise<void> {
    await getTransporter().verify();
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

  private async send(to: string, subject: string, text: string): Promise<void> {
    if (ENV.RESEND_API_KEY) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      const from = ENV.RESEND_FROM_EMAIL ||
        (ENV.SMTP_FROM_EMAIL
          ? `\"${ENV.SMTP_FROM_NAME}\" <${ENV.SMTP_FROM_EMAIL}>`
          : "Evalora <onboarding@resend.dev>");

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ENV.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to: [to], subject, text }),
          signal: controller.signal,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            `Resend email API returned ${response.status}: ${result.message || result.name || "request failed"}`,
          );
        }
        return;
      } catch (error: any) {
        if (error.name === "AbortError") {
          throw new Error("Resend email API request timed out.");
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    await getTransporter().sendMail({
      from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      text,
    });
  }
}

export const emailService = new EmailService();
