"""
Data Access Object for About model
"""
from app.models import About


class AboutDAO:

    def __init__(self, session):
        self.session = session

    def getAbout(self):
        try:
            return self.session.query(About).first()
        except Exception as e:
            raise Exception(f"Failed to fetch about: {str(e)}")

    def updateAbout(self, content=None, profilePhotoUrl=None):
        try:
            about = self.session.query(About).first()
            if not about:
                about = About(
                    content=content or '',
                    profilePhotoUrl=profilePhotoUrl
                )
                self.session.add(about)
            else:
                if content is not None:
                    about.content = content
                if profilePhotoUrl is not None:
                    about.profilePhotoUrl = profilePhotoUrl
            self.session.commit()
            return about
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to update about: {str(e)}")

    def getProfilePhotoUrl(self):
        try:
            about = self.session.query(About).first()
            return about.profilePhotoUrl if about else None
        except Exception:
            return None
