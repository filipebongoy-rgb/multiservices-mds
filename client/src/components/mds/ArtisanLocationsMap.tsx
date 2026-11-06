import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { MapPin, RefreshCw } from "lucide-react";
import type { RequestRecord } from "./private-types";
import { MAPBOX_PUBLIC_TOKEN } from "@/config/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

type Coordinates = [number, number];

export function ArtisanLocationsMap({
  requests,
}: {
  requests: RequestRecord[];
}) {
  const node = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [points, setPoints] = useState<
    { request: RequestRecord; coordinates: Coordinates }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const activeRequests = requests
    .filter(request => request.address && request.postcode && request.city)
    .slice(0, 50);

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
  }, [requests.map(request => request.id).join(",")]);

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
            {activeRequests.length} adresse
            {activeRequests.length !== 1 ? "s" : ""} dans vos demandes
          </p>
        </div>
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
      {message && <p className="notice">{message}</p>}
      {activeRequests.length ? (
        <div ref={node} className="artisan-locations-map" />
      ) : (
        <p className="muted">Aucune adresse disponible pour le moment.</p>
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
