export type LogLevel = 'info' | 'warn' | 'error' | 'security' | 'audit';

export interface StructuredLogPayload {
  event: string;
  userId?: string;
  email?: string;
  collegeId?: string;
  ip?: string;
  details?: Record<string, any>;
}

class Logger {
  private format(level: LogLevel, payload: StructuredLogPayload): string {
    const timestamp = new Date().toISOString();
    // Sanitize any accidentally passed secrets/tokens/keys/passwords
    const sanitizedDetails = payload.details ? { ...payload.details } : undefined;
    if (sanitizedDetails) {
      const sensitiveKeys = ['password', 'passwordHash', 'otp', 'code', 'token', 'secret', 'privateKey', 'seedPhrase'];
      sensitiveKeys.forEach(key => {
        if (key in sanitizedDetails) {
          sanitizedDetails[key] = '[REDACTED]';
        }
      });
    }

    return JSON.stringify({
      timestamp,
      level,
      event: payload.event,
      userId: payload.userId,
      email: payload.email,
      collegeId: payload.collegeId,
      ip: payload.ip,
      details: sanitizedDetails
    });
  }

  info(event: string, payload: Omit<StructuredLogPayload, 'event'> = {}): void {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[INFO] ${this.format('info', { event, ...payload })}`);
    }
  }

  warn(event: string, payload: Omit<StructuredLogPayload, 'event'> = {}): void {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[WARN] ${this.format('warn', { event, ...payload })}`);
    }
  }

  error(event: string, payload: Omit<StructuredLogPayload, 'event'> = {}): void {
    console.error(`[ERROR] ${this.format('error', { event, ...payload })}`);
  }

  security(event: string, payload: Omit<StructuredLogPayload, 'event'> = {}): void {
    console.warn(`[SECURITY] ${this.format('security', { event, ...payload })}`);
  }

  audit(event: string, payload: Omit<StructuredLogPayload, 'event'> = {}): void {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[AUDIT] ${this.format('audit', { event, ...payload })}`);
    }
  }
}

export const logger = new Logger();
