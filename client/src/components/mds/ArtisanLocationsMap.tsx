import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { MapPin, RefreshCw, Search, ExternalLink } from "lucide-react";
import type { RequestRecord } from "./private-types";
import { MAPBOX_PUBLIC_TOKEN } from "@/config/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

type Coordinates = [number, number];

export function ArtisanLocationsMap({
  requests,
  onOpen,
}: {
  requests: RequestRecord[];
  onOpen?: (id: number) => void;
}) {
  const node = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [points, setPoints] = useState<
    { request: RequestRecord; coordinates: Coordinates }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const allActiveRequests = requests
    .filter(request => request.address && request.postcode && request.city)
    .slice(0, 50);
  const activeRequests = allActiveRequests.filter(request =>
    `${request.name} ${request.address} ${request.postcode} ${request.city} ${request.serviceName || ""}`
      .toLocaleLowerCase("fr")
      .includes(search.toLocaleLowerCase("fr"))
  );

  async function locate() {
    if (!MAPBOX_PUBLIC_TOKEN || !activeRequests.length) return;
    setLoading(true);
    setMessage("");
    const located: { request: RequestRecord; coordinates: Coordinates }[] = [];
    for (const request of activeRequests) {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${request.address}, ${request.postcode} ${request.city}, France`)}.json?limit=1&country=fr&language=fr&access_token=${MAPBOX_PUBLIC_TOKEN}`
        );
        if (!response.ok) continue;
        const data = (await response.json()) as {
          features?: { center?: Coordinates }[];
        };
        const center = data.features?.[0]?.center;
        if (center) located.push({ request, coordinates: center });
      } catch {
        // Une adresse indisponible ne bloque pas les autres lieux.
      }
    }
    setPoints(located);
    if (!located.length)
      setMessage("Aucune adresse n’a encore pu être localisée.");
    setLoading(false);
  }

  useEffect(() => {
    void locate();
  }, [search, requests.map(request => request.id).join(",")]);

  useEffect(() => {
    if (!node.current || !MAPBOX_PUBLIC_TOKEN || !points.length) return;
    mapboxgl.accessToken = MAPBOX_PUBLIC_TOKEN;
    const instance = new mapboxgl.Map({
      container: node.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: points[0].coordinates,
      zoom: 10,
      attributionControl: true,
    });
    map.current = instance;
    instance.addControl(new mapboxgl.NavigationControl(), "top-right");
    instance.on("load", () => {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach(({ request, coordinates }) => {
        bounds.extend(coordinates);
        new mapboxgl.Marker({ color: "#bc4c23" })
          .setLngLat(coordinates)
          .setPopup(
            new mapboxgl.Popup({ offset: 20 }).setHTML(
              `<strong>${escapeHtml(request.name)}</strong><br>${escapeHtml(request.city)}<br><small>${escapeHtml(request.serviceName || "Demande libre")}</small>`
            )
          )
          .addTo(instance);
      });
      if (points.length > 1)
        instance.fitBounds(bounds, { padding: 48, maxZoom: 13 });
    });
    return () => {
      instance.remove();
      map.current = null;
    };
  }, [points]);

  if (!MAPBOX_PUBLIC_TOKEN)
    return (
      <section className="panel artisan-locations-empty">
        <MapPin size={22} aria-hidden="true" />
        <div>
          <strong>Carte des lieux d’intervention</strong>
          <p className="muted">
            La carte sera disponible lorsque Mapbox sera configuré.
          </p>
        </div>
      </section>
    );

  return (
    <section
      className="panel artisan-locations-card"
      aria-label="Carte des lieux d’intervention"
    >
      <div className="artisan-locations-heading">
        <div>
          <strong>Où intervenir</strong>
          <p className="muted">
            {allActiveRequests.length} adresse
            {allActiveRequests.length !== 1 ? "s" : ""} dans vos demandes
          </p>
        </div>
        <div className="artisan-locations-actions">
          <button
            type="button"
            className="btn secondary"
            onClick={() => void locate()}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" />{" "}
            {loading ? "Recherche…" : "Actualiser"}
          </button>
        </div>
      </div>
      <label className="artisan-locations-search">
        <Search size={17} aria-hidden="true" />
        <span className="visually-hidden">Rechercher un lieu</span>
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Rechercher une ville, une adresse ou un client"
        />
      </label>
      {message && <p className="notice">{message}</p>}
      {activeRequests.length ? (
        <div ref={node} className="artisan-locations-map" />
      ) : (
        <p className="muted">Aucune adresse disponible pour le moment.</p>
      )}
      {activeRequests.length > 0 && (
        <div className="artisan-locations-list" aria-label="Lieux trouvés">
          {activeRequests.map(request => (
            <button
              key={request.id}
              type="button"
              className="artisan-location-result"
              onClick={() => onOpen?.(request.id)}
              disabled={!onOpen}
            >
              <span>
                <strong>{request.name}</strong>
                <small>
                  {request.address}, {request.postcode} {request.city}
                </small>
              </span>
              {onOpen && <ExternalLink size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    character =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] || character
  );
}
