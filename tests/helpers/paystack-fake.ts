/**
 * A fake Paystack backend.
 *
 * It deliberately reproduces the two real Paystack behaviours that matter for
 * the payment flow:
 *
 *  1. A transaction reference must be unique. Initialising the same reference
 *     twice fails with "Duplicate transaction reference".
 *  2. Verification reports the *stored* transaction, so a test can decide what
 *     Paystack "knows" about a given reference.
 *
 * The fake is driven from the test through `paystackFake`.
 */
export interface FakeTransaction {
  reference: string;
  amount: number;
  currency: string;
  email: string;
  status: 'success' | 'failed' | 'abandoned' | 'pending';
  accessCode: string;
  paidAt: string | null;
}

export interface FakePaystack {
  /** Every transaction the fake has created, in order. */
  transactions: FakeTransaction[];
  /** Every reference the fake was asked to verify, in order. */
  verifyCalls: string[];
  /** References that verification should fail with a network/transport error. */
  failVerificationFor: Set<string>;
  /** When set, initialisation throws for this reference. */
  failInitializationFor: Set<string>;
  reset(): void;
  /** Overrides the stored status of a reference (simulates a later outcome). */
  setStatus(reference: string, status: FakeTransaction['status']): void;
}

export const paystackFake: FakePaystack = {
  transactions: [],
  verifyCalls: [],
  failVerificationFor: new Set<string>(),
  failInitializationFor: new Set<string>(),

  reset() {
    this.transactions.length = 0;
    this.verifyCalls.length = 0;
    this.failVerificationFor.clear();
    this.failInitializationFor.clear();
  },

  setStatus(reference, status) {
    const tx = this.transactions.find((t) => t.reference === reference);
    if (!tx) throw new Error(`Unknown fake Paystack reference: ${reference}`);
    tx.status = status;
    if (status === 'success' && !tx.paidAt) {
      tx.paidAt = new Date().toISOString();
    }
  },
};

let counter = 0;

/** Builds a deterministic-ish fake authorization URL for a reference. */
export function fakeAuthorizationUrl(reference: string): string {
  counter += 1;
  return `https://checkout.paystack.test/${encodeURIComponent(reference)}?attempt=${counter}`;
}
