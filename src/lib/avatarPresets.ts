const SEEDS = [
  'Atlas', 'Nova', 'Ronin', 'Kai', 'Zephyr',
  'Orion', 'Drake', 'Sage', 'Vega', 'Jinx',
  'Rogue', 'Blaze', 'Echo', 'Frost', 'Knox',
];

const BG = 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf';

export const AVATAR_PRESETS: string[] = SEEDS.map(
  (seed) => `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${BG}`
);
