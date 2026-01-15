"""
Data Access Object for About model
"""
from app.models import About


class AboutDAO:
    """DAO class for About database operations"""

    @staticmethod
    def getAbout():
        """
        Fetch the about content (there should only be one)

        Returns:
            About: About object or None if not found

        Raises:
            Exception: If database query fails
        """
        try:
            about = About.query.first()
            return about
        except Exception as e:
            raise Exception(f"Failed to fetch about: {str(e)}")

    @staticmethod
    def updateAbout(content=None, profilePhotoUrl=None):
        """
        Update or create the about content

        Args:
            content (str, optional): About text content (plain text)
            profilePhotoUrl (str, optional): URL/path to profile photo

        Returns:
            About: Updated or created about object

        Raises:
            Exception: If update fails
        """
        from app import db
        try:
            about = About.query.first()

            if not about:
                about = About(
                    content=content or '',
                    profilePhotoUrl=profilePhotoUrl
                )
                db.session.add(about)
            else:
                if content is not None:
                    about.content = content
                if profilePhotoUrl is not None:
                    about.profilePhotoUrl = profilePhotoUrl

            db.session.commit()
            return about
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to update about: {str(e)}")

    @staticmethod
    def getProfilePhotoUrl():
        """
        Get just the profile photo URL (for deletion checks)

        Returns:
            str: Profile photo URL or None
        """
        try:
            about = About.query.first()
            return about.profilePhotoUrl if about else None
        except Exception:
            return None
