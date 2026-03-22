"""
Data Access Object for Project model
"""
from sqlalchemy import func
from app.models import Project


class ProjectDAO:

    def __init__(self, session):
        self.session = session

    def getAllProjects(self, includeHidden=False):
        try:
            query = self.session.query(Project)
            if not includeHidden:
                query = query.filter_by(isVisible=True)
            return query.order_by(Project.displayOrder.asc()).all()
        except Exception as e:
            raise Exception(f"Failed to fetch projects: {str(e)}")

    def getProjectById(self, projectId):
        try:
            return self.session.get(Project, projectId)
        except Exception as e:
            raise Exception(f"Failed to fetch project: {str(e)}")

    def createProject(self, title, description, technologies, githubUrl=None, liveUrl=None, imageUrl=None, content=None, docsSlug=None, isInProgress=False):
        try:
            maxOrder = self.session.query(func.max(Project.displayOrder)).scalar() or -1
            project = Project(
                title=title,
                description=description,
                technologies=technologies,
                githubUrl=githubUrl,
                liveUrl=liveUrl,
                imageUrl=imageUrl,
                content=content,
                docsSlug=docsSlug,
                displayOrder=maxOrder + 1,
                isVisible=True,
                isInProgress=isInProgress
            )
            self.session.add(project)
            self.session.commit()
            return project
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to create project: {str(e)}")

    def updateProject(self, projectId, **kwargs):
        try:
            project = self.session.get(Project, projectId)
            if not project:
                return None
            for key, value in kwargs.items():
                if hasattr(project, key):
                    setattr(project, key, value)
            self.session.commit()
            return project
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to update project: {str(e)}")

    def deleteProject(self, projectId):
        try:
            project = self.session.get(Project, projectId)
            if not project:
                return False
            self.session.delete(project)
            self.session.commit()
            return True
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to delete project: {str(e)}")

    def getVisibleProjects(self):
        return self.getAllProjects(includeHidden=False)

    def toggleVisibility(self, projectId):
        try:
            project = self.session.get(Project, projectId)
            if not project:
                return None
            project.isVisible = not project.isVisible
            self.session.commit()
            return project
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to toggle visibility: {str(e)}")

    def updateDisplayOrder(self, orderUpdates):
        try:
            for update in orderUpdates:
                project = self.session.get(Project, update['id'])
                if project:
                    project.displayOrder = update['displayOrder']
            self.session.commit()
            return True
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to update order: {str(e)}")
