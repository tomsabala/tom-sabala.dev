/**
 * Self-rated skill levels, rendered as radar polygons in the About section and as
 * `skills/*.txt` inside the terminal filesystem. `terminal/data.ts` re-exports these,
 * so this module is the single source.
 */
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
