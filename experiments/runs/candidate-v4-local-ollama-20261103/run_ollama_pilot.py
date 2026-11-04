import asyncio, json, sys
from pathlib import Path
import httpx
from sentence_transformers import SentenceTransformer
root=Path.cwd()
sys.path.insert(0,str(root/'ai-service'))
from experiments import run_exploratory_matrix as matrix
from app.core.config import settings
from app.core import llm_router, llm_telemetry

out=root/'experiments/runs/candidate-v4-local-ollama-20261103'
configs=out/'configs'; configs.mkdir(parents=True,exist_ok=True)
model_id='qwen2.5-coder:3b'
for name in matrix.VARIANT_CONFIGS:
 src=root/'experiments/configs'/f'{name}.json'; data=json.loads(src.read_text(encoding='utf-8'))
 data['model']=model_id; data['embedding_model']='sentence-transformers/all-MiniLM-L6-v2'
 (configs/src.name).write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
snapshot=Path(r'C:\Users\kumar\.cache\huggingface\hub\models--sentence-transformers--all-MiniLM-L6-v2\snapshots')
embed_model=SentenceTransformer(str(next(snapshot.iterdir())),local_files_only=True)
matrix.CONFIG_DIR=configs
matrix._default_embedder=lambda texts:embed_model.encode(texts,normalize_embeddings=True).tolist()
settings.GEMINI_API_KEY=''; settings.OPENROUTER_API_KEY=''; settings.TAVILY_API_KEY=''

def output_schema(system_prompt):
 if 'Primary Evidence Retriever' in system_prompt:
  return {'type':'object','properties':{'claims':{'type':'array','maxItems':4,'items':{'type':'object','properties':{'claim_id':{'type':'string'},'text':{'type':'string'},'evidence_ids':{'type':'array','maxItems':5,'items':{'type':'string'}}},'required':['claim_id','text','evidence_ids'],'additionalProperties':False}}},'required':['claims'],'additionalProperties':False}
 if 'Fact-Checker' in system_prompt:
  return {'type':'object','properties':{'verifications':{'type':'array','maxItems':4,'items':{'type':'object','properties':{'claim_id':{'type':'string'},'label':{'type':'string','enum':['supported','contradicted','insufficient']},'evidence_ids':{'type':'array','maxItems':5,'items':{'type':'string'}},'confidence':{'type':'number','minimum':0,'maximum':1}},'required':['claim_id','label','evidence_ids','confidence'],'additionalProperties':False}}},'required':['verifications'],'additionalProperties':False}
 if 'Hallucination & Inconsistency Auditor' in system_prompt:
  return {'type':'object','properties':{'risk':{'type':'string','enum':['low','medium','high']},'unsupported_claim_ids':{'type':'array','maxItems':4,'items':{'type':'string'}},'confidence':{'type':'number','minimum':0,'maximum':1}},'required':['risk','unsupported_claim_ids','confidence'],'additionalProperties':False}
 return {'type':'object','properties':{'answer':{'type':'string'},'claims':{'type':'array','maxItems':3,'items':{'type':'object','properties':{'claim_id':{'type':'string'},'text':{'type':'string'},'evidence_ids':{'type':'array','maxItems':5,'items':{'type':'string'}}},'required':['claim_id','text','evidence_ids'],'additionalProperties':False}}},'required':['answer','claims'],'additionalProperties':False}

async def local_call(prompt,system_prompt='You are an expert RAG assistant.',model=None,temperature=0.1,api_key_override=None,max_output_tokens=768):
 attempt=llm_telemetry.record_llm_attempt('ollama',model_id)
 try:
  async with httpx.AsyncClient(timeout=180) as client:
   response=await client.post('http://127.0.0.1:11434/api/chat',json={'model':model_id,'stream':False,'format':output_schema(system_prompt),'messages':[{'role':'system','content':system_prompt},{'role':'user','content':prompt}],'options':{'temperature':temperature,'num_predict':max_output_tokens}})
   response.raise_for_status(); content=response.json().get('message',{}).get('content','')
   if not content.lstrip().startswith('{') or not content.rstrip().endswith('}'): print('OLLAMA_INCOMPLETE='+repr(content[-500:]),flush=True)
   if not content: raise RuntimeError('Ollama returned empty content')
  llm_telemetry.complete_llm_attempt(attempt,succeeded=True); return content
 except Exception:
  llm_telemetry.complete_llm_attempt(attempt,succeeded=False); raise
llm_router.call_llm=local_call
report=matrix.run_exploratory_matrix(root/'experiments/runs/candidate-v4-local-minilm-openrouter-20261103/pilot-4.jsonl',root/'experiments/datasets/trustrag-public-candidate-v4/trustrag-v1.manifest.json',out/'runs-schema',embedding_cache=root/'experiments/runs/candidate-v4-local-minilm-openrouter-20261103/output/embedding-cache.jsonl')
print('report='+str(report))
