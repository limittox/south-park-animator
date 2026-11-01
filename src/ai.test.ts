import { afterEach, describe, expect, it, vi } from 'vitest';
import { directScript, editWithChat } from './ai/director';
import { scenesSystem, editSystem, CAST_SYSTEM } from './ai/prompts';
import { voiceLine } from './audio/voices';
import { DEFAULT_SETTINGS } from './store/settings';
import { SAMPLE_SCRIPT } from './episode/parseScript';

/* OpenRouter is faked at the fetch level, so the real streaming parser, prompts and merging all run. */

function sse(text: string): Response {
  const chunks = text.match(/[\s\S]{1,40}/g) ?? [];
  const body = [': OPENROUTER PROCESSING', ...chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}`), 'data: [DONE]', ''].join('\n\n');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const CAST = {
  title: 'The Snow Day Scheme',
  cast: [
    { name: 'Benny', bio: 'gullible kid', look: { body: 'husky', hat: 'trapper', top: 'puffy', topColor: '#7fbf3f' }, voice: { voice: 'Fenrir', pitch: 5, tempo: 1.05, style: 'an excitable kid' } },
    { name: 'Dex', bio: 'deadpan kid', look: { body: 'kid', hat: 'beanie' }, voice: { voice: 'Puck', pitch: 4 } },
    { name: 'Mr. Hargrove', aliases: ['Hargrove'], look: { body: 'adult', hat: 'none' }, voice: { voice: 'Charon', pitch: 0 } },
  ],
};

const SCENES = {
  scenes: [
    {
      title: 'Bus Stop',
      set: { kind: 'preset', preset: 'busstop' },
      weather: 'snow',
      blocking: [
        { who: 'BENNY', x: 560, mood: 'happy' },
        { who: 'Dex', x: 1040, mood: 'deadpan' },
      ],
      beats: [
        { who: 'Benny', text: 'Dude, ice cubes!', gesture: 'explain', mood: 'joy' },
        { who: 'Dex', text: "That's dumb.", delivery: 'deadpan', pauseAfter: 0.8, shot: { type: 'close', on: ['Dex'] } },
      ],
    },
    {
      title: 'Grocery Store',
      set: { kind: 'kit', place: 'interior', time: 'night', wall: '#c9d98a', pieces: [{ type: 'store-shelf', x: 300 }, { type: 'checkout', x: 1000, front: true }, { type: 'unicorn', x: 3 }] },
      blocking: [{ who: 'Hargrove', x: 1000 }],
      beats: [{ who: 'Hargrove', text: 'Ninth cart of ice.', action: 'faint', sfx: 'thud' }],
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('AI director (faked OpenRouter)', () => {
  it('prompts mention the vocabulary, the kit and the originality rule', () => {
    expect(scenesSystem()).toContain('store-shelf');
    expect(scenesSystem()).toContain('busstop');
    expect(scenesSystem()).toContain('facepalm');
    expect(CAST_SYSTEM).toMatch(/never recreate another show's character designs/);
    expect(editSystem()).toContain('CHARACTER PARTS');
  });

  it('casts and storyboards in parallel and merges the answers', async () => {
    const calls: { url: string; body: { messages: { content: string }[] } }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/models')) return new Response(JSON.stringify({ data: [{ id: DEFAULT_SETTINGS.ttsModel, supported_voices: ['Puck', 'Fenrir', 'Charon'] }] }));
        const body = JSON.parse(String(init?.body));
        calls.push({ url, body });
        const system = body.messages[0].content as string;
        return sse(JSON.stringify(system.startsWith('You are the character designer') ? CAST : SCENES));
      }),
    );
    const progress: number[] = [];
    const ep = await directScript(SAMPLE_SCRIPT, { ...DEFAULT_SETTINGS, apiKey: 'test-key' }, [], (p) => progress.push(p.castChars + p.sceneChars));
    expect(calls).toHaveLength(2);
    expect(calls[0].body.messages[1].content).toContain('Snow Day Scheme');
    expect(progress.length).toBeGreaterThan(3);
    expect(ep.title).toBe('The Snow Day Scheme');
    expect(ep.cast.find((c) => c.id === 'benny')).toMatchObject({ look: { body: 'husky', hat: 'trapper', topColor: '#7fbf3f' }, voice: { voice: 'Fenrir', pitch: 5 } });
    const [s1, s2] = ep.scenes;
    expect(s1.blocking.map((b) => b.who)).toEqual(['benny', 'dex']);
    expect(s1.beats[1]).toMatchObject({ who: 'dex', shot: { type: 'close', on: ['dex'] }, pauseAfter: 0.8 });
    expect(s2.set.kind).toBe('kit');
    if (s2.set.kind === 'kit') expect(s2.set.pieces.map((p) => p.type)).toEqual(['store-shelf', 'checkout']);
    expect(s2.beats[0]).toMatchObject({ who: 'mr-hargrove', action: 'faint', sfx: 'thud' });
  });

  it('applies chat feedback to one scene', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/models')) return new Response(JSON.stringify({ data: [] }));
        return sse(JSON.stringify(SCENES));
      }),
    );
    const settings = { ...DEFAULT_SETTINGS, apiKey: 'k' };
    const ep = await directScript(SAMPLE_SCRIPT, settings, []);
    const original = ep.scenes[0];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/models')) return new Response(JSON.stringify({ data: [] }));
        return sse('Here you go:\n```json\n' + JSON.stringify({ reply: 'Dex now facepalms.', scene: { ...original, beats: original.beats.map((b) => (b.who === 'dex' ? { ...b, gesture: 'facepalm' } : b)) } }) + '\n```');
      }),
    );
    const res = await editWithChat({ episode: ep, sceneIndex: 0, request: 'Dex should facepalm', history: [], settings });
    expect(res.reply).toBe('Dex now facepalms.');
    expect(res.episode.scenes[0].beats.find((b) => b.who === 'dex')?.gesture).toBe('facepalm');
    expect(res.episode.scenes[0].beats.map((b) => b.id)).toEqual(original.beats.map((b) => b.id));
    expect(res.episode.scenes[1]).toBe(ep.scenes[1]);
  });

  it('reports a rejected key clearly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'No auth' } }), { status: 401 })));
    await expect(directScript('A: hi', { ...DEFAULT_SETTINGS, apiKey: 'bad' }, [])).rejects.toThrow(/rejected the API key/);
  });
});

describe('voice pipeline (faked speech endpoint)', () => {
  it('requests speech with direction, then pitches it up and builds a mouth track', async () => {
    const sr = 24000;
    const pcm = new Int16Array(sr); // 1 s: silence, a 0.6 s tone, silence
    for (let i = 0.2 * sr; i < 0.8 * sr; i++) pcm[i] = Math.round(Math.sin((2 * Math.PI * 180 * i) / sr) * 12000);
    let sent: Record<string, unknown> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        sent = JSON.parse(String(init?.body));
        // Like the real endpoint: Gemini only returns pcm and rejects mp3.
        if (sent.response_format !== 'pcm') return new Response(JSON.stringify({ error: { message: 'Gemini TTS only supports response_format pcm' } }), { status: 400 });
        return new Response(pcm.buffer, { headers: { 'content-type': 'audio/pcm' } });
      }),
    );
    const member = { id: 'benny', name: 'Benny', aliases: [], bio: '', look: {} as never, voice: { voice: 'Fenrir', pitch: 5, tempo: 1, style: 'an excitable kid' } };
    const line = await voiceLine('k', 'google/gemini-3.8-flash-tts', member, { id: 'b1', text: 'Dude!', delivery: 'yelling' });
    expect(sent).toMatchObject({ model: 'google/gemini-3.8-flash-tts', voice: 'Fenrir', input: 'Dude!', response_format: 'pcm', instructions: expect.stringMatching(/excitable kid.*yelling/) });
    // Silence trimmed (≈0.6 s of sound left), tempo kept despite the pitch shift.
    expect(line.clip.duration).toBeGreaterThan(0.55);
    expect(line.clip.duration).toBeLessThan(0.75);
    expect(Math.max(...line.clip.env)).toBeGreaterThan(0.8);
  });

  it('retries in the other format when a model rejects the first one', async () => {
    const formats: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        formats.push(body.response_format);
        if (body.response_format === 'mp3') return new Response(JSON.stringify({ error: { message: 'This model only returns pcm' } }), { status: 400 });
        return new Response(new Int16Array(4800).fill(8000).buffer, { headers: { 'content-type': 'audio/pcm' } });
      }),
    );
    const member = { id: 'a', name: 'A', aliases: [], bio: '', look: {} as never, voice: { voice: 'v1', pitch: 0, tempo: 1, style: '' } };
    await voiceLine('k', 'someone/new-tts', member, { id: 'b1', text: 'Hi.' });
    expect(formats).toEqual(['mp3', 'pcm']);
  });
});
