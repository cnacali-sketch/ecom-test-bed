"use client";

import { useEffect, useRef } from "react";

import { codSplit } from "@/lib/cod-split";
import { formatPrice } from "@/lib/format";

/**
 * The last thing a shopper sees before a Cash-on-Delivery order is placed:
 * what leaves their card now, what they owe at the door, and that the deposit
 * does not come back.
 *
 * Both amounts are derived from the server's own deposit via `codSplit`, so
 * the dialog cannot promise a split the backend will not apply. The words come
 * from the content layer; only the numbers are computed here.
 *
 * Built on `<dialog>` rather than a div with a high z-index, because the
 * browser then owns the things that are easy to get wrong and invisible when
 * they are: focus moves into the dialog and is trapped there, Escape closes
 * it, the rest of the page goes inert to a screen reader, and it renders in
 * the top layer above anything the storefront stacks.
 */

type Props = {
  open: boolean;
  total: number;
  depositAmount: number;
  copy: {
    heading: string;
    intro: string;
    depositLabel: string;
    balanceLabel: string;
    totalLabel: string;
    nonRefundableNote: string;
    agreeLabel: string;
    cancelLabel: string;
  };
  onAgree: () => void;
  onCancel: () => void;
};

export function CodConfirmDialog({
  open,
  total,
  depositAmount,
  copy,
  onAgree,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const split = codSplit(total, depositAmount);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // showModal()/close() rather than the `open` attribute: only the modal
    // form gets the top layer, the focus trap and the inert backdrop.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="cod-confirm-heading"
      // Escape and the backdrop both mean "not yet" -- route them through the
      // same cancel path as the button so the parent never believes a dialog
      // is still open after the browser has closed it.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[24px] border border-rule-soft bg-card p-0 text-ink backdrop:bg-ink/40"
    >
      <div className="p-6">
        <h2 id="cod-confirm-heading" className="font-display text-xl italic text-ink">
          {copy.heading}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">{copy.intro}</p>

        <dl className="mt-6 space-y-3 rounded-[18px] border border-rule-soft bg-shell p-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-ink-soft">{copy.depositLabel}</dt>
            <dd className="text-base font-medium tabular-nums text-teal">
              {formatPrice(split.depositNow)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-ink-soft">{copy.balanceLabel}</dt>
            <dd className="text-base font-medium tabular-nums text-ink">
              {formatPrice(split.balanceOnDelivery)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-rule-soft pt-3">
            <dt className="text-sm font-medium text-ink">{copy.totalLabel}</dt>
            <dd className="text-base font-medium tabular-nums text-ink">
              {formatPrice(split.total)}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-ink-soft">{copy.nonRefundableNote}</p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-rule-soft px-6 py-3 text-xs uppercase tracking-[0.18em] text-ink-soft transition-colors hover:text-ink"
          >
            {copy.cancelLabel}
          </button>
          <button
            type="button"
            onClick={onAgree}
            className="rounded-full bg-teal px-6 py-3 text-xs uppercase tracking-[0.18em] text-white transition-colors hover:bg-teal-deep"
          >
            {copy.agreeLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
