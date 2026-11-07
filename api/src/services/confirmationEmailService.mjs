import { env } from '../config/env.mjs';

const BREVO_EMAIL_API_URL = 'https://api.brevo.com/v3/smtp/email';

export class ConfirmationEmailError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function sendWithTimeout(fetchImpl, url, request, timeoutMs) {
  const controller = new AbortController();
  let didTimeOut = false;
  let timer;
  const delivery = Promise.resolve()
    .then(() => fetchImpl(url, { ...request, signal: controller.signal }))
    .then(
      (response) => ({ status: response.ok ? 'sent' : 'failed' }),
      () => ({ status: didTimeOut ? 'timeout' : 'failed' })
    );
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      didTimeOut = true;
      controller.abort();
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

function parseSender(emailFrom) {
  const value = emailFrom?.trim();
  const namedSender = value?.match(/^(.+?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (namedSender) {
    return { name: namedSender[1].trim(), email: namedSender[2] };
  }
  if (value?.match(/^[^<>\s]+@[^<>\s]+$/)) {
    return { email: value };
  }
  return null;
}

export function createConfirmationEmailSender({
  apiKey = env.brevoApiKey,
  emailFrom = env.emailFrom,
  timeoutMs = env.emailTimeoutMs,
  fetchImpl = globalThis.fetch
} = {}) {
  return async function sendConfirmationEmail({ registration, event }) {
    const sender = parseSender(emailFrom);
    if (!apiKey || !sender) {
      throw new ConfirmationEmailError('EMAIL_NOT_CONFIGURED', 'Confirmation email is not configured');
    }

    await sendWithTimeout(fetchImpl, BREVO_EMAIL_API_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender,
        to: [{ email: registration.email, name: registration.name }],
        subject: `Registration confirmed: ${event.title}`,
        textContent: confirmationText(registration, event)
      })
    }, timeoutMs);
  };
}

// Tests inject a fake sender. The default is disabled in test mode as an extra safeguard.
export const sendConfirmationEmail = createConfirmationEmailSender(
  env.nodeEnv === 'test' ? { apiKey: null, emailFrom: null } : undefined
);
