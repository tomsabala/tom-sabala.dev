"""
Data Access Object for ContactSubmission model
"""
from app.models import ContactSubmission
from datetime import datetime


class ContactSubmissionDAO:
    """DAO class for ContactSubmission database operations"""

    @staticmethod
    def createSubmission(name, email, message, ipAddress=None):
        """
        Create a new contact submission

        Args:
            name (str): Submitter name
            email (str): Submitter email
            message (str): Message content
            ipAddress (str, optional): Client IP address

        Returns:
            ContactSubmission: Created submission object

        Raises:
            Exception: If submission creation fails
        """
        from app import db
        try:
            submission = ContactSubmission(
                name=name,
                email=email,
                message=message,
                ipAddress=ipAddress,
                read=False
            )
            db.session.add(submission)
            db.session.commit()
            return submission
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to create contact submission: {str(e)}")

    @staticmethod
    def getAllSubmissions(limit=50, offset=0, readFilter='all', includeArchived=False):
        """
        Get submissions with pagination and filters

        Args:
            limit (int): Max results per page (default 50)
            offset (int): Pagination offset (default 0)
            readFilter (str): Filter by read status - 'all'|'read'|'unread' (default 'all')
            includeArchived (bool): Include archived submissions (default False)

        Returns:
            tuple: (submissions list, total_count)

        Raises:
            Exception: If query fails
        """
        try:
            query = ContactSubmission.query

            # Filter by archived status
            if not includeArchived:
                query = query.filter(ContactSubmission.archivedAt == None)

            # Filter by read status
            if readFilter == 'read':
                query = query.filter_by(read=True)
            elif readFilter == 'unread':
                query = query.filter_by(read=False)

            # Get total count for pagination
            total = query.count()

            # Paginate and order (newest first)
            submissions = query.order_by(ContactSubmission.submittedAt.desc())\
                               .limit(limit)\
                               .offset(offset)\
                               .all()

            return (submissions, total)
        except Exception as e:
            raise Exception(f"Failed to fetch contact submissions: {str(e)}")

    @staticmethod
    def getSubmissionById(submissionId):
        """
        Fetch a single submission by ID

        Args:
            submissionId (int): Submission ID

        Returns:
            ContactSubmission: Submission object or None if not found

        Raises:
            Exception: If query fails
        """
        try:
            submission = ContactSubmission.query.get(submissionId)
            return submission
        except Exception as e:
            raise Exception(f"Failed to fetch submission: {str(e)}")

    @staticmethod
    def toggleReadStatus(submissionId):
        """
        Toggle read/unread status

        Args:
            submissionId (int): Submission ID

        Returns:
            ContactSubmission: Updated submission or None if not found

        Raises:
            Exception: If toggle fails
        """
        from app import db
        try:
            submission = ContactSubmission.query.get(submissionId)
            if not submission:
                return None

            submission.read = not submission.read
            db.session.commit()
            return submission
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to toggle read status: {str(e)}")

    @staticmethod
    def markAsRead(submissionId):
        """
        Mark submission as read

        Args:
            submissionId (int): Submission ID

        Returns:
            ContactSubmission: Updated submission or None if not found

        Raises:
            Exception: If update fails
        """
        from app import db
        try:
            submission = ContactSubmission.query.get(submissionId)
            if not submission:
                return None

            submission.read = True
            db.session.commit()
            return submission
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to mark as read: {str(e)}")

    @staticmethod
    def softDelete(submissionId):
        """
        Soft delete (archive) a submission

        Args:
            submissionId (int): Submission ID

        Returns:
            bool: True if archived, False if not found

        Raises:
            Exception: If archiving fails
        """
        from app import db
        try:
            submission = ContactSubmission.query.get(submissionId)
            if not submission:
                return False

            submission.archivedAt = datetime.utcnow()
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to archive submission: {str(e)}")

    @staticmethod
    def unarchive(submissionId):
        """
        Restore archived submission

        Args:
            submissionId (int): Submission ID

        Returns:
            bool: True if unarchived, False if not found

        Raises:
            Exception: If unarchiving fails
        """
        from app import db
        try:
            submission = ContactSubmission.query.get(submissionId)
            if not submission:
                return False

            submission.archivedAt = None
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to unarchive submission: {str(e)}")
