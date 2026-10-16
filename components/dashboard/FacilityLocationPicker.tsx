"use client";

import "leaflet/dist/leaflet.css";

import type { LeafletMouseEvent, Map as LeafletMap, Marker } from "leaflet";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

export const FACILITY_LOCATION_SELECTED_EVENT = "tracmedy:facility-location-selected";

type PinMethod = "search" | "map" | "device";
type SearchResult = { label: string; latitude: number; longitude: number };

// Lagos — used only to frame the map before a facility has been pinned.
const DEFAULT_CENTER: [number, number] = [6.5244, 3.3792];
const DEFAULT_ZOOM = 11;
const PINNED_ZOOM = 16;

function round(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

function parseSearchResults(payload: unknown): SearchResult[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const latitude = Number(record.lat);
    const longitude = Number(record.lon);
    const label = typeof record.display_name === "string" ? record.display_name : "";
    if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{ label, latitude, longitude }];
  });
}

export function FacilityLocationPicker({
  latitude,
  longitude,
  address,
  disabled = false,
}: {
  latitude: number | null;
  longitude: number | null;
  address: string;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const disabledRef = useRef(disabled);
  const [isMapReady, setIsMapReady] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  // Leaflet touches `window`, so it is loaded only in the browser.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.on("click", (event: LeafletMouseEvent) => {
        if (disabledRef.current) return;
        selectLocation(event.latlng.lat, event.latlng.lng, "map");
      });
      mapRef.current = map;
      setIsMapReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Keep the pin in sync with the profile (initial load, reset, or address edits clearing it).
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!isMapReady || !L || !map) return;
    if (latitude === null || longitude === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const icon = L.divIcon({
        className: "",
        html: '<span class="block h-5 w-5 rounded-full border-[3px] border-white bg-primary shadow-md"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const marker = L.marker([latitude, longitude], { icon, draggable: !disabled, keyboard: true, title: "Hospital location" }).addTo(map);
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        selectLocation(position.lat, position.lng, "map");
      });
      markerRef.current = marker;
      map.setView([latitude, longitude], PINNED_ZOOM);
      return;
    }
    markerRef.current.setLatLng([latitude, longitude]);
    if (!map.getBounds().contains([latitude, longitude])) map.panTo([latitude, longitude]);
  }, [isMapReady, latitude, longitude, disabled]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker?.dragging) return;
    if (disabled) marker.dragging.disable();
    else marker.dragging.enable();
  }, [disabled, isMapReady, latitude, longitude]);

  function selectLocation(nextLatitude: number, nextLongitude: number, method: PinMethod) {
    const detail = { latitude: round(nextLatitude), longitude: round(nextLongitude) };
    window.dispatchEvent(new CustomEvent(FACILITY_LOCATION_SELECTED_EVENT, { detail }));
    mapRef.current?.setView([detail.latitude, detail.longitude], Math.max(mapRef.current.getZoom(), PINNED_ZOOM));
    capturePostHogEvent("settings_hospital_location_pinned", { method });
    setMessage("");
  }

  async function searchAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = query.trim() || address.trim();
    if (!text) {
      setMessage("Enter an address to search.");
      return;
    }
    setIsSearching(true);
    setMessage("");
    setResults([]);
    try {
      // Nominatim usage policy: explicit searches only (no type-ahead), at most 1 request/second.
      const params = new URLSearchParams({ q: text, format: "jsonv2", limit: "5" });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Address search is unavailable right now.");
      const found = parseSearchResults(await response.json());
      setResults(found);
      if (!found.length) setMessage("No matches found. Try a nearby landmark, or click the map to drop the pin.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Address search is unavailable right now.");
    } finally {
      setIsSearching(false);
    }
  }

  function useDeviceLocation() {
    if (!("geolocation" in navigator)) {
      setMessage("Your browser does not support location access.");
      return;
    }
    setIsLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        selectLocation(position.coords.latitude, position.coords.longitude, "device");
      },
      () => {
        setIsLocating(false);
        setMessage("We couldn't get your location. Allow location access or click the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const isPinned = latitude !== null && longitude !== null;

  return (
    <div className="space-y-3">
      <form onSubmit={searchAddress} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={address ? `Search for “${address}”` : "Search for your hospital's address"}
          aria-label="Search for hospital location"
          disabled={disabled}
          className="h-11"
        />
        <div className="flex gap-3">
          <Button type="submit" variant="outline" disabled={disabled || isSearching} className="h-11 rounded-lg font-semibold">
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
          <Button type="button" variant="outline" onClick={useDeviceLocation} disabled={disabled || isLocating} className="h-11 rounded-lg font-semibold">
            {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
            Use my location
          </Button>
        </div>
      </form>

      {results.length ? (
        <ul className="overflow-hidden rounded-lg border border-border bg-card" aria-label="Address search results">
          {results.map((result) => (
            <li key={`${result.latitude},${result.longitude}`} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  selectLocation(result.latitude, result.longitude, "search");
                  setResults([]);
                }}
                className="flex w-full items-start gap-2 px-4 py-3 text-left text-sm text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        ref={containerRef}
        role="application"
        aria-label="Map of hospital location. Click to place the pin, or drag the pin to adjust it."
        className="isolate h-72 w-full overflow-hidden rounded-lg border border-border bg-muted"
      />

      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className={isPinned ? "text-muted-foreground" : "font-medium text-amber-700"}>
          {isPinned
            ? `Pinned at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            : "Not pinned yet. Patients can't get directions until your hospital is on the map."}
        </p>
        <p className="text-xs text-muted-foreground">Click the map or drag the pin to adjust. Save to apply.</p>
      </div>

      {message ? <p className="text-sm text-destructive" role="status">{message}</p> : null}
    </div>
  );
}
