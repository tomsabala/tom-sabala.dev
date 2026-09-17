from datetime import datetime

from app.models import JobSearchProfile
from app.models.job_search_profile import PROFILE_ID


class JobSearchProfileDAO:
    """Singleton row holding the interests to prefill the Run-agent modal."""

    def __init__(self, session):
        self.session = session

    def get(self):
        try:
            profile = self.session.get(JobSearchProfile, PROFILE_ID)
            if profile is None:
                # The migration seeds this row; recreate it if a database was
                # built some other way so reads never 404.
                profile = JobSearchProfile(id=PROFILE_ID, interests='', minScore=60)
                self.session.add(profile)
                self.session.commit()
            return profile
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to fetch job search profile: {str(e)}")

    def save(self, interests, minScore):
        try:
            profile = self.get()
            profile.interests = interests
            profile.minScore = minScore
            profile.updatedAt = datetime.utcnow()
            self.session.commit()
            return profile
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to save job search profile: {str(e)}")
