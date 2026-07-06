import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lint грешките да не блокират продукшън build-а на Vercel.
  eslint: { ignoreDuringBuilds: true },
  // Този проект е root-ът (има чужд lockfile в родителската папка локално).
  outputFileTracingRoot: dir,
};

export default nextConfig;
