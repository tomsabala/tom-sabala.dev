"""
Data Access Object for Resume model
"""
from app.models import Resume


class ResumeDAO:

    def __init__(self, session):
        self.session = session

    def getResume(self):
        try:
            return self.session.query(Resume).first()
        except Exception as e:
            raise Exception(f"Failed to fetch resume: {str(e)}")

    def updateResume(self, resumeId, personalInfo=None, experience=None, education=None, skills=None):
        try:
            resume = self.session.get(Resume, resumeId)
            if not resume:
                return None
            if personalInfo is not None:
                resume.personalInfo = personalInfo
            if experience is not None:
                resume.experience = experience
            if education is not None:
                resume.education = education
            if skills is not None:
                resume.skills = skills
            self.session.commit()
            return resume
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to update resume: {str(e)}")

    def createResume(self, personalInfo, experience, education, skills):
        try:
            resume = Resume(
                personalInfo=personalInfo,
                experience=experience,
                education=education,
                skills=skills
            )
            self.session.add(resume)
            self.session.commit()
            return resume
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to create resume: {str(e)}")
