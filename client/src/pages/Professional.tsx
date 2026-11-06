import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Briefcase,
  Building,
  Building2,
  CheckCircle2,
  Clock,
  FileCheck2,
  GraduationCap,
  HeartPulse,
  Home,
  KeyRound,
  Mail,
  Phone,
  Plus,
  Sparkles,
  Store,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ActionButton,
  ErrorNotice,
  Field,
  LoginButton,
  PrivateModal,
  QueryState,
} from "@/components/mds/private-common";
import {
  OrganizationDetail,
  organizationTypes,
  type OrganizationType,
} from "@/components/mds/private-organization";
import "@/components/mds/private.css";

const sectors = [
  {
    id: "mairie",
    icon: Building2,
    name: "Mairies & collectivités territoriales",
    desc: "Bâtiments communaux, écoles municipales, médiathèques, locaux techniques.",
  },
  {
    id: "hlm",
    icon: Home,
    name: "Bailleurs sociaux & organismes HLM",
    desc: "Logements collectifs, parties communes, résidences étudiantes et sociales.",
  },
  {
    id: "syndic",
    icon: Building,
    name: "Syndics & gestionnaires de copropriétés",
    desc: "Immeubles, locaux poubelles, parkings, parties communes, compteurs.",
  },
  {
    id: "hopital",
    icon: HeartPulse,
    name: "Hôpitaux, cliniques & établissements de santé",
    desc: "Maintenance courante, mise en sécurité, réactivité renforcée.",
  },
  {
    id: "ecole",
    icon: GraduationCap,
    name: "Écoles, crèches & établissements scolaires",
    desc: "Sanitaires, électricité, sécurité des élèves, interventions hors temps scolaire.",
  },
  {
    id: "commerce",
    icon: Store,
    name: "Centres commerciaux, galeries & commerces",
    desc: "Sanitaires clients, maintenance continue, interventions hors heures d'ouverture.",
  },
  {
    id: "entreprise",
    icon: Briefcase,
    name: "Entreprises, bureaux & locaux professionnels",
    desc: "Petits travaux, réaménagements, entretien récurrent de vos sites.",
  },
];

const plans = [
  {
    id: "monthly",
    name: "Formule Mensuelle",
    commitment: "Sans engagement annuel",
    badge: null,
    highlight: false,
    priceNote: "Tarif adapté par bâtiment ou lot — sans engagement annuel",
    points: [
      "Abonnement mensualisé, résiliable avec un préavis court",
      "Priorité d'intervention par rapport aux demandes ponctuelles",
      "1 contact unique : plomberie, électricité, chauffage, peinture, maintenance",
      "Facturation mensuelle claire et prévisible",
      "Rapports avec photos avant/après obligatoires et signatures",
    ],
  },
  {
    id: "annual",
    name: "Formule Annuelle",
    commitment: "Engagement 12 mois",
    badge: "Tarif réduit — formule recommandée",
    highlight: true,
    priceNote: "Tarif réduit annuel avec remise d'engagement pour vos parcs",
    points: [
      "Tous les avantages de la formule mensuelle",
      "Tarif annuel remisé : la formule la plus avantageuse",
      "Visites de contrôle programmées et maintenance préventive",
      "Créneaux d'intervention réservés à l'avance",
      "Idéale pour les parcs : HLM, copropriétés, patrimoine communal",
    ],
  },
  {
    id: "custom",
    name: "Formule Sur-mesure Grands Comptes",
    commitment: "Multi-sites & établissements sensibles",
    badge: null,
    highlight: false,
    priceNote: "Sur devis personnalisé sous 48 h",
    points: [
      "Hôpitaux, centres commerciaux, bailleurs multi-sites",
      "Délais d'intervention contractuels (SLA) définis ensemble",
      "Astreinte et interventions en horaires décalés",
      "Interlocuteur dédié et reporting consolidé",
    ],
  },
];

const inclusions = [
  {
    title: "Priorité d'intervention garantie",
    text: "Vos demandes professionnelles passent avant les demandes ponctuelles.",
  },
  {
    title: "5 corps de métier, un seul contact",
    text: "Plomberie, électricité, chauffage, peinture, maintenance : un numéro, une facture.",
  },
  {
    title: "Preuves obligatoires à chaque intervention",
    text: "Photos avant/après obligatoires qui bloquent la fin des travaux, signatures clients enregistrées.",
  },
  {
    title: "Facturation unique mensuelle ou annuelle",
    text: "Une seule facture détaillée par bâtiment, pas de devis éparpillés.",
  },
  {
    title: "Pas de marketplace — toujours MDS",
    text: "Le même artisan de confiance sur vos sites, zéro sous-traitance anonyme.",
  },
  {
    title: "Rennes et agglomération — 30 km",
    text: "Interventions rapides sur l'ensemble de l'Ille-et-Vilaine.",
  },
];

type Formula = "annual" | "monthly" | "custom";

export default function Professional() {
  const auth = useAuth();
  const [tab, setTab] = useState<"offer" | "workspace">("offer");

  return (
    <main id="main-content" className="page-shell private-workspace simple-pro">
      <header className="simple-pro-header">
        <span className="eyebrow">
          Espace professionnel MDS · Rennes &amp; agglomération (30 km)
        </span>
        <h1>MULTISERVICES MDS pour les professionnels</h1>
        <p className="simple-pro-lead">
          Mairies, organismes HLM, syndics, bailleurs, hôpitaux, écoles, centres
          commerciaux et entreprises : un interlocuteur unique pour l'entretien
          et le dépannage de tous vos bâtiments, sous{" "}
          <strong>contrat d'entretien mensuel ou annuel</strong> avec des tarifs
          adaptés et une réduction annuelle attractive.
        </p>
      </header>

      <nav
        className="pro-tab-bar"
        aria-label="Navigation de l'espace professionnel"
      >
        <button
          type="button"
          className={`pro-tab ${tab === "offer" ? "active" : ""}`}
          onClick={() => setTab("offer")}
          aria-current={tab === "offer" ? "page" : undefined}
        >
          <Sparkles size={16} aria-hidden="true" />
          Offre professionnels &amp; contrats
        </button>
        <button
          type="button"
          className={`pro-tab ${tab === "workspace" ? "active" : ""}`}
          onClick={() => setTab("workspace")}
          aria-current={tab === "workspace" ? "page" : undefined}
        >
          <Building2 size={16} aria-hidden="true" />
          Mon espace organisation
          {!auth.user && (
            <span
              className="pro-tab-hint"
              title="Connexion requise pour accéder à vos organisations"
            >
              (connexion requise)
            </span>
          )}
        </button>
      </nav>

      {tab === "offer" && (
        <ProfessionalOffer onGoWorkspace={() => setTab("workspace")} />
      )}

      {tab === "workspace" && (
        <div className="pro-workspace-tab">
          {auth.loading ? (
            <QueryState loading />
          ) : auth.error ? (
            <QueryState error={auth.error} retry={auth.refresh} />
          ) : auth.user ? (
            <ProfessionalWorkspace currentUserId={auth.user.id} />
          ) : (
            <ProfessionalLanding />
          )}
        </div>
      )}

      <footer className="pro-footer-switch">
        <p className="muted small-text">
          Vous êtes l'artisan MDS ?{" "}
          <Link href="/artisan">Accéder à votre atelier →</Link>
        </p>
      </footer>
    </main>
  );
}

function ProfessionalOffer({ onGoWorkspace }: { onGoWorkspace: () => void }) {
  const { user } = useAuth();
  const [formula, setFormula] = useState<Formula>("annual");
  const [sector, setSector] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [name, setName] = useState(user?.name || "");
  const [org, setOrg] = useState("");
  const [buildings, setBuildings] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Rennes");
  const [postcode, setPostcode] = useState("35000");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const create = trpc.mds.requests.create.useMutation();

  function selectFormula(f: Formula) {
    setFormula(f);
    document
      .getElementById("demande-contrat")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectSector(sId: string) {
    setSector(sId);
    document
      .getElementById("demande-contrat")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!consent) {
      setSubmitError("Veuillez accepter le traitement de vos coordonnées.");
      return;
    }
    setSubmitting(true);
    const description = [
      `Organisation : ${org.trim()} (${sector || "secteur non précisé"})`,
      buildings ? `Parc : ${buildings.trim()} bâtiment(s)/logement(s)` : null,
      `Formule souhaitée : ${
        formula === "annual"
          ? "Formule Annuelle (engagement 12 mois avec tarif réduit)"
          : formula === "monthly"
            ? "Formule Mensuelle (sans engagement annuel)"
            : "Formule Sur-mesure Grands Comptes"
      }`,
      address.trim()
        ? `Adresse du site : ${address.trim()}, ${postcode} ${city}`
        : null,
      message.trim() ? `Message : ${message.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const idempotencyKey =
      Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      const res = await create.mutateAsync({
        serviceId: null,
        pricingFingerprint: null,
        problemType:
          "Contrat d'entretien professionnel (abonnement mensuel/annuel)",
        description,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim() || `${org.trim()}, ${city.trim()}`,
        postcode: postcode.trim(),
        city: city.trim(),
        desiredStart: null,
        consent: true,
        idempotencyKey,
      });
      setSent(res.reference);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Échec de l'envoi de la demande."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pro-offer stack">
      <section className="pro-highlights row" aria-label="Points forts">
        <span className="badge pro-highlight-chip">
          <CheckCircle2 size={15} aria-hidden="true" /> 5 corps de métier
        </span>
        <span className="badge pro-highlight-chip">
          <FileCheck2 size={15} aria-hidden="true" /> Photos &amp; signatures
          obligatoires
        </span>
        <span className="badge pro-highlight-chip">
          <Clock size={15} aria-hidden="true" /> Rennes + 30 km
        </span>
      </section>

      {/* Secteurs ciblés — chaque carte est cliquable et pré-sélectionne le formulaire */}
      <section className="stack">
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h2 className="section-title">Pour qui travaillons-nous ?</h2>
          <span className="muted small-text">
            Cliquez sur votre profil pour pré-remplir votre demande
          </span>
        </div>
        <div className="pro-sectors-grid">
          {sectors.map(s => {
            const Icon = s.icon;
            const selected = sector === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`panel pro-sector-card pro-sector-clickable stack ${
                  selected ? "pro-sector-selected" : ""
                }`}
                onClick={() => selectSector(s.id)}
                aria-pressed={selected}
              >
                <div className="pro-sector-head">
                  <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
                  <strong>{s.name}</strong>
                  {selected && (
                    <span
                      className="badge pro-sector-checked"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  )}
                </div>
                <p className="muted small-text">{s.desc}</p>
                <span className="pro-sector-cta text-link">
                  Demander pour ce profil →
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3 formules cliquables */}
      <section className="stack">
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h2 className="section-title">
            Contrats d'entretien : formules d'abonnement adaptées
          </h2>
          <span className="muted small-text">
            Cliquez une formule pour passer directement à la souscription
          </span>
        </div>
        <div className="pro-plans-grid">
          {plans.map(p => {
            const isSelected = formula === (p.id as Formula);
            return (
              <button
                key={p.id}
                type="button"
                className={`panel pro-plan-card pro-plan-clickable stack ${
                  p.highlight ? "pro-plan-highlight" : ""
                } ${isSelected ? "pro-plan-selected" : ""}`}
                onClick={() => selectFormula(p.id as Formula)}
                aria-pressed={isSelected}
              >
                <div
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <strong>{p.name}</strong>
                  {p.badge && (
                    <span className="badge pro-plan-badge">{p.badge}</span>
                  )}
                  {isSelected && (
                    <span className="badge pro-plan-checked">
                      Sélectionnée ✓
                    </span>
                  )}
                </div>
                <span className="eyebrow">{p.commitment}</span>
                <p className="pro-plan-price">{p.priceNote}</p>
                <ul className="pro-plan-points">
                  {p.points.map(pt => (
                    <li key={pt}>
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
                <span className="btn primary pro-plan-cta">
                  Choisir cette formule →
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="stack">
        <h2 className="section-title">Ce qui est inclus dans chaque contrat</h2>
        <div className="pro-inclusions-grid">
          {inclusions.map(inc => (
            <article key={inc.title} className="panel pro-inclusion-card stack">
              <strong>{inc.title}</strong>
              <p className="muted small-text">{inc.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2 className="section-title">
          Des tarifs adaptés et une réduction annuelle transparente
        </h2>
        <p className="muted">
          Le prix dépend de la taille de votre parc (bâtiments, logements, m²).
          La formule annuelle applique une <strong>remise d'engagement</strong>{" "}
          par rapport aux interventions ponctuelles. Devis gratuits, détaillés
          et sans engagement : réponse sous 24–48 h.
        </p>
      </section>

      {/* Formulaire express de souscription / demande de contrat */}
      <section className="panel pro-form-panel stack" id="demande-contrat">
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h2 className="section-title" style={{ margin: 0 }}>
            Demander une proposition de contrat
          </h2>
          <span className="badge pro-express-badge">
            <Clock size={13} aria-hidden="true" /> Réponse sous 24–48 h ·
            gratuit
          </span>
        </div>
        <p className="muted small-text">
          Formule actuellement sélectionnée :{" "}
          <strong>
            {formula === "annual"
              ? "Formule Annuelle (tarif réduit — formule recommandée)"
              : formula === "monthly"
                ? "Formule Mensuelle (sans engagement annuel)"
                : "Formule Sur-mesure Grands Comptes"}
          </strong>{" "}
          — vous pouvez la changer ci-dessous.
        </p>

        {sent ? (
          <div className="notice pro-success-notice" role="status">
            <strong>Votre demande a bien été envoyée.</strong>
            <p>
              Référence du dossier : <code>{sent}</code>. Vous recevrez une
              proposition chiffrée sous 24 à 48 heures.
            </p>
            <p className="small-text muted">
              Besoin urgent ? Appelez directement le{" "}
              <a href="tel:0604159916">06 04 15 99 16</a> ou écrivez à{" "}
              <a href="mailto:contact@multiservices-mds.fr">
                contact@multiservices-mds.fr
              </a>
              .
            </p>
          </div>
        ) : (
          <form className="stack pro-contract-form" onSubmit={handleSubmit}>
            {/* Formule en gros pills façon segment control */}
            <div className="field">
              <label>Formule</label>
              <div
                className="pro-formula-pills"
                role="radiogroup"
                aria-label="Formule de contrat"
              >
                {[
                  {
                    id: "annual",
                    label: "Annuelle · tarif réduit",
                    hint: "engagement 12 mois",
                  },
                  {
                    id: "monthly",
                    label: "Mensuelle",
                    hint: "sans engagement",
                  },
                  {
                    id: "custom",
                    label: "Sur-mesure",
                    hint: "grands comptes",
                  },
                ].map(f => {
                  const checked = formula === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      className={`pro-formula-pill ${checked ? "active" : ""}`}
                      onClick={() => setFormula(f.id as Formula)}
                    >
                      <strong>{f.label}</strong>
                      <small>{f.hint}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <Field label="Votre nom et prénom *">
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="name"
                  />
                </Field>
              </div>
              <div style={{ flex: 1, minWidth: 260 }}>
                <Field label="Nom de l'organisation *">
                  <input
                    required
                    minLength={2}
                    maxLength={200}
                    placeholder="Mairie, HLM, syndic, hôpital, entreprise…"
                    value={org}
                    onChange={e => setOrg(e.target.value)}
                    autoComplete="organization"
                  />
                </Field>
              </div>
            </div>

            <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <Field label="Téléphone *">
                  <input
                    required
                    type="tel"
                    minLength={8}
                    maxLength={30}
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </Field>
              </div>
              <div style={{ flex: 1, minWidth: 260 }}>
                <Field label="E-mail professionnel *">
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </Field>
              </div>
            </div>

            <details className="pro-details-fold">
              <summary>Préciser mon parc ou mes besoins (facultatif)</summary>
              <div className="stack" style={{ marginTop: 12 }}>
                <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <Field label="Type d'organisation">
                      <select
                        value={sector}
                        onChange={e => setSector(e.target.value)}
                      >
                        <option value="">Sélectionner</option>
                        <option value="mairie">Mairie / collectivité</option>
                        <option value="hlm">Bailleur social / HLM</option>
                        <option value="syndic">Syndic de copropriété</option>
                        <option value="bailleur">
                          Bailleur privé / gestionnaire
                        </option>
                        <option value="hopital">
                          Hôpital / clinique / santé
                        </option>
                        <option value="ecole">
                          École / crèche / enseignement
                        </option>
                        <option value="commerce">
                          Centre commercial / commerce
                        </option>
                        <option value="entreprise">Entreprise / bureau</option>
                        <option value="autre">Autre</option>
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <Field label="Nombre de bâtiments / logements (estimation)">
                      <input
                        type="text"
                        maxLength={50}
                        placeholder="ex. 3 immeubles, 120 logements"
                        value={buildings}
                        onChange={e => setBuildings(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>

                <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 2, minWidth: 260 }}>
                    <Field label="Adresse du site ou siège">
                      <input
                        maxLength={250}
                        placeholder="ex. 10 rue de la Gare"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        autoComplete="street-address"
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <Field label="Code postal">
                      <input
                        pattern="\\d{5}"
                        title="Code postal à 5 chiffres"
                        value={postcode}
                        onChange={e => setPostcode(e.target.value)}
                        autoComplete="postal-code"
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <Field label="Ville">
                      <input
                        maxLength={100}
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        autoComplete="address-level2"
                      />
                    </Field>
                  </div>
                </div>

                <Field label="Précisions">
                  <textarea
                    rows={3}
                    maxLength={2000}
                    placeholder="Besoins particuliers : plomberie d'urgence, maintenance électrique, peinture des parties communes…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                  />
                </Field>
              </div>
            </details>

            <label className="pro-consent-label">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
              />
              <span>
                J'accepte que MDS utilise mes coordonnées pour me transmettre
                une proposition de contrat (
                <Link href="/confidentialite">
                  politique de confidentialité
                </Link>
                ).
              </span>
            </label>

            {submitError && <ErrorNotice error={submitError} />}

            <div
              className="row"
              style={{ flexWrap: "wrap", gap: 12, alignItems: "center" }}
            >
              <ActionButton
                type="submit"
                className="primary"
                disabled={submitting}
              >
                {submitting
                  ? "Envoi…"
                  : "Envoyer ma demande de souscription (gratuit)"}
              </ActionButton>
              <a href="tel:0604159916" className="text-link">
                Ou appelez directement le 06 04 15 99 16
              </a>
            </div>
          </form>
        )}
      </section>

      <section className="pro-cta-card stack">
        <h2 className="section-title">Déjà client professionnel MDS ?</h2>
        <p className="muted">
          Retrouvez vos organisations, bâtiments, interventions en cours, devis
          et factures dans votre espace dédié.
        </p>
        <div>
          <ActionButton className="primary" onClick={onGoWorkspace}>
            Accéder à mon espace organisation
            <ArrowRight
              size={17}
              aria-hidden="true"
              style={{ marginLeft: 6 }}
            />
          </ActionButton>
        </div>
      </section>
    </div>
  );
}

function ProfessionalLanding() {
  return (
    <section className="panel stack" style={{ maxWidth: 640 }}>
      <h2 className="simple-panel-title">Vos bâtiments et vos demandes</h2>
      <p>Connectez-vous pour retrouver votre organisation ou en créer une.</p>
      <p className="action-example">
        Exemple : créez « Immeuble des Lilas », ajoutez son adresse, puis
        déclarez une fuite dans le bâtiment.
      </p>
      <LoginButton />
    </section>
  );
}

function ProfessionalWorkspace({ currentUserId }: { currentUserId: number }) {
  const organizations = trpc.mds.organizations.list.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<"create" | "join" | null>(null);
  const list = organizations.data ?? [];
  const selected =
    list.find(organization => organization.id === selectedId) || list[0];

  async function onCreated(id: number) {
    setModal(null);
    await organizations.refetch();
    setSelectedId(id);
  }
  async function onJoined() {
    setModal(null);
    await organizations.refetch();
  }

  const setupActions = (
    <div className="row" style={{ flexWrap: "wrap" }}>
      <ActionButton
        className={list.length ? "secondary" : "primary"}
        onClick={() => setModal("create")}
      >
        <Plus size={18} aria-hidden="true" />
        Créer une organisation
      </ActionButton>
      <ActionButton onClick={() => setModal("join")}>
        <KeyRound size={18} aria-hidden="true" />
        Rejoindre par code
      </ActionButton>
    </div>
  );

  return (
    <div className="stack">
      <QueryState
        loading={organizations.isLoading}
        error={organizations.error}
        retry={organizations.refetch}
      />
      {!organizations.isLoading && !organizations.error && (
        <>
          {selected ? (
            <>
              <div className="simple-pro-context">
                <Field label="Organisation">
                  <select
                    value={selected.id}
                    onChange={event =>
                      setSelectedId(Number(event.target.value))
                    }
                  >
                    {list.map(organization => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <span className="badge">
                  {selected.role === "owner"
                    ? "Propriétaire"
                    : selected.role === "manager"
                      ? "Gestionnaire"
                      : "Collaborateur"}
                </span>
              </div>
              <p className="action-example">
                Exemple : commencez par sélectionner un bâtiment, puis
                choisissez « Déclarer » pour signaler un problème.
              </p>
              <OrganizationDetail
                key={selected.id}
                summary={selected}
                currentUserId={currentUserId}
              />
              <details className="simple-pro-setup">
                <summary>Gérer mes organisations</summary>
                {setupActions}
              </details>
            </>
          ) : (
            <section className="panel stack">
              <h2 className="simple-panel-title">
                Votre première organisation
              </h2>
              <p className="muted">
                Créez votre organisation ou utilisez le code d'invitation reçu.
              </p>
              {setupActions}
            </section>
          )}
        </>
      )}
      {modal === "create" && (
        <CreateOrganization
          onClose={() => setModal(null)}
          onCreated={onCreated}
        />
      )}
      {modal === "join" && (
        <JoinOrganization onClose={() => setModal(null)} onJoined={onJoined} />
      )}
    </div>
  );
}

function CreateOrganization({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<OrganizationType | "">("");
  const create = trpc.mds.organizations.create.useMutation({
    onSuccess: result => void onCreated(result.id),
  });
  return (
    <PrivateModal
      title="Créer mon organisation"
      description="Vous disposerez des droits de gestion de cette organisation."
      onClose={onClose}
    >
      <form
        className="stack simple-pro-form"
        onSubmit={event => {
          event.preventDefault();
          if (type) create.mutate({ name: name.trim(), type });
        }}
      >
        <Field label="Nom de l'organisation">
          <input
            required
            minLength={2}
            maxLength={200}
            autoComplete="organization"
            value={name}
            onChange={event => setName(event.target.value)}
          />
        </Field>
        <Field label="Type d'organisation">
          <select
            required
            value={type}
            onChange={event => setType(event.target.value as OrganizationType)}
          >
            <option value="">Choisir un type</option>
            {organizationTypes.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <ErrorNotice error={create.error} />
        <ActionButton
          type="submit"
          className="primary"
          disabled={create.isPending}
        >
          {create.isPending ? "Création…" : "Créer mon organisation"}
        </ActionButton>
      </form>
    </PrivateModal>
  );
}

function JoinOrganization({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const join = trpc.mds.organizations.join.useMutation({
    onSuccess: () => {
      setCode("");
      void onJoined();
    },
  });
  return (
    <PrivateModal
      title="Rejoindre une organisation"
      description="Utilisez le code reçu et le compte correspondant à l'email invité."
      onClose={onClose}
    >
      <form
        className="stack simple-pro-form"
        onSubmit={event => {
          event.preventDefault();
          join.mutate({ code: code.trim() });
        }}
      >
        <Field label="Code d'invitation privé">
          <input
            required
            type="password"
            value={code}
            autoComplete="off"
            pattern="[a-f0-9]{64}"
            minLength={64}
            maxLength={64}
            title="Code privé de 64 caractères partagé par un gestionnaire"
            onChange={event => setCode(event.target.value)}
          />
        </Field>
        <ErrorNotice error={join.error} />
        <ActionButton
          type="submit"
          className="primary"
          disabled={join.isPending || !code.trim()}
        >
          {join.isPending ? "Vérification…" : "Rejoindre l'organisation"}
        </ActionButton>
      </form>
    </PrivateModal>
  );
}
