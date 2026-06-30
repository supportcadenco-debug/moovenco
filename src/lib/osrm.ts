// ─── src/lib/osrm.ts ───────────────────────────────────────────────────────
// Calcul de durée et distance de trajet routier réel via OSRM.
// Utilisé par le moteur de squelette pour dimensionner les HLP (Haut Le Pied)
// en fonction de la distance réelle entre deux adresses, et non d'un forfait.

export interface Coord {
  lat: number
  lng: number
}

export interface AddressLike {
  id?: string
  name?: string
  lat?: number | string | null
  lng?: number | string | null
}

export interface RouteResult {
  durationMin: number   // durée du trajet en minutes (arrondie)
  distanceKm: number    // distance en kilomètres (1 décimale)
  ok: boolean           // false si OSRM a échoué (fallback appliqué)
}

// Cache en mémoire : clé "lat1,lng1->lat2,lng2" -> RouteResult
// Évite de rappeler OSRM pour un trajet déjà calculé pendant la session.
const routeCache = new Map<string, RouteResult>()

function cacheKey(from: Coord, to: Coord): string {
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}->${to.lat.toFixed(5)},${to.lng.toFixed(5)}`
}

function parseCoord(addr: AddressLike): Coord | null {
  if (addr == null) return null
  const lat = typeof addr.lat === 'string' ? parseFloat(addr.lat) : addr.lat
  const lng = typeof addr.lng === 'string' ? parseFloat(addr.lng) : addr.lng
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null
  return { lat, lng }
}

/**
 * Calcule la durée et distance d'un trajet entre deux coordonnées.
 * Ajoute une marge de sécurité paramétrable (par défaut +10% sur la durée
 * OSRM, qui sous-estime souvent en conditions réelles avec un autocar).
 */
export async function getRoute(
  from: AddressLike,
  to: AddressLike,
  options?: { marginPct?: number }
): Promise<RouteResult> {
  const c1 = parseCoord(from)
  const c2 = parseCoord(to)
  const margin = options?.marginPct ?? 0.10

  // Pas de coordonnées exploitables -> fallback forfaitaire
  if (!c1 || !c2) {
    return { durationMin: 10, distanceKm: 0, ok: false }
  }

  // Même point (à ~50m près) -> trajet négligeable
  if (Math.abs(c1.lat - c2.lat) < 0.0005 && Math.abs(c1.lng - c2.lng) < 0.0005) {
    return { durationMin: 0, distanceKm: 0, ok: true }
  }

  const key = cacheKey(c1, c2)
  const cached = routeCache.get(key)
  if (cached) return cached

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${c1.lng},${c1.lat};${c2.lng},${c2.lat}?overview=false`
    const res = await fetch(url)
    const data = await res.json()
    if (data.routes && data.routes[0]) {
      const baseMin = data.routes[0].duration / 60
      const result: RouteResult = {
        durationMin: Math.max(1, Math.round(baseMin * (1 + margin))),
        distanceKm: Math.round((data.routes[0].distance / 1000) * 10) / 10,
        ok: true,
      }
      routeCache.set(key, result)
      return result
    }
  } catch (e) {
    // silencieux — on tombe sur le fallback
  }

  // Fallback : estimation à vol d'oiseau / vitesse moyenne 40 km/h
  const distKm = haversineKm(c1, c2)
  const fallback: RouteResult = {
    durationMin: Math.max(1, Math.round((distKm / 40) * 60 * (1 + margin))),
    distanceKm: Math.round(distKm * 10) / 10,
    ok: false,
  }
  routeCache.set(key, fallback)
  return fallback
}

/** Distance à vol d'oiseau en km (fallback si OSRM indisponible) */
function haversineKm(a: Coord, b: Coord): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/**
 * Calcule en une fois tous les segments d'un enchaînement d'adresses.
 * Retourne un tableau de durées (minutes) entre chaque point consécutif.
 * Ex: [A, B, C] -> [durée A->B, durée B->C]
 */
export async function getRouteSegments(
  points: AddressLike[],
  options?: { marginPct?: number }
): Promise<RouteResult[]> {
  const segments: RouteResult[] = []
  for (let i = 0; i < points.length - 1; i++) {
    segments.push(await getRoute(points[i], points[i + 1], options))
  }
  return segments
}

/** Vide le cache (utile après modification d'adresses) */
export function clearRouteCache(): void {
  routeCache.clear()
}
