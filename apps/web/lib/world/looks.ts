import { Avatar, type AvatarOptions, type Outfit } from './avatar';

/**
 * Visitor looks for the chibi world: modest clothes suited to Mass, chosen by gender at entry.
 * Every person in the church (visitors and NPCs) is built from the same chibi Avatar, so they
 * share one style, one set of proportions and one set of gestures.
 */

export type Gender = 'female' | 'male';
export type Look = { id: string; gender: Gender; label: string; hint: string; outfit: Outfit; longHair?: boolean; hair?: string; iris?: string };

export const LOOKS: Look[] = [
  { id: 'f-white', gender: 'female', label: '흰 미사복', hint: '흰 원피스와 미사보', outfit: 'dress', longHair: true, iris: '#3c4f7a' },
  { id: 'f-skirt', gender: 'female', label: '블라우스 · 롱스커트', hint: '단정한 블라우스와 하늘색 치마', outfit: 'skirt', longHair: true },
  { id: 'f-nun', gender: 'female', label: '수녀 수도복', hint: '검은 베일과 흰 두건', outfit: 'nun' },
  { id: 'm-suit', gender: 'male', label: '정장', hint: '네이비 정장과 넥타이', outfit: 'suit' },
  { id: 'm-casual', gender: 'male', label: '니트 · 바지', hint: '단정한 니트와 바지', outfit: 'casual', longHair: false },
  { id: 'm-monk', gender: 'male', label: '수사 수도복', hint: '갈색 수도복과 띠', outfit: 'monk' },
];
export const lookById = (id: string) => LOOKS.find(l => l.id === id) ?? LOOKS[0];

/** Adult chibi height ≈ 1.4 m; children are smaller. */
export const ADULT = 0.8;
export const CHILD = 0.62;

export const makeChibi = (opts: Omit<AvatarOptions, 'chibi'> & { look?: Look }) => {
  const { look, ...rest } = opts;
  return new Avatar({
    chibi: true,
    scale: ADULT,
    outfit: look?.outfit,
    longHair: look?.longHair,
    hair: look?.hair,
    iris: look?.iris,
    ...rest,
  });
};
