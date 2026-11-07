import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import mapboxgl from "mapbox-gl";
import { MAPBOX_PUBLIC_TOKEN } from "@/config/mapbox";

type Coordinates = [number, number];
const RENNES: Coordinates = [-1.6778, 48.1173];

function circleCoordinates(center: Coordinates, radiusKm: number) {
  const points: Coordinates[] = [];
  const latitudeScale = 111.32;
  const longitudeScale = 111.32 * Math.cos((center[1] * Math.PI) / 180);
  for (let angle = 0; angle <= 360; angle += 4) {
    const radians = (angle * Math.PI) / 180;
    points.push([
      center[0] + (radiusKm / longitudeScale) * Math.cos(radians),
      center[1] + (radiusKm / latitudeScale) * Math.sin(radians),
    ]);
  }
  return points;
}

export function ServiceAreaMap() {
  const node = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!node.current || !MAPBOX_PUBLIC_TOKEN) return;
    void import("mapbox-gl/dist/mapbox-gl.css");
    mapboxgl.accessToken = MAPBOX_PUBLIC_TOKEN;
    const instance = new mapboxgl.Map({
      container: node.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: RENNES,
      zoom: 9.4,
      attributionControl: true,
    });
    map.current = instance;
    instance.addControl(new mapboxgl.NavigationControl(), "top-right");
    instance.on("load", () => {
      instance.addSource("mds-service-area", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [circleCoordinates(RENNES, 30)],
          },
        },
      });
      instance.addLayer({
        id: "mds-service-area-fill",
        type: "fill",
        source: "mds-service-area",
        paint: { "fill-color": "#bc4c23", "fill-opacity": 0.12 },
      });
      instance.addLayer({
        id: "mds-service-area-line",
        type: "line",
        source: "mds-service-area",
        paint: { "line-color": "#bc4c23", "line-width": 2, "line-opacity": 0.7 },
      });
      new mapboxgl.Marker({ color: "#bc4c23" })
        .setLngLat(RENNES)
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setText("MULTISERVICES MDS — Rennes"))
        .addTo(instance);
    });
    return () => {
      marker.current?.remove();
      marker.current = null;
      instance.remove();
      map.current = null;
    };
  }, []);

  async function locateAddress() {
    const value = search.trim();
    if (!value || !MAPBOX_PUBLIC_TOKEN || !map.current) return;
    setSearching(true);
    setMessage("");
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${value}, France`)}.json?limit=1&country=fr&language=fr&access_token=${MAPBOX_PUBLIC_TOKEN}`
      );
      if (!response.ok) throw new Error("geocoding");
      const data = (await response.json()) as { features?: { center?: Coordinates; place_name?: string }[] };
      const result = data.features?.[0];
      if (!result?.center) {
        setMessage("Adresse non trouvée. Essayez une ville ou un code postal.");
        return;
      }
      marker.current?.remove();
      marker.current = new mapboxgl.Marker({ color: "#172b3a" })
        .setLngLat(result.center)
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(result.place_name || value))
        .addTo(map.current);
      map.current.flyTo({ center: result.center, zoom: 13, essential: true });
    } catch {
      setMessage("La recherche cartographique est momentanément indisponible.");
    } finally {
      setSearching(false);
    }
  }

  function locateMe() {
    if (!navigator.geolocation || !map.current) {
      setMessage("La géolocalisation n’est pas disponible sur cet appareil.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        const coordinates: Coordinates = [position.coords.longitude, position.coords.latitude];
        marker.current?.remove();
        marker.current = new mapboxgl.Marker({ color: "#172b3a" })
          .setLngLat(coordinates)
          .setPopup(new mapboxgl.Popup({ offset: 18 }).setText("Votre position"))
          .addTo(map.current!);
        map.current?.flyTo({ center: coordinates, zoom: 13, essential: true });
        setMessage("Votre position est affichée uniquement sur votre appareil.");
      },
      () => setMessage("Autorisez la position dans votre navigateur pour vous repérer sur la carte."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  if (!MAPBOX_PUBLIC_TOKEN) {
    return (
      <section className="panel service-area-map-empty" aria-label="Zone d’intervention">
        <MapPin size={22} aria-hidden="true" />
        <div><strong>Zone d’intervention MDS</strong><p className="muted">Carte indisponible tant que le fournisseur cartographique n’est pas configuré.</p></div>
      </section>
    );
  }

  return (
    <section className="panel service-area-map-card" aria-label="Carte interactive de la zone d’intervention MDS">
      <div className="service-area-map-heading">
        <div><strong>Zone d’intervention</strong><p className="muted">Rennes et alentours, jusqu’à 30 km selon l’adresse.</p></div>
        <button type="button" className="btn secondary small" onClick={locateMe}><LocateFixed size={16} aria-hidden="true" /> Me localiser</button>
      </div>
      <form className="service-area-map-search" onSubmit={event => { event.preventDefault(); void locateAddress(); }}>
        <Search size={17} aria-hidden="true" />
        <label className="sr-only" htmlFor="service-area-search">Rechercher une adresse</label>
        <input id="service-area-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher une ville ou une adresse" />
        <button className="btn primary small" type="submit" disabled={searching || !search.trim()}>{searching ? "Recherche…" : "Rechercher"}</button>
      </form>
      {message && <p className="service-area-map-message" role="status">{message}</p>}
      <div ref={node} className="service-area-map-canvas" />
    </section>
  );
}
