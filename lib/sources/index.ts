import type { Source } from "./base";
import { osmSource } from "./osm";
import { googlePlacesSource } from "./googlePlaces";

// Регистър на всички източници. Нов източник = нов запис тук.
export const SOURCES: Record<string, Source> = {
  osm: osmSource,
  google: googlePlacesSource,
};

export function getSource(name: string): Source {
  const s = SOURCES[name];
  if (!s) throw new Error(`Непознат източник: ${name}`);
  return s;
}
