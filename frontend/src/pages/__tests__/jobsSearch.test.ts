import { describe, it, expect } from 'vitest';
import {
  filterApplicationsByStatus,
  filterCompaniesByCategories,
  searchApplications,
  searchCompanies,
  searchFindings,
} from '../jobsSearch.ts';
import type { AgentFinding, Company, JobApplication } from '../../types/index.ts';

function company(overrides: Partial<Company> & { id: number; name: string }): Company {
  return {
    url: null,
    notes: null,
    categories: [],
    careers_url: null,
    ats_provider: null,
    ats_token: null,
    board_detected_at: null,
    last_synced_at: null,
    sync_error: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function application(overrides: Partial<JobApplication> & { id: number; company_name: string; position: string }): JobApplication {
  return {
    company_id: null,
    status: 'bookmarked',
    job_url: null,
    job_posting_id: null,
    date_applied: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function finding(id: number, title: string, companyName: string): AgentFinding {
  return {
    id,
    score: 80,
    verdict: 'apply',
    reason: null,
    is_new: true,
    posting: {
      id,
      company_id: id,
      source: 'greenhouse',
      title,
      url: 'https://boards.greenhouse.io/x',
      location: null,
      department: null,
      is_remote: null,
      posted_at: null,
      first_seen_at: '2026-01-01T00:00:00Z',
    },
    company: { id, name: companyName },
  };
}

const companies: Company[] = [
  company({ id: 1, name: 'Acme Corp', url: 'https://acme.example', notes: 'Great payroll team', categories: ['fintech'] }),
  company({ id: 2, name: 'Beta Ltd', url: 'https://beta.example', notes: null, categories: ['fintech'] }),
  company({ id: 3, name: 'Acme Labs', url: null, notes: null, categories: ['health'] }),
  company({ id: 4, name: 'Gamma' }),
];

const applications: JobApplication[] = [
  application({ id: 1, company_name: 'Acme Corp', position: 'Backend Engineer', status: 'applied', notes: 'Referred by Dana', job_url: 'https://jobs.acme.example/1' }),
  application({ id: 2, company_name: 'Beta Ltd', position: 'Platform Engineer', status: 'applied' }),
  application({ id: 3, company_name: 'Acme Labs', position: 'Data Scientist', status: 'rejected' }),
];

const findings: AgentFinding[] = [
  finding(1, 'Senior Backend Engineer', 'Acme Corp'),
  finding(2, 'Frontend Engineer', 'Beta Ltd'),
];

const ids = <T extends { id: number }>(rows: T[]) => rows.map(row => row.id);

describe('searchCompanies', () => {
  it('returns the input array untouched for an empty query', () => {
    expect(searchCompanies(companies, '')).toBe(companies);
  });

  it('returns the input array untouched for a whitespace-only query', () => {
    expect(searchCompanies(companies, '   ')).toBe(companies);
  });

  it('matches the name case-insensitively', () => {
    expect(ids(searchCompanies(companies, 'ACME'))).toEqual([1, 3]);
  });

  it('matches the url', () => {
    expect(ids(searchCompanies(companies, 'beta.example'))).toEqual([2]);
  });

  it('matches the notes', () => {
    expect(ids(searchCompanies(companies, 'payroll'))).toEqual([1]);
  });

  it('matches a categories entry', () => {
    expect(ids(searchCompanies(companies, 'health'))).toEqual([3]);
  });

  it('excludes a company matching nothing', () => {
    expect(ids(searchCompanies(companies, 'zzz'))).toEqual([]);
  });

  it('tolerates null url, null notes and empty categories', () => {
    const sparse = [company({ id: 9, name: 'Sparse' })];
    expect(ids(searchCompanies(sparse, 'sparse'))).toEqual([9]);
    expect(ids(searchCompanies(sparse, 'nope'))).toEqual([]);
  });
});

describe('searchApplications', () => {
  it('matches the company name', () => {
    expect(ids(searchApplications(applications, 'beta'))).toEqual([2]);
  });

  it('matches the position', () => {
    expect(ids(searchApplications(applications, 'data scientist'))).toEqual([3]);
  });

  it('matches the notes', () => {
    expect(ids(searchApplications(applications, 'dana'))).toEqual([1]);
  });

  it('matches the job url', () => {
    expect(ids(searchApplications(applications, 'jobs.acme.example'))).toEqual([1]);
  });

  it('tolerates null notes and null job url', () => {
    expect(ids(searchApplications(applications, 'platform'))).toEqual([2]);
  });
});

describe('searchFindings', () => {
  it('matches the posting title', () => {
    expect(ids(searchFindings(findings, 'senior'))).toEqual([1]);
  });

  it('matches the company name', () => {
    expect(ids(searchFindings(findings, 'beta ltd'))).toEqual([2]);
  });

  it('excludes a non-matching finding', () => {
    expect(ids(searchFindings(findings, 'designer'))).toEqual([]);
  });
});

describe('search composed with the existing filters', () => {
  it('ANDs the category pills with the company query', () => {
    expect(ids(searchCompanies(filterCompaniesByCategories(companies, new Set(['fintech'])), 'acme'))).toEqual([1]);
  });

  it('ANDs the status filter with the application query', () => {
    expect(ids(searchApplications(filterApplicationsByStatus(applications, 'applied'), 'acme'))).toEqual([1]);
  });
});
