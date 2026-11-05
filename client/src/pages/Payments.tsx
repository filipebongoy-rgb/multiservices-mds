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
      <div className="eyebrow">FACTURES ET RÈGLEMENTS</div>
      <h1 className="page-title">Vos paiements, au clair.</h1>
      <p className="lead muted">
        Consultez les montants et confirmations liés à vos vraies factures. Les
        essais de paiement sont identifiés séparément.
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
          {history.isLoading ? (
            <Loading />
          ) : history.error ? (
            <ApiError
              message={history.error.message}
              retry={() => history.refetch()}
            />
          ) : history.data?.length ? (
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
                        record.mode === "test" ? "payment-test-label" : "badge"
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
            Aucun compte n’est imposé pour une première demande. Le lien privé
            de suivi permet d’accéder à votre facture. Connectez-vous pour
            consulter l’historique de votre compte ou de votre organisation.
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
