"""
Data Access Object for Resume model
"""
from app.models import Resume


class ResumeDAO:
    """DAO class for Resume database operations"""

    @staticmethod
    def getResume():
        """
        Fetch the resume (there should only be one)

        Returns:
            Resume: Resume object or None if not found

        Raises:
            Exception: If database query fails
        """
        try:
            resume = Resume.query.first()
            return resume
        except Exception as e:
            raise Exception(f"Failed to fetch resume: {str(e)}")

    @staticmethod
    def updateResume(resumeId, personalInfo=None, experience=None, education=None, skills=None):
        """
        Update the resume

        Args:
            resumeId (int): Resume ID
            personalInfo (dict, optional): Personal information
            experience (list, optional): Experience list
            education (list, optional): Education list
            skills (dict, optional): Skills dictionary

        Returns:
            Resume: Updated resume object or None if not found

        Raises:
            Exception: If update fails
        """
        from app import db
        try:
            resume = Resume.query.get(resumeId)
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

            db.session.commit()
            return resume
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to update resume: {str(e)}")

    @staticmethod
    def createResume(personalInfo, experience, education, skills):
        """
        Create a new resume

        Args:
            personalInfo (dict): Personal information
            experience (list): Experience list
            education (list): Education list
            skills (dict): Skills dictionary

        Returns:
            Resume: Created resume object

        Raises:
            Exception: If creation fails
        """
        from app import db
        try:
            resume = Resume(
                personalInfo=personalInfo,
                experience=experience,
                education=education,
                skills=skills
            )
            db.session.add(resume)
            db.session.commit()
            return resume
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to create resume: {str(e)}")
