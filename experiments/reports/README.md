# Research report artifacts

`report.py` renders paper tables only from successful runs whose manifest has
`paper_eligible: true`. It produces:

- `table-ii.csv` and `table-ii.tex`: answer quality, grounding, safety,
  retrieval, calibration, and abstention;
- `table-iii.csv` and `table-iii.tex`: latency and orchestration counts;
- `comparison.json`: single-system and paired bootstrap intervals.

Run reports only after the authenticated review workflow exports all 200 approved records
with a passing integrity audit. The recorded protocol is one human reviewer plus automated
consistency checks; it does not claim independent reviewer agreement:

```powershell
ai-service/.venv/Scripts/python.exe -c "from experiments.report import render_comparison_report; render_comparison_report(['runs/baseline-rag', 'runs/reranked-rag', 'runs/rag-verification', 'runs/multi-agent-rag', 'runs/trustrag'], 'runs/report', baseline='baseline-rag')"
```

Smoke runs and draft datasets are intentionally rejected.
