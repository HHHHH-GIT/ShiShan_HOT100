"""Validate the complete offline upstream independently of the report pipeline."""
import copy
import json
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(root))
from reporting.provider import Provider

fixture = json.loads((root / 'samples/upstream.json').read_text(encoding='utf-8'))
provider = Provider(root / 'samples/upstream.json')
for name, source in fixture['accounts'].items():
    context = {'account': name, 'credential': 'local:' + name}
    assert provider.identity(context)['userStatus']['username'] == name
    assert provider.profile(name) == source['profile']
    offset = 0
    records = []
    while True:
        page = provider.page(context, offset)
        assert len(page['submissions']) <= provider.PAGE_SIZE
        for row in page['submissions']:
            record = provider.detail(context, row['id'])
            assert record['owner'] == name and record['content']['code']
            records.append(record)
        offset += len(page['submissions'])
        if not page['hasNext']:
            break
        assert page['submissions'], 'incomplete page'
    assert records == source['submissions'], 'missing or changed records'
    assert len({r['id'] for r in records}) == len(records)
    if records:
        before = copy.deepcopy(records[0])
        records[0]['content']['code'] = 'consumer mutation'
        assert provider.detail(context, before['id']) == before
    for other in fixture['accounts']:
        if other != name and fixture['accounts'][other]['submissions']:
            sid = fixture['accounts'][other]['submissions'][0]['id']
            try:
                provider.detail(context, sid)
            except PermissionError:
                pass
            else:
                raise AssertionError('provider returned private source to another account')
guest = {'account': None, 'credential': 'local:guest'}
assert provider.identity(guest)['userStatus']['isSignedIn'] is False
assert provider.page(guest, 0) == {'submissions': [], 'hasNext': False}
print('Local source: identity, complete pagination, permissions, empty account and detached results passed')
