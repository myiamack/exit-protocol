import sim_v2, itertools, json, sys
from bal import base
from sim_v2 import run, KEYS
costs=[2,3,3,4,4,6]
seen=set(); scheds=[]
for dbl in KEYS:
    for perm in set(itertools.permutations(KEYS+[dbl])):
        if perm not in seen: seen.add(perm); scheds.append(perm)
res=[]
lo,hi=int(sys.argv[1]),int(sys.argv[2])
for i,p in enumerate(scheds[lo:hi]):
    base(); sim_v2.ROUNDS[:]=list(zip(p,costs))
    gaps=[];tots=[]
    for st,acc in [("typical",0.33),("careful",0.5)]:
        r=run(0.5,acc,st,n=200,seed=7)
        g=[r[f'grad_{t}'] for t in ('coop','ind','contra')]
        gaps.append(max(g)-min(g)); tots.append(r['grad'])
    res.append((max(gaps),p,tots))

res.sort()
json.dump(res,open(f"s_{lo}.json","w"))
print("done")
