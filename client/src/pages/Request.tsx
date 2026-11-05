import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Copy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { createRequestSchema, dateTime, trades } from "@shared/mds";
import { PriceDetails } from "@/components/mds/PriceDetails";
import { ApiError } from "@/components/mds/Layout";

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
  serviceId: number | null;
};
const blank: Draft = {
  description: "",
  problemType: "",
  address: "",
  postcode: "",
  city: "",
  date: "",
  time: "",
  name: "",
  email: "",
  phone: "",
  answers: {},
  key: "",
  serviceId: null,
};
function initialDraft(): Draft {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("mds-request-draft") || "null"
    );
    return { ...blank, ...saved, key: saved?.key || crypto.randomUUID() };
  } catch {
    return { ...blank, key: crypto.randomUUID() };
  }
}
function initialStep() {
  try {
    const ready = sessionStorage.getItem("mds-description-ready");
    sessionStorage.removeItem("mds-description-ready");
    return ready && initialDraft().description.trim().length >= 10 ? 1 : 0;
  } catch {
    return 0;
  }
}
function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
export default function Request() {
  const params = new URLSearchParams(window.location.search),
    orgParam = Number(params.get("org")),
    siteParam = Number(params.get("site")),
    tradeParam = params.get("metier") || "";
  const organizationId =
      Number.isSafeInteger(orgParam) && orgParam > 0 ? orgParam : null,
    siteId =
      Number.isSafeInteger(siteParam) && siteParam > 0 ? siteParam : null;
  const [draft, setDraft] = useState<Draft>(initialDraft),
    [step, setStep] = useState(initialStep);
  const [selected, setSelected] = useState<number | null>(() => {
    if (params.get("libre") === "1") return null;
    const id = Number(params.get("service"));
    return Number.isSafeInteger(id) && id > 0 ? id : initialDraft().serviceId;
  });
  const { user } = useAuth();
  const catalog = trpc.mds.catalog.list.useQuery({});
  const service = catalog.data?.find(s => s.id === selected);
  const organization = trpc.mds.organizations.detail.useQuery(
    { id: organizationId || 0 },
    { enabled: !!organizationId && !!user, retry: false }
  );
  const [error, setError] = useState(""),
    [consent, setConsent] = useState(false),
    [photos, setPhotos] = useState<File[]>([]),
    [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<{
      id: number;
      reference: string;
      trackingToken: string;
    } | null>(null),
    [uploadError, setUploadError] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null),
    fingerprintSeen = useRef<string | null>(null);
  const create = trpc.mds.requests.create.useMutation(),
    upload = trpc.mds.documents.upload.useMutation();
  const set = (key: keyof Draft, value: string) => {
    setDraft(d => ({ ...d, [key]: value }));
    setConsent(false);
  };
  useEffect(() => {
    if (!receipt)
      try {
        sessionStorage.setItem(
          "mds-request-draft",
          JSON.stringify({ ...draft, serviceId: selected })
        );
      } catch {}
  }, [draft, selected, receipt]);
  useEffect(() => {
    if (user)
      setDraft(d => ({
        ...d,
        name: d.name || user.name || "",
        email: d.email || user.email || "",
      }));
  }, [user?.id]);
  useEffect(() => {
    const site = organization.data?.sites.find(s => s.id === siteId);
    if (site)
      setDraft(d => ({
        ...d,
        address: site.address,
        postcode: site.postcode,
        city: site.city,
        name: site.contactName || d.name,
        phone: site.contactPhone || d.phone,
      }));
  }, [organization.data, siteId]);
  useEffect(() => {
    const urls = photos.map(file => URL.createObjectURL(file));
    setPhotoPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [photos]);
  useEffect(() => {
    headingRef.current?.focus();
    setError("");
  }, [step]);
  const pricing = trpc.mds.catalog.pricing.useQuery(
    {
      serviceId: service?.id ?? null,
      postcode: /^\d{5}$/.test(draft.postcode) ? draft.postcode : undefined,
    },
    {
      enabled: step === 2 && (!selected || !!service),
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  useEffect(() => {
    const fingerprint = pricing.data?.fingerprint;
    if (fingerprint !== fingerprintSeen.current) {
      fingerprintSeen.current = fingerprint || null;
      setConsent(false);
    }
  }, [pricing.data?.fingerprint]);
  const slots = trpc.mds.calendar.slots.useQuery(
    {
      serviceId: service?.id ?? null,
      postcode: draft.postcode,
      date: draft.date,
    },
    {
      enabled:
        step === 1 &&
        /^\d{5}$/.test(draft.postcode) &&
        /^\d{4}-\d{2}-\d{2}$/.test(draft.date),
      retry: false,
    }
  );
  function validateStage() {
    if (selected && !service)
      return "Cette prestation n’est pas disponible. Choisissez une offre active ou décrivez votre problème librement.";
    if (step === 0 && draft.description.trim().length < 10)
      return "Décrivez votre problème en quelques mots (10 caractères minimum).";
    if (step === 1) {
      if (
        draft.address.trim().length < 5 ||
        !/^\d{5}$/.test(draft.postcode) ||
        draft.city.trim().length < 2
      )
        return "Complétez l’adresse, le code postal et la ville.";
      if (
        draft.date &&
        (!draft.time ||
          !Number.isFinite(new Date(draft.date + "T" + draft.time).getTime()) ||
          new Date(draft.date + "T" + draft.time) <= new Date())
      )
        return "Choisissez une heure future, ou laissez le créneau à convenir.";
    }
    return "";
  }
  function next() {
    const issue = validateStage();
    if (issue) {
      setError(issue);
      return;
    }
    setStep(s => Math.min(s + 1, 2));
  }
  async function uploadPhoto(key = receipt) {
    if (!key || !photos.length) return;
    setUploadError("");
    try {
      for (const photo of photos) {
        await upload.mutateAsync({
          reference: key.reference,
          token: key.trackingToken,
          name: photo.name,
          mimeType: photo.type,
          kind: "photo",
          photoStage: "before",
          base64: await readFile(photo),
        });
      }
      setPhotos([]);
    } catch (e: any) {
      setUploadError(
        e.message ||
          "La photo n’a pas été ajoutée. Votre demande est bien conservée."
      );
    }
  }
  async function submit() {
    setError("");
    if (!consent) {
      setError("Acceptez les conditions de la demande avant l’envoi.");
      return;
    }
    if (!pricing.data) {
      setError("Le prix et les conditions doivent être relus avant l’envoi.");
      return;
    }
    const desiredStart =
      draft.date && draft.time
        ? new Date(draft.date + "T" + draft.time).toISOString()
        : null;
    const input = {
      serviceId: service?.id ?? null,
      pricingFingerprint: pricing.data.fingerprint,
      problemType:
        draft.problemType ||
        trades.find(trade => trade.slug === tradeParam)?.name ||
        "",
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
        parsed.error.issues[0]?.message || "Vérifiez les informations saisies."
      );
      return;
    }
    try {
      const result = await create.mutateAsync(parsed.data);
      setReceipt(result);
      try {
        sessionStorage.removeItem("mds-request-draft");
        sessionStorage.setItem(
          "mds-tracking:" + result.reference,
          result.trackingToken
        );
      } catch {}
      await uploadPhoto(result);
    } catch (e: any) {
      setError(
        e.message ||
          "La demande n’a pas été envoyée. Votre saisie est conservée."
      );
      if (e?.data?.code === "CONFLICT") {
        setConsent(false);
        await pricing.refetch();
      }
    }
  }
  const tracking = receipt
    ? `/suivi?ref=${encodeURIComponent(receipt.reference)}#cle=${receipt.trackingToken}`
    : "";
  if (receipt)
    return (
      <main id="main-content" className="page-shell standard-page">
        <section
          className="panel stack request-simple"
          style={{ maxWidth: 650, margin: "0 auto" }}
        >
          <span className="eyebrow">{receipt.reference}</span>
          <h1 className="page-title">Demande envoyée.</h1>
          <p>
            MDS doit encore l’accepter. Vous confirmerez ensuite la proposition.
          </p>
          <Link className="btn primary" href={tracking}>
            Suivre ma demande
            <ArrowRight size={18} />
          </Link>
          <button
            className="btn secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  window.location.origin + tracking
                );
                setError("Lien privé copié.");
              } catch {
                setError(
                  "Copie indisponible. Conservez ce lien dans vos favoris."
                );
              }
            }}
          >
            <Copy size={17} />
            Copier le lien privé
          </button>
          <small className="muted">
            Conservez ce lien. Il donne accès à votre dossier.
          </small>
          {uploadError && (
            <>
              <p role="alert" className="notice">
                Demande conservée, photo non ajoutée : {uploadError}
              </p>
              <button
                className="btn secondary"
                disabled={upload.isPending}
                onClick={() => uploadPhoto()}
              >
                Réessayer la photo
              </button>
            </>
          )}
          {error && <p role="status">{error}</p>}
        </section>
      </main>
    );
  return (
    <main id="main-content" className="page-shell standard-page">
      <div
        className="request-simple"
        style={{ maxWidth: 720, margin: "0 auto" }}
      >
        <ol className="request-progress" aria-label="Étapes de la demande">
          {["Besoin", "Adresse et créneau", "Envoyer"].map((title, i) => (
            <li
              key={title}
              className={step === i ? "current" : step > i ? "done" : ""}
              aria-current={step === i ? "step" : undefined}
            >
              <span>{i + 1}</span>
              {title}
            </li>
          ))}
        </ol>
        <section className="panel stack">
          <h1 ref={headingRef} tabIndex={-1} className="page-title">
            {
              ["Que se passe-t-il ?", "Où et quand ?", "Envoyer ma demande"][
                step
              ]
            }
          </h1>
          {catalog.error && selected && (
            <ApiError
              message={catalog.error.message}
              retry={() => catalog.refetch()}
            />
          )}
          {organization.error && (
            <ApiError
              message={organization.error.message}
              retry={() => organization.refetch()}
            />
          )}
          {step === 0 && (
            <>
              {service && (
                <div className="row">
                  <strong>{service.name}</strong>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setSelected(null);
                      setConsent(false);
                    }}
                  >
                    Changer
                  </button>
                </div>
              )}
              {selected && !service && !catalog.isLoading && (
                <p className="notice">
                  Cette offre n’est pas disponible.{" "}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setSelected(null)}
                  >
                    Envoyer une demande libre
                  </button>
                </p>
              )}
              {!service && tradeParam && (
                <p className="notice">
                  Catégorie choisie :{" "}
                  <strong>
                    {trades.find(trade => trade.slug === tradeParam)?.name ||
                      tradeParam}
                  </strong>
                </p>
              )}
              <div className="field">
                <label htmlFor="description">Décrivez votre problème</label>
                <p className="action-example">
                  Exemple : « Le robinet fuit sous l’évier depuis ce matin. »
                </p>
                <textarea
                  id="description"
                  rows={4}
                  value={draft.description}
                  maxLength={5000}
                  placeholder="Mon robinet fuit…"
                  onChange={e => set("description", e.target.value)}
                />
              </div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <label className="btn secondary" htmlFor="photo">
                  <ImagePlus size={17} />
                  {photos.length
                    ? `${photos.length} photo(s) sélectionnée(s)`
                    : "Ajouter des photos"}
                </label>
                <input
                  id="photo"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="visually-hidden"
                  onChange={e => {
                    const selected = Array.from(e.target.files || []);
                    if (
                      selected.length > 10 ||
                      selected.some(
                        f =>
                          f.size > 5 * 1024 * 1024 ||
                          !["image/jpeg", "image/png", "image/webp"].includes(
                            f.type
                          )
                      )
                    ) {
                      setError(
                        "Jusqu’à 10 photos JPG, PNG ou WebP de 5 Mo maximum chacune."
                      );
                      e.target.value = "";
                      return;
                    }
                    setPhotos(selected);
                    setError("");
                  }}
                />
              </div>
              {photoPreviews.length > 0 && (
                <div className="photo-preview-grid">
                  {photoPreviews.map((preview, index) => (
                    <figure key={preview}>
                      <img
                        src={preview}
                        alt={`Photo ${index + 1} sélectionnée`}
                      />
                      <button
                        type="button"
                        className="text-link"
                        onClick={() =>
                          setPhotos(current =>
                            current.filter((_, i) => i !== index)
                          )
                        }
                      >
                        Retirer
                      </button>
                    </figure>
                  ))}
                </div>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <div className="field">
                <label htmlFor="address">Adresse de l’intervention</label>
                <p className="action-example">
                  Exemple : 12 rue des Lilas, bâtiment B, 2e étage.
                </p>
                <input
                  id="address"
                  autoComplete="street-address"
                  value={draft.address}
                  maxLength={250}
                  onChange={e => set("address", e.target.value)}
                />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="postcode">Code postal</label>
                  <input
                    id="postcode"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    value={draft.postcode}
                    maxLength={5}
                    onChange={e =>
                      set("postcode", e.target.value.replace(/\D/g, ""))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="city">Ville</label>
                  <input
                    id="city"
                    autoComplete="address-level2"
                    value={draft.city}
                    maxLength={100}
                    onChange={e => set("city", e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="date">Date souhaitée (facultative)</label>
                <p className="action-example">
                  Exemple : choisissez une date si vous avez une préférence ;
                  MDS confirmera ensuite.
                </p>
                <input
                  id="date"
                  type="date"
                  value={draft.date}
                  min={new Date().toLocaleDateString("en-CA")}
                  onChange={e => set("date", e.target.value)}
                />
              </div>
              {draft.date && (
                <>
                  {slots.data?.slots.length ? (
                    <div
                      className="slot-list"
                      aria-label="Créneaux actuellement possibles"
                    >
                      {slots.data.slots.map(slot => (
                        <button
                          key={slot.startAt}
                          type="button"
                          className={`btn secondary ${new Date(draft.date + "T" + draft.time).getTime() === new Date(slot.startAt).getTime() ? "selected" : ""}`}
                          onClick={() => {
                            const date = new Date(slot.startAt);
                            const local = new Date(
                              date.getTime() - date.getTimezoneOffset() * 60000
                            )
                              .toISOString()
                              .slice(0, 16)
                              .split("T");
                            setDraft(d => ({
                              ...d,
                              date: local[0],
                              time: local[1],
                            }));
                            setConsent(false);
                          }}
                        >
                          {dateTime(slot.startAt)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    slots.data?.reason && (
                      <p className="muted small-text">{slots.data.reason}</p>
                    )
                  )}
                  <div className="field">
                    <label htmlFor="time">
                      Heure souhaitée (heure de votre navigateur)
                    </label>
                    <input
                      id="time"
                      type="time"
                      value={draft.time}
                      onChange={e => set("time", e.target.value)}
                    />
                  </div>
                  {slots.error && (
                    <p className="muted">
                      Créneaux indisponibles. Vous pouvez proposer une heure à
                      MDS.
                    </p>
                  )}
                </>
              )}
              <p className="muted small-text">
                Ce créneau reste un souhait, pas une réservation.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <p>
                <strong>{service?.name || "Votre problème"}</strong> ·{" "}
                {draft.postcode} {draft.city}
              </p>
              {pricing.data ? (
                <PriceDetails snapshot={pricing.data.snapshot} />
              ) : pricing.error ? (
                <ApiError
                  message={pricing.error.message}
                  retry={() => pricing.refetch()}
                />
              ) : (
                <p role="status">Vérification du tarif…</p>
              )}
              <div className="field">
                <label htmlFor="name">Nom</label>
                <p className="action-example">
                  Exemple : indiquez le nom de la personne à contacter sur
                  place.
                </p>
                <input
                  id="name"
                  autoComplete="name"
                  value={draft.name}
                  maxLength={120}
                  onChange={e => set("name", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={draft.email}
                  maxLength={320}
                  onChange={e => set("email", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="phone">Téléphone</label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={draft.phone}
                  maxLength={30}
                  onChange={e => set("phone", e.target.value)}
                  placeholder="+33…"
                />
              </div>
              <details>
                <summary className="simple-summary">
                  Vérifier les détails
                </summary>
                <p>{draft.description}</p>
                <p>
                  {draft.address}, {draft.postcode} {draft.city}
                </p>
                <p>
                  {draft.date && draft.time
                    ? dateTime(new Date(draft.date + "T" + draft.time))
                    : "Créneau à convenir avec MDS"}
                </p>
              </details>
              <label className="row small-text" style={{ alignItems: "start" }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  J’accepte les conditions et{" "}
                  {pricing.data?.snapshot.totalCents != null
                    ? "le prix affiché"
                    : "une analyse sur devis"}
                  . MDS validera ma demande ; je confirmerai ensuite sa
                  proposition.{" "}
                  <Link href="/confidentialite" className="text-link">
                    Confidentialité
                  </Link>
                </span>
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="notice error-message">
              {error}
            </p>
          )}
          <div className="row" style={{ flexWrap: "wrap" }}>
            {step > 0 && (
              <button
                type="button"
                className="btn secondary"
                disabled={create.isPending}
                onClick={() => setStep(s => s - 1)}
              >
                <ArrowLeft size={17} />
                Retour
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                className="btn primary"
                disabled={
                  (!!selected && catalog.isLoading) ||
                  (!!organizationId && organization.isLoading)
                }
                onClick={next}
              >
                Continuer
                <ArrowRight size={17} />
              </button>
            ) : (
              <button
                type="button"
                className="btn primary"
                disabled={
                  create.isPending ||
                  !consent ||
                  !pricing.data ||
                  (!!organizationId &&
                    (!user || organization.isLoading || !!organization.error))
                }
                onClick={() => submit()}
              >
                {create.isPending ? "Envoi…" : "Envoyer ma demande"}
                <Check size={17} />
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
