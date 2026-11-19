import {
  PenTool, Dumbbell, Brain, BookOpen, Flame, Heart, Sun, Moon, Leaf, Zap, Music, Code, Coffee,
  Compass, Shield, Swords, Gem, Target, Palette, Wallet,
  Check, Plus, Trash2, Archive, ArchiveRestore, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Pencil, Gift, Lock, CalendarDays, User, SlidersHorizontal, Download, Upload, X, ExternalLink,
  Shuffle, Star, Snowflake, ListChecks, Package, RotateCcw,
} from 'lucide';

const ALL = {
  'pen-tool': PenTool, dumbbell: Dumbbell, brain: Brain, 'book-open': BookOpen, flame: Flame, heart: Heart,
  sun: Sun, moon: Moon, leaf: Leaf, zap: Zap, music: Music, code: Code, coffee: Coffee, compass: Compass,
  shield: Shield, swords: Swords, gem: Gem, target: Target, palette: Palette, wallet: Wallet,
  check: Check, plus: Plus, trash: Trash2, archive: Archive, restore: ArchiveRestore,
  up: ChevronUp, down: ChevronDown, left: ChevronLeft, right: ChevronRight, edit: Pencil, gift: Gift,
  lock: Lock, calendar: CalendarDays, user: User, sliders: SlidersHorizontal, download: Download,
  upload: Upload, x: X, link: ExternalLink, shuffle: Shuffle, star: Star, snow: Snowflake,
  list: ListChecks, package: Package, reset: RotateCcw,
};

/** Icons a value can use. */
export const VALUE_ICONS = [
  'pen-tool', 'dumbbell', 'brain', 'book-open', 'flame', 'heart', 'sun', 'moon', 'leaf', 'zap',
  'music', 'code', 'coffee', 'compass', 'shield', 'swords', 'gem', 'target', 'palette', 'wallet',
];

export function icon(name, size = 18) {
  const node = ALL[name] || ALL.star;
  const inner = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
