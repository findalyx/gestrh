/**
 * Capture des pages de l'application en images PNG.
 *
 * Prérequis : le serveur de dev doit tourner (`npm run dev`).
 * Usage     : npm run screenshot
 *
 * Les captures sont enregistrées dans le dossier `screenshots/`.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT = "screenshots";

const PAGES = [
  { path: "/tableau-de-bord", file: "01-tableau-de-bord.png" },
  { path: "/personnel", file: "02-personnel.png" },
  { path: "/conges", file: "03-conges.png" },
];

await mkdir(OUT, { recursive: true });

// Permet de pointer vers un binaire Chromium déjà installé (utile en CI
// ou en environnement cloud où le téléchargement est restreint).
const launchOptions = process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
  : {};

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1500, height: 980 } });

for (const p of PAGES) {
  await page.goto(BASE + p.path, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/${p.file}`, fullPage: true });
  console.log("Capturé :", `${OUT}/${p.file}`);
}

await browser.close();
