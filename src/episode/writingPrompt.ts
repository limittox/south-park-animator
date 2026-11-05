/*
 * A prompt people paste into their own AI chat (ChatGPT, Claude, Gemini…) to write a script
 * in the shape this app reads best, then paste the result back. Everything it promises
 * (place names, action words, acting notes) is something the parser or the director understands.
 */

/** Places with hand-drawn sets, worded the way a script heading would name them. */
export const PROMPT_PLACES = [
  'bus stop',
  'classroom',
  'school cafeteria',
  'living room',
  'frozen pond',
  'town welcome sign',
  'main street',
  'campfire',
  'TV news studio',
  'photo studio',
  'outer space',
  'heaven',
  'hell',
];

export const PROMPT_EXAMPLE = `TITLE: The Lemonade Loophole

EXT. MAIN STREET - DAY
Gus, a bossy nine-year-old in a red beanie, sits behind a lemonade stand. Officer Plunkett, a jumpy cop with a huge mustache, looms over him.

OFFICER PLUNKETT: (nervous) Son, do you have a permit for that lemonade?
GUS: (smug) It's not lemonade, officer. It's artisanal citrus water.
OFFICER PLUNKETT: Oh. Well, that's completely different.
TILLY (O.S.): (yelling) Gus! Mom says you used all the sugar!
Gus jumps.
GUS: (shocked) Don't touch the water. I'll be right back.
Gus exits.`;

export interface PromptContext {
  /** Names of characters the user already designed in the Character Creator. */
  crew?: string[];
  /** The script so far, if there is one worth continuing. */
  draft?: string;
}

export function scriptWritingPrompt({ crew = [], draft = '' }: PromptContext = {}): string {
  const hasDraft = !!draft.trim();
  const start = hasDraft
    ? 'Read my draft at the end of this message, tell me in a few sentences what works and what could be funnier, then ask what I want to change.'
    : "Ask me what the episode is about, who's in it and roughly how long it should be. Then pitch the premise in a few sentences before writing anything.";
  const sections = [
    `You're helping me write a script for Paper Town Studios, an app that turns a script into a cartoon made of flat construction-paper cut-outs: crude, satirical comedy about smart-mouthed nine-year-old kids and clueless grown-ups in a small, snowy mountain town. The app's AI director designs the characters, builds the sets, voices every line with text-to-speech and animates it, so the script is all it gets.`,

    `HOW WE'LL WORK
1. ${start}
2. Write the script in the format below, and revise it with me as often as I like.
3. When I say it's done, reply with only the final script inside one plain-text code block, so I can paste it straight into the app.`,

    `FORMAT (the app reads it line by line, so follow it exactly)
- The first line is the title: TITLE: <episode title>
- Every scene starts with a heading: INT. or EXT., the place, then the time of day (DAY, MORNING, DUSK or NIGHT), like "EXT. BUS STOP - MORNING" or "INT. GROCERY STORE - NIGHT".
- These places have hand-drawn sets, so use these names when they fit: ${PROMPT_PLACES.join(', ')}. Any other place is built from paper set pieces (a store, a hospital, a police station, a school hallway, a kitchen, a bedroom, a street of houses…), so just name it plainly.
- Under each heading, one line of stage direction says who is there and what the place looks like. The first time a character appears, describe them in a few words (age, look, personality), like "Mr. Hargrove, a tired teacher in a sweater vest, stands at the chalkboard."
- Dialogue is one line per speech: NAME: what they say
- Acting notes go in brackets right after the colon: BENNY: (whispering) Psst. Over here.
- A voice from off screen: PRIYA (O.S.): Dex! Dinner!
- Spell every name exactly the same way every time.
- Stage directions go on their own line, in the present tense, one action per sentence, naming who does it. The app animates these words: enters, walks in, arrives, leaves, exits, storms off, runs in, runs off, faints, collapses, jumps, bounces up and down, dances, shakes, trembles, spins, waves, points, shrugs, looks at, glances at, sneaks in, tiptoes, creeps, walks up to, hugs, cries, sweats, vomits, covers his ears, crosses her arms, puts her hands on her hips. People can sit (on the couch, at the table, at their desks, on a bench, on the floor), lie down (on the couch, on the bed, on the floor) and stand up. They can pick up, eat, drink, read or hold a prop (a phone, money, a gift, a letter, a soda, a snowball, a book, a TV remote…), hand it to someone ("Gus hands the money to Tilly.") or throw it ("Gus throws a snowball at Tilly."). Several people can act at once: "Gus and Tilly dance." They can drive up in a car or a police car, get in, get out and drive off, and the school bus can pull up. These make sounds: explodes, farts, slaps, crashes, doorbell rings. "It starts snowing." makes it snow. A caption reads "Three hours later." puts words on screen.
- Scenes change with a hard cut. For something softer, put FADE OUT. or DISSOLVE TO: on its own line between two scenes.
- Leave ordinary camera work to the app, but when a joke needs a particular shot, a stage direction can ask for it: "Close on Gus.", "Zoom in on Gus.", "The camera pans to Tilly.", "The camera follows Gus.", "The camera pulls back."
- Acting notes also set the character's face: angry, yelling, screaming, sad, crying (with tears), shocked, scared, nervous (with sweat), excited, happy, sarcastic, smug, evil, scheming, deadpan, bored, sick, dreamy, in love, hysterical. A line in ALL CAPS with an exclamation mark is screamed.`,

    `WRITING TIPS
- A text-to-speech voice reads every line aloud, so write words exactly as they're spoken: no emoji, no markdown, no *asterisk actions*, no sound effects inside dialogue.
- Keep speeches short, one or two sentences. Quick back-and-forth plays best.
- Five or six characters per scene at most; they all share one small stage.
- Two to five scenes. About 15 lines of dialogue make 30 to 60 seconds of cartoon.
- The main characters are usually nine-year-old kids. Grown-ups are teachers, parents, cashiers, cops, news anchors and the like.
- Comedy that works here: a dumb idea taken completely seriously, escalating absurdity, deadpan reactions, a twist at the end, and an over-earnest lesson that misses the point.
- Every character must be original. Don't use characters, names or catchphrases from any existing TV show.
- Skip music cues. The app's director handles those.`,

    crew.length ? `MY CHARACTERS\nI've already designed these characters. Use them when they fit, spelled exactly like this: ${crew.join(', ')}.` : '',

    `EXAMPLE OF THE FORMAT\n${PROMPT_EXAMPLE}`,

    hasDraft ? `MY DRAFT\n${draft.trim()}` : '',
  ];
  return sections.filter(Boolean).join('\n\n');
}
