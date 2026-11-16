# Exit_ProtocoL rules classes

The rule classes in `rules/`. They hold no screen code. Each diagram shows the key fields and methods, not every helper.

Arrows:
- **Filled diamond** (owns): the owner creates it and it lives inside the owner.
- **Open diamond** (has): a link to an object that also lives elsewhere.
- **Triangle** (inherits): a subclass.
- **Dashed arrow** (uses): calls it, or passes it in, without keeping it.

Numbers on the lines come from the rules (for example, a team has 3 to 5 members).

## 1. Core game

```mermaid
classDiagram
  direction TB

  class Game {
    +Team[] teams
    +Player[] players
    +int level  0 to 7
    +Round round
    +Attendance attendance
    +rng  seeded Rng
    +clock  injected time source
    +hooks  onStart, beforeClose
    +timer  name, deadline
    +log, prompts, submissions
    +start()
    +startNextRound()
    +advance()
    +tick(now) closed timers
    +closeTimer(now)
    +secondsLeft(now)
    +sabotage(actor, target)
    +gift(giver, receiver, pts)
    +answerGift(gift, accept)
    +accuse(accuser, target)
    +switchTeam(p, team)
    +setSopBoard(p, steps)
    +runTrial() ranking
    +payTrialCosts()
    +lockIn()
    +computeEarnings()
    +draftPoint(p, attr, plusOrMinus)
    +lockPoints(p)
    +cashOut(p)
    +finishRound()
    +checkAttendance(now)
    +board() public view
    +results() endings
    +toJSON()
    +fromJSON(data, clock, hooks)$
  }

  class Team {
    +id
    +name
    +Player[] members  3 to 5
    +won  this round
    +int trialWins
    +active() not Stuck, not idle
    +mates(p)
    +add(p)
    +remove(p)
    +toJSON()
    +fromJSON(data, byId)$
  }

  class Player {
    +id
    +name
    +CharacterType type
    +attrs  5 attributes
    +Hearts hearts
    +int glitches  2 = Stuck
    +bool idle
    +pathProgress, pathDone
    +caughtBy  team ids
    +earned, draft
    +round flags
    +attendance times
    +payTrial(attr, cost)
    +lose(attr, n)
    +cover(attr) hearts pay shortfall
    +takeFromHighest(n)
    +receiveGift(pts)
    +lockIn() glitch locks
    +reboot()
    +placePoints(alloc)
    +cashOut()
    +takeSkim()
    +creditPath(event)
    +rollAbility(attr, rng)
    +flag() OK, At risk, Glitching, Stuck
    +graduates()
    +wins()
    +toJSON()
    +fromJSON(data)$
  }

  class Hearts {
    -int count  start 3, cap 3
    +spend(n)
    +refill(n)
    +refund(n)
    +lose(n)
    +empty()
    +has(n)
    +isFull()
  }

  class CharacterType {
    <<abstract>>
    +key  coop, indep, contra
    +name
    +bonus  2 attributes
    +penalty  max 4
    +pathName, goal
    +isBonus(attr)
    +max(attr)
    +giftCost(pts)
    +giftRefundPerPoint()
    +canAcceptGifts()
    +canSabotage()
    +hasEmpathy()
    +hasCashOut()
    +hasSkim()
    +pathCounts(event)
    +get(key)$
  }
  class Cooperative {
    Lifeline 1 rescue
    +hasEmpathy() true
  }
  class Independent {
    Auditor 1 correct accusation
    +giftCost(pts) 2 or 3
    +canAcceptGifts() false
    +hasCashOut() true
  }
  class Contrarian {
    Exploit 3 uncaught rounds
    +canSabotage() true
    +hasSkim() true
  }

  class Round {
    +int n  level 1 to 7
    +attr  tested attribute
    +int cost
    +int stepIndex
    +completed  one-time actions run
    +Trial trial
    +sabotages[]
    +accusations[]
    +gifts[]
    +sopBoards, sopResults, earnings
    +step  briefing to statsUpdate
    +nextStep()
    +saboteurs()
    +drainOn(p)
    +toJSON()
    +fromJSON(data)$
  }

  class Attendance {
    +settings  idleMs 60000, popupMs 15000, maxPerRound 1
    +activity(p, now)
    +pause(p, now)
    +resume(p, now)
    +check(p, now) ok, popup, missed
  }

  class Rng {
    +seeded(seed)$ rng with getState, setState
    +randomSeed()$
    +canSave(rng)$
  }

  class Bots {
    <<prototype and tests only>>
    +SETTINGS  rates from sim_v2.py
    +hooks  onStart, beforeClose
    +soloGame(...)
    +makePlayer(id, name, type)
    +openFloor(game, rng)
    +trial(game, rng)
    +accusations(game, rng)
    +gifts(game, rng)
    +statsUpdate(game)
    +graduation(game)
    +allocate(p, n, final)
    +vote(game, vote, rng)
  }

  Game "1" *-- "2..*" Team : teams
  Game "1" *-- "*" Player : players
  Team "1" o-- "3..5" Player : members
  Game "1" *-- "0..1" Round : current round
  Game "1" *-- "1" Attendance : attendance
  Game ..> Rng : random numbers
  Player "1" *-- "1" Hearts : hearts
  Player "*" o-- "1" CharacterType : type (shared)
  CharacterType <|-- Cooperative
  CharacterType <|-- Independent
  CharacterType <|-- Contrarian
  Attendance ..> Player : reads and sets times
  Bots ..> Game : plays bot players
  Game ..> Bots : hooks, allocate
```

## 2. Round actions and trials

```mermaid
classDiagram
  direction TB

  class Round {
    +Trial trial
    +sabotages[]  actor, target, drain, cost
    +accusations[]  accuser, target, correct, safe
    +gifts[]  giver, receiver, pts, cost, status
  }

  class Sabotage {
    <<rules, no state>>
    +cost(actor)$ 1 first, 2 each extra
    +drain(target, rng)$ 2, or 1 by Composure
    +check(actor, target, team)$
    +apply(round, actor, target, team, rng)$
  }

  class Accusation {
    <<rules, no state>>
    +check(accuser, target, team)$
    +apply(round, accuser, target, team, rng)$ one per round
  }

  class Gift {
    <<rules, no state>>
    +cost(giver, pts)$ 1 or 2 points
    +check(giver, receiver, team, pts)$
    +apply(round, giver, receiver, team, pts, rng)$
    +accept(round, gift)$
    +decline(round, gift)$
    +expireAll(round)$
  }

  class Trial {
    <<abstract>>
    +rng
    +ranking  best first
    +run(round, teams) top half win, rounded up
    +rank(round, teams)*
    +influence(round, teams)$ Levels 1 to 4
    +winners(nTeams)$
    +forRound(round, rng)$
    +toJSON()
    +fromJSON(data)$
  }
  class SopTrial {
    Level 1
    +scores  per team, 0 to 7
    +STEPS, ENDLESS$
    +score(built, steps, endless)$
    +setScore(team, score)
  }
  class AutoTrial {
    Levels 2 to 4
    random 0 to 7 plus influence
  }
  class JudgedTrial {
    Levels 5 and 6
    +prompt
    +writing  open, closed
    +submissions  max 300 characters
    +Vote vote
    +choosePrompt(i)
    +customPrompt(text)
    +randomPrompt()
    +startWriting()
    +submit(p, text)
    +closeWriting()
    +startVote(teams)
  }

  class Vote {
    +ballots  voter to ranked players
    +choicesFor(voter) other teams only
    +cast(voter, ranking) top 3
    +tally() 3/2/1 x Initiative weight
  }

  class Player
  class Team
  class CharacterType

  Round "1" *-- "0..1" Trial : levels 1 to 6
  Trial <|-- SopTrial
  Trial <|-- AutoTrial
  Trial <|-- JudgedTrial
  JudgedTrial "1" *-- "0..1" Vote : vote
  Vote "1" o-- "*" Team : ranks teams
  Vote ..> Player : each ballot ranks up to 3
  Trial ..> Team : sets won, trialWins

  Sabotage ..> Round : adds record
  Sabotage ..> Player : drains target
  Accusation ..> Round : adds record
  Accusation ..> Player : penalty or catch
  Gift ..> Round : adds record
  Gift ..> Player : hearts, points
  Gift ..> CharacterType : cost, refusal
  Accusation ..> CharacterType : Auditor credit
```

Made from the rules code at commit `a5dd190` (branch ben-ooad).
Update this diagram whenever a class in `rules/` changes.
