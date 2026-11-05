import { useEffect, useState } from "react";
import { ArrowRight, CircleCheck, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { dateTime } from "@shared/mds";

type Photo = { id: number };

/** Miniature d'une photo privée : déchiffrée par le serveur après contrôle des droits. */
function PrivatePhotoThumb({
  id,
  reference,
  token,
  label,
}: {
  id: number;
  reference: string;
  token?: string;
  label: string;
}) {
  const download = trpc.mds.documents.download.useMutation();
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    download
      .mutateAsync({ id, reference, token })
      .then(file => {
        if (cancelled) return;
        const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
        objectUrl = URL.createObjectURL(
          new Blob([bytes], { type: file.mimeType })
        );
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // Une seule lecture par photo affichée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reference, token]);
  if (url) return <img className="proof-thumb" src={url} alt={label} />;
  return (
    <div
      className="proof-thumb proof-thumb-empty"
      role="img"
      aria-label={label}
    >
      {failed ? "Photo protégée" : "Chargement…"}
    </div>
  );
}

function plural(count: number) {
  return `${count} photo${count > 1 ? "s" : ""}`;
}

export function ProofOfWorkCard({
  reference,
  token,
  before,
  after,
  clientConfirmedAt,
}: {
  reference: string;
  token?: string;
  before: Photo[];
  after: Photo[];
  clientConfirmedAt?: Date | string | null;
}) {
  const records = trpc.mds.payments.list.useQuery(
    { reference, token },
    { retry: false, refetchInterval: 10000 }
  );
  const paid = records.data?.find(record => record.status === "succeeded");
  const validated = !!clientConfirmedAt;
  const steps = [
    {
      title: paid ? "Paiement effectué" : "Paiement",
      detail: paid
        ? dateTime(paid.confirmedAt || paid.createdAt)
        : "À régler depuis ce dossier, par carte via Stripe.",
      state: paid ? "done" : "todo",
    },
    {
      title: validated
        ? "Intervention validée"
        : "En attente de votre validation",
      detail: validated
        ? dateTime(clientConfirmedAt)
        : "Confirmez la fin des travaux ou signalez un problème.",
      state: validated ? "done" : "active",
    },
    {
      title: "Règlement à l’artisan",
      detail: validated
        ? "Traité par MDS après votre validation."
        : "Jamais déclenché sur la seule base des photos.",
      state: "todo",
    },
  ];
  return (
    <section className="proof-card" aria-labelledby="proof-title">
      <div className="proof-card-head">
        <CircleCheck size={34} aria-hidden="true" />
        <div>
          <h2 id="proof-title">Intervention terminée</h2>
          <p>
            {validated
              ? "Vous avez validé le résultat. Merci pour votre confiance."
              : "Les photos ont été envoyées et sont en attente de votre validation."}
          </p>
        </div>
      </div>
      <div className="proof-columns">
        {[
          { label: "Avant", photos: before },
          { label: "Après", photos: after },
        ].map(column => (
          <figure key={column.label}>
            <figcaption>{column.label}</figcaption>
            {column.photos[0] ? (
              <PrivatePhotoThumb
                id={column.photos[0].id}
                reference={reference}
                token={token}
                label={`Photo ${column.label.toLowerCase()} travaux`}
              />
            ) : (
              <div className="proof-thumb proof-thumb-empty">Aucune photo</div>
            )}
            <small>{plural(column.photos.length)}</small>
          </figure>
        ))}
      </div>
      <div className="proof-secure">
        <Lock size={22} aria-hidden="true" />
        <div>
          <strong>Paiement sécurisé</strong>
          <p>
            Le règlement de l’artisan n’intervient qu’après votre validation, ou
            après examen par MDS en cas de réclamation.
          </p>
        </div>
      </div>
      <ol className="proof-timeline">
        {steps.map(step => (
          <li key={step.title} className={`is-${step.state}`}>
            <span aria-hidden="true" />
            <div>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </div>
          </li>
        ))}
      </ol>
      <a className="proof-cta" href="#client-validation">
        {validated
          ? "Voir le suivi complet"
          : "Confirmer ou signaler un problème"}
        <ArrowRight size={18} aria-hidden="true" />
      </a>
    </section>
  );
}
