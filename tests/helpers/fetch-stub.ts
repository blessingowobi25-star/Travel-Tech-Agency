/**
 * Installs a `fetch` stub that speaks just enough Paystack for the payment
 * service. Returns a restore function.
 */
import { vi } from 'vitest';
import { fakeAuthorizationUrl, paystackFake } from './paystack-fake';

interface InitBody {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callback_url?: string;
}

export function installPaystackFetch(): () => void {
  const original = globalThis.fetch;

  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const body = init?.body ? (JSON.parse(String(init.body)) as InitBody) : undefined;

    if (url.includes('/transaction/initialize')) {
      if (!body) throw new Error('initialize called without a body');
      if (paystackFake.failInitializationFor.has(body.reference)) {
        return jsonResponse(400, {
          status: false,
          message: 'Could not initialise transaction',
        });
      }

      const duplicate = paystackFake.transactions.some(
        (t) => t.reference === body.reference,
      );
      if (duplicate) {
        // This is the real Paystack behaviour that makes a naive retry fail.
        return jsonResponse(400, {
          status: false,
          message: 'Duplicate transaction reference',
        });
      }

      paystackFake.transactions.push({
        reference: body.reference,
        amount: body.amount,
        currency: body.currency ?? 'NGN',
        email: body.email,
        status: 'pending',
        accessCode: `access_${body.reference}`,
        paidAt: null,
      });

      return jsonResponse(200, {
        status: true,
        message: 'Authorization URL created',
        data: {
          authorization_url: fakeAuthorizationUrl(body.reference),
          access_code: `access_${body.reference}`,
          reference: body.reference,
          amount: body.amount,
        },
      });
    }

    const verifyMatch = url.match(/\/transaction\/verify\/(.+)$/);
    if (verifyMatch) {
      const reference = decodeURIComponent(verifyMatch[1]);
      paystackFake.verifyCalls.push(reference);

      if (paystackFake.failVerificationFor.has(reference)) {
        throw new Error('network down');
      }

      const tx = paystackFake.transactions.find((t) => t.reference === reference);
      if (!tx) {
        return jsonResponse(404, {
          status: false,
          message: 'Transaction not found',
        });
      }

      return jsonResponse(200, {
        status: true,
        message: 'Verification successful',
        data: {
          reference: tx.reference,
          status: tx.status,
          amount: tx.amount,
          currency: tx.currency,
          paid_at: tx.paidAt,
          access_code: tx.accessCode,
          authorization: { authorization_code: `auth_${tx.reference}`, last4: '4081' },
          customer: { email: tx.email },
        },
      });
    }

    throw new Error(`Unexpected Paystack request: ${url}`);
  });

  globalThis.fetch = stub as unknown as typeof fetch;

  return () => {
    globalThis.fetch = original;
  };
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
