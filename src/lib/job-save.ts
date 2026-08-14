import { APP_STATUS } from "./enums";

export interface JobLike {
  id: string;
  company: string;
  title: string;
  url: string | null;
  salary: string | null;
}

/**
 * Map a Discover job into the payload for creating a tracker Application.
 * Synthesized `urn:` URLs (jobs with no real apply link) become null. Links the
 * new Application back to the Job via jobId. Starts at SAVED.
 */
export function jobToApplicationInput(job: JobLike) {
  const url = job.url && !job.url.startsWith("urn:") ? job.url : null;
  return {
    company: job.company,
    title: job.title,
    url,
    salary: job.salary ?? null,
    jobId: job.id,
    status: APP_STATUS.SAVED as string,
  };
}
