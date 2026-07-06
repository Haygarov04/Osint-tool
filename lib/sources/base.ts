import type { NewLead } from "../types";

// Всеки източник имплементира този интерфейс и връща стандартизирани лийдове.
// Добавяне на нов източник = нов файл, който експортира Source — нищо друго не се пипа.

export interface SearchQuery {
  location: string; // напр. "Plovdiv" или "Sofia, Bulgaria"
  industry: string; // ключ от industries.ts
  limit: number; // таван на резултатите за едно извикване
}

export interface Source {
  name: string;
  available(): boolean; // напр. Google е наличен само при API ключ
  search(query: SearchQuery): Promise<NewLead[]>;
}
