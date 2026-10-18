from app import db
from datetime import datetime


class Project(db.Model):
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    technologies = db.Column(db.JSON, nullable=False, default=list)  # Store as JSON array
    githubUrl = db.Column('github_url', db.String(500), nullable=True)
    liveUrl = db.Column('live_url', db.String(500), nullable=True)
    imageUrl = db.Column('image_url', db.String(500), nullable=True)
    content = db.Column('content', db.Text, nullable=True)
    docsSlug = db.Column('docs_slug', db.String(100), nullable=True)
    # ── Redesign detail-page content; all optional ────────────────────────────
    slug = db.Column('slug', db.String(100), nullable=True, unique=True)
    field = db.Column('field', db.String(100), nullable=True)
    lede = db.Column('lede', db.Text, nullable=True)
    facts = db.Column('facts', db.JSON, nullable=True)          # [{"k":..,"v":..}]
    aboutParagraphs = db.Column('about_paragraphs', db.JSON, nullable=True)  # ["..",".."]
    steps = db.Column('steps', db.JSON, nullable=True)          # [{"t":..,"d":..}]
    rulesTitle = db.Column('rules_title', db.String(120), nullable=True)
    rules = db.Column('rules', db.JSON, nullable=True)          # ["..", ".."]
    runCode = db.Column('run_code', db.Text, nullable=True)
    specimen = db.Column('specimen', db.String(40), nullable=True)
    accessLabel = db.Column('access_label', db.String(60), nullable=True)
    isVisible = db.Column('is_visible', db.Boolean, nullable=False, default=True)
    isInProgress = db.Column('is_in_progress', db.Boolean, nullable=False, default=False)
    displayOrder = db.Column('display_order', db.Integer, nullable=False, default=0)
    createdAt = db.Column('created_at', db.DateTime, nullable=False, default=datetime.utcnow)
    updatedAt = db.Column('updated_at', db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def toDict(self):
        """Convert model to dictionary for JSON response"""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'technologies': self.technologies,
            'github_url': self.githubUrl,
            'live_url': self.liveUrl,
            'image_url': self.imageUrl,
            'content': self.content,
            'docsSlug': self.docsSlug,
            'slug': self.slug,
            'field': self.field,
            'lede': self.lede,
            'facts': self.facts,
            'aboutParagraphs': self.aboutParagraphs,
            'steps': self.steps,
            'rulesTitle': self.rulesTitle,
            'rules': self.rules,
            'runCode': self.runCode,
            'specimen': self.specimen,
            'accessLabel': self.accessLabel,
            'isVisible': self.isVisible,
            'is_in_progress': self.isInProgress,
            'displayOrder': self.displayOrder,
            'createdAt': self.createdAt.isoformat() if self.createdAt else None,
            'updatedAt': self.updatedAt.isoformat() if self.updatedAt else None
        }

    def __repr__(self):
        return f'<Project {self.title}>'
