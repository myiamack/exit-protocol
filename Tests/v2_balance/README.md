# Rules v2 type balance simulation

Tests whether the three character types (Cooperative, Independent, Contrarian)
win at similar rates under rules v2. Results feed the Word report
"Exit_ProtocoL Rules v2 Type Balance Report" (kept off GitHub).

## Files

| File | What it does | Output |
|---|---|---|
| sim_v2.py | The game simulation. Rule switches are settings at the top. | none |
| bal.py | Resets to rules v2 and scores the four test settings. | none |
| search.py | Step 1 of the level-order search: screens all 1,800 orders. | s_*.json |
| verify.py | Step 2: reruns the best 24 orders with more games. | v_*.json |
| grid.py | Tests 96 buff combinations on the top 3 orders. | g_*.json |
| merge_results.py | Joins the chunked outputs. | verify_all.json, grid_all.json |
| gen_data.py | Every table in report sections 6 and 7. | data.json |
| diag.py | Report section 6.2 (why v2 is unbalanced). | diag.json |
| build_doc.js | Builds the Word report from the JSON files. | .docx |

All result JSON files are committed, so the report can be rebuilt without rerunning anything.

## Rerun everything (about 25 minutes)

Run from this folder, in order:

```
python search.py 0 450
python search.py 450 900
python search.py 900 1350
python search.py 1350 1800
python verify.py 0 12
python verify.py 12 24
python grid.py 0 48
python grid.py 48 96
python merge_results.py
del data.json
python gen_data.py
python diag.py
```

gen_data.py skips any result already in data.json. Delete data.json first to rerun all of it.

## Rebuild the report only

Needs Node.js. Run once: `npm install docx`. Then:

```
node build_doc.js
```

Do not commit the .docx it creates.
