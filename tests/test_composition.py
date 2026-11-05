from fastapi.testclient import TestClient
from backend.main import app

def test_composition_validation_and_atomic_delete(database):
    client=TestClient(app);headers={'Authorization':'Bearer test-secret'}
    command=dict(members=['a','missing'],target_id='c',source_verse_id=1)
    assert client.post('/compositions',json=command,headers=headers).status_code==422
    command['members']=['a','b']
    response=client.post('/compositions',json=command,headers=headers)
    assert response.status_code==200
    rows=response.json()
    assert rows[0]['composition_id']==rows[1]['composition_id']
    assert client.delete('/relations/'+str(rows[0]['id']),headers=headers).status_code==409
    assert client.delete('/compositions/'+rows[0]['composition_id'],headers=headers).json()['deleted']==2
