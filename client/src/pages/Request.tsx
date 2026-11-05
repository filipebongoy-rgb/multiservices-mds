import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Copy,
  Home,
  Camera,
  CalendarDays,
  ChevronRight,
  Droplets,
  Flame,
  MapPin,
  Paintbrush,
  Wrench,
  Zap,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { rememberGuestRequest } from "@/lib/requestProgress";
import { problemImage } from "@/lib/problemImages";
import { createRequestSchema, dateTime, trades } from "@shared/mds";
import { PriceDetails } from "@/components/mds/PriceDetails";
import { ApiError } from "@/components/mds/Layout";

const tradeIcons: Record<string, typeof Wrench> = {
  plomberie: Droplets,
  electricite: Zap,
  chauffage: Flame,
  peinture: Paintbrush,
  maintenance: Wrench,
};

function hourLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

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
function initialDraftForRoute(params: URLSearchParams): Draft {
  const saved = initialDraft();
  const requestedTrade = params.get("metier") || "";
  const isFreeRequest = params.get("libre") === "1";
  const savedTrade = saved.answers.__trade || "";
  if (isFreeRequest || (requestedTrade && requestedTrade !== savedTrade)) {
    return {
      ...saved,
      description: "",
      problemType: "",
      date: "",
      time: "",
      serviceId: null,
      answers: { ...saved.answers, __trade: requestedTrade },
    };
  }
  return saved;
}
function initialStep() {
  try {
    const saved = initialDraft();
    if (saved.answers.__buildingType) return 1;
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
    tradeParam = params.get("metier") || "",
    isFreeRequest = params.get("libre") === "1";
  const organizationId =
      Number.isSafeInteger(orgParam) && orgParam > 0 ? orgParam : null,
    siteId =
      Number.isSafeInteger(siteParam) && siteParam > 0 ? siteParam : null;
  const routeDraft = initialDraftForRoute(params);
  const [draft, setDraft] = useState<Draft>(routeDraft),
    [step, setStep] = useState(initialStep);
  const [tradeChoice, setTradeChoice] = useState(
    () => tradeParam || routeDraft.answers.__trade || ""
  );
  const [selected, setSelected] = useState<number | null>(() => {
    if (params.get("libre") === "1") return null;
    const id = Number(params.get("service"));
    return Number.isSafeInteger(id) && id > 0 ? id : routeDraft.serviceId;
  });
  const { user } = useAuth();
  const catalog = trpc.mds.catalog.list.useQuery({});
  const service = catalog.data?.find(s => s.id === selected);
  const selectedTrade = trades.find(trade => trade.slug === tradeChoice);
  const problemHints: Record<string, string> = {
    Fuite: "fuite d’eau visible",
    Robinetterie: "robinet, mitigeur…",
    Débouchage: "évier, douche, WC…",
    WC: "remplacement, réparation",
    "Chasse d’eau": "mécanisme, flotteur",
    "Lavabo et évier": "remplacement, vidage",
    "Douche et baignoire": "débouchage, remplacement",
    "Chauffe-eau": "ballon d’eau chaude",
    Raccordements: "évacuation, alimentation",
    "Panne électrique": "coupure partielle ou totale",
    Prises: "remplacement, ajout",
    Interrupteurs: "simple, va-et-vient",
    Éclairage: "luminaire, spot, ampoule",
    "Tableau électrique": "disjoncteur, différentiel",
    "Mise en sécurité": "mise aux normes",
    VMC: "nettoyage, remplacement",
    "Panne de chauffage": "ne chauffe plus",
    Radiateurs: "purge, robinet",
    Chaudière: "diagnostic, réglage",
    Thermostat: "installation, remplacement",
    Entretien: "entretien périodique",
    "Circuit de chauffage": "désembouage, raccordements",
    Murs: "intérieur ou extérieur",
    Plafonds: "mise en peinture",
    Portes: "peinture et finition",
    "Préparation des surfaces": "décollement, lissage",
    Rebouchage: "trous et fissures",
    Ponçage: "préparation des surfaces",
    Rénovation: "remise à neuf complète",
    "Montage de meubles": "kits type IKEA",
    Fixations: "étagères, tringles, miroirs",
    Réglages: "portes, tiroirs",
    "Petites réparations": "poignées, joints…",
    "Entretien courant": "bricolage du quotidien",
  };
  const problemOptions = (selectedTrade?.services ?? []).map(problem => ({
    label:
      problem === "Fuite"
        ? "Fuite d’eau"
        : problem === "WC"
          ? "WC et chasse d’eau"
          : problem === "Lavabo et évier"
            ? "Évier et lavabo"
            : problem,
    value: problem,
    hint: problemHints[problem],
  }));
  const today = new Date().toLocaleDateString("en-CA");
  const upcomingDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() + index);
    const short = day.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return {
      value: day.toLocaleDateString("en-CA"),
      title: index === 0 ? "Aujourd’hui" : index === 1 ? "Demain" : short,
      subtitle:
        index < 2 ? short : day.toLocaleDateString("fr-FR", { month: "long" }),
    };
  });
  useEffect(() => {
    if (service && !tradeChoice) setTradeChoice(service.trade);
  }, [service?.id, tradeChoice]);
  const organization = trpc.mds.organizations.detail.useQuery(
    { id: organizationId || 0 },
    { enabled: !!organizationId && !!user, retry: false }
  );
  const [error, setError] = useState(""),
    [consent, setConsent] = useState(false),
    [photos, setPhotos] = useState<File[]>([]),
    [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [recurrence, setRecurrence] = useState<"onetime" | "recurring">(
    "onetime"
  );
  const [selectedSlot, setSelectedSlot] = useState<string>("");
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
      enabled: step === 4 && (!selected || !!service),
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
      date: draft.date || new Date().toLocaleDateString("en-CA"),
    },
    {
      enabled: step === 3 && /^\d{5}$/.test(draft.postcode),
      retry: false,
    }
  );
  function validateStage() {
    if (step === 0 && !selectedTrade)
      return "Choisissez le métier qui correspond à votre besoin.";
    if (step === 1 && !selectedTrade && !isFreeRequest)
      return "Choisissez le service qui correspond à votre besoin.";
    if (step === 1 && !draft.problemType)
      return "Choisissez le type de problème qui correspond le mieux.";
    if (step === 2 && draft.description.trim().length < 10)
      return "Décrivez votre problème en quelques mots (10 caractères minimum).";
    if (step === 2) {
      if (
        draft.address.trim().length < 5 ||
        !/^\d{5}$/.test(draft.postcode) ||
        draft.city.trim().length < 2
      )
        return "Complétez l’adresse, le code postal et la ville.";
    }
    if (step === 3 && slots.data?.configured && !selectedSlot)
      return "Choisissez l’un des créneaux disponibles avant de continuer.";
    if (step === 3 && draft.date) {
      if (
        !draft.time ||
        !Number.isFinite(new Date(draft.date + "T" + draft.time).getTime()) ||
        new Date(draft.date + "T" + draft.time) <= new Date()
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
    setStep(s => Math.min(s + 1, 4));
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
    const desiredStart = selectedSlot
      ? new Date(selectedSlot).toISOString()
      : draft.date && draft.time
        ? new Date(draft.date + "T" + draft.time).toISOString()
        : null;
    const input = {
      serviceId: service?.id ?? null,
      pricingFingerprint: pricing.data.fingerprint,
      problemType:
        draft.problemType ||
        trades.find(trade => trade.slug === tradeParam)?.name ||
        "",
      description:
        recurrence === "recurring"
          ? `${draft.description}\n[Demande de récurrence : abonnement mensuel/annuel souhaité]`
          : draft.description,
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
      if (!user) rememberGuestRequest(result.reference, result.trackingToken);
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
  // Le type de bâtiment reste obligatoire côté métier, mais il est présenté
  // dans le premier écran visuel « Service » de la maquette.
  const progressStep = step <= 1 ? 0 : step === 2 ? 1 : step === 3 ? 2 : 3;
  return (
    <main id="main-content" className="page-shell standard-page">
      <div
        className="request-simple"
        style={{ maxWidth: 720, margin: "0 auto" }}
      >
        <ol className="request-progress" aria-label="Étapes de la demande">
          {["Service", "Détails", "Disponibilité", "Validation"].map(
            (title, i) => (
              <li
                key={title}
                className={
                  progressStep === i
                    ? "current"
                    : progressStep > i
                      ? "done"
                      : ""
                }
                aria-current={progressStep === i ? "step" : undefined}
              >
                <span>{i + 1}</span>
                {title}
              </li>
            )
          )}
        </ol>
        <section className="panel stack">
          <p className="request-kicker">Demande d’intervention</p>
          <h1 ref={headingRef} tabIndex={-1} className="page-title">
            {step === 1 && !selectedTrade && !isFreeRequest
              ? "Votre service"
              : [
                  "Votre logement",
                  "Votre problème",
                  "Détails",
                  "Votre disponibilité",
                  "Vérification",
                ][step]}
          </h1>
          {(step === 0 || step === 2 || step === 4) && (
            <p className="request-subtitle">
              {step === 0 && "Pour adapter l’intervention à votre lieu."}
              {step === 2 &&
                "Quelques mots suffisent. Les photos aident l’artisan à préparer son matériel."}
              {step === 4 && "Relisez, puis envoyez votre demande."}
            </p>
          )}
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
            <div className="property-grid" aria-label="Choisir un type de lieu">
              {[
                {
                  value: "appartement",
                  label: "Appartement",
                  hint: "studio, 2 pièces…",
                  icon: Home,
                },
                {
                  value: "maison",
                  label: "Maison",
                  hint: "individuelle",
                  icon: Home,
                },
                {
                  value: "immeuble",
                  label: "Immeuble ou copropriété",
                  hint: "parties communes",
                  icon: Building2,
                },
                {
                  value: "local-professionnel",
                  label: "Local professionnel",
                  hint: "bureau, commerce…",
                  icon: Building2,
                },
                {
                  value: "batiment-public",
                  label: "Bâtiment public ou collectivité",
                  hint: "école, mairie…",
                  icon: Building2,
                },
                {
                  value: "autre",
                  label: "Autre bâtiment",
                  hint: "autre type de lieu",
                  icon: Home,
                },
              ].map(building => {
                const Icon = building.icon;
                return (
                  <button
                    key={building.value}
                    type="button"
                    className="property-card"
                    onClick={() => {
                      setDraft(d => ({
                        ...d,
                        answers: {
                          ...d.answers,
                          __buildingType: building.value,
                        },
                      }));
                      setStep(1);
                    }}
                  >
                    <Icon size={26} strokeWidth={1.7} aria-hidden="true" />
                    <span className="property-card-text">
                      <strong>{building.label}</strong>
                      <small>{building.hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {step === 1 && (
            <>
              {!selectedTrade && !isFreeRequest && (
                <div className="choice-list" aria-label="Choisir un service">
                  {trades.map(trade => (
                    <button
                      key={trade.slug}
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        setTradeChoice(trade.slug);
                        setDraft(d => ({
                          ...d,
                          problemType: "",
                          answers: { ...d.answers, __trade: trade.slug },
                        }));
                        setSelected(null);
                      }}
                    >
                      <strong>{trade.name}</strong>
                      <span className="muted">{trade.short}</span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
              {selectedTrade && (
                <div className="selected-context">
                  <strong>{selectedTrade.name}</strong>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setStep(0)}
                  >
                    Modifier
                  </button>
                </div>
              )}
              {selectedTrade ? (
                <>
                  <div
                    className="problem-list"
                    role="radiogroup"
                    aria-label="Quel est votre problème ?"
                  >
                    {problemOptions.map(problem => {
                      const active = catalog.data?.find(
                        item =>
                          item.trade === selectedTrade.slug &&
                          item.name.toLocaleLowerCase("fr") ===
                            problem.value.toLocaleLowerCase("fr")
                      );
                      const checked = draft.problemType === problem.value;
                      const photo = problemImage(
                        problem.value,
                        active?.photoUrl
                      );
                      return (
                        <button
                          key={problem.value}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          className={`problem-choice${checked ? " is-checked" : ""}`}
                          onClick={() => {
                            setDraft(d => ({
                              ...d,
                              problemType: problem.value,
                            }));
                            setSelected(active?.id ?? null);
                          }}
                        >
                          <span className="problem-radio" aria-hidden="true" />
                          <span className="problem-text">
                            <strong>{problem.label}</strong>
                            {problem.hint && <small>({problem.hint})</small>}
                          </span>
                          {photo && (
                            <img
                              className="problem-thumb"
                              src={photo}
                              alt=""
                              loading="lazy"
                              width={112}
                              height={64}
                            />
                          )}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={draft.problemType === "Autre problème"}
                      className={`problem-choice${draft.problemType === "Autre problème" ? " is-checked" : ""}`}
                      onClick={() => {
                        setDraft(d => ({
                          ...d,
                          problemType: "Autre problème",
                        }));
                        setSelected(null);
                      }}
                    >
                      <span className="problem-radio" aria-hidden="true" />
                      <span className="problem-text">
                        <strong>Autre problème</strong>
                      </span>
                    </button>
                  </div>
                </>
              ) : isFreeRequest ? (
                <p className="notice">
                  Décrivez votre besoin librement ; MDS vous orientera ensuite.
                </p>
              ) : null}
            </>
          )}
          {step === 2 && (
            <>
              {selectedTrade && (
                <div className="details-service-card">
                  {(() => {
                    const TradeIcon = tradeIcons[selectedTrade.slug] || Wrench;
                    return (
                      <TradeIcon
                        size={30}
                        strokeWidth={1.6}
                        aria-hidden="true"
                      />
                    );
                  })()}
                  <span>
                    <strong>{selectedTrade.name}</strong>
                    <small>
                      {problemOptions.find(o => o.value === draft.problemType)
                        ?.label || draft.problemType}
                    </small>
                  </span>
                </div>
              )}
              <div className="field">
                <label htmlFor="description">Description du problème *</label>
                <textarea
                  id="description"
                  rows={4}
                  value={draft.description}
                  maxLength={500}
                  placeholder="Exemple : la fuite vient du robinet de la cuisine."
                  onChange={e => set("description", e.target.value)}
                />
                <small className="field-counter" aria-live="polite">
                  {draft.description.length}/500
                </small>
              </div>
              <div className="field">
                <label htmlFor="address">Adresse d’intervention *</label>
                <div className="input-with-icon">
                  <MapPin size={20} aria-hidden="true" />
                  <input
                    id="address"
                    autoComplete="street-address"
                    value={draft.address}
                    maxLength={250}
                    placeholder="12 rue de la Paix"
                    onChange={e => set("address", e.target.value)}
                  />
                </div>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="postcode">Code postal *</label>
                  <input
                    id="postcode"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    value={draft.postcode}
                    maxLength={5}
                    placeholder="35000"
                    onChange={e =>
                      set("postcode", e.target.value.replace(/\D/g, ""))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="city">Ville *</label>
                  <input
                    id="city"
                    autoComplete="address-level2"
                    value={draft.city}
                    maxLength={100}
                    placeholder="Rennes"
                    onChange={e => set("city", e.target.value)}
                  />
                </div>
              </div>
              <label className="photo-row" htmlFor="photo">
                <Camera size={21} aria-hidden="true" />
                <span>
                  {photos.length
                    ? `${photos.length} photo${photos.length > 1 ? "s" : ""} ajoutée${photos.length > 1 ? "s" : ""}`
                    : "Ajouter des photos (facultatif)"}
                </span>
                <ChevronRight size={20} aria-hidden="true" />
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
          {step === 3 && (
            <>
              <div className="availability-intro">
                <CalendarDays size={30} strokeWidth={1.6} aria-hidden="true" />
                <p>
                  {slots.data?.configured
                    ? "Choisissez le créneau qui vous convient. Seuls les horaires réellement disponibles sont affichés."
                    : "Choisissez un jour et une heure si vous avez une préférence. MDS vous proposera le meilleur horaire disponible."}
                </p>
              </div>
              <div
                className="day-tabs"
                role="radiogroup"
                aria-label="Choisir un jour"
              >
                {!slots.data?.configured && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!draft.date}
                    className={!draft.date ? "selected" : ""}
                    onClick={() => {
                      setDraft(d => ({ ...d, date: "", time: "" }));
                      setSelectedSlot("");
                    }}
                  >
                    <strong>À convenir</strong>
                    <small>avec MDS</small>
                  </button>
                )}
                {upcomingDays.map(day => {
                  const checked =
                    (draft.date || (slots.data?.configured ? today : "")) ===
                    day.value;
                  return (
                    <button
                      key={day.value}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      className={checked ? "selected" : ""}
                      onClick={() => {
                        setDraft(d => ({ ...d, date: day.value, time: "" }));
                        setSelectedSlot("");
                      }}
                    >
                      <strong>{day.title}</strong>
                      <small>{day.subtitle}</small>
                    </button>
                  );
                })}
              </div>
              {slots.isLoading && slots.fetchStatus !== "idle" && (
                <p className="muted">Recherche des créneaux disponibles…</p>
              )}
              {slots.data?.configured ? (
                slots.data.slots.length ? (
                  <div
                    className="slot-radio-list"
                    role="radiogroup"
                    aria-label="Créneaux disponibles"
                  >
                    {slots.data.slots.map(slot => {
                      const checked = selectedSlot === slot.startAt;
                      return (
                        <button
                          key={slot.startAt}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          className={`slot-radio${checked ? " is-checked" : ""}`}
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
                            setSelectedSlot(slot.startAt);
                            setConsent(false);
                          }}
                        >
                          <span className="problem-radio" aria-hidden="true" />
                          <strong>
                            {hourLabel(slot.startAt)} – {hourLabel(slot.endAt)}
                          </strong>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="notice">
                    {slots.data.reason ||
                      "Aucun créneau libre ce jour-là. Choisissez un autre jour."}
                  </p>
                )
              ) : (
                draft.date && (
                  <div className="field">
                    <label htmlFor="time">Heure souhaitée</label>
                    <input
                      id="time"
                      type="time"
                      value={draft.time}
                      onChange={e => {
                        set("time", e.target.value);
                        setSelectedSlot("");
                      }}
                    />
                  </div>
                )
              )}
              {slots.error && (
                <p className="muted">
                  Créneaux momentanément indisponibles. Choisissez « À convenir
                  » et MDS vous proposera un horaire.
                </p>
              )}
              <p className="muted small-text">
                {slots.data?.configured
                  ? "Le créneau choisi est contrôlé une dernière fois par MDS avant confirmation."
                  : "MDS confirme l’horaire après lecture de votre demande."}
              </p>
            </>
          )}
          {step === 4 && (
            <>
              <p>
                <strong>
                  {service?.name || draft.problemType || "Votre problème"}
                </strong>{" "}
                · {draft.postcode} {draft.city}
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
              <fieldset className="field">
                <legend>Récurrence de votre besoin</legend>
                <div
                  className="recurrence-options"
                  role="radiogroup"
                  aria-label="Récurrence du besoin"
                >
                  <label className="recurrence-option">
                    <input
                      type="radio"
                      name="recurrence"
                      value="onetime"
                      checked={recurrence === "onetime"}
                      onChange={() => setRecurrence("onetime")}
                    />
                    <span>
                      <strong>Intervention ponctuelle</strong>
                      <small>Pour ce dépannage précis</small>
                    </span>
                  </label>
                  <label className="recurrence-option">
                    <input
                      type="radio"
                      name="recurrence"
                      value="recurring"
                      checked={recurrence === "recurring"}
                      onChange={() => setRecurrence("recurring")}
                    />
                    <span>
                      <strong>Abonnement (mensuel / annuel)</strong>
                      <small>
                        Contrat d’entretien avec tarif réduit ·{" "}
                        <Link
                          href="/professionnels"
                          className="text-link"
                          target="_blank"
                        >
                          voir l’offre pro
                        </Link>
                      </small>
                    </span>
                  </label>
                </div>
              </fieldset>
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
          <div
            className={`row ${step === 1 ? "request-actions-single" : ""}`}
            style={{ flexWrap: "wrap" }}
          >
            {step > 1 && (
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
            {step > 0 && step < 4 ? (
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
            ) : step === 4 ? (
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
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
