import itertools,json,sys
from bal import evaluate
S={"S1":['initiative','collab','initiative','composure','grit','focus'],
   "S2":['focus','initiative','collab','composure','grit','focus'],
   "S3":['grit','collab','focus','initiative','composure','grit']}
out=[]
combos=list(itertools.product(S,[True,False],[2,1],[3,4],[3,2],[4,5]))
lo,hi=int(sys.argv[1]),int(sys.argv[2])
for s,emp,ll,cap,ex,pm in combos[lo:hi]:
    cfg={"ROUNDS":list(zip(S[s],[2,3,3,4,4,6])),"EMPATHY":emp,"LIFELINE_GOAL":ll,
         "CAP":{'coop':cap,'ind':3,'contra':3},"EXPLOIT_GOAL":ex,"PENMAX":{'coop':pm,'ind':4,'contra':4}}
    gg,ga,o=evaluate(cfg,n=600)
    out.append((round(ga,1),round(gg,1),s,emp,ll,cap,ex,pm))
json.dump(out,open(f"g_{lo}.json","w")); print(len(combos))
