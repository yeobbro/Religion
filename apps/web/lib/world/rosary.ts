/**
 * The rosary as prayed in Korean parishes, step by step: the Apostles' Creed on the crucifix,
 * the Our Father and three Hail Marys on the pendant, then five decades (Our Father, ten Hail
 * Marys, Glory Be with the Fatima prayer), closing with the Salve Regina.
 * Only the names of the prayers and mysteries are shown, not their texts.
 */

export type MysterySet = { id: 'joyful' | 'luminous' | 'sorrowful' | 'glorious'; name: string; days: string; mysteries: string[] };

export const MYSTERIES: MysterySet[] = [
  {
    id: 'joyful', name: '환희의 신비', days: '월·토',
    mysteries: [
      '마리아께서 예수님을 잉태하심을 묵상합시다',
      '마리아께서 엘리사벳을 찾아보심을 묵상합시다',
      '마리아께서 예수님을 낳으심을 묵상합시다',
      '마리아께서 예수님을 성전에 바치심을 묵상합시다',
      '마리아께서 잃으셨던 예수님을 성전에서 찾으심을 묵상합시다',
    ],
  },
  {
    id: 'luminous', name: '빛의 신비', days: '목',
    mysteries: [
      '예수님께서 세례받으심을 묵상합시다',
      '예수님께서 카나에서 첫 기적을 행하심을 묵상합시다',
      '예수님께서 하느님 나라를 선포하심을 묵상합시다',
      '예수님께서 거룩하게 변모하심을 묵상합시다',
      '예수님께서 성체성사를 세우심을 묵상합시다',
    ],
  },
  {
    id: 'sorrowful', name: '고통의 신비', days: '화·금',
    mysteries: [
      '예수님께서 우리를 위하여 피땀 흘리심을 묵상합시다',
      '예수님께서 우리를 위하여 매맞으심을 묵상합시다',
      '예수님께서 우리를 위하여 가시관 쓰심을 묵상합시다',
      '예수님께서 우리를 위하여 십자가 지심을 묵상합시다',
      '예수님께서 우리를 위하여 십자가에 못박혀 돌아가심을 묵상합시다',
    ],
  },
  {
    id: 'glorious', name: '영광의 신비', days: '수·일',
    mysteries: [
      '예수님께서 부활하심을 묵상합시다',
      '예수님께서 승천하심을 묵상합시다',
      '예수님께서 성령을 보내심을 묵상합시다',
      '예수님께서 마리아를 하늘에 불러올리심을 묵상합시다',
      '예수님께서 마리아께 천상 모후의 관을 씌우심을 묵상합시다',
    ],
  },
];

/** Mystery set customarily prayed on a given weekday (0 = Sunday). */
export const mysteryForDay = (day: number): MysterySet => {
  const id = (['glorious', 'joyful', 'sorrowful', 'glorious', 'luminous', 'sorrowful', 'joyful'] as const)[day];
  return MYSTERIES.find(m => m.id === id)!;
};

/**
 * Bead ids: 'cross', 'p0' (pendant large), 'p1'..'p3' (pendant small), 'medal',
 * 'L1'..'L5' (decade large beads), 'd{decade}-{n}' small beads (n 1..10).
 */
export type RosaryStep = { bead: string; prayer: string; decade: number; detail?: string };

export const rosarySteps = (set: MysterySet): RosaryStep[] => {
  const steps: RosaryStep[] = [
    { bead: 'cross', prayer: '성호경 · 사도신경', decade: 0 },
    { bead: 'p0', prayer: '주님의 기도', decade: 0 },
    { bead: 'p1', prayer: '성모송', decade: 0, detail: '믿음을 더하여 주소서' },
    { bead: 'p2', prayer: '성모송', decade: 0, detail: '희망을 북돋아 주소서' },
    { bead: 'p3', prayer: '성모송', decade: 0, detail: '사랑을 깊게 하여 주소서' },
    { bead: 'medal', prayer: '영광송', decade: 0 },
  ];
  for (let d = 1; d <= 5; d += 1) {
    steps.push({ bead: `L${d}`, prayer: '주님의 기도', decade: d, detail: `${set.name} ${d}단 · ${set.mysteries[d - 1]}` });
    for (let n = 1; n <= 10; n += 1) steps.push({ bead: `d${d}-${n}`, prayer: `성모송 ${n}/10`, decade: d, detail: set.mysteries[d - 1] });
    steps.push({ bead: d < 5 ? `L${d + 1}` : 'medal', prayer: '영광송 · 구원의 기도', decade: d, detail: `${d}단을 마칩니다` });
  }
  steps.push({ bead: 'medal', prayer: '성모 찬송 (살베 레지나)', decade: 5, detail: '묵주기도를 마칩니다' });
  return steps;
};

/** Bead positions for drawing: a loop of 55 beads with the pendant hanging below. */
export type BeadSpot = { id: string; x: number; y: number; large: boolean };

export const rosaryLayout = (cx = 160, cy = 150, r = 112): BeadSpot[] => {
  const beads: BeadSpot[] = [];
  // Medal at the bottom of the loop; the loop runs clockwise from there.
  const loop: { id: string; large: boolean }[] = [];
  for (let d = 1; d <= 5; d += 1) {
    loop.push({ id: `L${d}`, large: true });
    for (let n = 1; n <= 10; n += 1) loop.push({ id: `d${d}-${n}`, large: false });
  }
  const total = loop.length + 1; // medal takes one slot
  loop.forEach((b, i) => {
    const a = Math.PI / 2 + ((i + 1) / total) * Math.PI * 2; // start just right of the bottom
    beads.push({ id: b.id, x: cx - Math.cos(a) * r, y: cy + Math.sin(a) * r, large: b.large });
  });
  const bottom = cy + r;
  beads.push({ id: 'medal', x: cx, y: bottom, large: true });
  ['p3', 'p2', 'p1'].forEach((id, i) => beads.push({ id, x: cx, y: bottom + 22 + i * 15, large: false }));
  beads.push({ id: 'p0', x: cx, y: bottom + 22 + 3 * 15 + 6, large: true });
  beads.push({ id: 'cross', x: cx, y: bottom + 22 + 3 * 15 + 34, large: true });
  return beads;
};
