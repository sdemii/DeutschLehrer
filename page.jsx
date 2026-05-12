"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const API = "/api/chat";
const STORE = "gteacher_v5";
const MAX_CHARS = 600;
const MAX_RETRIES = 2;
const PASS_MARK = 60;

const TOPICS = {
  A1: [
    "Greetings & Introductions",
    "Numbers, Dates & Time",
    "Colors & Common Objects",
    "Family & Relationships",
    "Present Tense: sein & haben",
    "Food, Drinks & Ordering",
    "House, Home & Furniture",
    "Body Parts & Basic Health",
    "Days, Months & Seasons",
    "Basic Questions & Negation",
    "Vocabulary: Everyday Objects",
    "Vocabulary: Animals & Nature",
  ],
  A2: [
    "Regular & Irregular Present Tense",
    "Accusative Case",
    "Modal Verbs (können/müssen/wollen)",
    "Reflexive Verbs",
    "Separable & Inseparable Verbs",
    "Shopping, Money & Prices",
    "Travel, Transport & Directions",
    "Weather & Seasons",
    "Hobbies & Free Time",
    "Daily Routine & Time Expressions",
    "Vocabulary: Clothing & Fashion",
    "Vocabulary: Sports & Activities",
  ],
  B1: [
    "Perfect Tense (Perfekt)",
    "Simple Past (Präteritum)",
    "Dative Case",
    "Konjunktiv II (würde/hätte/wäre)",
    "Two-way Prepositions",
    "Subordinate Clauses (weil/dass/obwohl)",
    "Work, Profession & Job Applications",
    "Health, Medicine & Appointments",
    "Media, Technology & Internet",
    "Expressing Opinions & Agreeing/Disagreeing",
    "Vocabulary: Food & Cooking",
    "Vocabulary: Environment & Sustainability",
  ],
  B2: [
    "Passive Voice (Passiv)",
    "Genitive Case",
    "Relative Clauses",
    "Extended Adjective Phrases",
    "Formal Writing & Business Register",
    "Argumentation & Essay Writing",
    "Idioms & Fixed Expressions",
    "Vocabulary: Politics & Society",
    "Vocabulary: Economics & Finance",
    "Vocabulary: Health & Science",
    "Concessive & Causal Connectors",
    "Vocabulary: Culture & Arts",
  ],
  C1: [
    "Nominalization (Nominalisierung)",
    "Participle Constructions",
    "Indirect Speech (Konjunktiv I)",
    "Academic & Scientific Vocabulary",
    "Stylistic Variation & Register",
    "Complex Syntax & Clause Structures",
    "Text Cohesion & Discourse Markers",
    "Advanced Business & Formal Language",
    "Literary Analysis & Interpretation",
    "Vocabulary: Law, Ethics & Philosophy",
    "Vocabulary: Politics & International Relations",
    "Advanced Argumentation & Rhetoric",
  ],
  C2: [
    "Rhetorical Devices & Persuasion",
    "Literary & Poetic Language",
    "Advanced Idioms & Collocations",
    "Regional Varieties & Dialects",
    "Free Composition & Creative Writing",
    "Pragmatics & Communicative Strategies",
    "Translation & Nuanced Expression",
    "Cultural, Historical & Literary References",
    "Advanced Academic Writing",
    "Vocabulary: Diplomacy, Media & Journalism",
    "Vocabulary: Philosophy & Abstract Concepts",
    "Stylistics & Linguistic Analysis",
  ],
};

const LVL = {
  A1:{label:"Beginner",color:"#4ade80",glow:"rgba(74,222,128,0.12)"},
  A2:{label:"Elementary",color:"#60a5fa",glow:"rgba(96,165,250,0.12)"},
  B1:{label:"Intermediate",color:"#fbbf24",glow:"rgba(251,191,36,0.12)"},
  B2:{label:"Upper-Intermediate",color:"#fb923c",glow:"rgba(251,146,60,0.12)"},
  C1:{label:"Advanced",color:"#f87171",glow:"rgba(248,113,113,0.12)"},
  C2:{label:"Mastery",color:"#c084fc",glow:"rgba(192,132,252,0.12)"},
};

const LVL_ORDER = ["A1","A2","B1","B2","C1","C2"];
const XP_MILESTONE = 200;
const LVL_ICONS = ["🌱","🌿","⚡","🔥","💎","👑"];
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Cormorant:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');`;

// ─── JSON extraction ──────────────────────────────────────────────────────────
function extractTag(text, tag) {
  const idx = text.indexOf(tag + ":");
  if (idx === -1) return null;
  let start = text.indexOf("{", idx);
  if (start === -1) return null;
  let depth = 0, i = start;
  while (i < text.length) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
    i++;
  }
  return null;
}
function parseTag(text, tag) {
  try { const s = extractTag(text, tag); return s ? JSON.parse(s) : null; } catch { return null; }
}

// ─── Phase detection ──────────────────────────────────────────────────────────
function detectPhase(msgs) {
  // Walk backwards through AI messages to find latest PHASE_START
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "assistant") {
      const p = parseTag(msgs[i].content, "PHASE_START");
      if (p?.n) return p.n;
    }
  }
  return 1;
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function ai(messages, system, attempt = 0) {
  const clean = messages.map(({ role, content }) => ({ role, content }));
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1400, system, messages: clean }),
    });
    if (r.status === 429) {
      return "⚠️ You've reached today's usage limit (20 requests). Come back tomorrow!";
    }
    if (!r.ok) {
      if (r.status >= 500 && attempt < MAX_RETRIES) {
        await new Promise(res => setTimeout(res, 800 * (attempt + 1)));
        return ai(messages, system, attempt + 1);
      }
      return `⚠️ Server error (${r.status}). Please try again.`;
    }
    const d = await r.json();
    return d.content?.[0]?.text ?? "⚠️ Empty response — please try again.";
  } catch {
    if (attempt < MAX_RETRIES) {
      await new Promise(res => setTimeout(res, 800 * (attempt + 1)));
      return ai(messages, system, attempt + 1);
    }
    return "⚠️ Connection error. Check your internet and try again.";
  }
}

function stripMeta(t) {
  return t
    .replace(/PHASE_START:\{[^}]+\}/g, "")
    .replace(/RESULT:\{[\s\S]*?\}(?=\s|$)/g, "")
    .replace(/LESSON_DONE:\{[\s\S]*?\}(?=\s|$)/g, "")
    .replace(/TEST_DONE:\{[\s\S]*?\}(?=\s|$)/g, "")
    .trim();
}

// ─── Storage ──────────────────────────────────────────────────────────────────
async function loadProfile() {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
async function saveProfile(p) {
  try {
    localStorage.setItem(STORE, JSON.stringify(p));
    return true;
  } catch { return false; }
}

// ─── System prompts ───────────────────────────────────────────────────────────
const ASSESSMENT_SYS = `You are a German language assessment expert. Determine the student's CEFR level (A1–C2).

Ask EXACTLY 6 questions, ONE at a time. Start IMMEDIATELY with Question 1 — no preamble.

Q1–2: A1/A2 (translate a simple phrase, fill a basic blank)
Q3–4: B1/B2 (past tense, cases, modal verbs)
Q5–6: C1/C2 (passive voice, complex syntax, idioms)

After Q6 is answered, give a brief 2-line analysis, then write EXACTLY:
RESULT:{"level":"B1","weakAreas":["Konjunktiv II","Dative prepositions"],"summary":"Solid intermediate."}

Be warm and precise. One question per turn.`;

function lessonSys(profile, topic, skill4) {
  const lvlIdx = LVL_ORDER.indexOf(profile.level);

  // Language of instruction — scales with level
  const langNote =
    lvlIdx === 0
      ? "Language: Use ENGLISH for all instructions and explanations. German only for examples and exercises."
      : lvlIdx === 1
      ? "Language: Give instructions in simple German (A2 level). Use English only when introducing a new grammar term for the first time. Keep sentences short and clear."
      : lvlIdx === 2
      ? "Language: Conduct the entire lesson in German at B1 level. Avoid English except for brief parenthetical glosses on advanced grammar terms."
      : "Language: Conduct the entire lesson in German at the appropriate level. No English at all — the student must work in German throughout.";

  // Correction format note — used in all phases
  const correctionNote =
    `When marking wrong answers, ALWAYS use this exact format:\n❌ [what the student wrote] → ✓ [correct form]\nThen add one sentence explaining the rule. Never just say "wrong" without showing the correct version.`;

  // Vocabulary highlighting instruction
  const vocabNote =
    `VOCABULARY HIGHLIGHTING: In reading passages, example sentences, dialogues, and exercise prompts, wrap selected German words in [[word|hint]] format.

WHICH WORDS TO HIGHLIGHT:
- ONLY highlight words at EXACTLY ${profile.level} level or ONE level above
- Do NOT highlight words below ${profile.level} level — the student already knows these
- Only highlight content words: nouns, verbs, adjectives, adverbs
- Do NOT highlight: articles (der/die/das/ein), prepositions, pronouns, conjunctions, numbers, punctuation
- Do NOT highlight words explicitly taught in Phase 2 (they are the lesson focus)
- Do NOT highlight inside gap-fill blanks (①②③ or ___)
- Aim for 4–8 highlights per passage — be selective

FORMAT RULES (follow exactly):
1. Conjugated verbs — show the INFINITIVE and translate the infinitive, not the conjugated form:
   [[geht|gehen – to go]]   [[hat geschlafen|schlafen – to sleep]]   [[wurde gebaut|bauen – to build]]
2. Nouns — show the gender code before the translation (m = masculine, f = feminine, n = neuter, p = plural):
   [[Krankenhaus|n – hospital]]   [[Ärztin|f – female doctor]]   [[Eltern|p – parents]]   [[Zug|m – train]]
3. Adjectives and adverbs — translation only:
   [[plötzlich|suddenly]]   [[erschöpft|exhausted]]   [[dennoch|nevertheless]]`;


  // Phase 2 grammar depth note
  const grammarDepth =
    `After the rule explanation, if the topic involves verb conjugation, case endings, or irregular forms, include a compact reference table of the 6–8 most common examples at ${profile.level} level (e.g. for Perfekt: common past participles; for Dative: pronoun table; for Modal verbs: full conjugation grid).
After your teaching, ask the student — in the appropriate lesson language — whether they need more examples or a deeper explanation before you continue. Wait for their answer. If yes, provide more; if no, proceed immediately to Phase 3.`;

  // Phase 1 translation note
  const translationNote =
    `IMPORTANT — translations: Do NOT provide any English translation of German texts or exercises before the student has answered. After they answer, you may offer: "Möchtest du die deutsche Übersetzung sehen?" (or English equivalent at A1). Only show the translation if they ask for it.`;

  // Phase 4 speaking — role-play
  const speaking4 = `PHASE_START:{"n":4,"label":"Speaking 🗣️"}
Set up a short role-play. You play a character relevant to today's topic (e.g. shopkeeper, receptionist, friend, colleague, doctor).
In one sentence, tell the student the scenario and who you are playing — in the lesson language.
Then immediately speak your opening line IN CHARACTER in natural German.
The student replies in German. Continue the exchange for 2–3 turns total, responding naturally in character.
After the final exchange, step out of character and give structured feedback in the lesson language:
✅ What they got right (grammar, vocabulary, register)
❌ Any errors using the format: ❌ [what they wrote] → ✓ [correct form] + rule in one sentence
Rate their overall naturalness: natürlich / fast natürlich / braucht Übung`;

  // Phase 4 listening
  const listening4 = `PHASE_START:{"n":4,"label":"Listening 🎧"}
Present a short German dialogue (5–6 lines) between two people, relevant to today's topic. Do not translate it.
Remove 3 words/short phrases and replace with ___ (numbered ①②③).
Frame the task in the lesson language. Do NOT provide translations before the student answers.
After they answer: for each blank mark ✅ or use ❌ [student answer] → ✓ [correct word] + brief explanation.`;

  return `You are Professor Weber, a warm expert German teacher conducting a structured TELC-style lesson.

Student: Level ${profile.level} (${LVL[profile.level]?.label}). Weak areas: ${profile.weakAreas?.join(", ") || "general practice"}.
Today's topic: "${topic}"
Phase 4 skill: ${skill4.toUpperCase()}

${langNote}

${correctionNote}

${vocabNote}

${translationNote}

═══ LESSON STRUCTURE — 4 PHASES ═══
Begin each phase by writing PHASE_START:{"n":N,"label":"..."} on its own line.

── PHASE 1: READING ──
PHASE_START:{"n":1,"label":"Reading 📖"}
Write a short German passage (4–6 sentences) directly relevant to "${topic}". Do NOT translate it.
Ask ONE comprehension question (in the lesson language) beneath it.
Wait for the student's answer. Mark it ✅ or ❌ with a brief explanation.
After answering, offer the translation if they want it.
Then begin Phase 2 immediately.

── PHASE 2: GRAMMAR & VOCABULARY ──
PHASE_START:{"n":2,"label":"Grammar & Vocabulary 📚"}
Teach "${topic}":
- Rule explanation (3–4 sentences, in the lesson language)
- 4 example sentences: **German** with *(English translation)* — translations are allowed here since this is explicit teaching
- 2 common mistakes: use ❌ [wrong form] → ✓ [correct form] + explanation
${grammarDepth}

── PHASE 3: WRITING ──
PHASE_START:{"n":3,"label":"Writing ✍️"}
Give exactly 2 writing exercises in the lesson language. Do NOT include German translations or hints inside the exercise prompts.
1. Gap-fill or sentence transformation using today's grammar
2. Write 2–3 sentences / a short paragraph on a given prompt
Wait for the student's response. For each exercise mark ✅ or use ❌ [what they wrote] → ✓ [correct form] + rule.
Then begin Phase 4 immediately.

── PHASE 4: ${skill4.toUpperCase()} ──
${skill4 === "listening" ? listening4 : speaking4}

After Phase 4 feedback is complete, write on its own line:
LESSON_DONE:{"score":75,"xp":30,"weakAreas":["any specific area needing work"]}

Keep phases concise. Use **bold** for key German forms.`;
}

function testSys(profile) {
  const lvl = profile.level;
  const meta = LVL[lvl];
  const lvlIdx = LVL_ORDER.indexOf(lvl);

  const testLang =
    lvlIdx === 0
      ? "Use English for all instructions."
      : lvlIdx === 1
      ? "Give instructions in simple German. Use English only for complex grammar terms."
      : "Give all instructions in German at the appropriate level. No English.";

  const correctionNote =
    "When marking wrong answers, ALWAYS write: ❌ [student's answer] → ✓ [correct answer], then explain the rule in one sentence.";

  const vocabNoteTest =
    `VOCABULARY HIGHLIGHTING: In the reading text, listening dialogue, and writing prompt, wrap selected German words in [[word|hint]] format.

WHICH WORDS TO HIGHLIGHT:
- ONLY words at EXACTLY ${lvl} level or ONE level above — never below ${lvl}
- Only content words: nouns, verbs, adjectives, adverbs
- Never: articles, prepositions, pronouns, conjunctions, numbers, gap-fill blanks (①②③)
- Aim for 4–8 highlights per section

FORMAT RULES:
1. Conjugated verbs — show INFINITIVE and translate the infinitive:
   [[arbeitet|arbeiten – to work]]   [[ist gefahren|fahren – to drive]]
2. Nouns — gender code + translation (m/f/n/p):
   [[Bericht|m – report]]   [[Sitzung|f – meeting]]   [[Unternehmen|n – company]]
3. Adjectives/adverbs — translation only:
   [[zuständig|responsible]]   [[hingegen|on the other hand]]`;

  const speakingPhase =
    lvlIdx <= 1
      ? `PHASE_START:{"n":4,"label":"Speaking 🗣️"}
Set up a role-play scenario appropriate for ${lvl}. Play a character and open with one line in German.
The student replies in German. Do 2 exchanges. Then give feedback using ✅/❌ correction format.
Grade: fluency/naturalness (10), grammar (8), vocabulary/register (7).`
      : `PHASE_START:{"n":4,"label":"Speaking 🗣️"}
Set up a role-play in German. Play a character, open in German. 2–3 exchanges.
Give feedback entirely in German using ✅/❌ correction format.
Grade: fluency/naturalness (10), grammar (8), vocabulary/register (7).`;

  return `You are administering the official end-of-level TELC-style test for ${lvl} (${meta?.label}).

${testLang}

${correctionNote}

${vocabNoteTest}

TRANSLATIONS: Do not provide translations of German texts before the student answers. Offer them only afterwards if asked.

Skills: Reading, Listening, Writing, Speaking — 25 pts each = 100 total. Pass mark: ${PASS_MARK}/100.
Grade strictly at ${lvl} standards. Begin immediately — no preamble.

══ PHASE 1: READING (25 pts) ══
PHASE_START:{"n":1,"label":"Reading 📖"}
Present a ${lvl}-appropriate German text (6–10 sentences). Do NOT translate it.
Ask 3 comprehension questions. Await answers, then grade each.
For wrong answers: ❌ [student answer] → ✓ [correct answer].
Announce Reading subtotal. Then begin Phase 2.

══ PHASE 2: LISTENING (25 pts) ══
PHASE_START:{"n":2,"label":"Listening 🎧"}
Present a German dialogue/monologue (6–8 lines) with 5 gaps (①②③④⑤). Do not translate.
Frame the task in the test language. Grade: 5 pts each.
For wrong answers: ❌ [student answer] → ✓ [correct word].
Announce Listening subtotal. Then begin Phase 3.

══ PHASE 3: WRITING (25 pts) ══
PHASE_START:{"n":3,"label":"Writing ✍️"}
Give ONE writing task for ${lvl}:
- A1/A2: Write 4–6 sentences on a given topic
- B1/B2: Write a structured text (email, message, ~80 words)
- C1/C2: Write a formal argument or essay (~120 words)
Do NOT provide translation hints in the prompt.
Grade: content (10), grammar (8), vocabulary (7).
For errors: ❌ [wrong form] → ✓ [correct form].
Announce Writing subtotal. Then begin Phase 4.

══ PHASE 4: SPEAKING (25 pts) ══
${speakingPhase}
Announce Speaking subtotal.

Give a 2–3 line overall summary, announce TOTAL and PASSED/FAILED.
Finally write:
TEST_DONE:{"score":78,"passed":true,"breakdown":{"reading":20,"listening":18,"writing":22,"speaking":18},"feedback":"Strong reading and writing. Work on listening gap vocabulary."}`;
}


// ─── Vocab tooltip ───────────────────────────────────────────────────────────
function VocabWord({ word, translation }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{position:"relative",display:"inline"}}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}>
      <span
        style={{fontWeight:600,color:"#c4a35a",cursor:"default",borderBottom:"1px dashed rgba(196,163,90,0.6)",paddingBottom:1}}
      >{word}</span>
      {open && (
        <span style={{position:"absolute",bottom:"calc(100% + 5px)",left:"50%",transform:"translateX(-50%)",
          background:"#141428",border:"1px solid rgba(196,163,90,0.45)",borderRadius:6,
          padding:"4px 10px",fontSize:12,color:"#f0ede8",whiteSpace:"nowrap",zIndex:200,
          pointerEvents:"none",boxShadow:"0 4px 12px rgba(0,0,0,0.4)"}}>
          {translation}
          <span style={{position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",
            width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",
            borderTop:"5px solid rgba(196,163,90,0.45)"}} />
        </span>
      )}
    </span>
  );
}

// ─── Markdown ─────────────────────────────────────────────────────────────────
function Inline({ t }) {
  const parts = t.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\|[^\]]+\]\])/g);
  return <>{parts.map((s, i) => {
    if (s.startsWith("**") && s.endsWith("**")) return <strong key={i} style={{color:"#f0ede8",fontWeight:600}}>{s.slice(2,-2)}</strong>;
    if (s.startsWith("*") && s.endsWith("*")) return <em key={i} style={{color:"#c4a35a"}}>{s.slice(1,-1)}</em>;
    if (s.startsWith("`") && s.endsWith("`")) return <code key={i} style={{background:"rgba(196,163,90,0.12)",border:"1px solid rgba(196,163,90,0.22)",padding:"1px 6px",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:13,color:"#c4a35a"}}>{s.slice(1,-1)}</code>;
    if (s.startsWith("[[") && s.endsWith("]]")) {
      const pipe = s.indexOf("|");
      const word = s.slice(2, pipe);
      const trans = s.slice(pipe + 1, -2);
      return <VocabWord key={i} word={word} translation={trans} />;
    }
    return s;
  })}</>;
}

function MdText({ text }) {
  return (
    <div>
      {text.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return <h2 key={i} style={mdS.h1}>{line.slice(2)}</h2>;
        if (line.startsWith("## ")) return <h3 key={i} style={mdS.h2}>{line.slice(3)}</h3>;
        if (line.startsWith("### ")) return <h4 key={i} style={mdS.h3}>{line.slice(4)}</h4>;
        if (/^[-•*] /.test(line)) return <div key={i} style={mdS.li}><span style={mdS.bullet}>◆</span><span><Inline t={line.replace(/^[-•*] /,"")} /></span></div>;
        if (/^\d+\. /.test(line)) return <div key={i} style={mdS.oli}><span style={mdS.onum}>{line.match(/^(\d+)\./)[1]}.</span><span><Inline t={line.replace(/^\d+\. /,"")} /></span></div>;
        if (!line.trim()) return <div key={i} style={{height:6}} />;
        return <p key={i} style={mdS.p}><Inline t={line} /></p>;
      })}
    </div>
  );
}

const mdS = {
  h1:{fontFamily:"'Cormorant',serif",fontSize:20,fontWeight:700,color:"#f0ede8",margin:"14px 0 6px"},
  h2:{fontSize:15,fontWeight:600,color:"#e8e4d8",margin:"12px 0 5px"},
  h3:{fontSize:12,fontWeight:600,color:"#c4a35a",textTransform:"uppercase",letterSpacing:"0.07em",margin:"10px 0 4px"},
  p:{margin:"3px 0",lineHeight:1.65},
  li:{display:"flex",gap:8,margin:"3px 0",alignItems:"flex-start"},
  bullet:{color:"#c4a35a",flexShrink:0,fontSize:9,marginTop:6},
  oli:{display:"flex",gap:8,margin:"3px 0"},
  onum:{color:"#c4a35a",flexShrink:0,fontWeight:600,minWidth:20},
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((icon, title, sub) => {
    const id = Date.now();
    setToasts(p => [...p, { id, icon, title, sub, leaving: false }]);
    setTimeout(() => setToasts(p => p.map(t => t.id === id ? {...t, leaving:true} : t)), 2500);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2900);
  }, []);
  return { toasts, show };
}

function Toast({ toasts }) {
  return (
    <div style={{position:"fixed",top:16,right:16,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {toasts.map(t => (
        <div key={t.id} style={{background:"#0e1420",border:"1px solid rgba(196,163,90,0.35)",borderRadius:10,
          padding:"10px 16px",display:"flex",alignItems:"center",gap:10,minWidth:200,maxWidth:280,
          animation:t.leaving?"toastOut 0.3s ease forwards":"toastIn 0.3s ease both"}}>
          <span style={{fontSize:18}}>{t.icon}</span>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"#f0ede8"}}>{t.title}</div>
            {t.sub && <div style={{fontSize:12,color:"#888"}}>{t.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Phase bar ────────────────────────────────────────────────────────────────
function PhaseBar({ phase, skill4, isTest, onPhaseClick, reachedPhases }) {
  const phases = isTest
    ? [{n:1,label:"Reading 📖"},{n:2,label:"Listening 🎧"},{n:3,label:"Writing ✍️"},{n:4,label:"Speaking 🗣️"}]
    : [{n:1,label:"Reading 📖"},{n:2,label:"Grammar 📚"},{n:3,label:"Writing ✍️"},{n:4,label:skill4==="listening"?"Listening 🎧":"Speaking 🗣️"}];
  return (
    <div style={{display:"flex",gap:0,padding:"0 20px 0",background:"#0a0a14",borderBottom:"1px solid #1e1e30"}}>
      {phases.map((p, i) => {
        const active = phase === p.n;
        const done = phase > p.n;
        const reachable = reachedPhases?.has(p.n);
        const clickable = reachable && onPhaseClick;
        return (
          <div key={p.n}
            onClick={clickable ? () => onPhaseClick(p.n) : undefined}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 4px",
              position:"relative",cursor:clickable?"pointer":"default",
              transition:"opacity 0.2s",opacity:reachable||active?1:0.38}}>
            {i < phases.length - 1 && (
              <div style={{position:"absolute",right:0,top:"50%",transform:"translateY(-50%)",width:1,height:16,background:"#1e1e30"}} />
            )}
            <div style={{fontSize:10,fontWeight:active?600:400,
              color:done?"#4ade80":active?"#c4a35a":reachable?"#888":"#404060",
              transition:"color 0.3s",textAlign:"center",lineHeight:1.3}}>
              {done ? "✓ " : ""}{p.label}
            </div>
            <div style={{height:2,width:"80%",marginTop:5,borderRadius:1,
              background:done?"#4ade80":active?"#c4a35a":"#1e1e30",
              transition:"background 0.3s"}} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ msg, onConfirm, onCancel }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.72)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0e0e1a",border:"1px solid #2a2a40",borderRadius:14,padding:"28px 24px",maxWidth:340,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
        <p style={{color:"#e0dcd4",lineHeight:1.6,marginBottom:24,fontSize:15}}>{msg}</p>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button style={S.btnGhost} onClick={onCancel}>Cancel</button>
          <button style={{...S.btnPrimary,background:"#f87171",color:"#1a0808"}} onClick={onConfirm}>Yes, continue</button>
        </div>
      </div>
    </div>
  );
}

// ─── Test Results screen ──────────────────────────────────────────────────────
function TestResults({ result, level, onBack, onNextLevel }) {
  const meta = LVL[level] || LVL.A1;
  const nextLvl = LVL_ORDER[LVL_ORDER.indexOf(level) + 1];
  const skills = [
    {k:"reading",label:"Reading 📖"},
    {k:"listening",label:"Listening 🎧"},
    {k:"writing",label:"Writing ✍️"},
    {k:"speaking",label:"Speaking 🗣️"},
  ];
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px"}}>
      <div style={{maxWidth:480,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:12}}>{result.passed ? "🏆" : "📋"}</div>
        <div style={{fontFamily:"'Cormorant',serif",fontSize:38,fontWeight:700,color:result.passed?"#4ade80":"#f87171",marginBottom:4}}>
          {result.passed ? "Bestanden!" : "Nicht bestanden"}
        </div>
        <div style={{fontSize:13,color:"#7878a0",marginBottom:28}}>{result.passed ? "Level passed — well done!" : `Score below ${PASS_MARK}% — keep practising!`}</div>

        <div style={{background:"#0e0e1a",border:`1px solid ${result.passed?"rgba(74,222,128,0.3)":"rgba(248,113,113,0.3)"}`,borderRadius:14,padding:"20px 24px",marginBottom:20}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:52,fontWeight:500,color:result.passed?"#4ade80":"#f87171",lineHeight:1}}>{result.score}</div>
          <div style={{fontSize:12,color:"#606080",marginTop:4}}>/ 100 points</div>

          <div style={{borderTop:"1px solid #1e1e30",marginTop:16,paddingTop:16,display:"flex",flexDirection:"column",gap:10}}>
            {skills.map(({k,label}) => {
              const pts = result.breakdown?.[k] ?? 0;
              const pct = (pts / 25) * 100;
              return (
                <div key={k} style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:12,color:"#aaa8a0",minWidth:130,textAlign:"left"}}>{label}</div>
                  <div style={{flex:1,height:5,background:"#1e1e30",borderRadius:2}}>
                    <div style={{height:"100%",borderRadius:2,background:pct>=80?"#4ade80":pct>=60?"#fbbf24":"#f87171",width:`${pct}%`,transition:"width 0.6s ease"}} />
                  </div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:"#c4a35a",minWidth:36,textAlign:"right"}}>{pts}/25</div>
                </div>
              );
            })}
          </div>
        </div>

        {result.feedback && (
          <div style={{background:"rgba(196,163,90,0.06)",border:"1px solid rgba(196,163,90,0.18)",borderRadius:10,padding:"12px 16px",marginBottom:20,textAlign:"left"}}>
            <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:"#c4a35a",marginBottom:6,fontWeight:600}}>Feedback</div>
            <p style={{fontSize:13,color:"#c8c4bc",lineHeight:1.6,margin:0}}>{result.feedback}</p>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {result.passed && nextLvl && (
            <button style={S.btnPrimary} onClick={()=>onNextLevel(nextLvl)}>
              Start {nextLvl} — {LVL[nextLvl]?.label} →
            </button>
          )}
          <button style={S.btnGhost} onClick={onBack}>Back to Dashboard</button>
        </div>
      </div>
    </div>
  );
}

// ─── Welcome ──────────────────────────────────────────────────────────────────
function Welcome({ onStart, onManual }) {
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 24px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-100,left:"50%",transform:"translateX(-50%)",width:480,height:480,background:"radial-gradient(circle,rgba(196,163,90,0.08) 0%,transparent 70%)",pointerEvents:"none"}} />
      <div style={{textAlign:"center",maxWidth:460,position:"relative"}}>
        <div style={{fontSize:11,letterSpacing:"0.2em",textTransform:"uppercase",color:"#c4a35a",marginBottom:14,fontWeight:500}}>Ihr persönlicher</div>
        <h1 style={{fontFamily:"'Cormorant',serif",fontSize:72,fontWeight:700,color:"#f0ede8",lineHeight:0.95,marginBottom:20,letterSpacing:"-0.02em"}}>Deutsch&shy;lehrer</h1>
        <p style={{color:"#7878a0",fontSize:15,lineHeight:1.7,marginBottom:32}}>
          TELC-aligned lessons covering all 4 skills — Reading, Listening, Writing & Speaking — with end-of-level tests.
        </p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:36}}>
          {["📖 Reading","🎧 Listening","✍️ Writing","🗣️ Speaking","📊 Level Tests"].map(f=>(
            <div key={f} style={{background:"rgba(196,163,90,0.07)",border:"1px solid rgba(196,163,90,0.18)",borderRadius:20,padding:"5px 13px",fontSize:12,color:"#c4a35a"}}>{f}</div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
          <button style={S.btnPrimary} onClick={onStart}>Begin Assessment →</button>
          <button style={S.btnGhost} onClick={onManual}>I already know my level</button>
        </div>
      </div>
    </div>
  );
}

// ─── Level Select ─────────────────────────────────────────────────────────────
function LevelSelect({ onSelect, onBack, mode }) {
  const isBrowse = mode === "browse";
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <div>
          <div style={S.headerTitle}>{isBrowse ? "Change Level" : "Select Your Level"}</div>
          <div style={S.headerSub}>{isBrowse ? "Switch level — progress stays saved" : "Choose your current CEFR level"}</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,padding:"24px 20px",maxWidth:640,margin:"0 auto",width:"100%"}}>
        {Object.entries(LVL).map(([lvl,meta],idx)=>(
          <button key={lvl} style={S.lvlCard} onClick={()=>onSelect(lvl)}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=meta.color;e.currentTarget.style.background="#13132a";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#1e1e30";e.currentTarget.style.background="#0e0e1a";}}>
            <div style={{fontSize:26,marginBottom:8}}>{LVL_ICONS[idx]}</div>
            <div style={{fontFamily:"'Cormorant',serif",fontSize:28,fontWeight:700,color:meta.color,marginBottom:4}}>{lvl}</div>
            <div style={{fontSize:12,color:"#7878a0"}}>{meta.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
function Chat({ title, sub, msgs, input, busy, setInput, onSend, onBack, done, onFinish, skill4, isTest }) {
  const endRef = useRef(null);
  const phase = useMemo(() => detectPhase(msgs), [msgs]);
  const phaseRefs = useRef({});
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,busy]);

  // Build set of phases that have a message in the history
  const reachedPhases = useMemo(() => {
    const s = new Set();
    msgs.forEach(m => {
      if (m.role === "assistant") {
        const p = parseTag(m.content, "PHASE_START");
        if (p?.n) s.add(p.n);
      }
    });
    return s;
  }, [msgs]);

  const scrollToPhase = useCallback((n) => {
    const el = phaseRefs.current[n];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const charsLeft = MAX_CHARS - input.length;
  const isOverLimit = charsLeft < 0;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",maxWidth:760,margin:"0 auto"}}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <div style={{flex:1}}><div style={S.headerTitle}>{title}</div><div style={S.headerSub}>{sub}</div></div>
      </div>
      <PhaseBar phase={phase} skill4={skill4} isTest={isTest} onPhaseClick={scrollToPhase} reachedPhases={reachedPhases} />
      <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
        {msgs.length === 0 && (
          <div style={{textAlign:"center",color:"#404060",fontSize:14,marginTop:40}}>Professor Weber is preparing…</div>
        )}
        {msgs.map((m,i)=>{
          const msgPhase = (m.role==="assistant") ? parseTag(m.content,"PHASE_START")?.n : null;
          return (
          <div key={i}
            ref={msgPhase ? el => { if(el) phaseRefs.current[msgPhase] = el; } : null}
            style={{display:"flex",gap:12,alignItems:"flex-start",flexDirection:m.role==="user"?"row-reverse":"row"}}>
            {m.role==="assistant" && <div style={S.avatar}>PW</div>}
            <div style={{...S.bubble,...(m.role==="user"?S.bubbleUser:m.isError?S.bubbleErr:S.bubbleAI)}}>
              {m.role==="assistant"
                ? <MdText text={stripMeta(m.content)} />
                : <p style={{margin:0,lineHeight:1.6}}>{m.content}</p>}
            </div>
          </div>
          );
        })}
        {busy && (
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={S.avatar}>PW</div>
            <div style={{...S.bubble,...S.bubbleAI}}>
              <div style={{display:"flex",gap:5,padding:"4px 0"}}>
                {[0,1,2].map(j=><span key={j} style={{width:6,height:6,borderRadius:"50%",background:"#c4a35a",animation:`dot 1.2s ${j*0.2}s infinite ease-in-out`,display:"inline-block"}} />)}
              </div>
            </div>
          </div>
        )}
        {done && (
          <div style={{display:"flex",alignItems:"center",gap:14,background:"rgba(74,222,128,0.07)",border:"1px solid rgba(74,222,128,0.22)",borderRadius:12,padding:"14px 18px"}}>
            <span style={{fontSize:24}}>🎉</span>
            <div>
              <div style={{fontWeight:600,color:"#4ade80",fontSize:15}}>{isTest ? "Test complete!" : "Lektion abgeschlossen!"}</div>
              <div style={{fontSize:12,color:"#888"}}>{isTest ? "Reviewing your results…" : "Lesson complete — well done!"}</div>
            </div>
            <button style={{...S.btnPrimary,marginLeft:"auto",padding:"9px 18px",fontSize:13}} onClick={onFinish}>
              {isTest ? "See Results →" : "Dashboard →"}
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {!done && (
        <div style={{padding:"12px 20px",borderTop:"1px solid #1e1e30",background:"#0a0a14"}}>
          <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
            <div style={{flex:1,position:"relative"}}>
              <textarea
                style={{width:"100%",background:"#10101c",border:`1px solid ${isOverLimit?"#f87171":"#2a2a40"}`,borderRadius:8,
                  padding:"10px 14px",color:"#eeeae0",fontSize:14,fontFamily:"'DM Sans',sans-serif",resize:"none",outline:"none",lineHeight:1.5,display:"block"}}
                rows={2} value={input} placeholder="Type your answer… (Enter to send)" disabled={busy}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();onSend();} }}
                onFocus={e=>e.target.style.borderColor=isOverLimit?"#f87171":"#c4a35a"}
                onBlur={e=>e.target.style.borderColor=isOverLimit?"#f87171":"#2a2a40"}
              />
              {input.length > MAX_CHARS * 0.8 && (
                <div style={{position:"absolute",bottom:6,right:10,fontSize:11,color:isOverLimit?"#f87171":"#606080"}}>{charsLeft}</div>
              )}
            </div>
            <button style={{...S.btnPrimary,padding:"10px 18px",fontSize:18,opacity:busy||!input.trim()||isOverLimit?0.4:1,cursor:busy||!input.trim()||isOverLimit?"not-allowed":"pointer",flexShrink:0}}
              onClick={onSend} disabled={busy||!input.trim()||isOverLimit}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ profile, onLesson, onProgress, onReassess, onChangeLevel, onTest }) {
  const meta = LVL[profile.level] || LVL.A2;
  const topics = TOPICS[profile.level] || [];
  const done = useMemo(() => new Set((profile.completedLessons||[]).map(l=>l.topic)), [profile.completedLessons]);
  const xpPct = Math.min(100, ((profile.xp||0) % XP_MILESTONE) / XP_MILESTONE * 100);
  const next = topics.find(t=>!done.has(t)) || topics[0];
  const avg = profile.completedLessons?.length > 0
    ? Math.round(profile.completedLessons.reduce((a,l)=>a+l.score,0)/profile.completedLessons.length)
    : null;
  const allDone = topics.every(t => done.has(t));
  const testResult = profile.levelTests?.[profile.level];

  return (
    <div style={{minHeight:"100vh",maxWidth:660,margin:"0 auto",padding:"28px 20px 60px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <div style={{fontSize:13,color:"#7878a0",marginBottom:4}}>Guten Tag! 👋</div>
          <h1 style={{fontFamily:"'Cormorant',serif",fontSize:30,fontWeight:700,color:"#f0ede8",lineHeight:1}}>Your Dashboard</h1>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={S.btnGhost} onClick={onChangeLevel}>Change Level</button>
          <button style={S.btnGhost} onClick={onReassess}>Re-assess</button>
        </div>
      </div>

      <div style={{background:"#0e0e1a",border:`1px solid ${meta.color}`,borderRadius:14,padding:"18px 22px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:54,height:54,borderRadius:12,background:meta.glow,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>
            {LVL_ICONS[LVL_ORDER.indexOf(profile.level)]}
          </div>
          <div>
            <div style={{fontFamily:"'Cormorant',serif",fontSize:36,fontWeight:700,color:meta.color,lineHeight:1}}>{profile.level}</div>
            <div style={{fontSize:12,color:"#7878a0",marginTop:2}}>{meta.label}</div>
          </div>
        </div>
        <div style={{textAlign:"right",minWidth:130}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:22,fontWeight:500,color:"#f0ede8",marginBottom:6}}>{profile.xp||0} <span style={{fontSize:13,color:"#7878a0"}}>XP</span></div>
          <div style={{height:4,background:"#1e1e30",borderRadius:2,marginBottom:4}}>
            <div style={{height:"100%",borderRadius:2,background:meta.color,width:`${xpPct}%`,transition:"width 0.6s ease"}} />
          </div>
          <div style={{fontSize:11,color:"#606080"}}>{Math.round(xpPct)}% to next milestone</div>
        </div>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:18}}>
        {[{n:(profile.completedLessons||[]).length,l:"Lessons"},{n:avg!=null?`${avg}%`:"—",l:"Avg Score"},{n:profile.xp||0,l:"Total XP"}].map(({n,l})=>(
          <div key={l} style={{flex:1,background:"#0e0e1a",border:"1px solid #1e1e30",borderRadius:10,padding:"12px",textAlign:"center"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:22,color:"#c4a35a"}}>{n}</div>
            <div style={{fontSize:11,color:"#606080",marginTop:4}}>{l}</div>
          </div>
        ))}
      </div>

      {profile.weakAreas?.length > 0 && (
        <div style={{marginBottom:18}}>
          <div style={S.sectionLabel}>Focus Areas</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {profile.weakAreas.map(w=>(
              <span key={w} style={{background:"rgba(248,113,113,0.09)",border:"1px solid rgba(248,113,113,0.22)",color:"#f87171",padding:"4px 12px",borderRadius:20,fontSize:12}}>{w}</span>
            ))}
          </div>
        </div>
      )}

      <div style={S.sectionLabel}>Curriculum — {profile.level}</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {topics.map((topic,i)=>{
          const isDone = done.has(topic), isNext = !allDone && topic === next;
          return (
            <div key={topic} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0e0e1a",border:`1px solid ${isNext?"#2a2a40":"#1a1a28"}`,borderRadius:10,padding:"12px 16px",opacity:isDone?0.42:1}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:isNext?"rgba(196,163,90,0.14)":"#1e1e30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:isNext?"#c4a35a":"#606080",fontWeight:600,flexShrink:0}}>{i+1}</div>
                <span style={{fontSize:14,color:"#ddd8cc"}}>{topic}</span>
              </div>
              {isDone
                ? <span style={{fontSize:12,color:"#4ade80"}}>✓ Done</span>
                : <button style={{background:isNext?"rgba(196,163,90,0.09)":"transparent",border:`1px solid ${isNext?"#c4a35a":"#2a2a40"}`,color:isNext?"#c4a35a":"#888",padding:"6px 14px",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:isNext?600:400}}
                    onClick={()=>onLesson(topic)}>{isNext?"Start →":"Practice"}</button>}
            </div>
          );
        })}
      </div>

      {/* End-of-level test card */}
      <div style={{background:allDone?"#0a0f1a":"#0a0a12",border:`1px solid ${allDone?"rgba(196,163,90,0.4)":"#1e1e30"}`,borderRadius:12,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,marginBottom:20}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{fontSize:18}}>{testResult?.passed ? "🏆" : allDone ? "📝" : "🔒"}</span>
            <div style={{fontSize:14,fontWeight:600,color:allDone?"#f0ede8":"#404060"}}>Level {profile.level} Test</div>
          </div>
          <div style={{fontSize:12,color:"#606080"}}>
            {testResult
              ? `Score: ${testResult.score}/100 · ${testResult.passed?"Passed":"Not passed"}`
              : allDone
              ? "All lessons complete — ready to test!"
              : `Complete all ${topics.length} lessons to unlock`}
          </div>
        </div>
        {allDone && (
          <button style={{...S.btnPrimary,padding:"9px 18px",fontSize:13,background:testResult?.passed?"#4ade80":undefined,color:testResult?.passed?"#07180f":undefined}}
            onClick={onTest}>{testResult ? "Retake Test" : "Start Test →"}</button>
        )}
      </div>

      <div style={{textAlign:"center"}}>
        <button style={S.btnGhost} onClick={onProgress}>View Progress →</button>
      </div>
    </div>
  );
}

// ─── Progress ─────────────────────────────────────────────────────────────────
function Progress({ profile, onBack }) {
  const lessons = [...(profile.completedLessons||[])].reverse();
  const meta = LVL[profile.level] || LVL.A2;
  const avg = lessons.length > 0 ? Math.round(lessons.reduce((a,l)=>a+l.score,0)/lessons.length) : 0;

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <div><div style={S.headerTitle}>Progress</div><div style={S.headerSub}>{profile.level} · {profile.xp||0} XP total</div></div>
      </div>
      <div style={{padding:"20px",maxWidth:660,margin:"0 auto",width:"100%"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:28}}>
          {[{n:profile.level,l:"Level",c:meta.color},{n:lessons.length,l:"Lessons"},{n:`${avg}%`,l:"Avg Score",c:avg>=80?"#4ade80":avg>=60?"#fbbf24":"#f87171"},{n:profile.xp||0,l:"Total XP",c:"#c4a35a"}].map(({n,l,c})=>(
            <div key={l} style={{background:"#0e0e1a",border:"1px solid #1e1e30",borderRadius:10,padding:"14px 10px",textAlign:"center"}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:22,color:c||"#c4a35a"}}>{n}</div>
              <div style={{fontSize:11,color:"#606080",marginTop:4}}>{l}</div>
            </div>
          ))}
        </div>

        {Object.keys(profile.levelTests||{}).length > 0 && (
          <>
            <div style={S.sectionLabel}>Level Tests</div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
              {Object.entries(profile.levelTests||{}).map(([lvl,t])=>(
                <div key={lvl} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#0e0e1a",border:"1px solid #1e1e30",borderRadius:10,padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:16}}>{t.passed?"🏆":"📋"}</span>
                    <div>
                      <div style={{fontSize:14,color:"#ddd8cc",fontWeight:500}}>{lvl} — {LVL[lvl]?.label}</div>
                      <div style={{fontSize:12,color:"#606080",marginTop:2}}>{new Date(t.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:18,color:t.passed?"#4ade80":"#f87171"}}>{t.score}/100</div>
                    <div style={{fontSize:11,color:t.passed?"#4ade80":"#f87171"}}>{t.passed?"Passed":"Not passed"}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {lessons.length === 0
          ? <div style={{textAlign:"center",color:"#606080",padding:"60px 20px",fontSize:15}}>Complete your first lesson to see history here!</div>
          : <>
            <div style={S.sectionLabel}>Lesson History</div>
            {lessons.map((l,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#0e0e1a",border:"1px solid #1e1e30",borderRadius:10,padding:"12px 16px",marginBottom:8}}>
                <div>
                  <div style={{fontSize:14,color:"#ddd8cc",fontWeight:500}}>{l.topic}</div>
                  <div style={{fontSize:12,color:"#606080",marginTop:2}}>{new Date(l.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:18,color:l.score>=80?"#4ade80":l.score>=60?"#fbbf24":"#f87171"}}>{l.score}%</div>
                  <div style={{fontSize:12,color:"#c4a35a"}}>+{l.xp} XP</div>
                </div>
              </div>
            ))}
          </>}
      </div>
    </div>
  );
}

const S = {
  header:{display:"flex",alignItems:"center",gap:14,padding:"14px 20px",borderBottom:"1px solid #1e1e30",background:"#0a0a14",flexShrink:0},
  headerTitle:{fontSize:16,fontWeight:600,color:"#f0ede8"},
  headerSub:{fontSize:12,color:"#606080"},
  backBtn:{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:14,padding:"4px 8px",fontFamily:"'DM Sans',sans-serif"},
  avatar:{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#c4a35a,#8a6030)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#07070f",flexShrink:0,marginTop:2},
  bubble:{maxWidth:"84%",padding:"11px 15px",borderRadius:12,fontSize:14},
  bubbleAI:{background:"#0d1220",border:"1px solid #1b2540",borderTopLeftRadius:4,color:"#d8d4cc"},
  bubbleUser:{background:"#160f24",border:"1px solid #281840",borderTopRightRadius:4,color:"#eeeae0",marginLeft:"auto"},
  bubbleErr:{background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.2)",borderTopLeftRadius:4,color:"#f87171"},
  btnPrimary:{background:"#c4a35a",color:"#07070f",border:"none",padding:"12px 26px",borderRadius:6,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"},
  btnGhost:{background:"transparent",color:"#888",border:"1px solid #2a2a40",padding:"10px 20px",borderRadius:6,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"},
  lvlCard:{background:"#0e0e1a",border:"1px solid #1e1e30",borderRadius:12,padding:"20px 16px",textAlign:"center",cursor:"pointer",transition:"all 0.15s",fontFamily:"'DM Sans',sans-serif"},
  sectionLabel:{fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:"#606080",fontWeight:600,marginBottom:10},
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("loading");
  const [profile, setProfile] = useState(null);
  const profileRef = useRef(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [topic, setTopic] = useState("");
  const [skill4, setSkill4] = useState("listening");
  const [lessonDone, setLessonDone] = useState(false);
  const [testDone, setTestDone] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const lessonDoneRef = useRef(false);
  const testDoneRef = useRef(false);
  const { toasts, show: showToast } = useToast();

  useEffect(() => { profileRef.current = profile; }, [profile]);

  useEffect(() => {
    loadProfile().then(p => {
      if (p) { setProfile(p); setView("dashboard"); }
      else setView("welcome");
    });
  }, []);

  async function persist(p) {
    setProfile(p); profileRef.current = p;
    const ok = await saveProfile(p);
    if (!ok) showToast("⚠️", "Save failed", "Progress may not persist");
  }

  // Assessment
  async function startAssessment() {
    setMsgs([]); setView("assessment"); setBusy(true);
    const reply = await ai([{role:"user",content:"Begin"}], ASSESSMENT_SYS);
    setMsgs([{role:"assistant",content:reply,isError:reply.startsWith("⚠️")}]);
    setBusy(false);
  }
  async function sendAssessment() {
    if (!input.trim() || busy) return;
    const um = {role:"user",content:input.trim()};
    const nm = [...msgs, um]; setMsgs(nm); setInput(""); setBusy(true);
    const reply = await ai(nm, ASSESSMENT_SYS);
    const all = [...nm, {role:"assistant",content:reply,isError:reply.startsWith("⚠️")}];
    setMsgs(all); setBusy(false);
    if (reply.includes("RESULT:")) {
      const r = parseTag(reply, "RESULT");
      if (r) {
        const lvl = r.level || "A2";
        const p = profileRef.current;
        const np = { level:lvl, weakAreas:(r.weakAreas||[]).slice(0,5), summary:r.summary||"", xp:p?.xp||0, completedLessons:p?.completedLessons||[], levelTests:p?.levelTests||{}, joinDate:p?.joinDate||new Date().toISOString() };
        await new Promise(res => setTimeout(res, 2200));
        await persist(np);
        showToast(LVL_ICONS[LVL_ORDER.indexOf(lvl)], `Level ${lvl} detected!`, r.summary?.slice(0,50)||"");
        setView("dashboard");
      }
    }
  }

  // Manual level selection
  function selectLevel(lvl) {
    const np = { level:lvl, weakAreas:[], summary:"Level set manually.", xp:0, completedLessons:[], levelTests:{}, joinDate:new Date().toISOString() };
    persist(np);
    showToast(LVL_ICONS[LVL_ORDER.indexOf(lvl)], `Level ${lvl} selected`, LVL[lvl]?.label||"");
    setView("dashboard");
  }
  function changeLevel(lvl) {
    const p = profileRef.current;
    persist({ ...p, level: lvl });
    showToast(LVL_ICONS[LVL_ORDER.indexOf(lvl)], `Switched to ${lvl}`, LVL[lvl]?.label||"");
    setView("dashboard");
  }
  function requestReassess() {
    setConfirm({ msg:"Starting a new assessment will reset your level and focus areas. XP and lesson history are kept.", onConfirm:()=>{ setConfirm(null); startAssessment(); } });
  }

  // Lesson
  async function startLesson(t) {
    const p = profileRef.current;
    const completedCount = (p.completedLessons||[]).length;
    const s4 = completedCount % 2 === 0 ? "listening" : "speaking";
    lessonDoneRef.current = false;
    setTopic(t); setSkill4(s4); setMsgs([]); setLessonDone(false); setInput("");
    setView("lesson"); setBusy(true);
    const reply = await ai([{role:"user",content:"Begin the lesson please."}], lessonSys(p, t, s4));
    setMsgs([{role:"assistant",content:reply,isError:reply.startsWith("⚠️")}]);
    setBusy(false);
  }
  async function sendLesson() {
    if (!input.trim() || busy) return;
    const p = profileRef.current;
    const um = {role:"user",content:input.trim()};
    const nm = [...msgs, um]; setMsgs(nm); setInput(""); setBusy(true);
    const reply = await ai(nm, lessonSys(p, topic, skill4));
    const all = [...nm, {role:"assistant",content:reply,isError:reply.startsWith("⚠️")}];
    setMsgs(all); setBusy(false);
    if (reply.includes("LESSON_DONE:") && !lessonDoneRef.current) {
      const r = parseTag(reply, "LESSON_DONE");
      if (r) {
        lessonDoneRef.current = true;
        const xpGain = Math.max(5, r.xp || 20);
        const score = Math.min(100, Math.max(0, r.score || 70));
        const up = {
          ...p, xp:(p.xp||0)+xpGain,
          completedLessons:[...(p.completedLessons||[]).filter(l=>l.topic!==topic), {topic,date:new Date().toISOString(),score,xp:xpGain}],
          weakAreas:[...new Set([...(p.weakAreas||[]),...((r.weakAreas||[]).filter(Boolean))])].slice(0,5),
        };
        await persist(up);
        setLessonDone(true);
        showToast("✨", `+${xpGain} XP earned!`, `Score: ${score}%`);
      }
    }
  }

  // Test
  async function startTest() {
    const p = profileRef.current;
    testDoneRef.current = false;
    setMsgs([]); setTestDone(false); setTestResult(null); setInput("");
    setView("test"); setBusy(true);
    const reply = await ai([{role:"user",content:"Begin the test please."}], testSys(p));
    setMsgs([{role:"assistant",content:reply,isError:reply.startsWith("⚠️")}]);
    setBusy(false);
  }
  async function sendTest() {
    if (!input.trim() || busy) return;
    const p = profileRef.current;
    const um = {role:"user",content:input.trim()};
    const nm = [...msgs, um]; setMsgs(nm); setInput(""); setBusy(true);
    const reply = await ai(nm, testSys(p));
    const all = [...nm, {role:"assistant",content:reply,isError:reply.startsWith("⚠️")}];
    setMsgs(all); setBusy(false);
    if (reply.includes("TEST_DONE:") && !testDoneRef.current) {
      const r = parseTag(reply, "TEST_DONE");
      if (r) {
        testDoneRef.current = true;
        const score = Math.min(100, Math.max(0, r.score || 0));
        const passed = score >= PASS_MARK;
        const result = { score, passed, breakdown:r.breakdown||{}, feedback:r.feedback||"", date:new Date().toISOString() };
        const up = { ...p, levelTests:{ ...(p.levelTests||{}), [p.level]: result } };
        await persist(up);
        setTestResult(result);
        setTestDone(true);
        showToast(passed?"🏆":"📋", passed?"Level passed!":"Keep practising", `${score}/100`);
      }
    }
  }
  function finishTest() {
    if (testResult) setView("testresults");
    else setView("dashboard");
  }
  function handleNextLevel(lvl) {
    const p = profileRef.current;
    persist({ ...p, level: lvl });
    showToast(LVL_ICONS[LVL_ORDER.indexOf(lvl)], `Starting ${lvl}!`, LVL[lvl]?.label||"");
    setView("dashboard");
  }

  if (view === "loading") return (
    <div style={{minHeight:"100vh",background:"#07070f",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{FONTS}</style>
      <span style={{color:"#c4a35a",fontFamily:"'DM Sans',sans-serif"}}>Laden…</span>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#07070f",color:"#e0dcd4",fontFamily:"'DM Sans',sans-serif",fontSize:15,lineHeight:1.5}}>
      <style>{FONTS}</style>
      <style>{`
        @keyframes dot{0%,60%,100%{opacity:.3;transform:scale(.7)}30%{opacity:1;transform:scale(1)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
        @keyframes toastOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(40px)}}
      `}</style>
      <Toast toasts={toasts} />
      {confirm && <ConfirmModal msg={confirm.msg} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)} />}

      {view==="welcome"    && <Welcome onStart={startAssessment} onManual={()=>setView("manual")} />}
      {view==="manual"     && <LevelSelect onSelect={selectLevel} onBack={()=>setView("welcome")} />}
      {view==="levels"     && <LevelSelect onSelect={changeLevel} onBack={()=>setView("dashboard")} mode="browse" />}
      {view==="assessment" && <Chat title="Level Assessment" sub="6 questions to find your German level" msgs={msgs} input={input} busy={busy} setInput={setInput} onSend={sendAssessment} onBack={()=>setView("welcome")} skill4="speaking" />}
      {view==="dashboard"  && profile && <Dashboard profile={profile} onLesson={startLesson} onProgress={()=>setView("progress")} onReassess={requestReassess} onChangeLevel={()=>setView("levels")} onTest={startTest} />}
      {view==="lesson"     && <Chat title={topic} sub={`${profile?.level} Lesson · Professor Weber`} msgs={msgs} input={input} busy={busy} setInput={setInput} onSend={sendLesson} onBack={()=>setView("dashboard")} done={lessonDone} onFinish={()=>setView("dashboard")} skill4={skill4} />}
      {view==="test"       && <Chat title={`${profile?.level} Level Test`} sub="Official end-of-level assessment · All 4 skills" msgs={msgs} input={input} busy={busy} setInput={setInput} onSend={sendTest} onBack={()=>setView("dashboard")} done={testDone} onFinish={finishTest} skill4="speaking" isTest />}
      {view==="testresults"&& testResult && profile && <TestResults result={testResult} level={profile.level} onBack={()=>setView("dashboard")} onNextLevel={handleNextLevel} />}
      {view==="progress"   && profile && <Progress profile={profile} onBack={()=>setView("dashboard")} />}
    </div>
  );
}
