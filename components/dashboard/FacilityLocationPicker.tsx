"use client";

import "@tomtom-international/web-sdk-maps/dist/maps.css";

import type tt from "@tomtom-international/web-sdk-maps";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

export const FACILITY_LOCATION_SELECTED_EVENT = "tracmedy:facility-location-selected";

type PinMethod = "search" | "map" | "device";
type SearchResult = { label: string; latitude: number; longitude: number };

// Lagos — used only to frame the map before a facility has been pinned. TomTom/Mapbox order: [lng, lat].
const DEFAULT_CENTER: [number, number] = [3.3792, 6.5244];
const DEFAULT_ZOOM = 11;
const PINNED_ZOOM = 16;
// Search-as-you-type starts after this many characters, once typing pauses for SEARCH_DEBOUNCE_MS.
const MIN_SEARCH_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 300;

// Browser-exposed TomTom key — restrict it to this app's domains in the TomTom developer portal.
const TOMTOM_API_KEY = process.env.NEXT_PUBLIC_TOMTOM_API_KEY ?? "";

function round(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

// TomTom Search API v2 response: { results: [{ position: { lat, lon }, address: { freeformAddress }, poi?: { name } }] }
function parseSearchResults(payload: unknown): SearchResult[] {
  const results = asRecord(payload)?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((item: unknown) => {
    const record = asRecord(item);
    const position = asRecord(record?.position);
    const latitude = Number(position?.lat);
    const longitude = Number(position?.lon);
    const address = asRecord(record?.address)?.freeformAddress;
    const poiName = asRecord(record?.poi)?.name;
    const label = [typeof poiName === "string" ? poiName : "", typeof address === "string" ? address : ""].filter(Boolean).join(", ");
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
  const mapRef = useRef<tt.Map | null>(null);
  const markerRef = useRef<tt.Marker | null>(null);
  const ttRef = useRef<typeof tt | null>(null);
  const disabledRef = useRef(disabled);
  const searchRequestRef = useRef(0);
  const searchTimerRef = useRef<number | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  // Drop a pending debounced search when the picker unmounts.
  useEffect(() => () => {
    if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current);
  }, []);

  // The TomTom SDK touches `window`, so it is loaded only in the browser.
  useEffect(() => {
    if (!TOMTOM_API_KEY) return;
    let cancelled = false;
    void import("@tomtom-international/web-sdk-maps").then((module) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const sdk = (module as unknown as { default?: typeof tt }).default ?? (module as unknown as typeof tt);
      ttRef.current = sdk;
      const map = sdk.map({
        key: TOMTOM_API_KEY,
        container: containerRef.current,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        language: "en-GB",
        scrollZoom: false,
      });
      map.addControl(new sdk.NavigationControl({ showCompass: false }), "top-right");
      map.on("click", (event: tt.MapMouseEvent<"click">) => {
        if (disabledRef.current) return;
        selectLocation(event.lngLat.lat, event.lngLat.lng, "map");
      });
      map.on("load", () => {
        if (!cancelled) setIsMapReady(true);
      });
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep the pin in sync with the profile (initial load, reset, or address edits clearing it).
  useEffect(() => {
    const sdk = ttRef.current;
    const map = mapRef.current;
    if (!isMapReady || !sdk || !map) return;
    if (latitude === null || longitude === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const element = document.createElement("div");
      element.className = "h-5 w-5 rounded-full border-[3px] border-white bg-primary shadow-md";
      element.setAttribute("aria-label", "Hospital location");
      const marker = new sdk.Marker({ element, draggable: !disabled }).setLngLat([longitude, latitude]).addTo(map);
      marker.on("dragend", () => {
        const position = marker.getLngLat();
        selectLocation(position.lat, position.lng, "map");
      });
      markerRef.current = marker;
      map.jumpTo({ center: [longitude, latitude], zoom: PINNED_ZOOM });
      return;
    }
    markerRef.current.setLngLat([longitude, latitude]);
    if (!map.getBounds().contains([longitude, latitude])) map.easeTo({ center: [longitude, latitude] });
  }, [isMapReady, latitude, longitude, disabled]);

  useEffect(() => {
    markerRef.current?.setDraggable(!disabled);
  }, [disabled, isMapReady, latitude, longitude]);

  function selectLocation(nextLatitude: number, nextLongitude: number, method: PinMethod) {
    const detail = { latitude: round(nextLatitude), longitude: round(nextLongitude) };
    window.dispatchEvent(new CustomEvent(FACILITY_LOCATION_SELECTED_EVENT, { detail }));
    const map = mapRef.current;
    map?.easeTo({ center: [detail.longitude, detail.latitude], zoom: Math.max(map.getZoom(), PINNED_ZOOM) });
    capturePostHogEvent("settings_hospital_location_pinned", { method });
    setMessage("");
  }

  // Only the newest search may update the list — a slow earlier request must not overwrite it.
  async function runSearch(text: string, typeahead: boolean) {
    if (!TOMTOM_API_KEY) {
      setMessage("Address search is not configured.");
      return;
    }
    const requestId = ++searchRequestRef.current;
    setIsSearching(true);
    setMessage("");
    try {
      // TomTom Search API (fuzzy search), biased toward the current map view.
      const center = mapRef.current?.getCenter();
      const params = new URLSearchParams({ key: TOMTOM_API_KEY, limit: "5", language: "en-GB", typeahead: String(typeahead) });
      if (center) {
        params.set("lat", String(center.lat));
        params.set("lon", String(center.lng));
      }
      const response = await fetch(`https://api.tomtom.com/search/2/search/${encodeURIComponent(text)}.json?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Address search is unavailable right now.");
      const found = parseSearchResults(await response.json());
      if (requestId !== searchRequestRef.current) return;
      setResults(found);
      if (!found.length && !typeahead) setMessage("No matches found. Try a nearby landmark, or click the map to drop the pin.");
    } catch (error: unknown) {
      if (requestId !== searchRequestRef.current) return;
      setMessage(error instanceof Error ? error.message : "Address search is unavailable right now.");
    } finally {
      if (requestId === searchRequestRef.current) setIsSearching(false);
    }
  }

  function cancelPendingSearch() {
    if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = null;
  }

  // Search-as-you-type once the query reaches MIN_SEARCH_CHARS, debounced.
  function handleQueryChange(value: string) {
    setQuery(value);
    cancelPendingSearch();
    const text = value.trim();
    if (text.length < MIN_SEARCH_CHARS) {
      searchRequestRef.current += 1; // drop any in-flight result
      setResults([]);
      setIsSearching(false);
      setMessage("");
      return;
    }
    searchTimerRef.current = window.setTimeout(() => {
      searchTimerRef.current = null;
      void runSearch(text, true);
    }, SEARCH_DEBOUNCE_MS);
  }

  async function searchAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    cancelPendingSearch();
    const text = query.trim() || address.trim();
    if (!text) {
      setMessage("Enter an address to search.");
      return;
    }
    await runSearch(text, false);
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
          onChange={(event) => handleQueryChange(event.target.value)}
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

      {TOMTOM_API_KEY ? (
        <div
          ref={containerRef}
          role="application"
          aria-label="Map of hospital location. Click to place the pin, or drag the pin to adjust it."
          className="isolate h-72 w-full overflow-hidden rounded-lg border border-border bg-muted"
        />
      ) : (
        <div className="flex h-72 w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted px-6 text-center text-sm text-muted-foreground">
          The map is not configured. Use “Use my location” to pin your hospital, or contact support.
        </div>
      )}

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
