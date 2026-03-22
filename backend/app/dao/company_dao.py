from app.models import Company


class CompanyDAO:

    @staticmethod
    def getAll():
        try:
            return Company.query.order_by(Company.name.asc()).all()
        except Exception as e:
            raise Exception(f"Failed to fetch companies: {str(e)}")

    @staticmethod
    def getById(companyId):
        try:
            return Company.query.get(companyId)
        except Exception as e:
            raise Exception(f"Failed to fetch company: {str(e)}")

    @staticmethod
    def create(name, url=None, notes=None):
        from app import db
        try:
            company = Company(name=name, url=url, notes=notes)
            db.session.add(company)
            db.session.commit()
            return company
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to create company: {str(e)}")

    @staticmethod
    def update(companyId, **kwargs):
        from app import db
        try:
            company = Company.query.get(companyId)
            if not company:
                return None
            for key, value in kwargs.items():
                if hasattr(company, key):
                    setattr(company, key, value)
            db.session.commit()
            return company
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to update company: {str(e)}")

    @staticmethod
    def delete(companyId):
        from app import db
        try:
            company = Company.query.get(companyId)
            if not company:
                return False
            db.session.delete(company)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to delete company: {str(e)}")
