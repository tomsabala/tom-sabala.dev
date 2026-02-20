"""
Data Access Object for Project model
"""
from app.models import Project


class ProjectDAO:
    """DAO class for Project database operations"""

    @staticmethod
    def getAllProjects(includeHidden=False):
        """
        Fetch all projects from database ordered by displayOrder

        Args:
            includeHidden (bool): If True, include hidden projects

        Returns:
            list: List of Project objects

        Raises:
            Exception: If database query fails
        """
        try:
            query = Project.query
            if not includeHidden:
                query = query.filter_by(isVisible=True)
            projects = query.order_by(Project.displayOrder.asc()).all()
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
    def createProject(title, description, technologies, githubUrl=None, liveUrl=None, imageUrl=None, content=None):
        """
        Create a new project with auto-assigned displayOrder

        Args:
            title (str): Project title
            description (str): Project description
            technologies (list): List of technologies
            githubUrl (str, optional): GitHub URL
            liveUrl (str, optional): Live demo URL
            imageUrl (str, optional): Image URL
            content (str, optional): Markdown article content

        Returns:
            Project: Created project object

        Raises:
            Exception: If project creation fails
        """
        from app import db
        try:
            # Get max displayOrder and add 1 (new projects go to the end)
            maxOrder = db.session.query(db.func.max(Project.displayOrder)).scalar() or -1

            project = Project(
                title=title,
                description=description,
                technologies=technologies,
                githubUrl=githubUrl,
                liveUrl=liveUrl,
                imageUrl=imageUrl,
                content=content,
                displayOrder=maxOrder + 1,
                isVisible=True  # New projects visible by default
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

    @staticmethod
    def getVisibleProjects():
        """
        Fetch only visible projects ordered by displayOrder

        Returns:
            list: List of visible Project objects

        Raises:
            Exception: If database query fails
        """
        return ProjectDAO.getAllProjects(includeHidden=False)

    @staticmethod
    def toggleVisibility(projectId):
        """
        Toggle project visibility (show/hide)

        Args:
            projectId (int): Project ID

        Returns:
            Project: Updated project object or None if not found

        Raises:
            Exception: If toggle fails
        """
        from app import db
        try:
            project = Project.query.get(projectId)
            if not project:
                return None

            project.isVisible = not project.isVisible
            db.session.commit()
            return project
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to toggle visibility: {str(e)}")

    @staticmethod
    def updateDisplayOrder(orderUpdates):
        """
        Update display order for multiple projects

        Args:
            orderUpdates (list): List of dicts [{'id': 1, 'displayOrder': 0}, ...]

        Returns:
            bool: True if successful

        Raises:
            Exception: If update fails
        """
        from app import db
        try:
            for update in orderUpdates:
                project = Project.query.get(update['id'])
                if project:
                    project.displayOrder = update['displayOrder']

            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to update order: {str(e)}")
