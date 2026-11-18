"""Exit_ProtocoL rules v2 simulation. Mirrors the Nov 5 test settings."""
import random, sys
from collections import defaultdict

KEYS = ["focus", "initiative", "collab", "composure", "grit"]
TYPES = {
    "coop":   dict(bonus=["collab", "composure"], pen="initiative"),
    "ind":    dict(bonus=["focus", "grit"],       pen="collab"),
    "contra": dict(bonus=["initiative", "grit"],  pen="composure"),
}
ROUNDS = [("initiative", 2), ("focus", 3), ("composure", 3),
          ("focus", 4), ("collab", 4), ("grit", 6)]
PEN_MAX = 4
AT_RISK = 4
GRAD_TOTAL, GRAD_MIN = 22, 2
CONTRA_ACCUSE = False
DRAIN_BACKUP = False
GLITCH_PAYS = False
CAUGHT_LOSS = 0
SKIM_MAX = 2
DRAIN_FLAT1 = False
EXTRA = {'coop':0,'ind':0,'contra':0}
PENMAX = {'coop':4,'ind':4,'contra':4}
EMPATHY = True
LIFELINE_GOAL = 2
EXPLOIT_GOAL = 3
CAUGHT_LOCK = 'game'
CASHOUT_USES = 1
CASHOUT_FULL = True
CAP = {'coop':3,'ind':3,'contra':3}


class P:
    def __init__(s, pid, t, style):
        s.id, s.t, s.style = pid, t, style
        s.bonus, s.pen = TYPES[t]["bonus"], TYPES[t]["pen"]
        if style == "careful":
            spend = {k: 3 for k in KEYS}
        else:  # typical: 5/4/3/2/1, bonus first, penalty last
            others = [k for k in KEYS if k not in s.bonus and k != s.pen]
            order = s.bonus + others + [s.pen]
            spend = dict(zip(order, [5, 4, 3, 2, 1]))
        s.a = {k: 1 + spend[k] + (2 if k in s.bonus else 0) for k in KEYS}
        s.backup = CAP[t]; s.cap = CAP[t]; s.cash = 0
        for _ in range(EXTRA[t]):
            if style == "typical":
                b = [k for k in s.bonus if s.a[k] < s.mx(k)]
                pool = b or [k for k in KEYS if s.a[k] < s.mx(k)]
            else:
                pool = [k for k in KEYS if s.a[k] < s.mx(k)]
            if not pool: break
            k = min(pool, key=lambda x: s.a[x]); s.a[k] += 1
        s.glitches = 0
        s.glitched_ever = False
        s.caught = False
        s.lock = False
        s.caught_now = False
        s.skim = 0
        s.cashout = False
        s.path = 0
        s.path_done = False
        s.sabotaged_by_me = False
        s.correct_acc = False
        s.was_sabotaged = False

    def mx(s, k): return PENMAX[s.t] if k == s.pen else 10
    def rate(s, k): return 1 if k in s.bonus else 2
    def stuck(s): return s.glitches >= 2
    def neg(s): return any(v < 0 for v in s.a.values())
    def at_risk(s):
        for k in KEYS:
            avail = s.a[k] + (s.backup if k in s.bonus else s.backup // 2)
            if avail < AT_RISK: return True
        return False

    def pay(s, k, cost):
        if s.neg() and not GLITCH_PAYS: return  # v2: already Glitching pays nothing
        s.a[k] -= cost
        s.cover(k)

    def cover(s, k):
        if s.a[k] < 0:
            short = -s.a[k]; r = s.rate(k)
            cov = min(short, s.backup // r)
            s.backup -= cov * r
            s.a[k] += cov

    def take_highest(s, n):
        for _ in range(n):
            k = max(KEYS, key=lambda x: s.a[x])
            s.a[k] -= 1

    def reboot(s):
        for k in KEYS:
            if s.a[k] < 0:
                need = 1 - s.a[k]
                donors = [d for d in KEYS if d != k]
                got = 0
                while got < need:
                    avail = [d for d in donors if s.a[d] > 0]
                    if not avail: break  # rest forgiven
                    # even split; remainder from highest donors
                    avail.sort(key=lambda d: -s.a[d])
                    for d in avail:
                        if got >= need: break
                        s.a[d] -= 1; got += 1
                s.a[k] = max(0, s.a[k] + got)
        s.backup = 0

    def place(s, n, final=False):
        if final:
            for k in KEYS:
                while s.a[k] < 2 and n > 0:
                    s.a[k] += 1; n -= 1
        i = 0
        while n > 0:
            open_ = [k for k in KEYS if s.a[k] < s.mx(k)]
            if not open_: break
            if s.style == "typical" and i % 2 == 0:
                b = [k for k in s.bonus if s.a[k] < s.mx(k)]
                pool = b if b else open_
            else:
                pool = open_
            k = min(pool, key=lambda x: s.a[x])
            s.a[k] += 1; n -= 1; i += 1


def gift_cost(t, pts):
    if t == "ind": return 2 if pts == 1 else 3
    return pts


def game(win, acc, style, rng, sab_rate=0.5, victim_acc=0.9, other_acc=0.25,
         idle_acc=0.05):
    types = ["coop"] * 8 + ["ind"] * 5 + ["contra"] * 3
    rng.shuffle(types)
    ps = [P(i, t, style) for i, t in enumerate(types)]
    teams = [ps[i:i + 4] for i in range(0, 16, 4)]

    for (k, cost) in ROUNDS:
        for p in ps:
            if CAUGHT_LOCK == 'round' and p.lock and not p.caught_now: p.lock = False
            p.caught_now = False
            p.sabotaged_by_me = p.correct_acc = False
            p.glitched_this = False
        sab = {}  # team idx -> (actor, target)
        # Open Floor: sabotage (bots do 1 per round)
        for ti, team in enumerate(teams):
            for p in team:
                if p.t != "contra" or p.stuck() or p.lock or p.backup < 1:
                    continue
                if rng.random() >= sab_rate: continue
                tgts = [q for q in team if q is not p and not q.stuck()]
                if not tgts: continue
                risky = [q for q in tgts if q.at_risk()]
                tgt = rng.choice(risky or tgts)
                p.backup -= 1
                p.sabotaged_by_me = True
                drain = 1 if (tgt.a["composure"] >= 6 or DRAIN_FLAT1) else 2
                tgt.a[k] -= drain
                if DRAIN_BACKUP: tgt.cover(k)
                tgt.was_sabotaged = True
                sab[ti] = (p, tgt)
        # Trial
        results = {ti: rng.random() < win for ti in range(len(teams))}
        for p in ps:
            if not p.stuck(): p.pay(k, cost)
        # Glitch Report: accusations, one per player, teammates only
        for ti, team in enumerate(teams):
            actor, victim = sab.get(ti, (None, None))
            for p in team:
                if p.stuck() or (p.t == "contra" and not CONTRA_ACCUSE): continue
                if actor:
                    pr = victim_acc if p is victim else other_acc
                else:
                    pr = idle_acc
                if rng.random() >= pr: continue
                mates = [q for q in team if q is not p and not q.stuck()]
                if not mates: continue
                if actor and actor in mates and rng.random() < acc:
                    tgt = actor
                else:
                    wrong = [q for q in mates if q is not actor]
                    tgt = rng.choice(wrong) if wrong else actor
                if actor and tgt is actor:
                    p.correct_acc = True
                    if p.t == "ind" and not p.path_done:
                        p.path += 1
                        if p.path >= 1: p.path_done = True
                else:
                    p.take_highest(1)
            if actor:
                if any(q.correct_acc for q in team):
                    actor.caught = True; actor.lock = True; actor.caught_now = True
                    if CAUGHT_LOCK == 'game': actor.path_lost = True
                    actor.take_highest(CAUGHT_LOSS)
                else:
                    if not actor.path_done and not getattr(actor,'path_lost',False):
                        actor.path += 1
                        if actor.path >= EXPLOIT_GOAL: actor.path_done = True
        # Gift window: rescue Glitching teammates
        for team in teams:
            for r in team:
                if r.stuck() or not r.neg() or r.t == "ind": continue
                for g in team:
                    if g is r or g.stuck() or not r.neg(): continue
                    if g.t != "coop" and rng.random() >= 0.25: continue
                    pts = 2 if g.backup >= gift_cost(g.t, 2) else (
                        1 if g.backup >= gift_cost(g.t, 1) else 0)
                    if not pts: continue
                    g.backup -= gift_cost(g.t, pts)
                    nk = min(KEYS, key=lambda x: r.a[x])
                    for _ in range(pts):
                        if r.a[nk] < r.mx(nk): r.a[nk] += 1
                        else: g.backup = min(g.cap, g.backup + (2 if g.t == "ind" else 1))
                    if not r.neg() and g.t == "coop" and not g.path_done:
                        g.path += 1
                        if g.path >= LIFELINE_GOAL: g.path_done = True
        # Note: bots never gift to Independents (refusal refunds, no effect)
        # Close: lock glitches, reboot, empathy
        for team in teams:
            for p in team:
                if p.stuck() or not p.neg(): continue
                p.glitches += 1; p.glitched_ever = True; p.glitched_this = True
                p.reboot()
                for q in team:
                    if EMPATHY and q is not p and q.t == "coop" and not q.stuck():
                        q.backup = max(0, q.backup - 1)
        # Stats Update
        for ti, team in enumerate(teams):
            for p in team:
                if p.stuck(): continue
                e = 1 if p.glitched_this else (4 if results[ti] else 2)
                if p.correct_acc: e += 1
                if p.t == "contra" and p.sabotaged_by_me and not p.caught_now and p.skim < SKIM_MAX:
                    e += 1; p.skim += 1
                if p.t == "ind" and p.cash < CASHOUT_USES and p.backup >= 2 and (p.backup == p.cap or not CASHOUT_FULL):
                    p.backup -= 2; e += 1; p.cash += 1
                p.place(e)
                p.backup = min(p.cap, p.backup + 1)
    # Round 7
    for p in ps:
        if not p.stuck(): p.place(3, final=True)
    out = []
    for p in ps:
        grad = (not p.stuck() and sum(p.a.values()) >= GRAD_TOTAL
                and min(p.a.values()) >= GRAD_MIN)
        path = p.path_done
        out.append((p.t, grad, path, p.glitched_ever, p.stuck(), p.caught,
                    p.was_sabotaged))
    return out


def run(win, acc, style, n=1000, seed=1, **kw):
    rng = random.Random(seed)
    s = defaultdict(lambda: [0, 0])
    contra_sab = [0, 0]
    for _ in range(n):
        for (t, g, pth, ge, st, cg, ws) in game(win, acc, style, rng, **kw):
            for key, val in [("grad", g), (f"grad_{t}", g), (f"any_{t}", g or pth),
                             (f"path_{t}", pth), ("glitched", ge), ("stuck", st)]:
                s[key][0] += val; s[key][1] += 1
            if t == "contra": s["caught"][0] += cg; s["caught"][1] += 1
            s[f"grad_sab{int(ws)}"][0] += g; s[f"grad_sab{int(ws)}"][1] += 1
    return {k: 100 * v[0] / v[1] for k, v in s.items()}
