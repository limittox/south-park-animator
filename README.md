# Paper Town Studios

Paste a script, get a construction-paper cartoon. An AI director reads your script, designs and casts the characters, builds the sets, voices every line and animates each scene in the flat cut-out style of the [Paper Town Character Creator](https://limittox.github.io/south-park-character-creator/). Then you edit by dragging things around, changing beats, or telling the chat what to change, and export an MP4.

**Try it: https://limittox.github.io/south-park-animator/**

Everything runs in the browser. Your OpenRouter key is stored only in your browser and is sent only to OpenRouter.

## What it does

**Script → episode**
- Any script format: `NAME: line`, screenplay layout, loose prose. Scene headings (`INT. CLASSROOM - DAY`) choose the set; parentheticals (`(whispering)`) become acting directions; stage directions become entrances, exits, faints, sound effects and so on.
- Two LLM calls run in parallel: a **casting director** designs every character from the creator's ~300 paper parts and picks a voice, and a **storyboard director** turns each scene into beats with blocking, moods, gestures, camera cuts and comic pauses.
- Characters you made in the Character Creator can play themselves: import your crew file or paste share links, and any script name that matches gets their look.
- **Writing with your own AI?** *Copy AI prompt* copies instructions for ChatGPT, Claude, Gemini or any other chat: the script format the app reads best, the places with hand-drawn sets, the action and acting words it animates, comedy tips and an example. Your crew names and current draft go along. Paste the finished script back in; code fences are stripped automatically.
- **No key?** *Quick build* parses the script by itself and gives everyone a stand-in look. Stand-in voices come from your browser's speech engine (exported videos are silent then).

**Voices**
- OpenRouter's speech endpoint (default: Gemini 3.8 Flash TTS, 30 voices). Each line goes out with the character's standing acting note plus the line's own delivery, in whatever form the model understands (`instructions` for Gemini, OpenAI and Fish Audio, `[tags]` for ElevenLabs and Grok). Each model is asked for audio in a format it returns (raw PCM for Gemini, MP3 otherwise).
- Kids get the show's treatment: grown-up voices pitched up. A WSOLA time-stretch plus resample keeps their speaking speed natural.
- Mouths are lip-synced to the audio's loudness and snap between three shapes, cut-out style.
- Raw speech is cached in IndexedDB, so changing pitch or speed, or re-exporting, never re-bills you.

**Animation**
- One pure timeline (`src/episode/timeline.ts`) turns the episode into frames. The player and the exporter both sample it, so what you see is what you export.
- 24 frames a second with characters and props posed every second frame, the way the show is animated. Beats start on a pose, so lines, cuts and actions land the moment the picture changes; camera moves and fades run on every frame.
- Stop-motion hop walks, entrances and exits, blinks, a talking bob, 14 moods, 16 arm gestures (wave, point, facepalm, flail, cover ears…), jumps, spins, trembles and faints.
- Lip sync with seven mouth shapes plus closed lips. The words say which shape comes next and the audio says when, so pauses in the speech keep them lined up.
- Acting: dancing, crying with running tears, sweating, vomiting, eating and chewing, drinking, hugging, and lying down on couches, beds and floors. Several people can do the same thing at once.
- Running: faster, quicker hops, a forward lean and pumping arms. Sneaking: slow, crouched, hands up. Characters can also walk up to someone instead of to a spot.
- Sitting on couches, chairs, benches, beds, logs and the floor, or behind tables and desks (which are drawn again over the sitters). Grown-ups sink into the seat with their knees toward the camera; little kids are lifted onto it, legs dangling. Several people share a seat side by side.
- Props: 35 things to hold (phones, cash, gifts, love letters, sodas, snowballs, pickaxes, beers, swabs, microphones, butterfly nets…), picked up, put away, handed from one character to another mid-line, or thrown, flying in an arc to someone's head or out of shot.
- Vehicles: a car, a police car with flashing lights and the yellow school bus drive in and off, juddering on spinning wheels, with passengers showing through the windows. People get in and out; the bus can pull up in front of everyone.
- Listeners turn toward whoever is talking. Talkers face the person they address. Pupils move on their own: they point at whoever matters, wander in quiet moments, and a silent look is a side-eye with no head turn.
- Hard camera cuts between wide, medium and close-up shots framed from where people stand, plus pans between shots, shots that follow someone across the set, slow push-ins, screen shake and flashes.
- Scene changes are hard cuts, fades through black or dissolves.
- A title card, an original synthesized guitar sting for scene changes, synthesized sound effects (pop, boing, crash, thud, fart…), weather and captions.

**Sets**
- The 13 hand-drawn town locations from the creator's photo booth.
- Anything else is built from the **paper set-piece kit**: 69 pieces (doors, store shelves, checkouts, hospital beds, lockers, houses, shops, police stations, pines, cars, streetlights…), interior walls and floors in 6 and 5 styles, and exterior grounds and backdrops. All of it comes in day, dusk and night, with lit windows.

**Editing**
- Pause and drag characters on the stage. If a move brought them there, the move's target changes; otherwise their starting spot does. Click a character to set their face from that beat on, or flip them.
- In the Set tab, drag kit pieces around and change colours, text, size and the wall and floor styles.
- In the Beats tab, edit every line, speaker, delivery, face, gesture, camera shot, action, sound effect, caption, pause, prop and movement (walk or run, sit and stand, get in and out, drive).
- In the Set tab, add cars, police cars and buses to any scene.
- In the Cast tab: choose the voice, pitch, speed and acting note, and test the voice. Redesign a character by describing the change, randomise them, swap in a crew look, or open them in the Character Creator and paste the share link back.
- In the Chat tab, write feedback ("make the teacher angrier and cut to his face", "move this scene to a hospital at night") for the current scene or the whole episode. Every change can be undone.
- Undo and redo (Ctrl+Z / Ctrl+Y); episodes autosave to IndexedDB.

**Export**
- Frame-exact offline rendering to MP4 (H.264 + AAC, or VP9/Opus if those aren't available) with mediabunny and WebCodecs, at 720p or 1080p, with optional burned-in subtitles. It runs at about real time or faster while its tab is in front (browsers slow down background tabs). Each frame is rasterized to an `ImageBitmap` that's closed straight away, so memory stays flat however long the episode is. Cut-out animation holds its poses, so a frame identical to the one before isn't redrawn (about two frames in three).

## Running it

```bash
npm install
npm run dev        # http://localhost:5299
npm test           # unit tests (Vitest)
npm run build      # static site in dist/
```

Open Settings (⚙) and paste an [OpenRouter key](https://openrouter.ai/keys). The director model and the voice model can be any OpenRouter model; the lists load live with prices.

`kit-gallery.html` (served by `npm run dev`) shows every set piece by day and night, plus sample sets, and `parts-gallery.html` shows every character part on a kid and a grown-up, one category at a time (`?cat=hat`, `&body=kid,lanky`, `&bg=fff` to check pale parts against snow). They're handy when drawing new art.

If this site and the Character Creator are served from the same origin (as on `limittox.github.io`), *Use my creator crew* reads the creator's saved crew directly.

Every push to `main` runs the tests, builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`).

## How it's built

| Path | What's there |
| --- | --- |
| `src/episode/` | Episode types, the animation vocabulary, LLM-output repair (`normalize.ts`), the no-AI script parser, the timeline and camera, editing helpers |
| `src/ai/` | OpenRouter client (streamed JSON, speech, model list), prompts, the director (script → episode, chat edits, redesigns) |
| `src/audio/` | Speech requests and caching, voice DSP (pitch shift, trim, mouth envelope), synthesized sound effects and guitar sting, playback engine |
| `src/character/` | The creator's renderer and parts, plus `pose.ts` (arm gestures) and blinks |
| `src/sets/` | The paper set-piece kit |
| `src/scenes/` | The creator's hand-drawn town locations |
| `src/render/` | The frame renderer shared by player and exporter, and the MP4 exporter |
| `src/ui/` | Script screen, studio, stage player, panels, dialogs |

React + TypeScript + Vite, with no UI framework. The character art, palettes and town scenes are copied from the Character Creator.

## Disclaimer

An unofficial fan-made toy in the construction-paper cut-out style. All artwork, sounds and jokes are original, and the AI is told to design original characters rather than recreate any show's. Not affiliated with or endorsed by anyone who owns a certain quiet little mountain town.
