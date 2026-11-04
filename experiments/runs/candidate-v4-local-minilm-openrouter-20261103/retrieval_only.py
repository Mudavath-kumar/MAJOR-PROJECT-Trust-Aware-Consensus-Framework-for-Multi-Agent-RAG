import csv, json, os
from pathlib import Path
from statistics import mean
from time import perf_counter
from sentence_transformers import SentenceTransformer
from experiments.corpus import load_corpus_manifest, load_corpus_rows
from experiments.run_benchmark import InMemoryRetriever
from experiments.run_exploratory_matrix import _MemoizedEmbedder
from experiments.runner import load_jsonl

root=Path.cwd()
run_dir=root/'experiments/runs/candidate-v4-local-minilm-openrouter-20261103'
source=root/'experiments/reports/candidate-review-v4-automated-20261103/candidate-v4-automated-approved-exploratory.jsonl'
manifest_path=root/'experiments/datasets/trustrag-public-candidate-v4/trustrag-v1.manifest.json'
records=load_jsonl(source)
rows=load_corpus_rows(load_corpus_manifest(manifest_path))
snapshots=Path(r'C:\Users\kumar\.cache\huggingface\hub\models--sentence-transformers--all-MiniLM-L6-v2\snapshots')
model=SentenceTransformer(str(next(snapshots.iterdir())), local_files_only=True)
embedder=_MemoizedEmbedder(lambda texts:model.encode(texts,normalize_embeddings=True).tolist(),cache_path=run_dir/'output/embedding-cache.jsonl',model='sentence-transformers/all-MiniLM-L6-v2')
retriever=InMemoryRetriever(rows,embedder)
results=[]
for cfg_path in sorted((root/'experiments/configs').glob('*.json')):
    cfg=json.loads(cfg_path.read_text(encoding='utf-8'))
    variant=cfg.get('name')
    if variant not in {'baseline-rag','reranked-rag','rag-verification','multi-agent-rag','trustrag-no-external','trustrag'}: continue
    timings=[]; eligible=[]; output=[]
    rerank=bool(cfg['retrieval']['reranking']['enabled'])
    top_k=int(cfg['retrieval']['top_k'])
    candidate_k=int(cfg['retrieval'].get('candidate_k',top_k))
    for rec in records:
        scope={str(d['document_id']) for d in rec.get('documents',[])}
        start=perf_counter()
        found=retriever.search(rec['question'],top_k,rerank=rerank,candidate_k=candidate_k,document_ids=scope)
        elapsed=(perf_counter()-start)*1000
        timings.append(elapsed)
        gold=set(map(str,rec.get('gold_evidence_ids',[])))
        retrieved=[str(x.get('chunk_id',x.get('evidence_id',''))) for x in found]
        if rec['answer_type'] in {'answerable','prompt_injection'} and gold:
            eligible.append(len(gold & set(retrieved))/len(gold))
        output.append({'id':rec['id'],'answer_type':rec['answer_type'],'gold_evidence_ids':sorted(gold),'retrieved_evidence_ids':retrieved,'retrieval_recall_at_5':(len(gold & set(retrieved))/len(gold) if rec['answer_type'] in {'answerable','prompt_injection'} and gold else None),'retrieval_latency_ms':round(elapsed,3)})
    results.append({'variant':variant,'sample_count':len(records),'retrieval_recall_denominator':len(eligible),'recall_at_5':mean(eligible) if eligible else None,'mean_retrieval_latency_ms':mean(timings),'retrieval_calls_per_query':1,'reranking':rerank,'category_counts':{t:sum(r['answer_type']==t for r in records) for t in ['answerable','unanswerable','conflicting','prompt_injection']}})
    outdir=run_dir/'retrieval-only'/variant; outdir.mkdir(parents=True,exist_ok=True)
    (outdir/'retrieval-predictions.jsonl').write_text(''.join(json.dumps(x)+'\n' for x in output),encoding='utf-8')
(run_dir/'retrieval-only').mkdir(parents=True,exist_ok=True)
(run_dir/'retrieval-only/summary.json').write_text(json.dumps({'status':'retrieval-only exploratory measurement; no generation','embedding_model':'sentence-transformers/all-MiniLM-L6-v2','dataset_count':len(records),'results':results},indent=2)+'\n',encoding='utf-8')
with (run_dir/'retrieval-only/results.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=['variant','sample_count','retrieval_recall_denominator','recall_at_5','mean_retrieval_latency_ms','retrieval_calls_per_query','reranking','category_counts']);w.writeheader();w.writerows(results)
print(json.dumps(results,indent=2))
