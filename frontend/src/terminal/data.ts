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

export interface SkillCategory {
  name: string;
  skills: { name: string; level: number }[];
}

export const SKILLS: SkillCategory[] = [
  {
    name: 'Languages',
    skills: [
      { name: 'Java', level: 90 },
      { name: 'Python', level: 90 },
      { name: 'C++', level: 75 },
      { name: 'TypeScript', level: 85 },
      { name: 'JavaScript', level: 85 },
      { name: 'SQL', level: 80 },
      { name: 'HTML/CSS', level: 85 },
    ],
  },
  {
    name: 'Frameworks & Libraries',
    skills: [
      { name: 'Spring Boot', level: 90 },
      { name: 'Flutter', level: 85 },
      { name: 'React', level: 85 },
      { name: 'Flask', level: 85 },
      { name: 'Node.js', level: 75 },
      { name: 'Tailwind CSS', level: 80 },
      { name: 'SQLAlchemy', level: 80 },
    ],
  },
  {
    name: 'Tools & Platforms',
    skills: [
      { name: 'AWS', level: 85 },
      { name: 'Git', level: 90 },
      { name: 'Docker', level: 80 },
      { name: 'PostgreSQL', level: 80 },
      { name: 'MySQL', level: 80 },
      { name: 'Redis', level: 75 },
      { name: 'Vercel', level: 80 },
    ],
  },
];
