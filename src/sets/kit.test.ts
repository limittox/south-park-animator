import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, Fragment } from 'react';
import type { KitSet } from '../episode/types';
import { defaultKitSet, KIT_PIECES, kitCatalogForPrompt, kitGroundY, normalizeKitSet, pieceBounds, pieceType, renderKitSet, resolvePiece, wrapWords } from './kit';

const markup = (set: KitSet) => {
  const { back, front } = renderKitSet(set);
  return renderToStaticMarkup(createElement('svg', null, createElement(Fragment, null, back, front)));
};

describe('paper set kit', () => {
  it('has unique piece ids', () => {
    const ids = KIT_PIECES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(45);
  });

  it('renders every piece in every light, indoors and out, flipped and with text', () => {
    for (const place of ['interior', 'exterior'] as const) {
      for (const time of ['day', 'dusk', 'night'] as const) {
        const set: KitSet = {
          ...defaultKitSet(place),
          time,
          pieces: KIT_PIECES.map((d, i) => ({ id: `p${i}`, type: d.id, x: 100 + i * 20, text: 'Hello there town', flip: i % 2 === 0, front: i % 5 === 0 })),
        };
        const html = markup(set);
        expect(html).toContain('<svg');
        expect(html.length).toBeGreaterThan(1000);
      }
    }
  });

  it('renders every wall, floor, ground and backdrop style', () => {
    for (const wallStyle of ['plain', 'stripes', 'panels', 'brick', 'tiles', 'wainscot'] as const)
      for (const floorStyle of ['plain', 'boards', 'tiles', 'carpet', 'checker'] as const) markup({ ...defaultKitSet('interior'), wallStyle, floorStyle });
    for (const ground of ['snow', 'grass', 'road', 'sidewalk', 'dirt', 'sand'] as const)
      for (const backdrop of ['mountains', 'town', 'forest', 'city', 'none'] as const) markup({ ...defaultKitSet('exterior'), ground, backdrop, time: 'night' });
  });

  it('repairs garbage from the LLM', () => {
    expect(normalizeKitSet(null).kind).toBe('kit');
    expect(normalizeKitSet('nonsense').place).toBe('interior');
    const set = normalizeKitSet({
      place: 'EXTERIOR',
      time: 'midnight',
      wall: 'red',
      floorStyle: 'lava',
      ground: 'road',
      sky: '#123',
      pieces: [
        { type: 'Pine Tree', x: 99999, y: -50, scale: 40, color: 'green' },
        { type: 'spaceship', x: 100 },
        { type: 'street_light', x: '420', color: '#ABCDEF', text: 42 },
        'not a piece',
        { type: 'shop', id: 'dup', x: 300, text: '  ' + 'X'.repeat(200) },
        { type: 'shop', id: 'dup', x: 600, front: 'yes' },
        { type: 'house' },
      ],
    });
    expect(set.place).toBe('exterior');
    expect(set.time).toBe('day');
    expect(set.wall).toMatch(/^#[0-9a-f]{6}$/);
    expect(set.floorStyle).toBe('plain');
    expect(set.ground).toBe('road');
    expect(set.sky).toBe('#123');
    expect(set.pieces.map((p) => p.type)).toEqual(['pine', 'streetlight', 'shop', 'shop', 'house']);
    const [tree, lamp, shopA, shopB, house] = set.pieces;
    expect(tree.x).toBeLessThanOrEqual(1900);
    expect(tree.y).toBe(0);
    expect(tree.scale).toBe(4);
    expect(tree.color).toBeUndefined();
    expect(lamp.x).toBe(420);
    expect(lamp.color).toBe('#abcdef');
    expect(lamp.text).toBeUndefined();
    expect(shopA.text?.length).toBe(80);
    expect(shopA.id).not.toBe(shopB.id);
    expect(shopB.front).toBeUndefined();
    expect(house.x).toBe(800);
    expect(new Set(set.pieces.map((p) => p.id)).size).toBe(set.pieces.length);
    markup(set);
  });

  it('keeps defaults when pieces are missing, empties them when given an empty list', () => {
    expect(normalizeKitSet({ place: 'interior' }).pieces.length).toBeGreaterThan(0);
    expect(normalizeKitSet({ place: 'interior', pieces: [] }).pieces).toEqual([]);
  });

  it('resolves piece aliases', () => {
    expect(pieceType('Sofa')).toBe('couch');
    expect(pieceType('lockers')).toBe('lockers');
    expect(pieceType('benches')).toBe('bench');
    expect(pieceType('moon')).toBe('sun-moon');
    expect(pieceType('dragon')).toBeUndefined();
  });

  it('resolves pieces and their bounds the same way the renderer does', () => {
    const set = defaultKitSet('interior');
    const door = resolvePiece(set, { id: 'd', type: 'door', x: 300 });
    expect(door.y).toBe(652);
    expect(door.color).toBe('#8a5a32');
    expect(door.scale).toBe(1);
    expect(resolvePiece(set, { id: 'c', type: 'counter', x: 800, front: true }).y).toBe(1000);
    expect(resolvePiece(set, { id: 'w', type: 'window', x: 800 }).y).toBe(470);
    expect(pieceBounds(set, { id: 'd', type: 'door', x: 300, scale: 2 })).toEqual({ x: 300 - 224, y: 652 - 904, w: 448, h: 904 });
    const outside = defaultKitSet('exterior');
    expect(resolvePiece(outside, { id: 'h', type: 'house', x: 500 }).y).toBe(720);
    expect(pieceBounds(outside, { id: 'x', type: 'not-a-piece', x: 100 })).toEqual({ x: 0, y: 520, w: 200, h: 200 });
  });

  it('puts feet on the ground', () => {
    expect(kitGroundY(defaultKitSet('interior'))).toBe(930);
    expect(kitGroundY({ ...defaultKitSet('exterior'), ground: 'road' })).toBe(945);
  });

  it('describes every piece for the prompt', () => {
    const text = kitCatalogForPrompt();
    for (const p of KIT_PIECES) expect(text).toContain(`- ${p.id} (`);
  });

  it('wraps words', () => {
    expect(wrapWords('THE QUICK BROWN FOX JUMPS', 10)).toEqual(['THE QUICK', 'BROWN FOX', 'JUMPS']);
    expect(wrapWords('a b c d e f g h', 1, 2)).toEqual(['a', 'b…']);
  });
});
