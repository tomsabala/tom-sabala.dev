"""
Resume PDF DAO - Database access object for resume PDF operations
"""
from app.models.resume_pdf import ResumePdfVersion
from app import db
from datetime import datetime


class ResumePdfDAO:
    """DAO class for ResumePdfVersion database operations"""

    @staticmethod
    def getActivePdf():
        """
        Get the currently active PDF version

        Returns:
            ResumePdfVersion: Active PDF or None if no active PDF exists

        Raises:
            Exception: If database query fails
        """
        try:
            return ResumePdfVersion.query.filter_by(
                isActive=True,
                deletedAt=None
            ).first()
        except Exception as e:
            raise Exception(f"Failed to fetch active PDF: {str(e)}")

    @staticmethod
    def getAllVersions(includeDeleted=False):
        """
        Get all PDF versions ordered by creation date (newest first)

        Args:
            includeDeleted (bool): Include soft-deleted versions (default: False)

        Returns:
            list[ResumePdfVersion]: List of all versions

        Raises:
            Exception: If database query fails
        """
        try:
            query = ResumePdfVersion.query

            if not includeDeleted:
                query = query.filter_by(deletedAt=None)

            return query.order_by(ResumePdfVersion.createdAt.desc()).all()
        except Exception as e:
            raise Exception(f"Failed to fetch PDF versions: {str(e)}")

    @staticmethod
    def createVersion(fileName, filePath, fileSize, userId):
        """
        Create a new PDF version and set it as active
        Automatically deactivates all other versions

        Args:
            fileName (str): Original filename
            filePath (str): Relative storage path
            fileSize (int): File size in bytes
            userId (int): ID of uploading user

        Returns:
            ResumePdfVersion: Created version object

        Raises:
            Exception: If database operation fails
        """
        try:
            # Deactivate all existing versions
            ResumePdfVersion.query.filter_by(isActive=True).update({'isActive': False})

            # Create new version as active
            newVersion = ResumePdfVersion(
                fileName=fileName,
                filePath=filePath,
                fileSize=fileSize,
                isActive=True,
                uploadedByUserId=userId
            )

            db.session.add(newVersion)
            db.session.commit()

            return newVersion
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to create PDF version: {str(e)}")

    @staticmethod
    def setActiveVersion(versionId):
        """
        Set a specific version as active (restore from history)
        Deactivates all other versions

        Args:
            versionId (int): Version ID to activate

        Returns:
            ResumePdfVersion: Activated version or None if not found/deleted

        Raises:
            Exception: If database operation fails
        """
        try:
            version = ResumePdfVersion.query.get(versionId)

            if not version or version.deletedAt is not None:
                return None

            # Deactivate all versions
            ResumePdfVersion.query.filter_by(isActive=True).update({'isActive': False})

            # Activate selected version
            version.isActive = True
            db.session.commit()

            return version
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to set active version: {str(e)}")

    @staticmethod
    def softDelete(versionId):
        """
        Soft delete a PDF version (mark as deleted but keep in database)
        If deleting active version, no version will be active

        Args:
            versionId (int): Version ID to delete

        Returns:
            bool: True if deleted, False if not found

        Raises:
            Exception: If database operation fails
        """
        try:
            version = ResumePdfVersion.query.get(versionId)

            if not version:
                return False

            # Mark as deleted
            version.deletedAt = datetime.utcnow()

            # If deleting active version, deactivate it
            if version.isActive:
                version.isActive = False

            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to delete PDF version: {str(e)}")

    @staticmethod
    def getVersionById(versionId):
        """
        Get a specific version by ID

        Args:
            versionId (int): Version ID

        Returns:
            ResumePdfVersion: Version object or None if not found

        Raises:
            Exception: If database query fails
        """
        try:
            return ResumePdfVersion.query.get(versionId)
        except Exception as e:
            raise Exception(f"Failed to fetch PDF version: {str(e)}")
