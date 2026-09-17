from fastapi import FastAPI
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.routes import router
from app.core.config import get_settings


settings = get_settings()
app = FastAPI(title='AMIX Lead API', docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(settings.allowed_hosts))
app.include_router(router)


@app.get('/health')
async def health():
    return {'status': 'ok'}
