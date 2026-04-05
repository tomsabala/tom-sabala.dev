from app import db
from datetime import datetime


class TabConfig(db.Model):
    __tablename__ = 'tab_configs'

    id = db.Column(db.Integer, primary_key=True)
    tabKey = db.Column('tab_key', db.String(50), unique=True, nullable=False)
    isVisible = db.Column('is_visible', db.Boolean, nullable=False, default=True)
    updatedAt = db.Column('updated_at', db.DateTime, nullable=False,
                          default=datetime.utcnow, onupdate=datetime.utcnow)

    def toDict(self):
        return {'tab_key': self.tabKey, 'is_visible': self.isVisible}

    def __repr__(self):
        return f'<TabConfig {self.tabKey}={self.isVisible}>'
