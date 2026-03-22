"""
Data Access Object for ContactSubmission model
"""
from app.models import ContactSubmission
from datetime import datetime


class ContactSubmissionDAO:

    def __init__(self, session):
        self.session = session

    def createSubmission(self, name, email, message, ipAddress=None):
        try:
            submission = ContactSubmission(
                name=name,
                email=email,
                message=message,
                ipAddress=ipAddress,
                read=False
            )
            self.session.add(submission)
            self.session.commit()
            return submission
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to create contact submission: {str(e)}")

    def getAllSubmissions(self, limit=50, offset=0, readFilter='all', includeArchived=False):
        try:
            query = self.session.query(ContactSubmission)
            if not includeArchived:
                query = query.filter(ContactSubmission.archivedAt == None)
            if readFilter == 'read':
                query = query.filter_by(read=True)
            elif readFilter == 'unread':
                query = query.filter_by(read=False)
            total = query.count()
            submissions = query.order_by(ContactSubmission.submittedAt.desc()) \
                               .limit(limit) \
                               .offset(offset) \
                               .all()
            return (submissions, total)
        except Exception as e:
            raise Exception(f"Failed to fetch contact submissions: {str(e)}")

    def getSubmissionById(self, submissionId):
        try:
            return self.session.get(ContactSubmission, submissionId)
        except Exception as e:
            raise Exception(f"Failed to fetch submission: {str(e)}")

    def toggleReadStatus(self, submissionId):
        try:
            submission = self.session.get(ContactSubmission, submissionId)
            if not submission:
                return None
            submission.read = not submission.read
            self.session.commit()
            return submission
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to toggle read status: {str(e)}")

    def markAsRead(self, submissionId):
        try:
            submission = self.session.get(ContactSubmission, submissionId)
            if not submission:
                return None
            submission.read = True
            self.session.commit()
            return submission
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to mark as read: {str(e)}")

    def softDelete(self, submissionId):
        try:
            submission = self.session.get(ContactSubmission, submissionId)
            if not submission:
                return False
            submission.archivedAt = datetime.utcnow()
            self.session.commit()
            return True
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to archive submission: {str(e)}")

    def unarchive(self, submissionId):
        try:
            submission = self.session.get(ContactSubmission, submissionId)
            if not submission:
                return False
            submission.archivedAt = None
            self.session.commit()
            return True
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to unarchive submission: {str(e)}")
