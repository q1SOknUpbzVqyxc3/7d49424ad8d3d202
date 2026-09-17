from typing import Any

from pydantic import BaseModel, ConfigDict


class LeadPayload(BaseModel):
    model_config = ConfigDict(extra='allow')

    email: str
    website: str = ''
    kind: str = ''
    page: str = ''

    def fields(self) -> dict[str, Any]:
        return self.model_dump(exclude_none=True)
