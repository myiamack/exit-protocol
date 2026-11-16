# Exit_ProtocoL rules classes

The rule classes in `rules/`. They hold no screen code. Each diagram shows the key fields and methods, not every helper.

Arrows:
- **Filled diamond** (owns): the owner creates it and it lives inside the owner.
- **Open diamond** (has): a link to an object that is made elsewhere and passed in.
- **Solid arrow** (links to): keeps a reference to it.
- **Triangle** (inherits): a subclass.
- **Dashed arrow** (uses): calls it, or reads its constants, without keeping it.

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
    +rng  function from Rng.seeded
    +bool host
    +clock  injected time source
    +hooks  onStart, beforeClose
    +timer  name, deadline
    +log, prompts, submissions
    +step  current step, read-only
    +over  results ran, read-only
    +start()
    +startNextRound()
    +advance()
    +tick(now) closed timers
    +closeTimer(now)
    +secondsLeft(now)
    +activity(p, now)
    +sabotage(actor, target)
    +gift(giver, receiver, pts)
    +answerGift(gift, accept)
    +switchTeam(p, team)
    +setSopBoard(p, steps)
    +closeSop() ranking
    +startWriting()
    +submit(p, text, now)
    +closeWriting()
    +startVote()
    +runTrial() ranking
    +payTrialCosts()
    +accuse(accuser, target)
    +endGlitchReport()
    +closeGlitchReport()
    +closeGiftWindow()
    +lockIn()
    +computeEarnings()
    +draftPoint(p, attr, plusOrMinus)
    +lockPoints(p)
    +autoPlacePoints(p)
    +cashOut(p)
    +finishRound()
    +checkAttendance(now)
    +board() public view
    +results() endings
    +toJSON()
    +fromJSON(data, options clock hooks tick)$
  }

  class Team {
    +id
    +name
    +Player[] members
    +won  this round
    +int trialWins
    +int MIN$  3
    +int MAX$  5
    +active() not Stuck, not idle
    +mates(p)
    +has(p)
    +size()
    +add(p)
    +remove(p)
    +toJSON()
    +fromJSON(data, byId)$
  }

  class Player {
    +id
    +name
    +bool isBot
    +teamId
    +CharacterType type
    +attrs  5 attributes
    +Hearts hearts
    +int glitches  2 = Stuck
    +bool idle
    +pathProgress, pathDone
    +caughtBy  team ids
    +skimUsed, cashOutUsed
    +earned, draft, placedThisRound
    +locked  ending after results
    +round flags
    +attendance times
    +payTrial(attr, cost)
    +lose(attr, n)
    +cover(attr) hearts pay shortfall
    +takeFromHighest(n)
    +giftTarget()
    +receiveGift(pts)
    +lockIn() glitch locks
    +lockAttendanceGlitch()
    +reboot()
    +placePoints(alloc)
    +canCashOut()
    +cashOut()
    +takeSkim()
    +creditPath(event)
    +rollAbility(attr, rng)
    +voteWeight()
    +isStuck()
    +isActive()
    +isGlitching()
    +isGlitchingAny()
    +isAtRisk()
    +flag() OK, At risk, Glitching, Stuck
    +boardStatus()
    +gradChecks()
    +graduates()
    +lockEnding()
    +wins()
    +ending()
    +toJSON()
    +fromJSON(data)$
  }

  class Hearts {
    -int n  private, start 3, cap 3
    +count  read-only
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
    +pathEvent
    +PATH_EVENTS$
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
    +all()$
  }
  class Cooperative {
    Lifeline 1 rescue
    +hasEmpathy() true
  }
  class Independent {
    Auditor 1 correct accusation
    +giftCost(pts) 2 or 3
    +giftRefundPerPoint() 2
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
    +bool isFinal  Level 7
    +int stepIndex
    +completed  one-time actions run
    +trial  Trial, or Level 7 activity text
    +sabotages[]
    +accusations[]
    +gifts[]
    +sopBoards, sopResults, earnings  added by Game
    +steps  Levels 1 to 6 or Level 7 list
    +step  briefing to statsUpdate, or briefing then graduation
    +LEVELS$
    +STEPS$
    +nextStep()
    +saboteurs()
    +drainOn(p)
    +caughtOn(team, except)
    +toJSON()
    +fromJSON(data)$
  }

  class Attendance {
    +settings  idleMs 60000, popupMs 15000, maxPerRound 1
    +DEFAULTS$
    +set(settings) host dials
    +activity(p, now)
    +pause(p, now)
    +resume(p, now)
    +check(p, now) off, paused, ok, popup, missed
  }

  class Rng {
    +seeded(seed)$ returns an rng function
    +randomSeed()$
    +canSave(rng)$
  }
  note for Rng "The function seeded() returns has getState() and setState(), so a saved game continues the same sequence."

  class Bots {
    <<plain object, not a class>>
    +SETTINGS  rates from sim_v2.py
    +hooks  onStart, beforeClose
    +soloGame(...)
    +typicalSpend(type)
    +makePlayer(id, name, type)
    +openFloor(game, rng)
    +trial(game, rng)
    +submit(game)
    +accusations(game, rng)
    +gifts(game, rng)
    +answer(game, gift, rng)
    +answerAll(game, rng)
    +statsUpdate(game)
    +graduation(game)
    +allocate(p, n, final)
    +vote(game, vote, rng)
  }

  Game "1" o-- "1..*" Team : teams, passed in
  Game "1" o-- "*" Player : players, from the teams
  Team "1" o-- "*" Player : members, 3 to 5 kept by switchTeam
  Game "1" *-- "0..1" Round : current round
  Game "1" *-- "1" Attendance : attendance
  Game --> Rng : keeps the rng function
  Player "1" *-- "1" Hearts : hearts
  Player "*" o-- "1" CharacterType : type, shared
  CharacterType <|-- Cooperative
  CharacterType <|-- Independent
  CharacterType <|-- Contrarian

  Game ..> CharacterType : PATH_EVENTS
  Game ..> Bots : allocate, refactor candidate
  note for Bots "Game to Bots link: Core rules depend on prototype code. Refactor candidate: pass auto-place in from outside, like hooks."
  Attendance ..> Player : reads and sets times
  Bots ..> Game : plays bot players
  Bots ..> Player : makePlayer
  Bots ..> Team : soloGame
  Bots ..> CharacterType : typical spend
```

## 2. Round actions and trials

```mermaid
classDiagram
  direction TB

  class Round {
    +trial
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
    +MIN_COST$  1
    +cost(giver, pts)$ 1 or 2 points
    +refundPerPoint(giver)$
    +check(giver, receiver, team, pts)$
    +apply(round, giver, receiver, team, pts, rng)$
    +accept(round, gift)$
    +decline(round, gift)$
    +pending(round)$
    +expireAll(round)$
  }

  class Trial {
    <<abstract>>
    +rng
    +ranking  best first
    +kind  sop, auto, judged
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
    +MAX_SCORE$  7
    +STEPS, ENDLESS$
    +score(built, steps, endless)$
    +setScore(team, score)
    +rank(round, teams) board score plus influence
  }
  class AutoTrial {
    Levels 2 to 4
    +rank(round, teams) random 0 to 7 plus influence
  }
  class JudgedTrial {
    Levels 5 and 6
    +level
    +prompt
    +writing  open, closed
    +submissions  max 300 characters
    +Vote vote
    +WRITING_SECONDS$  180
    +prompts(level)$
    +choosePrompt(i)
    +customPrompt(text)
    +randomPrompt()
    +startWriting()
    +submit(p, text)
    +allSubmitted(players)
    +closeWriting()
    +startVote(teams)
    +rank(round, teams) by vote tally
  }

  class Vote {
    +teams
    +canBeRanked  has a submission
    +ballots  voter to ranked players
    +choicesFor(voter) other teams only
    +slotsFor(voter) up to 3
    +check(voter, ranking)
    +cast(voter, ranking) top 3
    +tally() 3/2/1 x Initiative weight
  }

  class Game
  class Bots
  class Player
  class Team
  class CharacterType

  Round "1" o-- "0..1" Trial : levels 1 to 6, set by Game
  Trial <|-- SopTrial
  Trial <|-- AutoTrial
  Trial <|-- JudgedTrial
  JudgedTrial "1" *-- "0..1" Vote : vote
  Vote "1" o-- "*" Team : ranks teams, sets won
  Vote "1" --> "*" Player : ballots, up to 3 ranked each
  Trial ..> Team : sets won, trialWins
  Round --> Player : records link players

  Game ..> Trial : forRound, SopTrial.score
  Game ..> Sabotage : apply
  Game ..> Accusation : apply
  Game ..> Gift : apply, accept, decline, expireAll
  Bots ..> Sabotage : cost
  Bots ..> Gift : cost, pending
  Bots ..> Trial : JudgedTrial, BOT_ANSWER

  Sabotage ..> Round : adds record
  Sabotage ..> Player : drains target
  Sabotage ..> Team : teammates only
  Accusation ..> Round : adds record
  Accusation ..> Player : penalty or catch
  Accusation ..> Team : catch by team id
  Accusation ..> CharacterType : Auditor credit
  Gift ..> Round : adds record
  Gift ..> Player : hearts, points
  Gift ..> Team : teammates only
  Gift ..> CharacterType : cost, refusal, Lifeline
```

Made from the rules code at commit `a5dd190` (branch ben-ooad).
Update this diagram whenever a class in `rules/` changes.
