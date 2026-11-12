import json, os, sys, random, sim_v2
from collections import Counter
from bal import base, SETS
from sim_v2 import run
N=2000; SEED=2026
S_OLD=['initiative','focus','composure','focus','collab','grit']
S3=['grit','collab','focus','initiative','composure','grit']
C=[2,3,3,4,4,6]
A={'ROUNDS':list(zip(S3,C)),'LIFELINE_GOAL':1,'EXPLOIT_GOAL':2}
def apply(cfg):
    base()
    for k,v in cfg.items():
        if k=="ROUNDS": sim_v2.ROUNDS[:]=v
        else: setattr(sim_v2,k,v)
def ev(cfg,win=0.5,seed=SEED):
    apply(cfg); rows=[]
    for st,acc in SETS:
        r=run(win,acc,st,n=N,seed=seed)
        rows.append({"style":st,"acc":acc,"all":r['grad'],
          "grad":[r[f'grad_{t}'] for t in ('coop','ind','contra')],
          "any":[r[f'any_{t}'] for t in ('coop','ind','contra')],
          "path":[r[f'path_{t}'] for t in ('coop','ind','contra')],
          "glitched":r['glitched'],"stuck":r['stuck'],"caught":r['caught'],
          "sab":[r['grad_sab1'],r['grad_sab0']]})
    return rows
JOBS={
 "base":({},0.5),"base30":({},0.3),"base70":({},0.7),
 "r6_7":({'R6':7},0.5),"grad23":({'GRAD_TOTAL':23},0.5),
 "drain_backup":({'DRAIN_BACKUP':True},0.5),"glitch_pays":({'GLITCH_PAYS':True},0.5),
 "nerf_caught1":({'CAUGHT_LOSS':1},0.5),"nerf_caught2":({'CAUGHT_LOSS':2},0.5),
 "nerf_skim1":({'SKIM_MAX':1},0.5),"nerf_skim0":({'SKIM_MAX':0},0.5),
 "only_sched":({'ROUNDS':list(zip(S3,C))},0.5),
 "only_lifeline":({'LIFELINE_GOAL':1},0.5),"only_exploit":({'EXPLOIT_GOAL':2},0.5),
 "sched_lifeline":({'ROUNDS':list(zip(S3,C)),'LIFELINE_GOAL':1},0.5),
 "A":(A,0.5),"A30":(A,0.3),"A70":(A,0.7),
 "A_seed2":(A,0.5,7),"A_seed3":(A,0.5,99),
 "rej_emp_cap":(dict(A,EMPATHY=False,CAP={'coop':4,'ind':3,'contra':3}),0.5),
 "rej_lock_e2":(dict(A,CAUGHT_LOCK='round'),0.5),
 "rej_lock_e3":(dict(A,CAUGHT_LOCK='round',EXPLOIT_GOAL=3),0.5),
}
def setr6(cfg):
    if 'R6' in cfg:
        c=dict(cfg); v=c.pop('R6'); r=list(zip(S_OLD,C)); r[5]=('grit',v); c['ROUNDS']=r; return c
    return cfg
out=json.load(open('data.json')) if os.path.exists('data.json') else {}
keys=sys.argv[1:] or list(JOBS)
for k in keys:
    if k in out: continue
    j=JOBS[k]; cfg=setr6(j[0]); seed=j[2] if len(j)>2 else SEED
    out[k]=ev(cfg,j[1],seed); json.dump(out,open('data.json','w')); print(k,flush=True)
