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

// About Types
export interface AboutData {
  id: number | null;
  content: string;
  updatedAt: string | null;
}

export interface AboutFormData {
  content: string;
}
