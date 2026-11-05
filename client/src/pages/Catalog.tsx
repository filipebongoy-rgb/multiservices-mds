import { useState } from "react";
import { Link } from "wouter";
import {
  Search,
  ArrowRight,
  Clock3,
  MapPin,
  Droplets,
  Zap,
  Flame,
  Paintbrush,
  Wrench,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { trades, money } from "@shared/mds";
import { FreeRequest, Loading, ApiError, Empty } from "@/components/mds/Layout";
const icons = [Droplets, Zap, Flame, Paintbrush, Wrench];
export default function Catalog() {
  const params = new URLSearchParams(window.location.search);
  const [q, setQ] = useState(params.get("q") || "");
  const [trade, setTrade] = useState(params.get("metier") || "");
  const query = trpc.mds.catalog.list.useQuery({});
  const filtered = (query.data || []).filter(
    s =>
      (!trade || s.trade === trade) &&
      `${s.name} ${s.description} ${s.problemTypes.join(" ")}`
        .toLocaleLowerCase("fr")
        .includes(q.toLocaleLowerCase("fr"))
  );
  return (
    <main id="main-content" className="page-shell catalog-page">
      <div className="eyebrow">RÉPARATIONS, TRAVAUX & MAINTENANCE</div>
      <h1 className="page-title">De quoi avez-vous besoin ?</h1>
      <p className="lead muted">
        Choisissez une prestation validée par MDS, ou décrivez simplement votre
        problème.
      </p>
      <div className="catalog-search">
        <Search size={20} />
        <label className="sr-only" htmlFor="catalog-search">
          Rechercher dans les prestations
        </label>
        <input
          id="catalog-search"
          placeholder="Rechercher une prestation ou un problème"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>
      <div className="tabs" aria-label="Filtrer par métier">
        <button
          className={!trade ? "selected" : ""}
          onClick={() => setTrade("")}
        >
          Tous les métiers
        </button>
        {trades.map((t, i) => {
          const Icon = icons[i];
          return (
            <button
              key={t.slug}
              className={trade === t.slug ? "selected" : ""}
              onClick={() => setTrade(t.slug)}
            >
              <Icon size={16} />
              {t.name}
            </button>
          );
        })}
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ApiError message={query.error.message} retry={() => query.refetch()} />
      ) : filtered.length ? (
        <div className="service-list">
          {filtered.map(s => (
            <article className="service-card" key={s.id}>
              <div className="eyebrow">
                {trades.find(t => t.slug === s.trade)?.name}
              </div>
              <h2>{s.name}</h2>
              <p>{s.description}</p>
              {s.problemTypes.length > 0 && (
                <div className="problem-tags">
                  {s.problemTypes.map(p => (
                    <span key={p}>{p}</span>
                  ))}
                </div>
              )}
              <div className="service-meta">
                <span>
                  <Clock3 size={15} />
                  {s.durationMinutes} min estimées
                </span>
                <span>{money(s.priceCents)}</span>
                {s.zone && (
                  <span>
                    <MapPin size={15} />
                    {s.zone}
                  </span>
                )}
              </div>
              {s.conditions && (
                <p className="muted small-text">{s.conditions}</p>
              )}
              <Link href={"/demande?service=" + s.id} className="btn primary">
                Demander cette prestation
                <ArrowRight size={18} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            q
              ? "Aucune prestation ne correspond à cette recherche."
              : "Aucune prestation ouverte dans ce catalogue pour le moment."
          }
        >
          <p>
            Vous pouvez toujours envoyer une demande libre. MDS étudiera votre
            besoin avant de vous proposer une intervention.
          </p>
          <button
            className="text-link"
            onClick={() => {
              setQ("");
              setTrade("");
            }}
          >
            Réinitialiser les filtres
          </button>
        </Empty>
      )}
      <FreeRequest />
      <div className="notice">
        <strong>Votre demande ne vous engage pas à une intervention.</strong>
        <p>
          MDS valide d’abord votre besoin. Vous confirmez ensuite le tarif et le
          créneau proposés.
        </p>
      </div>
    </main>
  );
}
