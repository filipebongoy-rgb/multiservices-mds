import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { MAPBOX_PUBLIC_TOKEN } from "@/config/mapbox";
import { dateTime } from "@shared/mds";
import "mapbox-gl/dist/mapbox-gl.css";

type Props = {
  reference: string;
  token?: string;
  status: string;
  address: string;
  postcode: string;
  city: string;
};

type Coordinates = [number, number];

export function TripMap({
  reference,
  token,
  status,
  address,
  postcode,
  city,
}: Props) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const artisanMarker = useRef<mapboxgl.Marker | null>(null);
  const clientMarker = useRef<mapboxgl.Marker | null>(null);
  const [destination, setDestination] = useState<Coordinates | null>(null);
  const [geocodeError, setGeocodeError] = useState("");
  const latest = trpc.mds.location.latest.useQuery(
    { reference, token },
    {
      enabled: status === "en_route" && Boolean(MAPBOX_PUBLIC_TOKEN),
      refetchInterval: 10000,
      retry: false,
    }
  );

  useEffect(() => {
    if (status !== "en_route" || !MAPBOX_PUBLIC_TOKEN) return;
    let cancelled = false;
    setGeocodeError("");
    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${address}, ${postcode} ${city}, France`)}.json?limit=1&country=fr&access_token=${MAPBOX_PUBLIC_TOKEN}`
    )
      .then(response => {
        if (!response.ok) throw new Error("geocoding");
        return response.json() as Promise<{
          features?: { center?: Coordinates }[];
        }>;
      })
      .then(data => {
        const center = data.features?.[0]?.center;
        if (!cancelled && center) setDestination(center);
        else if (!cancelled)
          setGeocodeError("Adresse non localisée sur la carte.");
      })
      .catch(() => {
        if (!cancelled)
          setGeocodeError("La carte ne peut pas localiser cette adresse.");
      });
    return () => {
      cancelled = true;
    };
  }, [address, city, postcode, status]);

  useEffect(() => {
    if (!mapNode.current || !MAPBOX_PUBLIC_TOKEN || status !== "en_route")
      return;
    mapboxgl.accessToken = MAPBOX_PUBLIC_TOKEN;
    map.current = new mapboxgl.Map({
      container: mapNode.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: destination || [2.3522, 48.8566],
      zoom: destination ? 13 : 5,
      attributionControl: true,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    return () => {
      artisanMarker.current?.remove();
      clientMarker.current?.remove();
      artisanMarker.current = null;
      clientMarker.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, [status]);

  useEffect(() => {
    if (!map.current || !destination) return;
    clientMarker.current?.remove();
    clientMarker.current = new mapboxgl.Marker({ color: "#17354a" })
      .setLngLat(destination)
      .setPopup(new mapboxgl.Popup().setText("Adresse de l’intervention"))
      .addTo(map.current);
  }, [destination]);

  useEffect(() => {
    const point = latest.data;
    if (!map.current || !point) return;
    const coordinates: Coordinates = [point.longitude, point.latitude];
    artisanMarker.current?.remove();
    artisanMarker.current = new mapboxgl.Marker({ color: "#d85b16" })
      .setLngLat(coordinates)
      .setPopup(new mapboxgl.Popup().setText("Position MDS"))
      .addTo(map.current);
    map.current.flyTo({ center: coordinates, zoom: 14, essential: false });
  }, [latest.data]);

  if (status !== "en_route") return null;
  if (!MAPBOX_PUBLIC_TOKEN)
    return (
      <section className="trip-map-state">
        La carte sera disponible lorsque Mapbox sera configuré.
      </section>
    );
  return (
    <section className="trip-map-card" aria-label="Suivi GPS de l’artisan">
      <div className="trip-map-heading">
        <div>
          <strong>Votre artisan arrive</strong>
          <p>
            {latest.data
              ? "Position réelle reçue pendant le trajet."
              : "En attente de la première position GPS autorisée."}
          </p>
        </div>
        <button
          className="text-link"
          type="button"
          onClick={() => latest.refetch()}
          disabled={latest.isFetching}
        >
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>
      <div ref={mapNode} className="trip-map-canvas" />
      {latest.data ? (
        <small className="trip-map-meta">
          Dernière position : {dateTime(latest.data.recordedAt)}
          {latest.data.accuracyM != null
            ? ` · précision ${Math.round(latest.data.accuracyM)} m`
            : ""}
        </small>
      ) : (
        <small className="trip-map-meta">
          La carte reste centrée sur le secteur jusqu’à réception d’une
          position.
        </small>
      )}
      {geocodeError && <small className="trip-map-error">{geocodeError}</small>}
    </section>
  );
}
