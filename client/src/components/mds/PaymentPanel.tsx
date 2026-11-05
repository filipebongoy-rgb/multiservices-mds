import { Link } from "wouter";
import { CreditCard, ExternalLink } from "lucide-react";
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
  const config = trpc.mds.payments.config.useQuery(undefined, { retry: false });
  const records = trpc.mds.payments.list.useQuery(
    { reference, token },
    { retry: false, refetchInterval: 10000 }
  );
  const checkout = trpc.mds.payments.checkout.useMutation();
  const [error, setError] = useState("");
  async function pay() {
    setError("");
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const result = await checkout.mutateAsync({
        reference,
        token,
        origin: window.location.origin,
      });
      toast.info(
        result.mode === "test"
          ? "Ouverture de Stripe en mode test : aucun débit réel."
          : "Ouverture du paiement sécurisé dans un nouvel onglet."
      );
      if (tab) tab.location.href = result.url;
      else window.location.assign(result.url);
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
  const receivedLive =
    records.data?.some(
      record => record.mode === "live" && record.status === "succeeded"
    ) ?? false;
  const successfulTest =
    records.data?.some(
      record => record.mode === "test" && record.status === "succeeded"
    ) ?? false;
  const alreadyReceived =
    config.data?.mode === "live"
      ? receivedLive
      : config.data?.mode === "test"
        ? successfulTest
        : false;
  const hasCommercialPayment =
    invoice?.paidAt || status === "paid" || status === "closed";
  return (
    <section className="panel stack" aria-label="Paiement de la facture">
      <div
        className="row"
        style={{ justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <h2 style={{ fontSize: 22 }}>Votre facture et son règlement</h2>
        <CreditCard size={21} aria-hidden="true" />
      </div>
      {invoice ? (
        <div>
          <strong>
            {invoice.amountCents === null
              ? "Montant à vérifier par MDS"
              : money(invoice.amountCents)}
          </strong>
          <p className="muted small-text">
            Montant issu du tarif ou du devis confirmé dans ce dossier.
            Consultez le PDF de facture dans les documents.
          </p>
        </div>
      ) : (
        <p className="muted">
          Aucune facture émise pour le moment. Aucun paiement n’est demandé.
        </p>
      )}
      {hasCommercialPayment ? (
        <p className="success-message" role="status">
          Le règlement de cette facture a été confirmé. Aucun nouveau paiement
          n’est demandé.
        </p>
      ) : receivedLive ? (
        <p className="notice" role="status">
          Un versement Stripe a été reçu et attend un rapprochement par MDS. La
          facture n’est pas encore acquittée ; ne lancez pas un second paiement.
        </p>
      ) : (
        invoice &&
        status === "invoiced" && (
          <>
            {config.isLoading ? (
              <Loading />
            ) : config.error ? (
              <ApiError
                message={config.error.message}
                retry={() => config.refetch()}
              />
            ) : config.data?.enabled ? (
              <>
                {config.data.mode === "test" && (
                  <div className="notice">
                    <strong>Mode test · aucun débit réel</strong>
                    <p>
                      Le compte de paiement commercial MDS n’est pas ouvert dans
                      cette version. Un essai réussi apparaît dans l’historique,
                      mais ne règle pas la facture réelle.
                    </p>
                  </div>
                )}
                {successfulTest && config.data.mode === "test" && (
                  <p className="notice">
                    L’essai est réussi. Aucun règlement commercial n’a été
                    enregistré ; aucun second essai n’est nécessaire pour cette
                    facture.
                  </p>
                )}
                <button
                  className="btn primary"
                  disabled={
                    alreadyReceived ||
                    checkout.isPending ||
                    invoice.amountCents === null ||
                    invoice.amountCents < 50
                  }
                  onClick={pay}
                >
                  {checkout.isPending
                    ? "Préparation du paiement…"
                    : config.data.mode === "test"
                      ? successfulTest
                        ? "Essai de paiement déjà réussi"
                        : "Tester le paiement sécurisé"
                      : "Régler ma facture"}
                  <ExternalLink size={17} aria-hidden="true" />
                </button>
                {invoice.amountCents !== null && invoice.amountCents < 50 && (
                  <p className="small-text muted">
                    Ce montant ne permet pas un paiement Stripe. Contactez MDS
                    pour le règlement adapté.
                  </p>
                )}
              </>
            ) : (
              <p className="notice">
                Le paiement en ligne n’est pas configuré. MDS peut vous
                communiquer les modalités de règlement et enregistrer un
                paiement réellement vérifié.
              </p>
            )}
          </>
        )
      )}
      {error && (
        <p className="notice error-message" role="alert">
          {error}
        </p>
      )}
      <div>
        <h3>Historique des paiements</h3>
        <p className="small-text muted">
          Un retour de Stripe ne prouve pas le paiement. La confirmation
          nécessite la réponse vérifiée du prestataire.
        </p>
      </div>
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
              <div
                className="row"
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <strong>
                  {record.provider === "stripe"
                    ? "Montant contractuel réservé : "
                    : "Montant vérifié : "}
                  {money(record.amountCents)}
                </strong>
                {record.mode === "test" ? (
                  <span className="payment-test-label">
                    {record.status === "succeeded"
                      ? "Essai réussi · pas de règlement réel"
                      : "Essai · " + (labels[record.status] || record.status)}
                  </span>
                ) : (
                  <span className="badge">
                    {record.status === "succeeded" &&
                    record.provider === "stripe"
                      ? "Versement reçu"
                      : labels[record.status] || record.status}
                  </span>
                )}
              </div>
              <p className="small-text muted">
                {dateTime(record.confirmedAt || record.createdAt)} ·{" "}
                {record.provider === "manual"
                  ? "Paiement vérifié par MDS"
                  : "Stripe"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small-text">
          Aucun paiement enregistré pour cette facture.
        </p>
      )}
      <Link className="text-link" href="/paiements">
        Mes paiements et factures
      </Link>
    </section>
  );
}
