#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Génère `prisma/seed.sql` à partir de `prisma/seed-data.json`.

Le fichier SQL produit (INSERT prêts à coller dans le SQL Editor de Supabase)
remplace tout le personnel par les données réelles. `seed.sql` contient des
données personnelles → il est gitignoré (comme seed-data.json et le .xlsx).

Usage :  python scripts/seed-sql.py   (après seed-extract.py)
"""
import json
import re

IN = "prisma/seed-data.json"
OUT = "prisma/seed.sql"
# Hash bcrypt de « sirh2026 » (compatible bcryptjs) — mot de passe démo.
PWD_HASH = "$2a$10$N/fKjd2XBM33QYJD0XYpreyGkuqEQVBO6g2yc9Hg2ukCSdUSVKuYO"
TODAY = "2026-06-05"

data = json.load(open(IN, encoding="utf-8"))


def q(v):
    """Littéral SQL : texte échappé, NULL si vide/None."""
    if v is None or v == "":
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def num(v):
    return "NULL" if v is None else str(v)


def ident(prefix, raw):
    return prefix + re.sub(r"[^A-Za-z0-9]", "_", str(raw))


lines = []
lines.append("-- Seed données réelles — Université St Christopher")
lines.append("-- À coller dans Supabase (SQL Editor) APRÈS les migrations.")
lines.append("-- ⚠ Remplace tout le personnel. L'Organization est préservée.")
lines.append("BEGIN;")
lines.append("")

# --- Nettoyage (ordre FK-safe) ---
for t in [
    "LeaveApproval", "ContractNotification", "Resignation", "ContractRenewal",
    "ContractAmendment", "AuditLog", "Notification", "AnnouncementAttachment",
    "Announcement", "ApplicationNote", "Document", "PayrollRecord",
    "TrainingEnrollment", "TrainingSession", "CourseModule", "TrainingCourse",
    "Application", "JobPosting", "Evaluation", "LeaveBalance", "LeaveRequest",
    "Contract", "CareerEntry", '"User"', "Agent", "Service",
]:
    name = t if t.startswith('"') else f'"{t}"'
    lines.append(f"DELETE FROM {name};")
lines.append("")

# --- Services ---
svc_id = {}
lines.append('-- Services')
for s in data["services"]:
    sid = ident("svc_", s["code"])
    svc_id[s["name"]] = sid
    lines.append(
        f'INSERT INTO "Service" (id,name,code,"createdAt","updatedAt") '
        f"VALUES ({q(sid)},{q(s['name'])},{q(s['code'])},now(),now());"
    )
lines.append("")

# --- Agents + contrats + soldes + évaluations ---
agt_id = {}
lines.append('-- Agents')
for a in data["agents"]:
    aid = ident("agt_", a["matricule"])
    agt_id[a["matricule"]] = aid
    sid = svc_id.get(a["serviceName"])
    if not sid:
        continue
    hire = a["hireDate"] or a["contract"]["startDate"] or TODAY
    lines.append(
        'INSERT INTO "Agent" (id,matricule,"firstName","lastName",email,phone,'
        '"birthDate",gender,category,"subCategory","jobTitle",status,"hireDate",'
        '"serviceId","createdAt","updatedAt") VALUES ('
        f"{q(aid)},{q(a['matricule'])},{q(a['firstName'] or '—')},{q(a['lastName'])},"
        f"{q(a['email'])},{q(a['phone'])},{q(a['birthDate'])},'{a['gender']}',"
        f"'{a['category']}','{a['subCategory']}',{q(a['jobTitle'] or 'Agent')},"
        f"'ACTIF',{q(hire)},{q(sid)},now(),now());"
    )

lines.append("")
lines.append('-- Contrats')
for a in data["agents"]:
    if a["matricule"] not in agt_id:
        continue
    c = a["contract"]
    start = c["startDate"] or a["hireDate"] or TODAY
    end = c["endDate"]
    status = "EXPIRE" if (end and end < TODAY) else "ACTIF"
    lines.append(
        'INSERT INTO "Contract" (id,"agentId",reference,type,status,"startDate",'
        '"endDate","baseSalary","pdfGenerated","createdAt","updatedAt") VALUES ('
        f"{q(ident('ctr_', a['matricule']))},{q(agt_id[a['matricule']])},"
        f"{q('CTR-' + a['matricule'])},'{c['type']}','{status}',{q(start)},"
        f"{q(end)},0,false,now(),now());"
    )

lines.append("")
lines.append('-- Soldes de congés 2026')
for a in data["agents"]:
    b = a.get("leaveBalance")
    if not b or a["matricule"] not in agt_id:
        continue
    lines.append(
        'INSERT INTO "LeaveBalance" (id,"agentId",year,type,"totalDays","usedDays") '
        f"VALUES ({q(ident('bal_', a['matricule']))},{q(agt_id[a['matricule']])},"
        f"{b['year']},'{b['type']}',{num(b['totalDays'])},{num(b['usedDays'])});"
    )

lines.append("")
lines.append('-- Évaluations (note conservée sur /20)')
for a in data["agents"]:
    if a.get("note") is None or a["matricule"] not in agt_id:
        continue
    score = a["note"]
    lines.append(
        'INSERT INTO "Evaluation" (id,"agentId",period,status,"overallScore",'
        '"highPotential","completedAt","createdAt","updatedAt") VALUES ('
        f"{q(ident('eval_', a['matricule']))},{q(agt_id[a['matricule']])},'2026',"
        f"'TERMINEE',{score},false,now(),now(),now());"
    )

lines.append("")
lines.append('-- Chefs de service')
for s in data["services"]:
    if s["managerMatricule"] and s["managerMatricule"] in agt_id:
        lines.append(
            f'UPDATE "Service" SET "managerId"={q(agt_id[s["managerMatricule"]])} '
            f'WHERE id={q(svc_id[s["name"]])};'
        )

lines.append("")
lines.append('-- Comptes démo (mot de passe : sirh2026)')
for i, u in enumerate(data["demoUsers"]):
    aid = agt_id.get(u["linkMatricule"]) if u["linkMatricule"] else None
    lines.append(
        'INSERT INTO "User" (id,email,"passwordHash",role,"isActive","agentId",'
        '"createdAt","updatedAt") VALUES ('
        f"{q('usr_' + str(i))},{q(u['email'])},{q(PWD_HASH)},'{u['role']}',true,"
        f"{q(aid)},now(),now());"
    )

lines.append("")
lines.append("COMMIT;")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"OK -> {OUT}  ({len(lines)} lignes SQL)")
