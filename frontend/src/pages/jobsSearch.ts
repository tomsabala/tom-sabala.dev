import type { AgentFinding, Company, JobApplication } from '../types/index.ts';

function hit(needle: string, fields: (string | null | undefined)[]): boolean {
  return fields.some(field => !!field && field.toLowerCase().includes(needle));
}

export function filterCompaniesByCategories(companies: Company[], categories: Set<string>): Company[] {
  if (categories.size === 0) return companies;
  return companies.filter(c => (c.categories || []).some(cat => categories.has(cat)));
}

export function filterApplicationsByStatus(applications: JobApplication[], status: string): JobApplication[] {
  if (status === 'all') return applications;
  return applications.filter(a => a.status === status);
}

export function searchCompanies(companies: Company[], query: string): Company[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return companies;
  return companies.filter(c => hit(needle, [c.name, c.url, c.notes, ...(c.categories || [])]));
}

export function searchApplications(applications: JobApplication[], query: string): JobApplication[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return applications;
  return applications.filter(a => hit(needle, [a.company_name, a.position, a.notes, a.job_url]));
}

export function searchFindings(findings: AgentFinding[], query: string): AgentFinding[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return findings;
  return findings.filter(f => hit(needle, [f.posting.title, f.company.name]));
}
