// Речник на индустриите — разширяем без пипане на останалия код.
// Всяка индустрия има: български етикет, OSM тагове (за Overpass) и Google types.
// Добавяне на нова индустрия = нов запис тук.

export interface IndustryDef {
  key: string;
  label: string; // за UI (на български)
  osm: [string, string][]; // двойки [tag, value] за Overpass (union)
  google: string[]; // Google Places types / ключови думи
}

export const INDUSTRIES: IndustryDef[] = [
  {
    key: "restaurant",
    label: "Ресторант",
    osm: [["amenity", "restaurant"]],
    google: ["restaurant"],
  },
  {
    key: "cafe",
    label: "Кафе / Бар",
    osm: [
      ["amenity", "cafe"],
      ["amenity", "bar"],
      ["amenity", "pub"],
    ],
    google: ["cafe", "bar"],
  },
  {
    key: "hotel",
    label: "Хотел / Настаняване",
    osm: [
      ["tourism", "hotel"],
      ["tourism", "guest_house"],
    ],
    google: ["lodging"],
  },
  {
    key: "dentist",
    label: "Зъболекар",
    osm: [
      ["amenity", "dentist"],
      ["healthcare", "dentist"],
    ],
    google: ["dentist"],
  },
  {
    key: "doctor",
    label: "Лекар / Клиника",
    osm: [
      ["amenity", "doctors"],
      ["amenity", "clinic"],
      ["healthcare", "doctor"],
    ],
    google: ["doctor"],
  },
  {
    key: "car_repair",
    label: "Автосервиз",
    osm: [
      ["shop", "car_repair"],
      ["craft", "car_repair"],
    ],
    google: ["car_repair"],
  },
  {
    key: "beauty",
    label: "Салон за красота",
    osm: [
      ["shop", "beauty"],
      ["shop", "hairdresser"],
      ["leisure", "spa"],
    ],
    google: ["beauty_salon", "hair_care"],
  },
  {
    key: "gym",
    label: "Фитнес",
    osm: [
      ["leisure", "fitness_centre"],
      ["leisure", "sports_centre"],
    ],
    google: ["gym"],
  },
  {
    key: "lawyer",
    label: "Адвокат / Правни услуги",
    osm: [["office", "lawyer"]],
    google: ["lawyer"],
  },
  {
    key: "real_estate",
    label: "Недвижими имоти",
    osm: [
      ["office", "estate_agent"],
      ["shop", "estate_agent"],
    ],
    google: ["real_estate_agency"],
  },
  {
    key: "shop",
    label: "Магазин (общо)",
    osm: [["shop", "*"]],
    google: ["store"],
  },
  {
    key: "florist",
    label: "Цветарница",
    osm: [["shop", "florist"]],
    google: ["florist"],
  },
];

export function getIndustry(key: string): IndustryDef | undefined {
  return INDUSTRIES.find((i) => i.key === key);
}
