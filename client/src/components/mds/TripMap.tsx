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
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
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
      style: "mapbox://styles/mapbox/dark-v11",
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

  useEffect(() => {
    const point = latest.data;
    if (!map.current || !point || !destination) return;
    let cancelled = false;
    const origin = `${point.longitude},${point.latitude}`;
    const target = `${destination[0]},${destination[1]}`;
    fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${origin};${target}?geometries=geojson&overview=full&access_token=${MAPBOX_PUBLIC_TOKEN}`
    )
      .then(response => {
        if (!response.ok) throw new Error("directions");
        return response.json() as Promise<{
          routes?: {
            geometry?: { coordinates?: Coordinates[] };
            duration?: number;
            distance?: number;
          }[];
        }>;
      })
      .then(data => {
        const route = data.routes?.[0];
        const coordinates = route?.geometry?.coordinates;
        if (!cancelled) {
          setEtaMinutes(
            route?.duration != null
              ? Math.max(1, Math.ceil(route.duration / 60))
              : null
          );
          setDistanceKm(
            route?.distance != null
              ? Math.round((route.distance / 1000) * 10) / 10
              : null
          );
        }
        if (cancelled || !coordinates?.length || !map.current) return;
        const drawRoute = () => {
          if (!map.current || !coordinates.length) return;
          const source = map.current.getSource("mds-trip-route");
          const feature = {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates },
          } as const;
          if (source && "setData" in source) {
            source.setData(feature);
            return;
          }
          map.current.addSource("mds-trip-route", {
            type: "geojson",
            data: feature,
          });
          map.current.addLayer({
            id: "mds-trip-route-line",
            type: "line",
            source: "mds-trip-route",
            paint: {
              "line-color": "#d85b16",
              "line-width": 5,
              "line-opacity": 0.82,
            },
          });
        };
        if (map.current.isStyleLoaded()) drawRoute();
        else map.current.once("load", drawRoute);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [destination, latest.data]);

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
          <strong>Votre artisan est en route</strong>
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
      <div className="trip-map-arrival">
        <div>
          <small>Arrivée estimée</small>
          <strong>
            {etaMinutes != null ? `${etaMinutes} min` : "Calcul en cours…"}
          </strong>
        </div>
        <div>
          <small>Distance restante</small>
          <strong>{distanceKm != null ? `${distanceKm} km` : "—"}</strong>
        </div>
      </div>
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
