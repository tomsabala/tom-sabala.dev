"""
Resume PDF DAO - Database access object for resume PDF operations
"""
from app.models.resume_pdf import ResumePdfVersion
from datetime import datetime


class ResumePdfDAO:

    def __init__(self, session):
        self.session = session

    def getActivePdf(self):
        try:
            return self.session.query(ResumePdfVersion).filter_by(
                isActive=True,
                deletedAt=None
            ).first()
        except Exception as e:
            raise Exception(f"Failed to fetch active PDF: {str(e)}")

    def getAllVersions(self, includeDeleted=False):
        try:
            query = self.session.query(ResumePdfVersion)
            if not includeDeleted:
                query = query.filter_by(deletedAt=None)
            return query.order_by(ResumePdfVersion.createdAt.desc()).all()
        except Exception as e:
            raise Exception(f"Failed to fetch PDF versions: {str(e)}")

    def createVersion(self, fileName, filePath, fileSize, userId):
        try:
            self.session.query(ResumePdfVersion).filter_by(isActive=True).update({'isActive': False})
            newVersion = ResumePdfVersion(
                fileName=fileName,
                filePath=filePath,
                fileSize=fileSize,
                isActive=True,
                uploadedByUserId=userId
            )
            self.session.add(newVersion)
            self.session.commit()
            return newVersion
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to create PDF version: {str(e)}")

    def setActiveVersion(self, versionId):
        try:
            sourceVersion = self.session.get(ResumePdfVersion, versionId)
            if not sourceVersion:
                return None
            self.session.query(ResumePdfVersion).filter_by(isActive=True).update({'isActive': False})
            newVersion = ResumePdfVersion(
                fileName=sourceVersion.fileName,
                filePath=sourceVersion.filePath,
                fileSize=sourceVersion.fileSize,
                mimeType=sourceVersion.mimeType,
                isActive=True,
                uploadedByUserId=sourceVersion.uploadedByUserId,
                createdAt=datetime.utcnow()
            )
            self.session.add(newVersion)
            self.session.commit()
            return newVersion
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to set active version: {str(e)}")

    def softDelete(self, versionId):
        try:
            version = self.session.get(ResumePdfVersion, versionId)
            if not version:
                return False
            version.deletedAt = datetime.utcnow()
            if version.isActive:
                version.isActive = False
            self.session.commit()
            return True
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to delete PDF version: {str(e)}")

    def getVersionById(self, versionId):
        try:
            return self.session.get(ResumePdfVersion, versionId)
        except Exception as e:
            raise Exception(f"Failed to fetch PDF version: {str(e)}")
