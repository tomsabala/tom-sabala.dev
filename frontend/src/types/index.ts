export interface PortfolioItem {
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

export interface ProjectFormData {
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

export interface CVData {
  personal_info: {
    name: string;
    title: string;
    email: string;
    location: string;
    summary: string;
  };
  experience: Array<{
    company: string;
    position: string;
    start_date: string;
    end_date: string;
    description: string;
    technologies: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    start_date: string;
    end_date: string;
  }>;
  skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
  };
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

export interface ContactSubmissionsResponse {
  submissions: ContactSubmission[];
  total: number;
  limit: number;
  offset: number;
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
export interface DashboardStats {
  projectCount: number;
  resumeExists: boolean;
  lastLogin: string | null;
  adminUser: User | null;
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
export interface GitHubLanguage {
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
  updatedAt: string | null;
}

export interface AboutFormData {
  content: string;
}

// Job Tracking Types
export interface Company {
  id: number;
  name: string;
  url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyFormData {
  name: string;
  url: string;
  notes: string;
}

export interface JobApplication {
  id: number;
  company_id: number | null;
  company_name: string;
  position: string;
  status: string;
  job_url: string | null;
  date_applied: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobApplicationFormData {
  company_name: string;
  position: string;
  status: string;
  job_url: string;
  date_applied: string;
  notes: string;
}

export interface IdeaItem {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaFormData {
  title: string;
  description: string;
}
