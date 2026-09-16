from datetime import datetime

from app.models import JobPosting


class JobPostingDAO:

    def __init__(self, session):
        self.session = session

    def getById(self, postingId):
        try:
            return self.session.get(JobPosting, postingId)
        except Exception as e:
            raise Exception(f"Failed to fetch job posting: {str(e)}")

    def getOpenForCompanies(self, companyIds):
        """Open (still listed) and non-dismissed postings for the given companies."""
        if not companyIds:
            return []
        try:
            return (
                self.session.query(JobPosting)
                .filter(JobPosting.companyId.in_(list(companyIds)))
                .filter(JobPosting.closedAt.is_(None))
                .filter(JobPosting.dismissedAt.is_(None))
                .order_by(JobPosting.companyId.asc(), JobPosting.title.asc())
                .all()
            )
        except Exception as e:
            raise Exception(f"Failed to fetch open job postings: {str(e)}")

    def upsert(self, companyId, source, posting):
        """Insert or refresh one posting. Returns (row, created).

        `posting` is the adapter dict plus a precomputed 'contentHash'.
        `firstSeenAt` is only ever written on insert — that is the whole basis
        for the New/Seen distinction.
        """
        try:
            now = datetime.utcnow()
            externalId = str(posting['externalId'])
            row = (
                self.session.query(JobPosting)
                .filter(JobPosting.companyId == companyId)
                .filter(JobPosting.externalId == externalId)
                .one_or_none()
            )
            created = row is None
            if created:
                row = JobPosting(
                    companyId=companyId,
                    source=source,
                    externalId=externalId,
                    firstSeenAt=now,
                )
                self.session.add(row)

            row.source = source
            row.title = (posting.get('title') or '')[:300]
            row.url = (posting.get('url') or '')[:1000]
            row.location = (posting.get('location') or None)
            if row.location:
                row.location = row.location[:300]
            row.department = (posting.get('department') or None)
            if row.department:
                row.department = row.department[:200]
            row.isRemote = posting.get('isRemote')
            row.description = posting.get('description')
            row.contentHash = posting['contentHash']
            row.postedAt = posting.get('postedAt')
            row.lastSeenAt = now
            row.closedAt = None

            self.session.commit()
            return row, created
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to upsert job posting: {str(e)}")

    def closeMissing(self, companyId, source, seenExternalIds):
        """Mark postings the board no longer lists as closed. Returns the count."""
        try:
            now = datetime.utcnow()
            query = (
                self.session.query(JobPosting)
                .filter(JobPosting.companyId == companyId)
                .filter(JobPosting.source == source)
                .filter(JobPosting.closedAt.is_(None))
            )
            seen = {str(x) for x in (seenExternalIds or [])}
            closed = 0
            for row in query.all():
                if row.externalId not in seen:
                    row.closedAt = now
                    closed += 1
            self.session.commit()
            return closed
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to close missing job postings: {str(e)}")

    def setScore(self, postingId, contentHash, score, verdict, reason):
        """Cache a relevance verdict against the content it was based on, so an
        unchanged posting is never sent to the model twice."""
        try:
            row = self.session.get(JobPosting, postingId)
            if not row:
                return None
            row.lastScoredHash = contentHash
            row.lastScore = score
            row.lastVerdict = verdict
            row.lastReason = reason
            self.session.commit()
            return row
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to store posting score: {str(e)}")

    def dismiss(self, postingId):
        try:
            row = self.session.get(JobPosting, postingId)
            if not row:
                return None
            row.dismissedAt = datetime.utcnow()
            self.session.commit()
            return row
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to dismiss job posting: {str(e)}")
