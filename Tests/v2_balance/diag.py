import json, random, sim_v2
from collections import Counter
from gen_data import apply, A
out={}
for lab,cfg in [("base",{}),("A",A)]:
    for st,acc in [("typical",0.33),("careful",0.5)]:
        apply(cfg); rng=random.Random(2026); n=Counter(); tot=Counter(); gl=Counter(); vic=Counter()
        oldP=sim_v2.P
        for _ in range(2000):
            hold=[]
            class Q(oldP):
                def __init__(s,*a,**k): super().__init__(*a,**k); hold.append(s)
            sim_v2.P=Q; sim_v2.game(0.5,acc,st,rng); sim_v2.P=oldP
            for p in hold:
                n[p.t]+=1; tot[p.t]+=sum(p.a.values()); gl[p.t]+=p.glitched_ever; vic[p.t]+=p.was_sabotaged
        out[f"{lab}|{st}|{acc}"]={t:[tot[t]/n[t],100*gl[t]/n[t],100*vic[t]/n[t]] for t in ('coop','ind','contra')}
json.dump(out,open('diag.json','w'))
for k,v in out.items(): print(k,{t:[round(x,1) for x in y] for t,y in v.items()})
