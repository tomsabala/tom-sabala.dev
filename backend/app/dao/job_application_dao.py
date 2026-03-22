from app.models import JobApplication


class JobApplicationDAO:

    def __init__(self, session):
        self.session = session

    def getAll(self, status=None):
        try:
            query = self.session.query(JobApplication)
            if status:
                query = query.filter_by(status=status)
            return query.order_by(JobApplication.createdAt.desc()).all()
        except Exception as e:
            raise Exception(f"Failed to fetch job applications: {str(e)}")

    def getById(self, applicationId):
        try:
            return self.session.get(JobApplication, applicationId)
        except Exception as e:
            raise Exception(f"Failed to fetch job application: {str(e)}")

    def create(self, companyName, position, status='bookmarked', companyId=None, jobUrl=None, dateApplied=None, notes=None):
        try:
            application = JobApplication(
                companyName=companyName,
                position=position,
                status=status,
                companyId=companyId,
                jobUrl=jobUrl,
                dateApplied=dateApplied,
                notes=notes,
            )
            self.session.add(application)
            self.session.commit()
            return application
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to create job application: {str(e)}")

    def update(self, applicationId, **kwargs):
        try:
            application = self.session.get(JobApplication, applicationId)
            if not application:
                return None
            for key, value in kwargs.items():
                if hasattr(application, key):
                    setattr(application, key, value)
            self.session.commit()
            return application
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to update job application: {str(e)}")

    def delete(self, applicationId):
        try:
            application = self.session.get(JobApplication, applicationId)
            if not application:
                return False
            self.session.delete(application)
            self.session.commit()
            return True
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to delete job application: {str(e)}")
