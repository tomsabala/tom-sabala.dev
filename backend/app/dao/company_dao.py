import re
import sys
from app.models import Company


def _normalizeCategories(categories):
    """Deduplicate, lowercase, validate, and cap category tags."""
    print(f"[_normalizeCategories] input={categories}", file=sys.stderr)
    if not categories or not isinstance(categories, list):
        print(f"[_normalizeCategories] empty or non-list input → returning []", file=sys.stderr)
        return []
    seen = set()
    result = []
    pattern = re.compile(r'^[a-z0-9][a-z0-9-]*$')
    for tag in categories:
        if not isinstance(tag, str):
            print(f"[_normalizeCategories] skipping non-string tag: {tag!r}", file=sys.stderr)
            continue
        original = tag
        tag = tag.strip().lower()
        if not tag:
            print(f"[_normalizeCategories] skipping empty tag after strip", file=sys.stderr)
        elif len(tag) > 50:
            print(f"[_normalizeCategories] skipping tag too long ({len(tag)} chars): {tag!r}", file=sys.stderr)
        elif not pattern.match(tag):
            print(f"[_normalizeCategories] skipping tag fails pattern: {tag!r}", file=sys.stderr)
        elif tag in seen:
            print(f"[_normalizeCategories] skipping duplicate: {tag!r}", file=sys.stderr)
        else:
            seen.add(tag)
            result.append(tag)
    result = result[:10]
    print(f"[_normalizeCategories] output={result}", file=sys.stderr)
    return result


class CompanyDAO:

    def __init__(self, session):
        self.session = session

    def getAll(self):
        try:
            return self.session.query(Company).order_by(Company.name.asc()).all()
        except Exception as e:
            raise Exception(f"Failed to fetch companies: {str(e)}")

    def getById(self, companyId):
        try:
            return self.session.get(Company, companyId)
        except Exception as e:
            raise Exception(f"Failed to fetch company: {str(e)}")

    def create(self, name, url=None, notes=None, categories=None):
        try:
            company = Company(
                name=name,
                url=url,
                notes=notes,
                categories=_normalizeCategories(categories),
            )
            self.session.add(company)
            self.session.commit()
            return company
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to create company: {str(e)}")

    def update(self, companyId, **kwargs):
        try:
            company = self.session.get(Company, companyId)
            if not company:
                return None
            if 'categories' in kwargs:
                kwargs['categories'] = _normalizeCategories(kwargs['categories'])
            for key, value in kwargs.items():
                if hasattr(company, key):
                    setattr(company, key, value)
            self.session.commit()
            return company
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to update company: {str(e)}")

    def delete(self, companyId):
        try:
            company = self.session.get(Company, companyId)
            if not company:
                return False
            self.session.delete(company)
            self.session.commit()
            return True
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to delete company: {str(e)}")
