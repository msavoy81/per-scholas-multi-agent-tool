# Per Scholas Multi-Agent Tool

A clickable prototype of **multi-agent support for learners and the career coaching team**. It is a proposed solution from a Babson FutureLab team for Per Scholas Greater Boston, a free tech training nonprofit. It is a design prototype for testing ideas with people, not production software.

**All learner data in this project is fictional.** The four sample learners (S1 to S4) and their admissions interview records were made up for the prototype. No real names, interview details, or statistics appear anywhere in the code.

## The idea in one paragraph

A human career coach connects with each learner from admissions, before training starts. Four AI agents handle the day-to-day: an **intake agent** has a short conversation right after acceptance, a **plan and prep agent** drafts a weekly plan and a meeting brief for the coach, a **learner coach agent** is the learner's AI coach for check-ins and practice, and a **watcher agent** gives the coach a heads up when something looks off. People make admission decisions. The coach approves plans. The AI never contacts anyone on the coach's behalf. Learners can go to the AI or their coach whenever they choose.

## What is in the folder

| Path | What it is |
|---|---|
| `server.js` | A small web server (the program that shows the pages and saves data). |
| `charters/` | One plain-text file of instructions per agent. Edit these to change how an agent behaves. No coding needed. |
| `lib/agents.js` | The one place that talks to the AI. Uses mock replies if no API key is set. |
| `lib/checks.js` | Plain-code safety checks: crisis words, friendly fallbacks, plan approval rule, flag evidence rule. |
| `lib/store.js` | Reads and writes the JSON files. Refuses to write anywhere except `data/sessions/`. |
| `lib/intake.js` | The intake question list and the code-built learner profile. |
| `lib/mock.js` | Pre-written replies for mock mode. |
| `lib/log.js` | The usage log and its CSV export. |
| `data/sample/` | The fictional sample learners. Read only. Committed to git. |
| `data/sessions/` | Everything created while using the prototype. Ignored by git. |
| `public/` | The web pages: home, admissions record, learner view, coach dashboard. |

## How to install and run it

You need **Node.js** (version 20 or newer). Node.js is the program that runs JavaScript outside a web browser. Download it from nodejs.org if you don't have it. To check, open a terminal and type `node --version`.

1. Open a terminal in this folder.
2. Install the one dependency (the Anthropic software kit) by typing:

   ```bash
   npm install
   ```

3. Start the prototype:

   ```bash
   npm start
   ```

4. Open **http://localhost:3000** in your browser. (localhost means "this computer".)
5. To stop it, press `Ctrl + C` in the terminal.

The first time, the prototype runs in **mock mode** (see below), so you can click through everything without an API key.

## Mock mode and live mode

- **Mock mode**: no API key is set. Every agent uses realistic pre-written replies. A banner at the top of each page says "Mock mode is on". Good for demos and quick clicks.
- **Live mode**: an API key is set. The agents call Claude (model `claude-sonnet-5-5`) with the instructions in `charters/`. Replies are real AI responses.

### Adding the API key

An API key is a long password that lets the prototype use the Claude AI. Get one from the Anthropic Console (console.anthropic.com). Then:

1. Copy the file `.env.example` and name the copy `.env`.
2. Open `.env` and paste your key after the equals sign:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Restart the prototype (`Ctrl + C`, then `npm start`). The terminal will say `Mode  LIVE`.

To switch back to mock mode, delete the key from `.env` (or delete the file) and restart. The key is never written into the code, and `.env` is ignored by git, so it will not be published by accident.

## Resetting the demo

On the home page, **Reset demo data** clears `data/sessions/` (test sessions and the usage log). The sample records in `data/sample/` are never changed by the prototype.

## Safety basics built in

- The AI always says it is an AI.
- It does not make admission decisions and does not give legal, benefits, or financial advice.
- If a learner's message contains crisis words, plain code (not the AI) shows the 988 Suicide & Crisis Lifeline information and the "Talk to my career coach" button, even if the AI misses it.
- Learner messages are treated as conversation, not instructions.
- Nothing shows scores, rankings, or admission recommendations.
- If an agent's reply is empty or broken, a friendly fallback message shows instead.

## Decisions for Per Scholas

Our team left these choices open for Per Scholas to make if they adopt this:

1. **When the AI should bring in the career coach.** The prototype suggests the coach for employer introductions, talk of pausing or leaving, barriers the AI cannot solve, and distress. Per Scholas may want a different list, or a different threshold.
2. **How much learners are told about chat review and data sharing.** The prototype says it up front in the intake and in a note on every chat screen. The wording, and whether learners can opt out, is a policy choice.
3. **Who can see interview records and chats.** The prototype shows the record to staff and the coach, lets AI agents read it, and never shows it to the learner. Chats are visible to the coach. Per Scholas should decide who else, if anyone.
4. **How long data is kept.** The prototype keeps everything until someone clicks Reset. A real system needs a retention rule.
5. **Which real resources to match to each barrier.** The prototype uses clearly labeled placeholders like "Sample childcare resource". Per Scholas would replace them with real partners and programs.
