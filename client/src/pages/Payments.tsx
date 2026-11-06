import { Link } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { money, dateTime } from "@shared/mds";
import { ApiError, Loading } from "@/components/mds/Layout";
import { PaymentPanel } from "@/components/mds/PaymentPanel";
import { startLogin } from "@/const";

export default function Payments() {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get("ref") || "";
  const returned = params.get("checkout");
  const fragment =
    new URLSearchParams(window.location.hash.slice(1)).get("cle") || "";
  let token = fragment;
  try {
    token ||= sessionStorage.getItem("mds-tracking:" + reference) || "";
  } catch {}
  const { user, loading } = useAuth();
  const details = trpc.mds.requests.track.useQuery(
    { reference, token: token || undefined },
    {
      enabled: !!reference && (!!token || !loading),
      retry: false,
      refetchInterval: 10000,
    }
  );
  const history = trpc.mds.payments.mine.useQuery(undefined, {
    enabled: !!user && !reference,
    retry: false,
    refetchInterval: 10000,
  });
  useEffect(() => {
    if (reference && fragment)
      try {
        sessionStorage.setItem("mds-tracking:" + reference, fragment);
      } catch {}
  }, [reference, fragment]);
  return (
    <main id="main-content" className="page-shell standard-page">
      <div className="eyebrow">MES DOCUMENTS</div>
      <h1 className="page-title">Mes documents et paiements</h1>
      <p className="lead muted">
        Retrouvez ici vos factures, vos confirmations de paiement et les
        documents liés à vos interventions MDS.
      </p>
      <p className="action-example">
        Exemple : ouvrez le lien de suivi d’une demande, puis vérifiez la
        facture avant de payer.
      </p>
      {returned && (
        <div className="notice" role="status">
          <strong>
            {returned === "annule"
              ? "Vous avez quitté le paiement."
              : "Vous êtes revenu du paiement."}
          </strong>
          <p>
            Ce retour ne change pas le statut de votre facture. Les
            confirmations du prestataire apparaîtront dans l’historique après
            vérification ; la page s’actualise automatiquement.
          </p>
        </div>
      )}
      {!reference && (
        <section className="panel stack documents-start-panel">
          <h2>Comment accéder à un document ?</h2>
          <p>
            Ouvrez une demande dans <strong>Mes demandes</strong>, puis
            choisissez la facture ou le document associé. Les photos et pièces
            privées restent accessibles uniquement aux personnes autorisées.
          </p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <Link className="btn primary" href="/suivi">
              Ouvrir Mes demandes
            </Link>
            <Link className="btn secondary" href="/demande">
              Faire une demande
            </Link>
          </div>
        </section>
      )}
      {reference ? (
        <div className="stack" style={{ maxWidth: 760, marginTop: 24 }}>
          {details.isLoading ? (
            <Loading />
          ) : details.error ? (
            <ApiError
              message={details.error.message}
              retry={() => details.refetch()}
            />
          ) : (
            details.data && (
              <PaymentPanel
                reference={reference}
                token={token || undefined}
                status={details.data.request.status}
                invoice={details.data.invoice}
              />
            )
          )}
          <Link
            className="text-link"
            href={
              "/suivi?ref=" +
              encodeURIComponent(reference) +
              (token ? "#cle=" + encodeURIComponent(token) : "")
            }
          >
            Revenir au suivi de cette demande
          </Link>
        </div>
      ) : loading ? (
        <Loading />
      ) : user ? (
        <section className="panel stack" style={{ marginTop: 24 }}>
          <h2>Historique de votre compte</h2>
          <p className="action-example">
            Exemple : ouvrez une ligne pour retrouver la facture et le suivi
            associés.
          </p>
          {history.isLoading ? (
            <Loading />
          ) : history.error ? (
            <ApiError
              message={history.error.message}
              retry={() => history.refetch()}
            />
          ) : history.data?.length ? (
            <details>
              <summary>Voir les paiements de votre compte</summary>
              <ul className="payment-history">
                {history.data.map(record => (
                  <li key={record.id}>
                    <div
                      className="row"
                      style={{
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong>
                        {record.provider === "stripe"
                          ? "Montant contractuel réservé : "
                          : "Montant vérifié : "}
                        {money(record.amountCents)}
                      </strong>
                      <span
                        className={
                          record.mode === "test"
                            ? "payment-test-label"
                            : "badge"
                        }
                      >
                        {record.mode === "test" ? "Mode test · " : ""}
                        {record.status === "succeeded"
                          ? record.mode === "test"
                            ? "Essai réussi"
                            : record.provider === "stripe"
                              ? "Versement reçu"
                              : "Vérifié par MDS"
                          : record.status === "pending"
                            ? "En attente"
                            : record.status === "failed"
                              ? "Non abouti"
                              : record.status === "expired"
                                ? "Expiré"
                                : "Annulé"}
                      </span>
                    </div>
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
                          ? "aucun règlement commercial"
                          : record.creditedAt
                            ? "imputé au dossier"
                            : "non imputé, à rapprocher"}
                      </p>
                    )}
                    <p className="small-text muted">
                      {dateTime(record.confirmedAt || record.createdAt)} ·{" "}
                      {record.requestReference} ·{" "}
                      {record.serviceName || "Intervention MDS"}
                    </p>
                    <Link
                      className="text-link"
                      href={
                        "/paiements?ref=" +
                        encodeURIComponent(record.requestReference)
                      }
                    >
                      Consulter la facture et le suivi
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="muted">
              Aucun paiement enregistré dans les dossiers accessibles à votre
              compte.
            </p>
          )}
        </section>
      ) : (
        <section
          className="panel stack"
          style={{ marginTop: 24, maxWidth: 650 }}
        >
          <h2>Retrouvez votre facture depuis votre suivi privé.</h2>
          <p className="muted">
            Le suivi privé reste accessible avec votre lien. En revanche, un
            compte est obligatoire avant d’ouvrir un paiement sécurisé, afin de
            protéger votre identité et conserver le reçu dans votre espace.
          </p>
          <Link href="/suivi" className="btn primary">
            Ouvrir mon suivi privé
          </Link>
          <button className="text-link" onClick={() => startLogin()}>
            Me connecter à mon compte
          </button>
        </section>
      )}
    </main>
  );
}
