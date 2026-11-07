import nodemailer from 'nodemailer';
import { env } from '../config/env.mjs';

export class ConfirmationEmailError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const createTransportCloser = (transport) => {
  let closed = false;

  return () => {
    if (closed || typeof transport.close !== 'function') {
      return;
    }
    closed = true;

    try {
      Promise.resolve(transport.close()).catch(() => {});
    } catch {
      // Closing is best-effort and must not affect a saved registration.
    }
  };
};

async function sendWithTimeout(transport, message, timeoutMs, closeTransport) {
  let timer;
  const delivery = Promise.resolve()
    .then(() => transport.sendMail(message))
    .then(
      () => ({ status: 'sent' }),
      () => ({ status: 'failed' })
    );
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      closeTransport();
      resolve({ status: 'timeout' });
    }, timeoutMs);
  });

  let outcome;
  try {
    outcome = await Promise.race([delivery, timeout]);
  } finally {
    clearTimeout(timer);
  }

  if (outcome.status === 'timeout') {
    throw new ConfirmationEmailError('EMAIL_TIMEOUT', 'Confirmation email timed out');
  }
  if (outcome.status === 'failed') {
    throw new ConfirmationEmailError('EMAIL_DELIVERY_FAILED', 'Confirmation email could not be sent');
  }
}

const confirmationText = (registration, event) => [
  `Hello ${registration.name},`,
  '',
  `You are registered for ${event.title}.`,
  `Date: ${new Date(event.startsAt).toISOString()}`,
  `Location: ${event.location}`
].join('\n');

export function createConfirmationEmailSender({
  smtpUrl = env.smtpUrl,
  emailFrom = env.emailFrom,
  timeoutMs = env.emailTimeoutMs,
  transportFactory = nodemailer.createTransport
} = {}) {
  return async function sendConfirmationEmail({ registration, event }) {
    if (!smtpUrl || !emailFrom) {
      throw new ConfirmationEmailError('EMAIL_NOT_CONFIGURED', 'Confirmation email is not configured');
    }

    let transport;
    try {
      transport = transportFactory(smtpUrl, {
        connectionTimeout: timeoutMs,
        greetingTimeout: timeoutMs,
        socketTimeout: timeoutMs,
        dnsTimeout: timeoutMs
      });
    } catch {
      throw new ConfirmationEmailError('EMAIL_DELIVERY_FAILED', 'Confirmation email could not be sent');
    }

    const closeTransport = createTransportCloser(transport);
    try {
      await sendWithTimeout(transport, {
        from: emailFrom,
        to: registration.email,
        subject: `Registration confirmed: ${event.title}`,
        text: confirmationText(registration, event)
      }, timeoutMs, closeTransport);
    } finally {
      closeTransport();
    }
  };
}

// Tests inject a fake sender. The default is disabled in test mode as an extra safeguard.
export const sendConfirmationEmail = createConfirmationEmailSender(
  env.nodeEnv === 'test' ? { smtpUrl: null, emailFrom: null } : undefined
);
