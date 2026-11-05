from fastapi.testclient import TestClient
from backend.main import app

def test_backend_is_read_only_without_token(monkeypatch):
    monkeypatch.delenv('PARALLELISMUS_WRITE_TOKEN', raising=False)
    client = TestClient(app)
    assert client.post('/relations', json={}).status_code == 503
    assert client.delete('/relations/1').status_code == 503

def test_token_and_origin_required(monkeypatch):
    monkeypatch.setenv('PARALLELISMUS_WRITE_TOKEN', 'test-secret')
    client = TestClient(app)
    assert client.post('/relations', json={}).status_code == 401
    assert client.delete('/relations/1', headers={'Authorization':'Bearer wrong'}).status_code == 401
    assert client.post('/relations', json={}, headers={'Authorization':'Bearer test-secret','Origin':'https://untrusted.example'}).status_code == 403
    # Authenticated request reaches request validation rather than write authorization.
    assert client.post('/relations', content='bad json', headers={'Authorization':'Bearer test-secret','Content-Type':'application/json'}).status_code == 422
    preflight = client.options('/relations', headers={'Origin':'https://untrusted.example','Access-Control-Request-Method':'POST'})
    assert 'access-control-allow-origin' not in preflight.headers
