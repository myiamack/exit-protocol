import sim_v2, itertools, time, sys
from sim_v2 import run
SETS=[("typical",0.33),("careful",0.33),("typical",0.5),("careful",0.5)]
def base():
    sim_v2.ROUNDS[:]=[("initiative",2),("focus",3),("composure",3),("focus",4),("collab",4),("grit",6)]; sim_v2.GRAD_TOTAL=22; sim_v2.CONTRA_ACCUSE=True
    sim_v2.CAUGHT_LOSS=0; sim_v2.SKIM_MAX=2; sim_v2.DRAIN_FLAT1=False
    sim_v2.EXTRA={'coop':0,'ind':0,'contra':0}; sim_v2.PENMAX={'coop':4,'ind':4,'contra':4}
    sim_v2.EMPATHY=True; sim_v2.CASHOUT_USES=1; sim_v2.CASHOUT_FULL=True
    sim_v2.CAP={'coop':3,'ind':3,'contra':3}; sim_v2.LIFELINE_GOAL=2; sim_v2.EXPLOIT_GOAL=3; sim_v2.CAUGHT_LOCK='game'
def evaluate(cfg,n=1000,win=0.5,verbose=False):
    base()
    for k,v in cfg.items():
        if k=="R6": sim_v2.ROUNDS[5]=("grit",v)
        elif k=="ROUNDS": sim_v2.ROUNDS[:]=v
        else: setattr(sim_v2,k,v)
    out=[]
    for st,acc in SETS:
        r=run(win,acc,st,n=n,seed=7)
        g=[r[f'grad_{t}'] for t in ('coop','ind','contra')]
        a=[r[f'any_{t}'] for t in ('coop','ind','contra')]
        out.append((st,acc,g,a,r['grad']))
    gg=max(max(o[2])-min(o[2]) for o in out); ga=max(max(o[3])-min(o[3]) for o in out)
    if verbose:
        for st,acc,g,a,tot in out:
            print(f"   {st:8} acc{int(acc*100)}: all {tot:.0f} | grad C/I/X {g[0]:.1f}/{g[1]:.1f}/{g[2]:.1f} gap {max(g)-min(g):.1f} | any C/I/X {a[0]:.1f}/{a[1]:.1f}/{a[2]:.1f} gap {max(a)-min(a):.1f}")
    return gg,ga,out
if __name__=="__main__":
    t=time.time(); gg,ga,_=evaluate({},verbose=True); print("worst gaps",round(gg,1),round(ga,1), round(time.time()-t),"s")
