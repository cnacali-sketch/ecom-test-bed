"use client";

/**
 * Razorpay checkout SDK loader + modal opener (client side).
 *
 * The Key ID and order id come from the backend's `/api/orders/{id}/razorpay/init`
 * response — never hardcoded here and never contains the Key Secret. Opens the
 * modal and resolves with the captured payment ids/signature on success.
 */

export interface RazorpayResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature?: string;
}

export interface RazorpayOpenOptions {
  keyId: string;
  orderId: string;
  /** Amount in paise (echoed back from the server). */
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
}

type RazorpayConstructor = new (options: {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: RazorpayOpenOptions["prefill"];
  notes?: Record<string, string>;
  handler: (response: RazorpayResult) => void;
  modal: { ondismiss: () => void };
}) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<boolean> | null = null;

function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** Open the Razorpay payment modal. Resolves on success, rejects on cancel/fail. */
export async function openRazorpayCheckout(
  options: RazorpayOpenOptions,
): Promise<RazorpayResult> {
  if (typeof window === "undefined") throw new Error("Razorpay is browser-only");
  if (!window.Razorpay) {
    const loaded = await loadCheckoutScript();
    if (!loaded || !window.Razorpay) throw new Error("Could not load Razorpay checkout");
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const instance = new window.Razorpay!({
      key: options.keyId,
      order_id: options.orderId,
      amount: options.amount,
      currency: options.currency,
      name: options.name,
      description: options.description,
      prefill: options.prefill,
      notes: options.notes,
      handler(response) {
        settled = true;
        resolve(response);
      },
      modal: {
        ondismiss() {
          if (!settled) reject(new Error("Payment cancelled"));
        },
      },
    });

    instance.on("payment.failed", () => {
      if (!settled) {
        settled = true;
        reject(new Error("Payment failed"));
      }
    });

    instance.open();
  });
}
