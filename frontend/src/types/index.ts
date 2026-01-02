export interface PortfolioItem {
  id: number;
  title: string;
  description: string;
  technologies: string[];
  github_url?: string;
  live_url?: string;
  image_url?: string;
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
}

// Authentication Types
export interface User {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  lastLogin: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: { user: User };
  error?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

// Dashboard Types
export interface DashboardStats {
  projectCount: number;
  resumeExists: boolean;
  lastLogin: string | null;
  adminUser: User | null;
}
