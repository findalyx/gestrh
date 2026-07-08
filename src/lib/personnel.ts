import { prisma } from "@/lib/prisma";
import { AgentStatus, ContractStatus, StaffCategory } from "@prisma/client";

export type AgentListFilters = {
  search?: string;
  serviceId?: string;
  category?: StaffCategory;
  status?: AgentStatus;
};

export async function listAgents(filters: AgentListFilters = {}) {
  const where = {
    AND: [
      filters.category ? { category: filters.category } : {},
      filters.status ? { status: filters.status } : {},
      filters.serviceId ? { serviceId: filters.serviceId } : {},
      filters.search
        ? {
            OR: [
              { firstName: { contains: filters.search, mode: "insensitive" as const } },
              { lastName: { contains: filters.search, mode: "insensitive" as const } },
              { matricule: { contains: filters.search, mode: "insensitive" as const } },
              { email: { contains: filters.search, mode: "insensitive" as const } },
            ],
          }
        : {},
    ],
  };

  return prisma.agent.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      matricule: true,
      firstName: true,
      lastName: true,
      email: true,
      jobTitle: true,
      category: true,
      subCategory: true,
      status: true,
      birthDate: true,
      hireDate: true,
      service: { select: { id: true, name: true, code: true } },
      contracts: {
        where: { status: ContractStatus.ACTIF },
        orderBy: { startDate: "desc" },
        take: 1,
        select: {
          id: true,
          type: true,
          startDate: true,
          endDate: true,
          baseSalary: true,
        },
      },
    },
    take: 500,
  });
}

export type AgentListItem = Awaited<ReturnType<typeof listAgents>>[number];

export async function getAgentDetail(id: string) {
  return prisma.agent.findUnique({
    where: { id },
    include: {
      service: true,
      contracts: {
        orderBy: { startDate: "desc" },
        include: {
          amendments: { orderBy: { effectiveDate: "desc" } },
          renewal: true,
          resignation: true,
          notifications: { orderBy: { sentAt: "desc" } },
        },
      },
      // size > 0 : on masque les lignes d'upload direct non finalisées (annulé).
      documents: { where: { size: { gt: 0 } }, orderBy: { createdAt: "desc" } },
      careerEntries: { orderBy: { startDate: "desc" } },
    },
  });
}

export type AgentDetail = NonNullable<Awaited<ReturnType<typeof getAgentDetail>>>;
export type AgentContract = AgentDetail["contracts"][number];

export async function listServices() {
  return prisma.service.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
}
