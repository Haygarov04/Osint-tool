import { resolveMx } from "dns/promises";
import type { EmailStatus } from "../types";

// Верификация на имейл на ниво домейн (безплатно, чрез MX запис).
// "valid" = домейнът приема поща (нисък риск от bounce). Не гарантира, че точната
// кутия съществува — това иска SMTP handshake, който често е блокиран/ненадежден.
export async function verifyEmailDomain(email: string): Promise<EmailStatus> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return "invalid";
  try {
    const mx = await resolveMx(domain);
    return mx && mx.length > 0 ? "valid" : "invalid";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") return "invalid";
    return "unverified"; // временна/мрежова грешка — не осъждаме имейла
  }
}
