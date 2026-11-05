import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  CircleAlert,
  Truck,
  Wrench,
  CalendarCheck2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  clientMustAct,
  isActiveRequest,
  readGuestRequest,
  requestHeadline,
  requestNextAction,
  requestProgressIndex,
} from "@/lib/requestProgress";

type BannerRequest = {
  reference: string;
  status: string;
  serviceName?: string | null;
};

function iconFor(status: string) {
  if (status === "en_route") return Truck;
  if (status === "in_progress") return Wrench;
  if (clientMustAct(status)) return CircleAlert;
  return CalendarCheck2;
}

/**
 * Bandeau « commande en cours » : visible en haut de l'accueil dès qu'un
 * dossier est actif, il mène au suivi en un seul geste. Rendu uniquement
 * dans le navigateur : le pré-rendu statique n'a ni session ni données live.
 */
export function ActiveRequestBanner() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <LiveActiveRequestBanner /> : null;
}

function LiveActiveRequestBanner() {
  const { user, loading } = useAuth();
  const guest = !user && !loading ? readGuestRequest() : null;
  const mine = trpc.mds.requests.mine.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });
  const guestTrack = trpc.mds.requests.track.useQuery(
    guest || { reference: "" },
    { enabled: !!guest, retry: false, refetchInterval: 30000 }
  );

  let active: BannerRequest | null = null;
  let href = "";
  if (user) {
    const rows = (mine.data || []).filter(r => isActiveRequest(r.status));
    // Une action attendue du client passe avant le reste.
    active = rows.find(r => clientMustAct(r.status)) || rows[0] || null;
    if (active) href = `/suivi?ref=${encodeURIComponent(active.reference)}`;
  } else if (guest && guestTrack.data?.request) {
    const r = guestTrack.data.request;
    if (isActiveRequest(r.status)) {
      active = r;
      href = `/suivi?ref=${encodeURIComponent(r.reference)}#cle=${encodeURIComponent(guest.token)}`;
    }
  }
  if (!active) return null;

  const others = user
    ? (mine.data || []).filter(r => isActiveRequest(r.status)).length - 1
    : 0;
  const Icon = iconFor(active.status);
  const urgent = clientMustAct(active.status);
  const step = requestProgressIndex(active.status);
  return (
    <Link
      href={href}
      className={`active-request-banner${urgent ? " is-urgent" : ""}`}
      aria-label={`${requestHeadline(active.status)}. Ouvrir le suivi du dossier ${active.reference}`}
    >
      <span className="active-request-icon" aria-hidden="true">
        <Icon size={22} />
      </span>
      <span className="active-request-copy">
        <strong>{requestHeadline(active.status)}</strong>
        <small>{requestNextAction(active.status)}</small>
        <span className="active-request-steps" aria-hidden="true">
          {[0, 1, 2, 3].map(index => (
            <i key={index} className={index <= step ? "done" : ""} />
          ))}
        </span>
        {others > 0 && (
          <small className="active-request-more">
            + {others} autre{others > 1 ? "s" : ""} demande
            {others > 1 ? "s" : ""} en cours
          </small>
        )}
      </span>
      <span className="active-request-cta">
        Suivre <ArrowRight size={17} aria-hidden="true" />
      </span>
    </Link>
  );
}
