import { Prisma } from "@prisma/client";
import { db } from "./db";
import { buildJobOrderBy, buildJobWhere, type JobQuery } from "./job-query";

export async function listJobs(query: JobQuery) {
  const where = buildJobWhere(query) as Prisma.JobWhereInput;
  const [jobs, total] = await Promise.all([
    db.job.findMany({
      where,
      orderBy: buildJobOrderBy(query.sort) as Prisma.JobOrderByWithRelationInput[],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.job.count({ where }),
  ]);
  return { jobs, total, page: query.page, pageSize: query.pageSize };
}
