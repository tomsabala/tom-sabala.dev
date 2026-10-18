/** `{k, v}` pair rendered in a project's bordered spec grid. */
export interface ProjectFact { k: string; v: string }
/** One numbered step in the "how it works" section. `t` = title, `d` = detail. */
export interface ProjectStep { t: string; d: string }

/** Specimen painter key — matches `projects.specimen` on the backend. */
type SpecimenKey = 'chain' | 'hull' | 'equity' | 'graph' | 'board';

/**
 * Detail-page content lives on the project row, so every field below is optional:
 * a project added before the redesign renders hero + whatever it has.
 */
interface ProjectContentFields {
  slug?: string | null;
  field?: string | null;
  lede?: string | null;
  facts?: ProjectFact[] | null;
  aboutParagraphs?: string[] | null;
  steps?: ProjectStep[] | null;
  rulesTitle?: string | null;
  rules?: string[] | null;
  runCode?: string | null;
  specimen?: SpecimenKey | string | null;
  accessLabel?: string | null;
}

export interface PortfolioItem extends ProjectContentFields {
  id: number;
  title: string;
  description: string;
  technologies: string[];
  github_url?: string;
  live_url?: string;
  image_url?: string;
  content?: string;
  docsSlug?: string;
  isVisible: boolean;
  is_in_progress: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectFormData extends ProjectContentFields {
  title: string;
  description: string;
  technologies: string[];
  github_url?: string;
  live_url?: string;
  image_url?: string;
  content?: string;
  docsSlug?: string;
  is_in_progress?: boolean;
}

export interface ProjectOrderUpdate {
  id: number;
  displayOrder: number;
}

export interface ContactFormData {
  name: string;
  email: string;
  message: string;

  // Security fields
  recaptchaToken?: string;  // reCAPTCHA token from execution
  email2?: string;          // Honeypot field 1 (must remain empty)
  phoneNumber?: string;     // Honeypot field 2 (must remain empty)
}

export interface ContactSubmission {
  id: number;
  name: string;
  email: string;
  message: string;
  submittedAt: string;
  ipAddress?: string;
  read: boolean;
  archivedAt?: string | null;
}

// Authentication Types
export interface User {
  id: number;
  username: string;
  email: string;
  profilePicture?: string;
  createdAt: string;
  lastLogin: string | null;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: { user: User };
  error?: string;
}

// Dashboard Types

/** Counts keyed by `job_applications.status`; every status is always present. */
type ApplicationsByStatus = Record<string, number>;

/** Compact summary of the most recent agent sweep. `null` when no run exists yet. */
interface LatestRunSummary {
  id: number;
  status: AgentRunStatus;
  findings_count: number;
  companies_total: number;
  postings_seen: number;
  postings_new: number;
  input_tokens: number;
  output_tokens: number;
  duration_seconds: number | null;
  finished_at: string | null;
}

export interface DashboardStats {
  projectCount: number;
  hiddenProjectCount: number;
  pdfVersionCount: number;
  unreadMessages: number;
  resumeExists: boolean;
  activeApplications: number;
  applicationsByStatus: ApplicationsByStatus;
  latestRun: LatestRunSummary | null;
  lastLogin: string | null;
  adminUser: User | null;
}

// Hangar Types — mirrors the broker's `GET /instances` payload, proxied by the backend.
interface HangarInstance {
  slug: string;
  name: string;
  kind: string;
  mode: string;
  state: string;
  /** Absent when the Docker socket proxy refuses container stats. */
  memUsedBytes?: number | null;
  memLimitBytes?: number | null;
  startedAt: string | null;
  lastSeenMs: number | null;
  coldStartMs: number | null;
}

export interface HangarStatus {
  instances: HangarInstance[];
  caps: { total: number; anon: number; admin: number };
}

// Resume PDF Types
export interface ResumePdfVersion {
  id: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  isActive: boolean;
  uploadedBy: {
    id: number;
    username: string;
    email: string;
  } | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface PdfUploadResponse {
  success: boolean;
  message?: string;
  data?: ResumePdfVersion;
  error?: string;
}

// GitHub Stats Types
interface GitHubLanguage {
  name: string;
  pct: number;
  color: string;
}

export interface GitHubStats {
  username: string;
  publicRepos: number;
  stars: number;
  prs: number;
  totalContributions: number;
  currentStreak: number;
  longestStreak: number;
  /** 52×7 grid: contributions[weekIndex][dayIndex], Sun=0, Sat=6 */
  contributions: number[][];
  languages: GitHubLanguage[];
  fetchedAt: string;
  hasContributionData: boolean;
}

// About Types
export interface AboutData {
  id: number | null;
  content: string;
  profilePhotoUrl: string | null;
  updatedAt: string | null;
}

export interface AboutFormData {
  content: string;
  /** Empty string clears the portrait; omit the field to leave it untouched. */
  profilePhotoUrl?: string;
}

// Job Tracking Types
export interface Company {
  id: number;
  name: string;
  url: string | null;
  notes: string | null;
  categories: string[];
  careers_url: string | null;
  ats_provider: string | null;
  ats_token: string | null;
  board_detected_at: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export type TabConfigs = Record<string, boolean>;

export interface JobApplication {
  id: number;
  company_id: number | null;
  company_name: string;
  position: string;
  status: string;
  job_url: string | null;
  job_posting_id: number | null;
  date_applied: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Job-search agent types
type AgentRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface AgentRun {
  id: number;
  status: AgentRunStatus;
  created_by: string | null;
  interests_snapshot: string;
  min_score: number;
  model: string | null;
  companies_total: number;
  companies_processed: number;
  companies_failed: number;
  postings_seen: number;
  postings_new: number;
  postings_rejected: number;
  postings_applied_skipped: number;
  findings_count: number;
  input_tokens: number;
  output_tokens: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  duration_seconds: number | null;
}

interface AgentRunCompanyResult {
  id: number;
  company_id: number;
  company_name: string;
  status: 'ok' | 'skipped' | 'error';
  source: string | null;
  postings_found: number;
  error: string | null;
  duration_ms: number | null;
}

export interface AgentRunDetail extends AgentRun {
  company_results: AgentRunCompanyResult[];
}

interface AgentPosting {
  id: number;
  company_id: number;
  source: string;
  title: string;
  url: string;
  location: string | null;
  department: string | null;
  is_remote: boolean | null;
  posted_at: string | null;
  first_seen_at: string;
}

export interface AgentFinding {
  id: number;
  score: number | null;
  verdict: 'apply' | 'maybe' | 'skip' | null;
  reason: string | null;
  is_new: boolean;
  posting: AgentPosting;
  company: { id: number; name: string };
}
