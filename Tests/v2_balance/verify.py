import json,glob,sys,sim_v2
from bal import base, SETS
from sim_v2 import run
r=[]
for f in glob.glob('s_*.json'): r+=json.load(open(f))
r.sort(); lo,hi=int(sys.argv[1]),int(sys.argv[2])
out=[]
for gap,p,_ in r[lo:hi]:
    base(); sim_v2.ROUNDS[:]=list(zip(p,[2,3,3,4,4,6]))
    gs=[];ts=[]
    for st,acc in SETS:
        x=run(0.5,acc,st,n=1500,seed=11)
        g=[x[f'grad_{t}'] for t in ('coop','ind','contra')]
        gs.append(round(max(g)-min(g),1)); ts.append(round(x['grad']))
    out.append((max(gs),p,gs,ts))
json.dump(out,open(f"v_{lo}.json","w")); print("ok")
