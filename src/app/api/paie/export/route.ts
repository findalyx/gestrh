import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { getPayrollScopeWhere } from "@/lib/payroll-access";

/**
 * Export CSV des bulletins de paie.
 *
 * Query params :
 *   - period (optionnel) : "YYYY-MM" pour filtrer une période
 *
 * Respecte les permissions du module Paie :
 *   - DIRECTION / DRH : tous les bulletins
 *   - AGENT : ses propres bulletins
 *   - MANAGER : 401 (pas d'accès)
 */
export async function GET(request: NextRequest) {
  await requireRole(Role.DIRECTION, Role.DRH, Role.AGENT);

  const { where, scope } = await getPayrollScopeWhere();
  const periodParam = request.nextUrl.searchParams.get("period")?.trim();
  const yearParam = request.nextUrl.searchParams.get("year")?.trim();

  const finalWhere = periodParam
    ? { AND: [where, { period: periodParam }] }
    : yearParam && /^\d{4}$/.test(yearParam)
      ? { AND: [where, { period: { startsWith: `${yearParam}-` } }] }
      : where;

  const records = await prisma.payrollRecord.findMany({
    where: finalWhere,
    orderBy: [{ period: "desc" }, { agent: { lastName: "asc" } }],
    include: {
      agent: {
        select: {
          matricule: true,
          firstName: true,
          lastName: true,
          category: true,
          service: { select: { name: true } },
        },
      },
    },
  });

  const headers = [
    "Matricule",
    "Nom",
    "Prénom",
    "Service",
    "Catégorie",
    "Période",
    "Salaire de base",
    "Primes",
    "Allocations",
    "Total brut",
    "Cotisations",
    "Net à payer",
    "Statut",
  ];

  const rows = records.map((r) => {
    const gross = r.baseSalary + r.bonuses + r.allowances;
    return [
      r.agent.matricule,
      r.agent.lastName,
      r.agent.firstName,
      r.agent.service.name,
      r.agent.category,
      r.period,
      r.baseSalary,
      r.bonuses,
      r.allowances,
      gross,
      r.deductions,
      r.netSalary,
      r.status,
    ];
  });

  // Encodage CSV (séparateur ; pour Excel français, BOM UTF-8 pour les accents)
  const escape = (v: unknown): string => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(";") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers, ...rows].map((row) => row.map(escape).join(";"));
  const body = "﻿" + lines.join("\r\n"); // BOM + CRLF

  const filename =
    periodParam && /^\d{4}-\d{2}$/.test(periodParam)
      ? `bulletins-${periodParam}.csv`
      : yearParam && /^\d{4}$/.test(yearParam)
        ? `bulletins-${yearParam}.csv`
        : scope === "SELF"
          ? `mes-bulletins.csv`
          : `bulletins.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
