"""
Data Access Object for Project model
"""
from app.models import Project


class ProjectDAO:
    """DAO class for Project database operations"""

    @staticmethod
    def getAllProjects():
        """
        Fetch all projects from database

        Returns:
            list: List of Project objects

        Raises:
            Exception: If database query fails
        """
        try:
            projects = Project.query.all()
            return projects
        except Exception as e:
            raise Exception(f"Failed to fetch projects: {str(e)}")

    @staticmethod
    def getProjectById(projectId):
        """
        Fetch a single project by ID

        Args:
            projectId (int): Project ID

        Returns:
            Project: Project object or None if not found

        Raises:
            Exception: If database query fails
        """
        try:
            project = Project.query.get(projectId)
            return project
        except Exception as e:
            raise Exception(f"Failed to fetch project: {str(e)}")

    @staticmethod
    def createProject(title, description, technologies, githubUrl=None, liveUrl=None, imageUrl=None):
        """
        Create a new project

        Args:
            title (str): Project title
            description (str): Project description
            technologies (list): List of technologies
            githubUrl (str, optional): GitHub URL
            liveUrl (str, optional): Live demo URL
            imageUrl (str, optional): Image URL

        Returns:
            Project: Created project object

        Raises:
            Exception: If project creation fails
        """
        from app import db
        try:
            project = Project(
                title=title,
                description=description,
                technologies=technologies,
                githubUrl=githubUrl,
                liveUrl=liveUrl,
                imageUrl=imageUrl
            )
            db.session.add(project)
            db.session.commit()
            return project
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to create project: {str(e)}")

    @staticmethod
    def updateProject(projectId, **kwargs):
        """
        Update an existing project

        Args:
            projectId (int): Project ID
            **kwargs: Fields to update

        Returns:
            Project: Updated project object or None if not found

        Raises:
            Exception: If update fails
        """
        from app import db
        try:
            project = Project.query.get(projectId)
            if not project:
                return None

            for key, value in kwargs.items():
                if hasattr(project, key):
                    setattr(project, key, value)

            db.session.commit()
            return project
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to update project: {str(e)}")

    @staticmethod
    def deleteProject(projectId):
        """
        Delete a project

        Args:
            projectId (int): Project ID

        Returns:
            bool: True if deleted, False if not found

        Raises:
            Exception: If deletion fails
        """
        from app import db
        try:
            project = Project.query.get(projectId)
            if not project:
                return False

            db.session.delete(project)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to delete project: {str(e)}")
