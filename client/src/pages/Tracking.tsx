import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Check,
  FileText,
  Download,
  RefreshCw,
  Star,
  LockKeyhole,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { statusLabels, dateTime, money } from "@shared/mds";
import { PriceDetails } from "@/components/mds/PriceDetails";
import { ClientOperations } from "@/components/mds/ClientOperations";
import { UploadDocument } from "@/components/mds/private-common";
import { PaymentPanel } from "@/components/mds/PaymentPanel";
import { ApiError, Loading } from "@/components/mds/Layout";

function initialKey(reference: string) {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  try {
    return (
      hash.get("cle") ||
      sessionStorage.getItem("mds-tracking:" + reference) ||
      ""
    );
  } catch {
    return hash.get("cle") || "";
  }
}
export default function Tracking() {
  const { user, loading: authLoading } = useAuth();
  const [reference, setReference] = useState(
    new URLSearchParams(window.location.search).get("ref") || ""
  );
  const [token, setToken] = useState(() => initialKey(reference));
  const [lookup, setLookup] = useState<{
    reference: string;
    token?: string;
  } | null>(reference ? { reference, token: token || undefined } : null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editor, setEditor] = useState<"reschedule" | "information" | null>(
    null
  );
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [alternativeId, setAlternativeId] = useState<string>("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const details = trpc.mds.requests.track.useQuery(
    lookup || { reference: "" },
    {
      enabled: !!lookup && (!!lookup.token || !authLoading),
      retry: false,
      refetchInterval: 10000,
      refetchOnWindowFocus: true,
    }
  );
  const act = trpc.mds.requests.clientAction.useMutation();
  const review = trpc.mds.reviews.submit.useMutation();
  const claim = trpc.mds.requests.claim.useMutation();
  const download = trpc.mds.documents.download.useMutation();
  const r = details.data?.request;
  useEffect(() => {
    if (lookup?.token)
      try {
        sessionStorage.setItem(
          "mds-tracking:" + lookup.reference,
          lookup.token
        );
      } catch {}
  }, [lookup]);
  async function action(
    type:
      | "confirm"
      | "refuse"
      | "reschedule"
      | "information"
      | "acceptQuote"
      | "refuseQuote"
      | "cancel"
  ) {
    if (!r || !lookup) return;
    setError("");
    setSuccess("");
    let desiredStart: string | undefined;
    if (type === "reschedule") {
      if (!newDate) {
        setError("Indiquez la date que vous souhaitez proposer.");
        return;
      }
      const date = new Date(newDate + "T" + newTime);
      if (date.getTime() <= Date.now()) {
        setError("Choisissez un créneau à venir.");
        return;
      }
      desiredStart = date.toISOString();
    }
    if (type === "information" && !message.trim()) {
      setError("Ajoutez votre réponse avant de l’envoyer.");
      return;
    }
    try {
      await act.mutateAsync({
        ...lookup,
        version: r.version,
        action: type,
        message: message || undefined,
        desiredStart,
        alternativeId:
          type === "confirm" && alternativeId ? alternativeId : undefined,
      });
      setSuccess(
        type === "confirm"
          ? "Votre accord est enregistré. Le rendez-vous est confirmé."
          : "Votre réponse est enregistrée dans le dossier."
      );
      setEditor(null);
      setMessage("");
      await details.refetch();
    } catch (e: any) {
      setError(e.message);
      details.refetch();
    }
  }
  async function getDocument(id: number) {
    setError("");
    try {
      const d = await download.mutateAsync({ id, ...lookup });
      const bytes = Uint8Array.from(atob(d.base64), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: d.mimeType }));
      const a = document.createElement("a");
      a.href = url;
      a.download = d.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      setError(e.message);
    }
  }
  const canConfirm =
    user?.role !== "admin" &&
    r &&
    ["awaiting_client", "proposed_slot", "quote_accepted"].includes(r.status) &&
    r.quoteStatus !== "pending" &&
    r.quoteStatus !== "refused";
  const isFinished =
    r && ["completed", "invoiced", "paid", "closed"].includes(r.status);
  const isTerminal =
    r && ["refused", "cancelled", "closed", "expired"].includes(r.status);
  return (
    <main id="main-content" className="page-shell standard-page">
      <div className="eyebrow">VOTRE DOSSIER, ÉTAPE PAR ÉTAPE</div>
      {!lookup || !r ? (
        <>
          <h1 className="page-title">Suivre ma demande</h1>
          <p className="lead muted">
            Utilisez le lien privé reçu à la fin de votre demande, ou retrouvez
            vos dossiers dans votre compte.
          </p>
          <p className="action-example">
            Exemple : copiez la référence reçue par e-mail, puis la clé privée
            si elle est demandée.
          </p>
          <form
            className="panel stack"
            style={{ maxWidth: 560, marginTop: 28 }}
            onSubmit={e => {
              e.preventDefault();
              setLookup({
                reference: reference.trim(),
                token: token.trim() || undefined,
              });
              setError("");
            }}
          >
            <div className="field">
              <label htmlFor="reference">Référence de votre demande</label>
              <input
                id="reference"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="MDS-…"
                required
                minLength={4}
              />
            </div>
            <div className="field">
              <label htmlFor="tracking-key">
                Clé privée de suivi
                {user ? " (facultative pour vos propres dossiers)" : ""}
              </label>
              <input
                id="tracking-key"
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                autoComplete="off"
                placeholder="La clé incluse dans votre lien de suivi"
              />
              <small>
                La référence seule ne permet pas d’accéder aux informations
                personnelles.
              </small>
            </div>
            <button className="btn primary">
              Ouvrir mon suivi
              <ArrowRight size={18} />
            </button>
            {!user && (
              <button
                type="button"
                className="text-link"
                onClick={() => startLogin()}
              >
                Me connecter à mon espace
              </button>
            )}
          </form>
          {lookup && details.isLoading && <Loading />}
          {details.error && (
            <ApiError
              message={details.error.message}
              retry={() => details.refetch()}
            />
          )}
          <MyRequests
            onSelect={ref => {
              setReference(ref);
              setToken("");
              setLookup({ reference: ref });
            }}
          />
        </>
      ) : (
        <>
          <div className="tracking-header">
            <div>
              <h1 className="page-title">Suivi de votre intervention</h1>
              <p className="muted small-text">Dossier {r.reference}</p>
            </div>
            <span className="badge">
              {statusLabels[r.status as keyof typeof statusLabels] || r.status}
            </span>
          </div>
          <div className="tracking-layout">
            <div className="stack">
              {r.pricingSnapshot && (
                <details className="panel">
                  <summary className="simple-summary">
                    Prix et conditions convenus
                  </summary>
                  <PriceDetails snapshot={r.pricingSnapshot} frozen />
                </details>
              )}
              {canConfirm && (
                <section className="panel stack">
                  <div className="eyebrow">VOTRE ACCORD EST ATTENDU</div>
                  <h2 style={{ fontSize: 23 }}>La proposition de MDS</h2>
                  <p>
                    {r.proposalMessage ||
                      "Votre artisan a précisé les conditions de l’intervention."}
                  </p>
                  <div className="row">
                    <span>
                      <strong>{money(r.proposedPriceCents)}</strong>
                    </span>
                    <span>{dateTime(r.proposedStart)}</span>
                    <span className="muted small-text">
                      {r.durationMinutes} min estimées
                    </span>
                  </div>
                  {r.expiresAt && (
                    <p className="small-text muted">
                      Proposition valable jusqu’au {dateTime(r.expiresAt)}.
                    </p>
                  )}
                  {!!r.alternatives?.length && (
                    <div className="field">
                      <label htmlFor="alternative">
                        Choisir un créneau proposé
                      </label>
                      <select
                        id="alternative"
                        value={alternativeId}
                        onChange={e => setAlternativeId(e.target.value)}
                      >
                        <option value="">{dateTime(r.proposedStart)}</option>
                        {r.alternatives
                          .filter(
                            s =>
                              new Date(s.startAt).getTime() !==
                              new Date(r.proposedStart || 0).getTime()
                          )
                          .map(s => (
                            <option key={s.id} value={s.id}>
                              {dateTime(s.startAt)}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <button
                    className="btn primary"
                    disabled={act.isPending}
                    onClick={() => action("confirm")}
                  >
                    Accepter et confirmer le rendez-vous
                    <Check size={18} />
                  </button>
                  <div className="row">
                    <button
                      className="btn secondary"
                      disabled={act.isPending}
                      onClick={() => {
                        setEditor("reschedule");
                        setSuccess("");
                      }}
                    >
                      Demander un autre créneau
                    </button>
                    <button
                      className="btn secondary danger"
                      disabled={act.isPending}
                      onClick={() => action("refuse")}
                    >
                      Refuser la proposition
                    </button>
                  </div>
                </section>
              )}
              {r.quoteStatus === "pending" && r.status === "quote_pending" && (
                <section className="panel stack">
                  <div className="eyebrow">DEVIS À VALIDER</div>
                  <h2 style={{ fontSize: 23 }}>MDS vous propose un devis</h2>
                  <p>{r.proposalMessage}</p>
                  <strong>{money(r.proposedPriceCents)}</strong>
                  <p className="small-text muted">
                    Consultez les documents joints. Accepter le devis ne
                    confirme pas encore le rendez-vous : le créneau demandera
                    votre accord distinct.
                  </p>
                  <div className="row">
                    <button
                      className="btn primary"
                      disabled={act.isPending}
                      onClick={() => action("acceptQuote")}
                    >
                      Accepter le devis
                    </button>
                    <button
                      className="btn secondary danger"
                      disabled={act.isPending}
                      onClick={() => action("refuseQuote")}
                    >
                      Refuser le devis
                    </button>
                  </div>
                </section>
              )}
              {r.status === "needs_information" && (
                <section className="panel stack">
                  <div className="eyebrow">UNE PRÉCISION EST NÉCESSAIRE</div>
                  <h2 style={{ fontSize: 22 }}>MDS a une question pour vous</h2>
                  <p>{r.proposalMessage}</p>
                  <UploadDocument
                    reference={r.reference}
                    token={lookup?.token}
                    kind="photo"
                    photoStage="before"
                    multiple
                    onUploaded={() => void details.refetch()}
                  />
                  <button
                    className="btn primary"
                    onClick={() => setEditor("information")}
                  >
                    Répondre à votre artisan
                    <ArrowRight size={18} />
                  </button>
                </section>
              )}
              {editor && (
                <form
                  className="panel stack"
                  onSubmit={e => {
                    e.preventDefault();
                    action(editor);
                  }}
                >
                  <h3>
                    {editor === "reschedule"
                      ? "Proposez un autre créneau"
                      : "Votre réponse à MDS"}
                  </h3>
                  {editor === "reschedule" && (
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor="new-date">Date souhaitée</label>
                        <input
                          id="new-date"
                          type="date"
                          value={newDate}
                          onChange={e => setNewDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="new-time">Heure souhaitée</label>
                        <input
                          id="new-time"
                          type="time"
                          value={newTime}
                          onChange={e => setNewTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}
                  <div className="field">
                    <label htmlFor="reply">
                      {editor === "information"
                        ? "Votre réponse"
                        : "Un message (facultatif)"}
                    </label>
                    <p className="action-example">
                      Exemple : « Je serai disponible mardi matin. » ou « La
                      fuite est maintenant plus importante. »
                    </p>
                    <textarea
                      id="reply"
                      maxLength={3000}
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      required={editor === "information"}
                    />
                  </div>
                  <button className="btn primary" disabled={act.isPending}>
                    Envoyer ma réponse
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setEditor(null)}
                  >
                    Fermer
                  </button>
                </form>
              )}
              {details.data?.appointment && (
                <section className="notice">
                  <strong>
                    {details.data.appointment.status === "cancelled"
                      ? "Rendez-vous annulé"
                      : details.data.appointment.status === "completed"
                        ? "Créneau de l’intervention terminée"
                        : details.data.appointment.status === "in_progress"
                          ? "Votre intervention en cours"
                          : "Votre rendez-vous confirmé"}
                  </strong>
                  <p>
                    {dateTime(details.data.appointment.startAt)}
                    <br />
                    Fin estimée : {dateTime(details.data.appointment.endAt)}
                  </p>
                  <p className="small-text">
                    {r.address}, {r.postcode} {r.city}
                  </p>
                </section>
              )}
              {details.data && (
                <PaymentPanel
                  reference={r.reference}
                  token={lookup?.token}
                  status={r.status}
                  invoice={details.data.invoice}
                />
              )}
              {details.data && user?.role !== "admin" && (
                <ClientOperations
                  detail={details.data}
                  token={lookup?.token}
                  onChanged={() => void details.refetch()}
                />
              )}
              {success && (
                <p role="status" className="success-message">
                  {success}
                </p>
              )}
              {error && (
                <p role="alert" className="notice error-message">
                  {error}
                </p>
              )}
              <details className="panel">
                <summary className="simple-summary">
                  Historique du dossier
                </summary>
                <div className="section-heading">
                  <button
                    className="text-link"
                    onClick={() => details.refetch()}
                    aria-label="Actualiser le suivi"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
                <p className="small-text muted">
                  Seules les actions réellement enregistrées apparaissent ici.
                </p>
                <ol className="timeline">
                  {details.data?.events.map(event => (
                    <li key={event.id}>
                      <span className="event-dot">
                        <Check size={10} />
                      </span>
                      <strong>
                        {statusLabels[
                          event.status as keyof typeof statusLabels
                        ] || event.status}
                      </strong>
                      {event.message && <p>{event.message}</p>}
                      <small>
                        {dateTime(event.createdAt)} ·{" "}
                        {event.actorType === "artisan"
                          ? "MDS"
                          : event.actorType === "client"
                            ? "Vous"
                            : "Système"}
                      </small>
                    </li>
                  ))}
                </ol>
              </details>
              {isFinished && (
                <details className="panel stack">
                  <summary className="simple-summary">
                    Évaluer mon intervention
                  </summary>
                  <p className="small-text muted">
                    Les évaluations sont liées à une intervention terminée et
                    restent privées, sans publication automatique.
                  </p>
                  {user &&
                    lookup?.token &&
                    !r.organizationId &&
                    user.role !== "admin" && (
                      <div className="notice">
                        <p>
                          Si cette demande a été déposée sans compte,
                          rattachez-la à votre compte avant de l’évaluer.
                          L’adresse e-mail de votre identité connectée doit
                          correspondre à celle du dossier.
                        </p>
                        <button
                          className="btn secondary"
                          disabled={claim.isPending}
                          onClick={async () => {
                            setError("");
                            try {
                              await claim.mutateAsync({
                                reference: r.reference,
                                token: lookup.token!,
                              });
                              setSuccess(
                                "Cette demande est rattachée à votre compte. Vous pouvez maintenant l’évaluer."
                              );
                              details.refetch();
                            } catch (e: any) {
                              setError(e.message);
                            }
                          }}
                        >
                          Rattacher cette demande à mon compte
                        </button>
                      </div>
                    )}
                  {user ? (
                    <form
                      className="stack"
                      onSubmit={async e => {
                        e.preventDefault();
                        setError("");
                        try {
                          await review.mutateAsync({
                            requestId: r.id,
                            rating,
                            comment: comment || undefined,
                          });
                          setSuccess(
                            "Votre évaluation privée est enregistrée."
                          );
                          details.refetch();
                        } catch (e: any) {
                          setError(e.message);
                        }
                      }}
                    >
                      <label>Votre note sur 5</label>
                      <div className="star-buttons">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            type="button"
                            key={n}
                            className={rating === n ? "selected" : ""}
                            aria-label={n + " sur 5"}
                            aria-pressed={rating === n}
                            onClick={() => setRating(n)}
                          >
                            {n}
                            <Star size={13} />
                          </button>
                        ))}
                      </div>
                      <div className="field">
                        <label htmlFor="review-comment">
                          Un commentaire (facultatif)
                        </label>
                        <textarea
                          id="review-comment"
                          value={comment}
                          onChange={e => setComment(e.target.value)}
                          maxLength={2000}
                        />
                      </div>
                      <button
                        className="btn primary"
                        disabled={review.isPending}
                      >
                        Envoyer mon évaluation
                      </button>
                    </form>
                  ) : (
                    <>
                      <p className="small-text">
                        Une identité authentifiée et autorisée sur ce dossier
                        est nécessaire pour laisser une évaluation.
                      </p>
                      <button
                        className="btn secondary"
                        onClick={() => startLogin()}
                      >
                        Me connecter pour évaluer
                      </button>
                    </>
                  )}
                  {details.data?.reviews.map(rv => (
                    <div key={rv.id} className="notice">
                      <strong>
                        {rv.authorType === "artisan"
                          ? "Évaluation MDS"
                          : "Évaluation client"}{" "}
                        · {rv.rating}/5
                      </strong>
                      {rv.comment && <p>{rv.comment}</p>}
                      <small>
                        Évaluation privée · {dateTime(rv.createdAt)}
                      </small>
                    </div>
                  ))}
                </details>
              )}
              {!isTerminal && !isFinished && (
                <button
                  className="text-link danger"
                  disabled={act.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Annuler cette demande ? Cette action sera enregistrée et MDS sera informé dans son espace."
                      )
                    )
                      action("cancel");
                  }}
                >
                  Annuler ma demande
                </button>
              )}
            </div>
            <aside className="stack">
              <details className="panel tracking-detail">
                <summary className="simple-summary">
                  Détails de ma demande
                </summary>
                <h3 style={{ marginTop: 10 }}>
                  {r.serviceName || "Demande libre"}
                </h3>
                <dl>
                  <dt>Le problème décrit</dt>
                  <dd>{r.description}</dd>
                  <dt>Adresse</dt>
                  <dd>
                    {r.address}
                    <br />
                    {r.postcode} {r.city}
                  </dd>
                  <dt>Créneau initialement souhaité</dt>
                  <dd>{dateTime(r.desiredStart)}</dd>
                  <dt>Contact</dt>
                  <dd>
                    {r.name}
                    <br />
                    {r.email}
                    <br />
                    {r.phone}
                  </dd>
                </dl>
              </details>
              <details className="panel">
                <summary className="simple-summary">
                  Photos et documents
                </summary>
                {details.data?.documents.length ? (
                  details.data.documents.map(d => (
                    <div className="document-item" key={d.id}>
                      <FileText size={18} />
                      <span className="small-text">
                        {d.kind === "photo"
                          ? `${d.photoStage === "before" ? "Avant travaux" : d.photoStage === "after" ? "Après travaux" : "Photo"} · ${d.photoAuthor === "artisan" ? "Artisan" : d.photoAuthor === "client" ? "Client" : "Dossier"} · `
                          : ""}
                        {d.name}
                      </span>
                      <button
                        className="text-link"
                        aria-label={"Télécharger " + d.name}
                        disabled={download.isPending}
                        onClick={() => getDocument(d.id)}
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="muted small-text" style={{ marginTop: 13 }}>
                    Aucun document joint pour le moment.
                  </p>
                )}
              </details>
              <div className="small-text muted row">
                <LockKeyhole size={19} />
                <p>Gardez votre lien privé.</p>
              </div>
              <button
                className="text-link"
                onClick={() => {
                  setLookup(null);
                  setReference("");
                  setToken("");
                }}
              >
                Suivre une autre demande
              </button>
              <Link href="/" className="text-link">
                Revenir à l’accueil
              </Link>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
function MyRequests({ onSelect }: { onSelect: (reference: string) => void }) {
  const { user } = useAuth();
  const mine = trpc.mds.requests.mine.useQuery(undefined, { enabled: !!user });
  if (!user) return null;
  return (
    <section style={{ marginTop: 35 }}>
      <h2 style={{ fontSize: 23 }}>Les demandes de mon compte</h2>
      {mine.isLoading ? (
        <Loading />
      ) : mine.error ? (
        <ApiError message={mine.error.message} retry={() => mine.refetch()} />
      ) : mine.data?.length ? (
        <div className="data-list" style={{ marginTop: 18 }}>
          {mine.data.map(r => (
            <button
              key={r.id}
              className="data-row"
              style={{ textAlign: "left", width: "100%" }}
              onClick={() => onSelect(r.reference)}
            >
              <span>
                <strong>{r.serviceName || "Demande libre"}</strong>
                <small style={{ display: "block" }}>
                  {r.reference} · {dateTime(r.createdAt)}
                </small>
              </span>
              <span className="badge">
                {statusLabels[r.status as keyof typeof statusLabels] ||
                  r.status}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>
          Aucune demande associée à votre compte. Les demandes déposées sans
          compte restent accessibles avec leur lien privé.
        </p>
      )}
    </section>
  );
}
