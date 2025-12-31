from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash


class User(db.Model):
    __tablename__ = 'admin_users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=False)
    passwordHash = db.Column('password_hash', db.String(255), nullable=False)
    createdAt = db.Column('created_at', db.DateTime, nullable=False, default=datetime.utcnow)
    lastLogin = db.Column('last_login', db.DateTime, nullable=True)

    def setPassword(self, password):
        """Hash and set the password"""
        self.passwordHash = generate_password_hash(password)

    def checkPassword(self, password):
        """Check if the provided password matches the hash"""
        return check_password_hash(self.passwordHash, password)

    def toDict(self):
        """Convert model to dictionary for JSON response (exclude password)"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'createdAt': self.createdAt.isoformat() if self.createdAt else None,
            'lastLogin': self.lastLogin.isoformat() if self.lastLogin else None
        }

    def __repr__(self):
        return f'<User {self.username}>'
