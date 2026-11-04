from __future__ import annotations
import json, sys
from pathlib import Path
import httpx

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'ai-service'))
from experiments import run_exploratory_matrix as matrix
from app.core.config import settings
from app.core import llm_router, llm_telemetry

OUT = Path(__file__).resolve().parent
MODEL = 'qwen2.5-coder:3b'
BASE = ROOT / 'experiments' / 'configs'
CONFIG_DIR = OUT / 'configs'
CONFIG_DIR.mkdir(exist_ok=True)
for variant in matrix.VARIANT_CONFIGS:
    source = json.loads((BASE / f'{variant}.json').read_text(encoding='utf-8'))
    source['model'] = MODEL
    source['embedding_model'] = 'sentence-transformers/all-MiniLM-L6-v2'
    (CONFIG_DIR / f'{variant}.json').write_text(json.dumps(source, indent=2) + '\n', encoding='utf-8')
matrix.CONFIG_DIR = CONFIG_DIR

cache = OUT.parent / 'candidate-v4-local-minilm-openrouter-20261103' / 'output' / 'embedding-cache.jsonl'
cache_vectors = {}
for line in cache.read_text(encoding='utf-8').splitlines()[1:]:
    item = json.loads(line)
    cache_vectors[item['sha256']] = item['vector']
def cached_embed(texts):
    import hashlib
    missing = [text for text in texts if hashlib.sha256(text.encode('utf-8')).hexdigest() not in cache_vectors]
    if missing:
        raise RuntimeError(f'cached MiniLM embeddings missing for {len(missing)} text(s)')
    return [cache_vectors[hashlib.sha256(text.encode('utf-8')).hexdigest()] for text in texts]
matrix._default_embedder = cached_embed

# Do not call hosted services during this local, no-cost run.
settings.GEMINI_API_KEY = ''
settings.OPENROUTER_API_KEY = ''
settings.TAVILY_API_KEY = ''

def output_schema(system_prompt):
    claim = {'type':'object','properties':{'claim_id':{'type':'string'},'text':{'type':'string'},'evidence_ids':{'type':'array','maxItems':5,'items':{'type':'string'}}},'required':['claim_id','text','evidence_ids'],'additionalProperties':False}
    if 'Primary Evidence Retriever' in system_prompt:
        return {'type':'object','properties':{'claims':{'type':'array','maxItems':4,'items':claim}},'required':['claims'],'additionalProperties':False}
    if 'Fact-Checker' in system_prompt:
        verification = {'type':'object','properties':{'claim_id':{'type':'string'},'label':{'type':'string','enum':['supported','contradicted','insufficient']},'evidence_ids':{'type':'array','maxItems':5,'items':{'type':'string'}},'confidence':{'type':'number','minimum':0,'maximum':1}},'required':['claim_id','label','evidence_ids','confidence'],'additionalProperties':False}
        return {'type':'object','properties':{'verifications':{'type':'array','maxItems':4,'items':verification}},'required':['verifications'],'additionalProperties':False}
    if 'Hallucination & Inconsistency Auditor' in system_prompt:
        return {'type':'object','properties':{'risk':{'type':'string','enum':['low','medium','high']},'unsupported_claim_ids':{'type':'array','maxItems':4,'items':{'type':'string'}},'confidence':{'type':'number','minimum':0,'maximum':1}},'required':['risk','unsupported_claim_ids','confidence'],'additionalProperties':False}
    return {'type':'object','properties':{'answer':{'type':'string'},'claims':{'type':'array','maxItems':3,'items':claim}},'required':['answer','claims'],'additionalProperties':False}

async def local_call(prompt, system_prompt='You are an expert RAG assistant.', model=None, temperature=0.1, api_key_override=None, max_output_tokens=768):
    attempt = llm_telemetry.record_llm_attempt('ollama', MODEL)
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=10.0)) as client:
            response = await client.post('http://127.0.0.1:11434/api/chat', json={
                'model': MODEL, 'stream': False, 'format': output_schema(system_prompt),
                'messages': [{'role':'system','content':system_prompt},{'role':'user','content':prompt}],
                'options': {'temperature': temperature, 'num_predict': max_output_tokens}
            })
            response.raise_for_status()
            content = response.json().get('message', {}).get('content', '')
            if not content:
                raise RuntimeError('Ollama returned empty content')
        llm_telemetry.complete_llm_attempt(attempt, succeeded=True)
        return content
    except Exception:
        llm_telemetry.complete_llm_attempt(attempt, succeeded=False)
        raise
llm_router.call_llm = local_call

if __name__ == '__main__':
    dataset = ROOT / 'experiments' / 'runs' / 'candidate-v4-local-minilm-openrouter-20261103' / 'pilot-4.jsonl'
    manifest = ROOT / 'experiments' / 'datasets' / 'trustrag-public-candidate-v4' / 'trustrag-v1.manifest.json'
    embedding_cache = OUT.parent / 'candidate-v4-local-minilm-openrouter-20261103' / 'output' / 'embedding-cache.jsonl'
    report = matrix.run_exploratory_matrix(dataset, manifest, OUT / 'runs', embedding_cache=embedding_cache)
    print(f'REPORT={report}', flush=True)
