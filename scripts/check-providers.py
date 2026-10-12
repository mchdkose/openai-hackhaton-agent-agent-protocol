"""Verify the server integration without printing credentials or account data."""
from pathlib import Path
import json
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
env = dict(line.split('=', 1) for line in (ROOT / '.env.local').read_text().splitlines() if '=' in line and not line.startswith('#'))
schema = {'type':'object','properties':{'ok':{'type':'boolean'}},'required':['ok'],'additionalProperties':False}
for model in ['anthropic/claude-haiku-5.5', 'openai/gpt-6.1-sol']:
    start = time.monotonic()
    payload = {
        'model': model,
        'messages': [{'role':'user','content':'Return ok as true.'}],
        'max_tokens': 2048,
        'response_format': {'type':'json_schema','json_schema':{'name':'connection_check','strict':True,'schema':schema}},
        'provider': {'require_parameters': True}
    }
    if model.startswith('openai/gpt-6'):
        payload['reasoning'] = {'effort': 'low', 'exclude': True}
    request = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=json.dumps(payload).encode(), headers={'Content-Type':'application/json','Authorization':'Bearer '+env['OPENROUTER_API_KEY']})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data = json.load(response)
        content = data.get('choices', [{}])[0].get('message', {}).get('content')
        parsed = json.loads(content or '{}')
        print(json.dumps({'model': model, 'structured_output_valid': parsed == {'ok': True}, 'elapsed_seconds': round(time.monotonic()-start, 2), 'reported_cost_usd': data.get('usage', {}).get('cost')}))
    except urllib.error.HTTPError as error:
        try:
            details = json.loads(error.read()).get('error', {})
            reason = details.get('message', 'Provider request failed')
        except Exception:
            reason = 'Provider request failed'
        print(json.dumps({'model':model,'http_status':error.code,'reason':reason[:250]}))
    except Exception as error:
        print(json.dumps({'model':model,'error_type':type(error).__name__}))
