export interface Swatch {
  color: string;
  name: string;
  quip?: string;
}

export const SKIN_TONES: Swatch[] = [
  { color: '#fdebdd', name: 'Porcelain', quip: 'Has never once seen the sun. The sun has heard rumours.' },
  { color: '#fcd9b8', name: 'Classic Paper', quip: 'The official colour of construction paper everywhere.' },
  { color: '#f4c7a1', name: 'Rosy Peach', quip: 'Blushes when anyone says "hi".' },
  { color: '#e8b48a', name: 'Sandstone', quip: 'Warm, friendly, slightly sandy after recess.' },
  { color: '#d9a066', name: 'Golden', quip: 'Glows like a fresh-baked tater tot.' },
  { color: '#c68a56', name: 'Amber', quip: 'Looks great in every school photo. Even the bad ones.' },
  { color: '#a86b3c', name: 'Bronze', quip: 'Third place? No. First place in looking good.' },
  { color: '#8a5530', name: 'Mahogany', quip: 'Rich, classy, probably owns a nice desk.' },
  { color: '#6b3e22', name: 'Umber', quip: 'Deep, warm and effortlessly cool.' },
  { color: '#4e2c17', name: 'Ebony', quip: 'Looks like a million bucks. Has four.' },
  { color: '#f59b4c', name: 'Spray Tan', quip: 'Went to the tanning salon. The tanning salon won.' },
  { color: '#f08a7e', name: 'Sunburnt Tourist', quip: 'Forgot sunscreen on a ski trip. Ouch.' },
  { color: '#9ec9f0', name: 'Hypothermia Blue', quip: 'Wore shorts in a blizzard. Regrets nothing.' },
  { color: '#9bd36a', name: 'Visitor Green', quip: 'Definitely not an alien. Please stop probing.' },
  { color: '#b9c2a6', name: 'Zombie Gray', quip: 'Mostly harmless. Wants braaains. Settles for nachos.' },
  { color: '#c9a7e8', name: 'Grape Soda', quip: 'Fell into a vat of grape soda. Doesn\'t want to talk about it.' },
];

export const HAIR_COLORS: Swatch[] = [
  { color: '#1e1a1a', name: 'Jet Black' },
  { color: '#3d2314', name: 'Dark Brown' },
  { color: '#6e4224', name: 'Brown' },
  { color: '#a5713d', name: 'Light Brown' },
  { color: '#e9c766', name: 'Blonde' },
  { color: '#f4ecc8', name: 'Platinum' },
  { color: '#d2622a', name: 'Ginger', quip: 'Day-walker. Burns in 4 minutes flat.' },
  { color: '#8e3b1f', name: 'Auburn' },
  { color: '#9a9a9a', name: 'Gray' },
  { color: '#eeeeee', name: 'White' },
  { color: '#3b7dd8', name: 'Blue' },
  { color: '#f27bb4', name: 'Bubblegum' },
  { color: '#4cb050', name: 'Slime Green' },
  { color: '#8b5cc7', name: 'Purple' },
  { color: '#e5322d', name: 'Fire Red' },
  { color: '#2ec4c4', name: 'Teal' },
];

/** Construction-paper colours for clothes, hats and accessories. */
export const CLOTH_COLORS: string[] = [
  '#d33b2c', // red
  '#f0742a', // orange
  '#f2c230', // yellow
  '#7fbf3f', // lime
  '#2e8b47', // green
  '#2ec4c4', // teal
  '#5aaeea', // sky
  '#3b6fd8', // blue
  '#26367a', // navy
  '#8b5cc7', // purple
  '#e86fb0', // pink
  '#7a4a2a', // brown
  '#c9a77a', // khaki
  '#ffffff', // white
  '#b8b8b8', // gray
  '#55555a', // charcoal
  '#1f1f22', // black
  '#8a1f2b', // maroon
];
