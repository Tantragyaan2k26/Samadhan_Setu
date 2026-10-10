export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  ticketNo?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

class Logger {
  private formatLog(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      message,
      service: 'samadhan-setu',
      env: process.env.NODE_ENV || 'development',
      ...context
    });
  }

  public debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('debug', message, context));
    }
  }

  public info(message: string, context?: LogContext) {
    console.info(this.formatLog('info', message, context));
  }

  public warn(message: string, context?: LogContext) {
    console.warn(this.formatLog('warn', message, context));
  }

  public error(message: string, error?: unknown, context?: LogContext) {
    const errObj = error instanceof Error ? {
      name: error.name,
      errorMessage: error.message,
      stack: error.stack
    } : { rawError: error };

    console.error(this.formatLog('error', message, { ...context, ...errObj }));

    // In production, forward to Sentry or OpenTelemetry collector
    if (process.env.SENTRY_DSN) {
      // Sentry.captureException(error, { extra: context });
    }
  }
}

export const logger = new Logger();
