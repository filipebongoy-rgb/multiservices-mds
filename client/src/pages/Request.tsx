import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mic,
  MicOff,
  ImagePlus,
  Copy,
  CalendarDays,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { createRequestSchema, money } from "@shared/mds";
import { ApiError, Loading } from "@/components/mds/Layout";

type Draft = {
  description: string;
  problemType: string;
  address: string;
  postcode: string;
  city: string;
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  answers: Record<string, string>;
  key: string;
};
const blank: Draft = {
  description: "",
  problemType: "",
  address: "",
  postcode: "",
  city: "",
  date: "",
  time: "09:00",
  name: "",
  email: "",
  phone: "",
  answers: {},
  key: "",
};
function initialDraft(): Draft {
  try {
    const saved = sessionStorage.getItem("mds-request-draft");
    return saved
      ? { ...blank, ...JSON.parse(saved) }
      : { ...blank, key: crypto.randomUUID() };
  } catch {
    return { ...blank, key: crypto.randomUUID() };
  }
}
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
export default function Request() {
  const params = new URLSearchParams(window.location.search);
  const serviceId = params.has("service")
    ? Number(params.get("service"))
    : null;
  const organizationId = params.has("org") ? Number(params.get("org")) : null;
  const siteId = params.has("site") ? Number(params.get("site")) : null;
  const catalog = trpc.mds.catalog.list.useQuery({});
  const service = catalog.data?.find(s => s.id === serviceId);
  const { user } = useAuth();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [recording, setRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const speechRef = useRef<any>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [receipt, setReceipt] = useState<{
    id: number;
    reference: string;
    trackingToken: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState("");
  const create = trpc.mds.requests.create.useMutation();
  const upload = trpc.mds.documents.upload.useMutation();
  const questionSteps = (service?.questions || []).map((question, index) => ({
    key: "question:" + index,
    title: question,
  }));
  const steps = [
    { key: "description", title: "Que se passe-t-il ?" },
    ...questionSteps,
    { key: "photo", title: "Une photo pour mieux comprendre ?" },
    { key: "address", title: "Où faut-il intervenir ?" },
    { key: "date", title: "Quand seriez-vous disponible ?" },
    { key: "name", title: "Comment vous appelez-vous ?" },
    { key: "email", title: "À quelle adresse vous contacter ?" },
    { key: "phone", title: "Quel est votre numéro de téléphone ?" },
    { key: "review", title: "Tout est prêt pour envoyer votre demande." },
  ];
  const current = steps[Math.min(step, steps.length - 1)];
  const set = (key: keyof Draft, value: string) =>
    setDraft(d => ({ ...d, [key]: value }));
  useEffect(() => {
    if (!receipt)
      try {
        sessionStorage.setItem("mds-request-draft", JSON.stringify(draft));
      } catch {}
  }, [draft, receipt]);
  useEffect(() => {
    if (user)
      setDraft(d => ({
        ...d,
        name: d.name || user.name || "",
        email: d.email || user.email || "",
      }));
  }, [user?.id]);
  useEffect(() => {
    const w = window as any;
    setSpeechSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => speechRef.current?.abort();
  }, []);
  useEffect(() => {
    if (!photo) {
      setPhotoPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);
  function dictate() {
    if (recording) {
      speechRef.current?.stop();
      return;
    }
    const w = window as any;
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setDraft(d => ({
        ...d,
        description: (d.description + " " + text).trim(),
      }));
    };
    recognition.onerror = () => {
      setRecording(false);
      setError(
        "La dictée n’a pas abouti. Vous pouvez écrire votre problème ou réessayer."
      );
    };
    recognition.onend = () => setRecording(false);
    speechRef.current = recognition;
    try {
      recognition.start();
      setRecording(true);
      setError("");
    } catch {
      setError("Le microphone est indisponible dans ce navigateur.");
    }
  }
  function validate() {
    if (current.key === "description" && draft.description.trim().length < 10)
      return "Décrivez votre problème en au moins 10 caractères.";
    if (
      current.key.startsWith("question:") &&
      !draft.answers[current.title]?.trim()
    )
      return "Répondez à cette question pour aider MDS à analyser le besoin.";
    if (current.key === "address") {
      if (draft.address.trim().length < 5)
        return "Indiquez le numéro et le nom de la rue.";
      if (!/^\d{5}$/.test(draft.postcode))
        return "Indiquez un code postal à 5 chiffres.";
      if (draft.city.trim().length < 2) return "Indiquez la ville.";
    }
    if (current.key === "date" && draft.date) {
      const date = new Date(draft.date + "T" + draft.time);
      if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
        return "Choisissez une date et une heure à venir.";
    }
    if (current.key === "name" && draft.name.trim().length < 2)
      return "Indiquez votre nom.";
    if (
      current.key === "email" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)
    )
      return "Indiquez une adresse e-mail valide.";
    if (current.key === "phone" && draft.phone.replace(/\D/g, "").length < 8)
      return "Indiquez un numéro de téléphone valide.";
    return "";
  }
  async function attach(r: { reference: string; trackingToken: string }) {
    if (!photo) return;
    try {
      await upload.mutateAsync({
        reference: r.reference,
        token: r.trackingToken,
        name: photo.name,
        mimeType: photo.type as "image/jpeg" | "image/png" | "image/webp",
        base64: await readFile(photo),
        kind: "photo",
      });
      setUploadError("");
    } catch (e: any) {
      setUploadError(
        "Votre demande est enregistrée, mais la photo n’a pas pu être jointe. " +
          e.message
      );
    }
  }
  async function send() {
    setError("");
    if (!consent) {
      setError(
        "Confirmez que MDS peut utiliser ces informations pour traiter votre demande."
      );
      return;
    }
    const desiredStart = draft.date
      ? new Date(draft.date + "T" + draft.time).toISOString()
      : null;
    const input = {
      serviceId: service?.id || null,
      problemType: draft.problemType,
      description: draft.description,
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      address: draft.address,
      postcode: draft.postcode,
      city: draft.city,
      desiredStart,
      organizationId,
      siteId,
      answers: draft.answers,
      consent: true as const,
      idempotencyKey: draft.key,
    };
    const parsed = createRequestSchema.safeParse(input);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ||
          "Vérifiez les informations de votre demande."
      );
      return;
    }
    try {
      const r = await create.mutateAsync(parsed.data);
      setReceipt(r);
      sessionStorage.removeItem("mds-request-draft");
      sessionStorage.setItem("mds-tracking:" + r.reference, r.trackingToken);
      await attach(r);
    } catch (e: any) {
      setError(
        e.message ||
          "Votre demande n’a pas pu être envoyée. Vos informations sont conservées."
      );
    }
  }
  const followLink = receipt
    ? "/suivi?ref=" +
      encodeURIComponent(receipt.reference) +
      "#cle=" +
      encodeURIComponent(receipt.trackingToken)
    : "";
  if (receipt)
    return (
      <main id="main-content" className="page-shell">
        <div className="wizard-wrap">
          <div className="success-icon">
            <Check size={28} />
          </div>
          <div className="eyebrow">DEMANDE ENREGISTRÉE</div>
          <h1 className="page-title">Merci, votre demande est transmise.</h1>
          <p className="lead muted">
            MDS va l’analyser. Aucun rendez-vous n’est confirmé : vous devrez
            accepter la proposition de votre artisan.
          </p>
          <div className="panel stack" style={{ marginTop: 25 }}>
            <div>
              <span className="eyebrow">VOTRE RÉFÉRENCE</span>
              <strong style={{ fontSize: 25 }}>{receipt.reference}</strong>
            </div>
            <p className="small-text muted">
              Conservez le lien de suivi ci-dessous. Il donne accès à votre
              dossier : ne le partagez qu’avec une personne autorisée. Aucun
              e-mail automatique n’est envoyé pour le moment.
            </p>
            <Link className="btn primary" href={followLink}>
              Suivre ma demande
              <ArrowRight size={18} />
            </Link>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    window.location.origin + followLink
                  );
                  setError("Lien copié.");
                } catch {
                  setError(
                    "Copie indisponible. Ouvrez le suivi et conservez le lien dans votre navigateur."
                  );
                }
              }}
            >
              <Copy size={16} />
              Copier mon lien de suivi
            </button>
            {error && <p role="status">{error}</p>}
          </div>
          {upload.isPending && (
            <p role="status">Ajout de votre photo en cours…</p>
          )}
          {uploadError && (
            <div className="notice error-message" role="alert">
              <p>{uploadError}</p>
              <button
                className="btn secondary"
                disabled={upload.isPending}
                onClick={() => attach(receipt)}
              >
                Réessayer l’ajout de la photo
              </button>
            </div>
          )}
          <Link className="text-link" href="/">
            Revenir à l’accueil
          </Link>
        </div>
      </main>
    );
  if (catalog.isLoading && serviceId)
    return (
      <main id="main-content" className="page-shell">
        <Loading />
      </main>
    );
  return (
    <main id="main-content" className="page-shell">
      <div className="wizard-wrap">
        <div className="wizard-top">
          <button
            className="wizard-back"
            onClick={() => {
              if (step) {
                setStep(step - 1);
                setError("");
              } else window.history.back();
            }}
          >
            <ArrowLeft size={16} />
            Retour
          </button>
          <span>
            Votre demande · {step + 1} / {steps.length}
          </span>
        </div>
        <div
          className="wizard-progress"
          aria-label={"Étape " + (step + 1) + " sur " + steps.length}
        >
          {steps.map((s, i) => (
            <span key={s.key} className={i <= step ? "done" : ""} />
          ))}
        </div>
        <form
          className="wizard"
          onSubmit={e => {
            e.preventDefault();
            const msg = validate();
            setError(msg);
            if (msg) return;
            if (current.key === "review") send();
            else {
              speechRef.current?.stop();
              setStep(step + 1);
            }
          }}
        >
          <div className="eyebrow">
            {service
              ? service.name
              : organizationId
                ? "DEMANDE PROFESSIONNELLE"
                : "DEMANDE LIBRE · À ANALYSER"}
          </div>
          <h1 ref={headingRef} tabIndex={-1}>
            {current.title}
          </h1>
          {current.key === "description" && (
            <>
              <p className="wizard-subtitle">
                Décrivez simplement ce qui ne fonctionne pas ou ce que vous
                souhaitez réaliser.
              </p>
              {serviceId && !service && !catalog.isLoading && (
                <div className="notice">
                  Cette prestation n’est plus ouverte. Vous pouvez quand même
                  envoyer votre demande libre.
                </div>
              )}
              {catalog.error && (
                <ApiError
                  message={catalog.error.message}
                  retry={() => catalog.refetch()}
                />
              )}
              <div className="field">
                <label htmlFor="description">Votre problème</label>
                <textarea
                  id="description"
                  value={draft.description}
                  onChange={e => set("description", e.target.value)}
                  placeholder="Par exemple : l’eau coule sous l’évier depuis ce matin…"
                  maxLength={5000}
                  aria-describedby="description-help"
                  autoFocus
                />
                <small id="description-help">
                  Votre demande est conservée même si le problème n’existe pas
                  dans le catalogue.
                </small>
              </div>
              {service && service.problemTypes.length > 0 && (
                <div className="field">
                  <label htmlFor="problem-type">
                    Le problème le plus proche (facultatif)
                  </label>
                  <select
                    id="problem-type"
                    value={draft.problemType}
                    onChange={e => set("problemType", e.target.value)}
                  >
                    <option value="">Je préfère décrire avec mes mots</option>
                    {service.problemTypes.map(p => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                className="text-link"
                disabled={!speechSupported}
                onClick={dictate}
              >
                {recording ? <MicOff size={17} /> : <Mic size={17} />}{" "}
                {recording
                  ? "Arrêter la dictée"
                  : speechSupported
                    ? "Dicter mon problème"
                    : "Dictée indisponible sur ce navigateur"}
              </button>
              {recording && (
                <p role="status" className="small-text muted">
                  Vous pouvez parler. La dictée utilise le service vocal de
                  votre navigateur ; MDS ne conserve pas l’audio.
                </p>
              )}
            </>
          )}
          {current.key.startsWith("question:") && (
            <>
              <p className="wizard-subtitle">
                Cette précision aide votre artisan à préparer la proposition.
              </p>
              <div className="field">
                <label htmlFor="specific-answer">Votre réponse</label>
                <textarea
                  id="specific-answer"
                  maxLength={1000}
                  value={draft.answers[current.title] || ""}
                  onChange={e =>
                    setDraft(d => ({
                      ...d,
                      answers: {
                        ...d.answers,
                        [current.title]: e.target.value,
                      },
                    }))
                  }
                />
              </div>
            </>
          )}
          {current.key === "photo" && (
            <>
              <p className="wizard-subtitle">
                C’est facultatif. Évitez de photographier des personnes ou des
                documents personnels.
              </p>
              <div className="field">
                <label htmlFor="photo">
                  <ImagePlus size={18} />
                  Ajouter une photo
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    setError("");
                    if (!f) {
                      setPhoto(null);
                      return;
                    }
                    if (f.size > 5 * 1024 * 1024) {
                      setError("La photo doit faire moins de 5 Mo.");
                      return;
                    }
                    if (
                      !["image/jpeg", "image/png", "image/webp"].includes(
                        f.type
                      )
                    ) {
                      setError("Choisissez une photo JPG, PNG ou WebP.");
                      return;
                    }
                    setPhoto(f);
                  }}
                />
                <small>
                  JPG, PNG ou WebP · 5 Mo maximum. Pièce jointe chiffrée,
                  accessible aux personnes autorisées au dossier.
                </small>
              </div>
              {photoPreview && (
                <>
                  <img
                    className="upload-preview"
                    src={photoPreview}
                    alt="Photo sélectionnée pour votre demande"
                  />
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setPhoto(null)}
                  >
                    Retirer la photo
                  </button>
                </>
              )}
            </>
          )}
          {current.key === "address" && (
            <>
              <p className="wizard-subtitle">
                L’adresse permet à MDS de vérifier la zone d’intervention.
                Aucune disponibilité n’est garantie à ce stade.
              </p>
              <div className="field">
                <label htmlFor="address">Numéro et rue</label>
                <input
                  id="address"
                  autoComplete="street-address"
                  value={draft.address}
                  onChange={e => set("address", e.target.value)}
                  maxLength={250}
                  placeholder="12 rue des Lilas"
                />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="postcode">Code postal</label>
                  <input
                    id="postcode"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={5}
                    value={draft.postcode}
                    onChange={e =>
                      set("postcode", e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="75000"
                  />
                </div>
                <div className="field">
                  <label htmlFor="city">Ville</label>
                  <input
                    id="city"
                    autoComplete="address-level2"
                    value={draft.city}
                    onChange={e => set("city", e.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>
            </>
          )}
          {current.key === "date" && (
            <>
              <p className="wizard-subtitle">
                Proposez un créneau souhaité, ou laissez MDS vous en proposer
                un. Ce n’est pas une réservation définitive.
              </p>
              <div className="field">
                <label htmlFor="desired-date">
                  <CalendarDays size={17} />
                  Date souhaitée (facultative)
                </label>
                <input
                  id="desired-date"
                  type="date"
                  min={new Date().toLocaleDateString("en-CA")}
                  value={draft.date}
                  onChange={e => set("date", e.target.value)}
                />
              </div>
              {draft.date && (
                <div className="field">
                  <label htmlFor="desired-time">Heure souhaitée</label>
                  <input
                    id="desired-time"
                    type="time"
                    value={draft.time}
                    onChange={e => set("time", e.target.value)}
                    required
                  />
                  <small>
                    Heure locale de votre appareil. MDS vous confirmera les
                    conditions.
                  </small>
                </div>
              )}
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  set("date", "");
                  setStep(step + 1);
                }}
              >
                Je laisse MDS me proposer un créneau
              </button>
            </>
          )}
          {current.key === "name" && (
            <>
              <p className="wizard-subtitle">
                Pour que votre artisan sache à qui s’adresser.
              </p>
              <div className="field">
                <label htmlFor="name">Votre nom et prénom</label>
                <input
                  id="name"
                  autoComplete="name"
                  value={draft.name}
                  onChange={e => set("name", e.target.value)}
                  maxLength={120}
                />
              </div>
            </>
          )}
          {current.key === "email" && (
            <>
              <p className="wizard-subtitle">
                Votre adresse sera jointe au dossier pour permettre à MDS de
                vous contacter.
              </p>
              <div className="field">
                <label htmlFor="email">Votre adresse e-mail</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={draft.email}
                  onChange={e => set("email", e.target.value)}
                  maxLength={320}
                />
              </div>
            </>
          )}
          {current.key === "phone" && (
            <>
              <p className="wizard-subtitle">
                MDS pourra vous appeler si une précision est nécessaire.
              </p>
              <div className="field">
                <label htmlFor="phone">Votre numéro de téléphone</label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={draft.phone}
                  onChange={e => set("phone", e.target.value)}
                  maxLength={30}
                  placeholder="06 12 34 56 78"
                />
              </div>
            </>
          )}
          {current.key === "review" && (
            <>
              <p className="wizard-subtitle">
                Vérifiez ces informations. MDS vous proposera ensuite des
                conditions à confirmer.
              </p>
              <dl className="review-summary">
                <div>
                  <dt>Votre besoin</dt>
                  <dd>
                    {service?.name || "Demande libre"} — {draft.description}
                  </dd>
                  {service && (
                    <dd className="muted">
                      {money(service.priceCents)} · {service.durationMinutes}{" "}
                      min estimées
                    </dd>
                  )}
                </div>
                <div>
                  <dt>Adresse d’intervention</dt>
                  <dd>
                    {draft.address}
                    <br />
                    {draft.postcode} {draft.city}
                  </dd>
                </div>
                <div>
                  <dt>Créneau souhaité</dt>
                  <dd>
                    {draft.date
                      ? draft.date + " à " + draft.time
                      : "À proposer par MDS"}
                  </dd>
                </div>
                <div>
                  <dt>Vos coordonnées</dt>
                  <dd>
                    {draft.name}
                    <br />
                    {draft.email}
                    <br />
                    {draft.phone}
                  </dd>
                </div>
                {photo && (
                  <div>
                    <dt>Photo à joindre</dt>
                    <dd>{photo.name}</dd>
                  </div>
                )}
              </dl>
              {service?.conditions && (
                <div className="notice">{service.conditions}</div>
              )}
              <label className="consent-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                />
                <span>
                  J’autorise MDS à utiliser ces informations pour traiter ma
                  demande et me contacter. J’ai lu les{" "}
                  <Link
                    className="text-link"
                    href="/confidentialite"
                    target="_blank"
                  >
                    informations de confidentialité
                  </Link>
                  . Aucune intervention n’est confirmée sans mon accord.
                </span>
              </label>
            </>
          )}
          {error && (
            <p className="notice error-message" role="alert">
              {error}
            </p>
          )}
          <button
            className="btn primary"
            type="submit"
            disabled={create.isPending || upload.isPending}
          >
            {create.isPending
              ? "Envoi de votre demande…"
              : current.key === "review"
                ? "Envoyer ma demande"
                : current.key === "photo" && !photo
                  ? "Continuer sans photo"
                  : "Continuer"}
            <ArrowRight size={18} />
          </button>
          <p className="small-text muted" style={{ marginTop: 16 }}>
            Sans compte obligatoire · Votre saisie est conservée dans cette
            session.
          </p>
        </form>
      </div>
    </main>
  );
}
