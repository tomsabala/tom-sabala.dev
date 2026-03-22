from app.models import Company


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

    def create(self, name, url=None, notes=None):
        try:
            company = Company(name=name, url=url, notes=notes)
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
