"""Merge the chunked search outputs into the two files build_doc.js reads."""
import json, glob
v = []
for f in glob.glob("v_*.json"): v += json.load(open(f))
v.sort()
json.dump(v, open("verify_all.json", "w"))
g = []
for f in glob.glob("g_*.json"): g += json.load(open(f))
g.sort(key=lambda x: max(x[0], x[1]))
json.dump(g, open("grid_all.json", "w"))
print(f"verify_all.json: {len(v)} orders, grid_all.json: {len(g)} combinations")
