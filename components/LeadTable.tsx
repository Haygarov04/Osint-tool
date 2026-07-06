import type { Lead } from "@/lib/types";

const STATUS_BG: Record<string, string> = {
  new: "Нов",
  processed: "Обработен",
  contacted: "Контактиран",
  replied: "Отговорил",
  customer: "Клиент",
  unsubscribed: "Отписан",
};

export default function LeadTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        Няма лийдове. Събери от панела горе или разхлаби филтрите.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Име</th>
            <th className="px-3 py-2">Категория</th>
            <th className="px-3 py-2">Телефон</th>
            <th className="px-3 py-2">Имейл</th>
            <th className="px-3 py-2">Сайт</th>
            <th className="px-3 py-2">Град</th>
            <th className="px-3 py-2">Рейтинг</th>
            <th className="px-3 py-2">Качество</th>
            <th className="px-3 py-2">Статус</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium">{l.name}</td>
              <td className="px-3 py-2 text-slate-500">{l.category}</td>
              <td className="px-3 py-2">{l.phone || "—"}</td>
              <td className="px-3 py-2">
                {l.email ? (
                  <span>
                    {l.email}
                    {l.emailVerified === "valid" && (
                      <span
                        className="ml-1 text-green-600"
                        title="Домейнът приема поща (MX)"
                      >
                        ✓
                      </span>
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2">
                {l.website ? (
                  <a
                    href={l.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {l.domain || "сайт"}
                  </a>
                ) : (
                  <span className="text-amber-600">няма</span>
                )}
              </td>
              <td className="px-3 py-2">{l.city || "—"}</td>
              <td className="px-3 py-2 tabular-nums">
                {l.rating != null ? `${l.rating} (${l.reviewsCount ?? 0})` : "—"}
              </td>
              <td className="px-3 py-2 tabular-nums">{l.qualityScore}</td>
              <td className="px-3 py-2">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                  {STATUS_BG[l.status] ?? l.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
