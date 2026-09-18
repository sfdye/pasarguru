import { useEffect, useSyncExternalStore } from 'react';
import * as Location from 'expo-location';

/** Matches the web app's `maximumAge: 300000` — a five-minute-old location is good enough here. */
const MAX_AGE_MS = 5 * 60 * 1000;

export interface Coords {
  lat: number;
  lng: number;
}

/** Permission, not coordinates: `granted` with `coords === null` just means no location yet. */
export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied';

// The location lives in a module, not in a component: the map tab and the add modal both want it,
// and mounting either one again must not re-prompt or re-locate.
let snapshot: { coords: Coords | null; status: LocationStatus } = { coords: null, status: 'idle' };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<typeof snapshot>): void {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function acquire(options?: { fresh?: boolean }): Promise<void> {
  if (inflight && !options?.fresh) return inflight;
  inflight = (async () => {
    set({ status: 'requesting' });
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        set({ status: 'denied' });
        return;
      }
      // A user-initiated "locate me" wants the current position, not a stale last-known location
      // that may predate a physical move. The 5-minute cache stays for background acquisition.
      const last = options?.fresh
        ? null
        : await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS });
      const position =
        last ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      set({
        status: 'granted',
        coords: { lat: position.coords.latitude, lng: position.coords.longitude },
      });
    } catch {
      // Permission is granted but no location is available; callers order alphabetically instead.
      set({ status: snapshot.status === 'requesting' ? 'granted' : snapshot.status });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useLocation(): {
  coords: Coords | null;
  status: LocationStatus;
  request: (options?: { fresh?: boolean }) => Promise<void>;
} {
  const current = useSyncExternalStore(subscribe, () => snapshot);

  useEffect(() => {
    if (snapshot.status === 'idle') void acquire();
  }, []);

  return { ...current, request: (options) => acquire(options) };
}
