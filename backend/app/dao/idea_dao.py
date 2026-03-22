"""
Data Access Object for Idea model
"""
from app.models.idea import Idea


class IdeaDAO:

    def __init__(self, session):
        self.session = session

    def getAll(self):
        try:
            return self.session.query(Idea).order_by(Idea.createdAt.desc()).all()
        except Exception as e:
            raise Exception(f"Failed to fetch ideas: {str(e)}")

    def getById(self, ideaId):
        try:
            return self.session.get(Idea, ideaId)
        except Exception as e:
            raise Exception(f"Failed to fetch idea: {str(e)}")

    def create(self, title, description):
        try:
            idea = Idea(title=title, description=description)
            self.session.add(idea)
            self.session.commit()
            return idea
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to create idea: {str(e)}")

    def update(self, ideaId, title=None, description=None):
        try:
            idea = self.session.get(Idea, ideaId)
            if not idea:
                return None
            if title is not None:
                idea.title = title
            if description is not None:
                idea.description = description
            self.session.commit()
            return idea
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to update idea: {str(e)}")

    def delete(self, ideaId):
        try:
            idea = self.session.get(Idea, ideaId)
            if not idea:
                return False
            self.session.delete(idea)
            self.session.commit()
            return True
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to delete idea: {str(e)}")
