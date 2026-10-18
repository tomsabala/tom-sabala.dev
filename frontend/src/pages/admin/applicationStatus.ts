/**
 * How the eight `job_applications.status` values collapse into the board's columns.
 *
 * The handoff shows five columns, which assumes every application was applied to. The agent's
 * "Track" action writes a `bookmarked` application, so a sixth leading column exists —
 * without it a tracked finding would vanish from the console the moment it was tracked.
 * Shared by the pipeline board and the overview funnel so the two can never disagree.
 */
export interface BoardColumn {
  key: string;
  label: string;
  statuses: string[];
}

export const BOARD_COLUMNS: BoardColumn[] = [
  { key: 'bookmarked', label: 'TRACKED', statuses: ['bookmarked'] },
  { key: 'applied', label: 'APPLIED', statuses: ['applied'] },
  { key: 'in_review', label: 'SCREENING', statuses: ['in_review'] },
  { key: 'interview', label: 'INTERVIEW', statuses: ['interview'] },
  { key: 'offer', label: 'OFFER', statuses: ['offer'] },
  { key: 'closed', label: 'CLOSED', statuses: ['rejected', 'withdrawn', 'closed'] },
];

export const STATUS_LABELS: Record<string, string> = {
  bookmarked: 'Tracked',
  applied: 'Applied',
  in_review: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  closed: 'Closed',
};

export const VALID_STATUSES = Object.keys(STATUS_LABELS);
