import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { money, dateTime } from "@shared/mds";
import { ApiError, Loading } from "./Layout";

const labels: Record<string, string> = {
  pending: "En attente",
  succeeded: "Confirmé",
  failed: "Non abouti",
  expired: "Expiré",
  cancelled: "Annulé",
};
const purposes: Record<string, string> = {
  full: "Règlement",
  deposit: "Acompte",
  balance: "Solde",
};
export function PaymentPanel({
  reference,
  token,
  status,
  invoice,
}: {
  reference: string;
  token?: string;
  status: string;
  invoice: {
    amountCents: number | null;
    currency: string;
    paidAt: Date | string | null;
  } | null;
}) {
  const utils = trpc.useUtils();
  const config = trpc.mds.payments.config.useQuery(undefined, { retry: false });
  const ledger = trpc.mds.payments.plan.useQuery(
    { reference, token },
    { retry: false, refetchInterval: 10000 }
  );
  const records = trpc.mds.payments.list.useQuery(
    { reference, token },
    { retry: false, refetchInterval: 10000 }
  );
  const checkout = trpc.mds.payments.checkout.useMutation();
  const respond = trpc.mds.payments.respondPlan.useMutation();
  const [error, setError] = useState("");
  const data = ledger.data;
  const plan = data?.activePlan;
  const settled = !!(
    data?.invoice?.paidAt ||
    invoice?.paidAt ||
    status === "paid"
  );
  // One contextual payment action. No arbitrary browser amount; server recomputes the stage.
  const purpose = data?.invoicePayable
    ? data.totalPaidCents > 0 || plan?.status === "accepted"
      ? "balance"
      : "full"
    : "deposit";
  const due = purpose === "deposit" ? data?.depositCents : data?.remainingCents;
  const testDone =
    config.data?.mode === "test" &&
    data?.successfulTestPurposes.includes(purpose);
  const blocked = settled || data?.withheldLive || testDone;
  async function pay() {
    setError("");
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const result = await checkout.mutateAsync({
        reference,
        token,
        origin: window.location.origin,
        purpose,
      });
      toast.info(
        result.mode === "test"
          ? "Ouverture de Stripe TEST · aucun règlement réel."
          : "Ouverture de Stripe dans un nouvel onglet sécurisé."
      );
      if (tab) tab.location.href = result.url;
      else window.location.assign(result.url);
      void ledger.refetch();
      void records.refetch();
    } catch (cause) {
      tab?.close();
      setError(
        cause instanceof Error
          ? cause.message
          : "Le paiement n’a pas pu être ouvert."
      );
    }
  }
  async function consent(accept: boolean) {
    if (!plan) return;
    setError("");
    try {
      await respond.mutateAsync({
        reference,
        token,
        id: plan.id,
        version: plan.version,
        accept,
      });
      await ledger.refetch();
      void utils.mds.requests.invalidate();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "L’accord n’a pas été enregistré."
      );
    }
  }
  if (
    data &&
    !data.activePlan &&
    !data.invoice &&
    !invoice &&
    !records.data?.length
  )
    return null;
  return (
    <section className="panel stack" aria-label="Paiement">
      <h2 style={{ fontSize: 22 }}>Votre règlement</h2>
      {ledger.isLoading ? (
        <Loading />
      ) : ledger.error ? (
        <ApiError
          message={ledger.error.message}
          retry={() => ledger.refetch()}
        />
      ) : (
        <>
          {plan?.status === "proposed" && (
            <div className="stack">
              <strong>Échéancier proposé</strong>
              <p>
                Total {money(plan.totalCents)} · acompte{" "}
                {money(plan.depositCents)} · solde prévu{" "}
                {money(plan.totalCents - plan.depositCents)}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{plan.conditions}</p>
              <p className="small-text muted">
                Cet accord de paiement est distinct de la confirmation du
                rendez-vous.
              </p>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button
                  className="btn primary"
                  disabled={respond.isPending}
                  onClick={() => consent(true)}
                >
                  Accepter l’échéancier
                </button>
                <button
                  className="btn secondary"
                  disabled={respond.isPending}
                  onClick={() => consent(false)}
                >
                  Refuser
                </button>
              </div>
            </div>
          )}
          {settled ? (
            <p className="success-message" role="status">
              Facture réglée.
            </p>
          ) : data?.withheldLive ? (
            <p className="notice" role="status">
              Un versement attend le rapprochement MDS. Aucun second paiement ne
              doit être lancé.
            </p>
          ) : due != null && due >= 50 ? (
            <>
              <strong>
                {purpose === "deposit"
                  ? "Acompte à régler"
                  : "Restant à régler"}{" "}
                : {money(due)}
              </strong>
              {data?.totalPaidCents ? (
                <p className="small-text muted">
                  Déjà imputé, remboursements déduits :{" "}
                  {money(data.totalPaidCents)}
                </p>
              ) : null}
              {config.data?.mode === "test" && (
                <p className="notice">
                  <strong>TEST · aucun encaissement réel.</strong> Un essai ne
                  règle pas votre facture.
                </p>
              )}
              {testDone ? (
                <p className="small-text muted">
                  Essai de cette échéance réussi. Facture réelle non acquittée.
                </p>
              ) : (
                <button
                  className="btn primary"
                  disabled={
                    !!blocked || checkout.isPending || !config.data?.enabled
                  }
                  onClick={pay}
                >
                  {checkout.isPending
                    ? "Préparation…"
                    : `${config.data?.mode === "test" ? "Tester" : "Payer"} ${purpose === "deposit" ? "l’acompte" : purpose === "full" ? "la facture" : "le solde"} · ${money(due)}`}
                  <ExternalLink size={17} aria-hidden="true" />
                </button>
              )}
              {!config.data?.enabled && (
                <p className="small-text muted">
                  Paiement en ligne indisponible. Contactez MDS.
                </p>
              )}
            </>
          ) : !settled && plan?.status !== "proposed" ? (
            <p className="muted">Aucune échéance payable actuellement.</p>
          ) : null}
        </>
      )}
      {error && (
        <p className="notice error-message" role="alert">
          {error}
        </p>
      )}
      <details>
        <summary>Montants, conditions et historique</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          {plan && (
            <p className="small-text">
              Échéancier {plan.status === "accepted" ? "accepté" : "proposé"} ·{" "}
              {money(plan.totalCents)}
              <br />
              {plan.conditions}
            </p>
          )}
          {(data?.invoice || invoice) && (
            <p>
              Facture :{" "}
              {money(data?.invoice?.amountCents ?? invoice?.amountCents)} ·{" "}
              {settled ? "acquittée" : "non acquittée"}
            </p>
          )}
          <p className="small-text muted">
            Un retour Stripe ne prouve pas le règlement. Un code promotionnel
            peut nécessiter un rapprochement du montant reçu.
          </p>
          {records.isLoading ? (
            <Loading />
          ) : records.error ? (
            <ApiError
              message={records.error.message}
              retry={() => records.refetch()}
            />
          ) : records.data?.length ? (
            <ul className="payment-history">
              {records.data.map(record => (
                <li key={record.id}>
                  <strong>
                    {purposes[record.purpose] || "Règlement"} · réservé{" "}
                    {money(record.amountCents)}
                  </strong>
                  <p className="small-text">
                    {record.mode === "test"
                      ? "TEST · aucun encaissement commercial"
                      : ""}{" "}
                    {labels[record.status] || record.status}
                  </p>
                  {record.status === "succeeded" && (
                    <p className="small-text">
                      {record.mode === "test"
                        ? "Reçu en test"
                        : "Reçu confirmé"}{" "}
                      :{" "}
                      {record.receivedAmountCents == null
                        ? "montant EUR à rapprocher"
                        : money(record.receivedAmountCents)}{" "}
                      ·{" "}
                      {record.mode === "test"
                        ? "non imputé à la facture"
                        : record.creditedAt
                          ? "imputé au dossier"
                          : "non imputé, à rapprocher"}
                    </p>
                  )}
                  <p className="small-text muted">
                    {dateTime(record.confirmedAt || record.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small-text muted">Aucun paiement enregistré.</p>
          )}
        </div>
      </details>
    </section>
  );
}
