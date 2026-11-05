import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { dateTime, money } from "@shared/mds";
import { ApiError, Loading } from "./Layout";

export function parseEurosCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimal = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
type SavedRefund = {
  paymentId: number;
  amountCents: number;
  mode: "test" | "live";
  reference: string;
  reason: string;
  confirm: true;
  idempotencyKey: string;
};
function RefundPayment({ paymentId }: { paymentId: number }) {
  const proof = trpc.mds.payments.refundable.useQuery(
    { paymentId },
    { retry: false }
  );
  const refund = trpc.mds.payments.refund.useMutation();
  const sync = trpc.mds.payments.syncRefund.useMutation();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedRefund | null>(null);
  const storageKey = `mds-refund-confirmation:${paymentId}`;
  useEffect(() => {
    setAmount("");
    setReason("");
    setConfirmed(false);
    setError("");
    setSaved(null);
    try {
      const old = JSON.parse(
        sessionStorage.getItem(storageKey) || "null"
      ) as SavedRefund | null;
      if (old && old.paymentId === paymentId) {
        setSaved(old);
        setAmount((old.amountCents / 100).toFixed(2));
        setReason(old.reason);
      }
    } catch {}
  }, [paymentId, storageKey]);
  const p = proof.data;
  const cents = parseEurosCents(amount);
  async function submit() {
    if (
      !p ||
      !cents ||
      !confirmed ||
      !p.reference ||
      (p.mode !== "test" && p.mode !== "live")
    )
      return;
    setError("");
    const payload: SavedRefund = saved || {
      paymentId,
      amountCents: cents,
      mode: p.mode,
      reference: p.reference,
      reason: reason.trim(),
      confirm: true,
      idempotencyKey: crypto.randomUUID(),
    };
    if (
      payload.amountCents !== cents ||
      payload.reason !== reason.trim() ||
      payload.mode !== p.mode ||
      payload.reference !== p.reference
    ) {
      setError(
        "La confirmation originale a changé. Rapprochez le remboursement en attente sans créer un nouvel ordre."
      );
      return;
    }
    setSaved(payload);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {}
    try {
      const result = await refund.mutateAsync(payload);
      await proof.refetch();
      if (result.status !== "pending") {
        setSaved(null);
        setConfirmed(false);
        try {
          sessionStorage.removeItem(storageKey);
        } catch {}
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Confirmation Stripe indisponible. La même clé est conservée."
      );
      void proof.refetch();
    }
  }
  async function refresh(id: number) {
    setError("");
    try {
      await sync.mutateAsync({ id });
      await proof.refetch();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Relecture impossible."
      );
    }
  }
  if (proof.isLoading) return <Loading />;
  if (proof.error)
    return (
      <ApiError message={proof.error.message} retry={() => proof.refetch()} />
    );
  if (!p) return null;
  return (
    <div className="stack">
      <p>
        <strong>
          {p.mode === "test"
            ? "STRIPE TEST · aucun argent commercial"
            : "STRIPE LIVE · opération réelle"}
        </strong>
        <br />
        Référence : {p.reference}
        <br />
        Reçu réellement confirmé : {money(p.receivedAmountCents)} · réservé :{" "}
        {money(p.reservedAmountCents)}
        <br />
        Encore remboursable : {money(p.remainingRefundableCents)}
      </p>
      {(p.remainingRefundableCents > 0 || saved) && (
        <>
          <label>
            Montant exact à rembourser (€)
            <input
              className="input"
              inputMode="decimal"
              value={amount}
              disabled={!!saved}
              onChange={e => {
                setAmount(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            Motif du remboursement
            <textarea
              className="input"
              value={reason}
              disabled={!!saved}
              onChange={e => {
                setReason(e.target.value);
                setConfirmed(false);
              }}
              maxLength={2000}
            />
          </label>
          <div className="notice">
            <strong>Confirmer cette opération {p.mode.toUpperCase()}</strong>
            <p>
              {cents ? money(cents) : "Montant non valide"} · {p.reference}
              <br />
              Motif : {reason.trim() || "à renseigner"}
            </p>
            <label className="row">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
              />
              <span>
                Je confirme explicitement le mode {p.mode.toUpperCase()}, ce
                montant, cette référence et ce motif.{" "}
                {p.mode === "live"
                  ? "Le remboursement enverra réellement des fonds au client."
                  : "Cet essai ne rembourse pas d’argent commercial."}
              </span>
            </label>
          </div>
          {saved && (
            <p className="small-text muted">
              Une confirmation a déjà été réservée. Reprendre conserve
              exactement son montant, motif et clé ; ce n’est pas une nouvelle
              opération.
            </p>
          )}
          <button
            className="btn primary"
            onClick={submit}
            disabled={
              !confirmed ||
              !cents ||
              reason.trim().length < 5 ||
              refund.isPending ||
              (!saved && (p.hasPending || cents > p.remainingRefundableCents))
            }
          >
            {refund.isPending
              ? "Vérification Stripe…"
              : saved
                ? "Reprendre la même confirmation"
                : `Confirmer le remboursement ${p.mode.toUpperCase()}`}
          </button>
        </>
      )}
      {error && (
        <p className="notice error-message" role="alert">
          {error}
        </p>
      )}
      <button className="text-link" onClick={() => proof.refetch()}>
        Relire les fonds disponibles (sans dépense)
      </button>
      {p.refunds.length > 0 && (
        <ul className="payment-history">
          {p.refunds.map(r => (
            <li key={r.id}>
              <strong>
                {money(r.amountCents)} · {r.mode.toUpperCase()} · {r.status}
              </strong>
              <p className="small-text">
                {r.reason} · {dateTime(r.confirmedAt || r.createdAt)}
              </p>
              {r.status === "pending" && (
                <button
                  className="btn secondary"
                  disabled={sync.isPending}
                  onClick={() => refresh(r.id)}
                >
                  Relire ce remboursement
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function PaymentTools({
  requestId,
  version,
  reference,
}: {
  requestId: number;
  version: number;
  reference: string;
}) {
  const [open, setOpen] = useState(false);
  const [deposit, setDeposit] = useState("");
  const [conditions, setConditions] = useState("");
  const [error, setError] = useState("");
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const records = trpc.mds.payments.list.useQuery(
    { reference },
    { enabled: open, retry: false }
  );
  const plan = trpc.mds.payments.plan.useQuery(
    { reference },
    { enabled: open, retry: false }
  );
  const propose = trpc.mds.payments.proposePlan.useMutation();
  const utils = trpc.useUtils();
  async function proposal() {
    const cents = parseEurosCents(deposit);
    if (!cents) return;
    setError("");
    try {
      await propose.mutateAsync({
        requestId,
        version,
        depositCents: cents,
        conditions: conditions.trim(),
      });
      await plan.refetch();
      void utils.mds.requests.invalidate();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Proposition impossible."
      );
    }
  }
  return (
    <details onToggle={e => setOpen(e.currentTarget.open)}>
      <summary>Échéancier et remboursements</summary>
      {open && (
        <div className="stack" style={{ marginTop: 16 }}>
          {plan.data?.activePlan && (
            <p>
              Échéancier {plan.data.activePlan.status} · acompte{" "}
              {money(plan.data.activePlan.depositCents)} · total{" "}
              {money(plan.data.activePlan.totalCents)}
              <br />
              {plan.data.activePlan.conditions}
            </p>
          )}
          <p className="small-text muted">
            Le serveur calcule le total depuis le contrat accepté et les
            suppléments acceptés terminés. Le client doit accepter ces modalités
            séparément.
          </p>
          <label>
            Acompte proposé (€)
            <input
              className="input"
              inputMode="decimal"
              value={deposit}
              onChange={e => setDeposit(e.target.value)}
            />
          </label>
          <label>
            Conditions de paiement
            <textarea
              className="input"
              value={conditions}
              onChange={e => setConditions(e.target.value)}
              maxLength={3000}
            />
          </label>
          <button
            className="btn secondary"
            disabled={
              propose.isPending ||
              !parseEurosCents(deposit) ||
              conditions.trim().length < 5
            }
            onClick={proposal}
          >
            Proposer au client
          </button>
          {error && (
            <p className="notice error-message" role="alert">
              {error}
            </p>
          )}
          <details>
            <summary>Rembourser un versement Stripe confirmé</summary>
            <div className="stack" style={{ marginTop: 12 }}>
              {records.error ? (
                <ApiError
                  message={records.error.message}
                  retry={() => records.refetch()}
                />
              ) : (
                <label>
                  Versement
                  <select
                    className="input"
                    value={paymentId ?? ""}
                    onChange={e => setPaymentId(Number(e.target.value) || null)}
                  >
                    <option value="">Choisir un versement</option>
                    {records.data
                      ?.filter(
                        p => p.provider === "stripe" && p.status === "succeeded"
                      )
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.reference} · {p.mode.toUpperCase()} · reçu{" "}
                          {p.receivedAmountCents == null
                            ? "à relire"
                            : money(p.receivedAmountCents)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {paymentId && (
                <RefundPayment key={paymentId} paymentId={paymentId} />
              )}
            </div>
          </details>
        </div>
      )}
    </details>
  );
}
export const PrivatePayments = PaymentTools;
