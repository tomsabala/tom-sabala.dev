export const PERSONAL_INFO = {
  name: 'Tom Sabala',
  title: 'Full-Stack Software Engineer',
  location: 'Israel',
  email: 'contact@tom-sabala.dev',
  bio: 'Math-minded software engineer with a strong problem-solving approach and a love for clean, scalable systems. Combines algorithmic thinking with full-stack development to turn complex requirements into reliable, data-informed products. Tennis enthusiast.',
  website: 'https://tom-sabala.dev',
  siteLaunchDate: '2025-01-01',
};

export interface SocialLink {
  name: string;
  url: string;
  label: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { name: 'github', url: 'https://github.com/tomsabala', label: 'GitHub' },
  { name: 'linkedin', url: 'https://www.linkedin.com/in/tom-sabala-a9513721a/', label: 'LinkedIn' },
  { name: 'email', url: 'mailto:contact@tom-sabala.dev', label: 'Email' },
  { name: 'website', url: 'https://tom-sabala.dev', label: 'Portfolio Website' },
];

/**
 * Skills are shared with the About section's radars; `src/about/skills.ts` is the source
 * and this re-export keeps `terminal/filesystem.ts` importing from one place.
 */
export { SKILLS } from '../about/skills';
