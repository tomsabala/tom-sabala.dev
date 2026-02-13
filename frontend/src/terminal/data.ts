export const PERSONAL_INFO = {
  name: 'Tom Sabala',
  title: 'Full-Stack Software Engineer',
  location: 'Poland',
  email: 'contact@tom-sabala.dev',
  bio: 'Passionate full-stack developer specializing in modern web technologies. I build performant, user-friendly applications with React, TypeScript, Python, and Flask.',
  website: 'https://tom-sabala.dev',
  siteLaunchDate: '2025-01-01',
};

export interface SocialLink {
  name: string;
  url: string;
  label: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { name: 'github', url: 'https://github.com/tom-sabala', label: 'GitHub' },
  { name: 'linkedin', url: 'https://linkedin.com/in/tom-sabala', label: 'LinkedIn' },
  { name: 'email', url: 'mailto:contact@tom-sabala.dev', label: 'Email' },
  { name: 'website', url: 'https://tom-sabala.dev', label: 'Portfolio Website' },
];

export interface SkillCategory {
  name: string;
  skills: { name: string; level: number }[];
}

export const SKILLS: SkillCategory[] = [
  {
    name: 'Languages',
    skills: [
      { name: 'Python', level: 90 },
      { name: 'TypeScript', level: 85 },
      { name: 'JavaScript', level: 85 },
      { name: 'SQL', level: 80 },
      { name: 'HTML/CSS', level: 85 },
    ],
  },
  {
    name: 'Frameworks & Libraries',
    skills: [
      { name: 'React', level: 85 },
      { name: 'Flask', level: 90 },
      { name: 'Node.js', level: 75 },
      { name: 'Tailwind CSS', level: 80 },
      { name: 'SQLAlchemy', level: 85 },
    ],
  },
  {
    name: 'Tools & Platforms',
    skills: [
      { name: 'Git', level: 90 },
      { name: 'Docker', level: 75 },
      { name: 'PostgreSQL', level: 80 },
      { name: 'AWS', level: 70 },
      { name: 'Vercel', level: 80 },
    ],
  },
];
