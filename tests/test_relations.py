from fastapi.testclient import TestClient
from backend.main import app

def test_relation_input_and_duplicate_validation(database):
    client=TestClient(app)
    headers={'Authorization':'Bearer test-secret'}
    valid=dict(source_id='a',target_id='b',relation_type='similar',source_verse_id=1)
    for changes in [dict(id=44),dict(source_id='missing'),dict(source_verse_id=999),dict(relation_type='invented'),dict(source_verse_id=None)]:
        assert client.post('/relations',json={**valid,**changes},headers=headers).status_code==422
    assert client.post('/relations',json=valid,headers=headers).status_code==200
    assert client.post('/relations',json=valid,headers=headers).status_code==409
