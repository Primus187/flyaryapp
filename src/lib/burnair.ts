/**
 * Link into the burnair map (map.burnair.cloud) at a place: the map opens centred on it with the
 * layers of the view the product owner uses (tw, ant, alr, ald). The position goes into the hash as
 * "#zoom/lat/lng", which is how burnair addresses a map view.
 */
const LAYERS = "?layers=tw%2Cant%2Calr%2Cald&visibility=on%2Con%2Con%2Con";

export function burnairMapUrl(latitude: number, longitude: number, zoom = 15): string {
  return `https://map.burnair.cloud/${LAYERS}#${zoom}/${latitude.toFixed(5)}/${longitude.toFixed(5)}`;
}
