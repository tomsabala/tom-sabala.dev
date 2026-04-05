from app.models.tab_config import TabConfig
from datetime import datetime

TAB_KEYS = ['home', 'portfolio', 'cv', 'contact', 'github']


class TabConfigDAO:

    def __init__(self, session):
        self.session = session

    def getAll(self):
        """Returns dict of all tab visibility configs, defaulting missing keys to True."""
        rows = self.session.query(TabConfig).all()
        result = {k: True for k in TAB_KEYS}
        for row in rows:
            result[row.tabKey] = row.isVisible
        return result

    def bulkUpsert(self, configs: dict):
        """Upsert tab visibility. Ignores unknown keys. configs: {tab_key: bool}"""
        for key, visible in configs.items():
            if key not in TAB_KEYS:
                continue
            row = self.session.query(TabConfig).filter_by(tabKey=key).first()
            if row:
                row.isVisible = bool(visible)
                row.updatedAt = datetime.utcnow()
            else:
                self.session.add(TabConfig(tabKey=key, isVisible=bool(visible)))
        self.session.commit()
