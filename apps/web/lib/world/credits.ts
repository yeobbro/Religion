/* Generated from the asset download metadata; every file is served from /public. */
export type Track = { id: string; title: string; composer: string; performer: string; src: string; duration: number; license: string; source: string };
export type Credit = { title: string; author: string; license: string; source: string };
export type GlassImage = { id: string; title: string; src: string; size: [number, number]; author: string; license: string; source: string };

export const TRACKS: Track[] = [
  {
    "id": "notre-dame-bells",
    "title": "파리 노트르담 대성당 성탄 종소리",
    "composer": "대성당 종",
    "performer": "Mxsmanic",
    "src": "/audio/notre-dame-bells.mp3",
    "duration": 64.3,
    "license": "CC0",
    "source": "https://commons.wikimedia.org/wiki/File:2011_Christmas_bells_at_Notre-Dame_de_Paris_(excerpt).wav"
  },
  {
    "id": "veni-sancte-spiritus",
    "title": "오소서 성령이여 (Veni Sancte Spiritus)",
    "composer": "그레고리오 성가",
    "performer": "Membeth",
    "src": "/audio/veni-sancte-spiritus.mp3",
    "duration": 157.3,
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Veni.sancte.spiritus.ogg"
  },
  {
    "id": "palestrina-kyrie",
    "title": "자비송 (Kyrie) — 교황 마르첼루스 미사",
    "composer": "팔레스트리나 · 합창",
    "performer": "European Archive",
    "src": "/audio/palestrina-kyrie.mp3",
    "duration": 213.8,
    "license": "CC0",
    "source": "https://commons.wikimedia.org/wiki/File:Missa_Papae_Marcelli_-_I._Kyrie.flac"
  },
  {
    "id": "panis-angelicus",
    "title": "생명의 양식 (Panis angelicus)",
    "composer": "세자르 프랑크",
    "performer": "Mentxuwiki",
    "src": "/audio/panis-angelicus.mp3",
    "duration": 215.9,
    "license": "CC0",
    "source": "https://commons.wikimedia.org/wiki/File:Panis_Angelicus_Cesar_Frank.webm"
  },
  {
    "id": "bach-gounod-ave-maria",
    "title": "아베 마리아",
    "composer": "바흐·구노",
    "performer": "Beal, Campbell (1930년대 녹음)",
    "src": "/audio/bach-gounod-ave-maria.mp3",
    "duration": 174.4,
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Bach-Gounod_-_Ave_Maria_(Beal,_Campbell).flac"
  },
  {
    "id": "palestrina-sanctus",
    "title": "거룩하시도다 (Sanctus) — 교황 마르첼루스 미사",
    "composer": "팔레스트리나 · 합창",
    "performer": "European Archive",
    "src": "/audio/palestrina-sanctus.mp3",
    "duration": 354.0,
    "license": "CC0",
    "source": "https://commons.wikimedia.org/wiki/File:Missa_Papae_Marcelli_-_IV._Sanctus.flac"
  },
  {
    "id": "bach-toccata-bwv565",
    "title": "토카타와 푸가 d단조 BWV 565",
    "composer": "바흐 · 파이프오르간",
    "performer": "Norbert Schenk",
    "src": "/audio/bach-toccata-bwv565.mp3",
    "duration": 464.0,
    "license": "CC BY 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Bach,_Toccata_und_Fuge_d-moll_BWV_565,_Norbert_Schenk.mp3"
  },
  {
    "id": "palestrina-agnus-dei",
    "title": "하느님의 어린양 (Agnus Dei) — 교황 마르첼루스 미사",
    "composer": "팔레스트리나 · 합창",
    "performer": "European Archive",
    "src": "/audio/palestrina-agnus-dei.mp3",
    "duration": 148.1,
    "license": "CC0",
    "source": "https://commons.wikimedia.org/wiki/File:Missa_Papae_Marcelli_-_V._Agnus_Dei_I.flac"
  },
  {
    "id": "widor-toccata",
    "title": "오르간 교향곡 5번 중 토카타",
    "composer": "비도르 · 파이프오르간",
    "performer": "Norbert Schenk",
    "src": "/audio/widor-toccata.mp3",
    "duration": 313.4,
    "license": "CC BY 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Widor,_Orgelsinfonie_Nr._5_f-moll,_Toccata,_Norbert_Schenk.mp3"
  }
];

export const AMBIENCE = [
  {
    "id": "garden-breeze-birds",
    "title": "정원의 바람과 새소리",
    "src": "/audio/garden-breeze-birds.mp3",
    "duration": 32.6,
    "license": "Public domain",
    "author": "ezwa",
    "source": "https://commons.wikimedia.org/wiki/File:Gentle_breeze_and_birds_singing.ogg"
  },
  {
    "id": "wholesome-kevin-macleod",
    "title": "Wholesome (잔잔한 배경음악)",
    "src": "/audio/wholesome-kevin-macleod.mp3",
    "duration": 363.9,
    "license": "CC BY 4.0",
    "author": "Kevin MacLeod (incompetech.com)",
    "source": "https://commons.wikimedia.org/wiki/File:Wholesome_by_Kevin_MacLeod.ogg"
  }
] as const;

export const IMAGES: GlassImage[] = [
  {
    "id": "glass-chartres-103",
    "title": "샤르트르 대성당 스테인드글라스 103",
    "src": "/textures/glass/glass-chartres-103.jpg",
    "size": [
      500,
      2906
    ],
    "author": "Michelet-密是力",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Vitrail_Chartres-103_rectifi%C3%A9.jpg"
  },
  {
    "id": "glass-chartres-104",
    "title": "샤르트르 대성당 스테인드글라스 104",
    "src": "/textures/glass/glass-chartres-104.jpg",
    "size": [
      500,
      2907
    ],
    "author": "Michelet-密是力",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Vitrail_Chartres-104_rectifi%C3%A9.jpg"
  },
  {
    "id": "glass-chartres-105",
    "title": "샤르트르 대성당 스테인드글라스 105",
    "src": "/textures/glass/glass-chartres-105.jpg",
    "size": [
      500,
      2907
    ],
    "author": "Michelet-密是力",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Vitrail_Chartres-105_rectifi%C3%A9.jpg"
  },
  {
    "id": "glass-chartres-106",
    "title": "샤르트르 대성당 스테인드글라스 106",
    "src": "/textures/glass/glass-chartres-106.jpg",
    "size": [
      500,
      2906
    ],
    "author": "Michelet-密是力",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Vitrail_Chartres-106_rectifi%C3%A9.jpg"
  },
  {
    "id": "glass-chartres-000",
    "title": "샤르트르 대성당 스테인드글라스",
    "src": "/textures/glass/glass-chartres-000.jpg",
    "size": [
      500,
      2007
    ],
    "author": "Michelet-密是力",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Vitrail_Chartres-000.JPG"
  },
  {
    "id": "glass-chartres-028",
    "title": "샤르트르 대성당 스테인드글라스 28",
    "src": "/textures/glass/glass-chartres-028.jpg",
    "size": [
      500,
      1804
    ],
    "author": "Michelet-密是力",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Vitrail_Chartres-028-g.jpg"
  },
  {
    "id": "glass-chartres-030",
    "title": "샤르트르 대성당 스테인드글라스 30",
    "src": "/textures/glass/glass-chartres-030.jpg",
    "size": [
      500,
      1547
    ],
    "author": "Michelet-密是力",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Vitrail_Chartres-030-d_rectifi%C3%A9.jpg"
  },
  {
    "id": "glass-chartres-042",
    "title": "샤르트르 대성당 스테인드글라스 42",
    "src": "/textures/glass/glass-chartres-042.jpg",
    "size": [
      500,
      1741
    ],
    "author": "Michelet-密是力",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Vitrail_Chartres-042_rectifi%C3%A9.JPG"
  },
  {
    "id": "glass-chartres-051",
    "title": "샤르트르 대성당 스테인드글라스 51",
    "src": "/textures/glass/glass-chartres-051.jpg",
    "size": [
      500,
      1838
    ],
    "author": "Michelet-密是力",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Vitrail_Chartres-051_rectifi%C3%A9.JPG"
  },
  {
    "id": "glass-belle-verriere",
    "title": "샤르트르 '아름다운 유리창의 성모'",
    "src": "/textures/glass/glass-belle-verriere.jpg",
    "size": [
      500,
      1481
    ],
    "author": "Michelet-密是力",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Chartres_-30a-_ND_de_la_belle_verri%C3%A8re.jpg"
  },
  {
    "id": "glass-chartres-06",
    "title": "샤르트르 대성당 스테인드글라스",
    "src": "/textures/glass/glass-chartres-06.jpg",
    "size": [
      500,
      1364
    ],
    "author": "Vassil",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Vitrail_Chartres_210209_06.jpg"
  },
  {
    "id": "glass-chartres-20",
    "title": "샤르트르 대성당 스테인드글라스",
    "src": "/textures/glass/glass-chartres-20.jpg",
    "size": [
      500,
      960
    ],
    "author": "Vassil",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Vitrail_Chartres_210209_20.jpg"
  },
  {
    "id": "rose-notre-dame",
    "title": "파리 노트르담 대성당 장미창",
    "src": "/textures/glass/rose-notre-dame.jpg",
    "size": [
      1280,
      1280
    ],
    "author": "Krzysztof Mizera",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Rozeta_Pary%C5%BC_notre-dame_chalger.jpg"
  },
  {
    "id": "painting-murillo",
    "title": "무리요, 원죄 없이 잉태되신 성모 (1678, 프라도 미술관)",
    "src": "/textures/art/painting-murillo.jpg",
    "size": [
      960,
      1408
    ],
    "author": "Bartolomé Esteban Murillo",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Murillo_-_Inmaculada_Concepci%C3%B3n_de_los_Venerables_o_de_Soult_(Museo_del_Prado,_1678).jpg"
  },
  {
    "id": "painting-raphael",
    "title": "라파엘로, 시스티나 성모 (1512, 드레스덴)",
    "src": "/textures/art/painting-raphael.jpg",
    "size": [
      960,
      1311
    ],
    "author": "Raphael",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Raffaello_Sanzio_-_Madonna_Sistina.jpg"
  },
  {
    "id": "painting-titian",
    "title": "티치아노, 성모 승천 (1516–18, 베네치아 프라리 성당)",
    "src": "/textures/art/painting-titian.jpg",
    "size": [
      960,
      1766
    ],
    "author": "Titian",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Tizian_041.jpg"
  },
  {"id": "ref-rose", "title": "장미창 (로즈 윈도우)", "src": "/textures/glass/ref-rose.jpg", "size": [346, 344], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w01", "title": "스테인드글라스 · 예수 그리스도", "src": "/textures/glass/ref-w01.jpg", "size": [146, 430], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w02", "title": "스테인드글라스 · 성모 마리아", "src": "/textures/glass/ref-w02.jpg", "size": [146, 430], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w03", "title": "스테인드글라스 · 성 베드로", "src": "/textures/glass/ref-w03.jpg", "size": [146, 430], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w04", "title": "스테인드글라스 · 성 바오로", "src": "/textures/glass/ref-w04.jpg", "size": [146, 430], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w05", "title": "스테인드글라스 · 십자가의 수난", "src": "/textures/glass/ref-w05.jpg", "size": [146, 430], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w06", "title": "스테인드글라스 · 부활하신 예수", "src": "/textures/glass/ref-w06.jpg", "size": [146, 430], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w07", "title": "스테인드글라스 · 성령 강림", "src": "/textures/glass/ref-w07.jpg", "size": [146, 430], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w08", "title": "스테인드글라스 · 천상 영광", "src": "/textures/glass/ref-w08.jpg", "size": [146, 430], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w09", "title": "스테인드글라스 · 예수 탄생", "src": "/textures/glass/ref-w09.jpg", "size": [146, 427], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w10", "title": "스테인드글라스 · 세례", "src": "/textures/glass/ref-w10.jpg", "size": [146, 427], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w11", "title": "스테인드글라스 · 최후의 만찬", "src": "/textures/glass/ref-w11.jpg", "size": [146, 427], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w12", "title": "스테인드글라스 · 선한 목자", "src": "/textures/glass/ref-w12.jpg", "size": [146, 427], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w13", "title": "스테인드글라스 · 천사와 하늘", "src": "/textures/glass/ref-w13.jpg", "size": [146, 427], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w14", "title": "스테인드글라스 · 성 미카엘 대천사", "src": "/textures/glass/ref-w14.jpg", "size": [146, 427], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w15", "title": "스테인드글라스 · 십자가의 길", "src": "/textures/glass/ref-w15.jpg", "size": [146, 427], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w16", "title": "스테인드글라스 · 성모 마리아와 아기 예수", "src": "/textures/glass/ref-w16.jpg", "size": [250, 440], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w17", "title": "스테인드글라스 · 예수 그리스도 (세상의 빛)", "src": "/textures/glass/ref-w17.jpg", "size": [228, 440], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w18", "title": "스테인드글라스 · 예수님의 생애", "src": "/textures/glass/ref-w18.jpg", "size": [210, 440], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w19", "title": "스테인드글라스 · 성경 이야기", "src": "/textures/glass/ref-w19.jpg", "size": [237, 440], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w20", "title": "스테인드글라스 · 십자가와 성인들", "src": "/textures/glass/ref-w20.jpg", "size": [241, 440], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w21", "title": "스테인드글라스 · 열두 사도", "src": "/textures/glass/ref-w21.jpg", "size": [236, 440], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w22", "title": "스테인드글라스 · 천사와 찬미", "src": "/textures/glass/ref-w22.jpg", "size": [207, 445], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w23", "title": "스테인드글라스 · 그리스도 왕", "src": "/textures/glass/ref-w23.jpg", "size": [213, 445], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w24", "title": "스테인드글라스 · 성 요셉", "src": "/textures/glass/ref-w24.jpg", "size": [203, 445], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w25", "title": "스테인드글라스 · 성모 승천", "src": "/textures/glass/ref-w25.jpg", "size": [213, 445], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
  {"id": "ref-w26", "title": "스테인드글라스 · 부활과 영광", "src": "/textures/glass/ref-w26.jpg", "size": [236, 445], "author": "KREWX 제공 레퍼런스 이미지", "license": "제공자 사용 허락", "source": "/catholic"},
];

export const TEXTURES: Credit[] = [
  {
    "title": "대리석 바닥 (밀라노 대성당)",
    "author": "Gerda Arendt",
    "license": "CC0",
    "source": "https://commons.wikimedia.org/wiki/File:Milan_Cathedral,_floor.jpg"
  },
  {
    "title": "하늘 (Kloofendal 48d Partly Cloudy, Pure Sky)",
    "author": "Greg Zaal · Poly Haven",
    "license": "CC0",
    "source": "https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky"
  },
  {
    "title": "회벽 돌 벽 (plastered_stone_wall)",
    "author": "Poly Haven",
    "license": "CC0",
    "source": "https://polyhaven.com/a/plastered_stone_wall"
  },
  {
    "title": "성당 외벽 석재 (castle_brick_07)",
    "author": "Poly Haven",
    "license": "CC0",
    "source": "https://polyhaven.com/a/castle_brick_07"
  },
  {
    "title": "짙은 나무 (신자석·문) (dark_wooden_planks)",
    "author": "Poly Haven",
    "license": "CC0",
    "source": "https://polyhaven.com/a/dark_wooden_planks"
  },
  {
    "title": "정원 잔디 (aerial_grass_rock)",
    "author": "Poly Haven",
    "license": "CC0",
    "source": "https://polyhaven.com/a/aerial_grass_rock"
  },
  {
    "title": "광장 포석 (cobblestone_floor_08)",
    "author": "Poly Haven",
    "license": "CC0",
    "source": "https://polyhaven.com/a/cobblestone_floor_08"
  },
  {
    "title": "성모 동굴 바위 (rock_wall_08)",
    "author": "Poly Haven",
    "license": "CC0",
    "source": "https://polyhaven.com/a/rock_wall_08"
  }
];

export const image = (id: string) => IMAGES.find(i => i.id === id)!;
