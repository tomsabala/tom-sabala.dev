from app.models import JobApplication


class JobApplicationDAO:

    @staticmethod
    def getAll(status=None):
        try:
            query = JobApplication.query
            if status:
                query = query.filter_by(status=status)
            return query.order_by(JobApplication.createdAt.desc()).all()
        except Exception as e:
            raise Exception(f"Failed to fetch job applications: {str(e)}")

    @staticmethod
    def getById(applicationId):
        try:
            return JobApplication.query.get(applicationId)
        except Exception as e:
            raise Exception(f"Failed to fetch job application: {str(e)}")

    @staticmethod
    def create(companyName, position, status='bookmarked', companyId=None, jobUrl=None, dateApplied=None, notes=None):
        from app import db
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
            db.session.add(application)
            db.session.commit()
            return application
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to create job application: {str(e)}")

    @staticmethod
    def update(applicationId, **kwargs):
        from app import db
        try:
            application = JobApplication.query.get(applicationId)
            if not application:
                return None
            for key, value in kwargs.items():
                if hasattr(application, key):
                    setattr(application, key, value)
            db.session.commit()
            return application
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to update job application: {str(e)}")

    @staticmethod
    def delete(applicationId):
        from app import db
        try:
            application = JobApplication.query.get(applicationId)
            if not application:
                return False
            db.session.delete(application)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to delete job application: {str(e)}")
