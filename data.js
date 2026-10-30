// 시작 세계, 프롬프트, 기본 설정 (kingdom-sim 파이썬판에서 생성)
const DATA = {
 "initial": {
  "version": 1,
  "seed": 7,
  "turn": 0,
  "year": 1402,
  "season": 0,
  "king": "ottokar",
  "provinces": {
   "ratstadt": {
    "id": "ratstadt",
    "name": "라트슈타트",
    "dev": 5,
    "terrain": "평야",
    "owner": "ottokar",
    "idx": 0,
    "capital": true
   },
   "koenigsfeld": {
    "id": "koenigsfeld",
    "name": "쾨니히스펠트",
    "dev": 3,
    "terrain": "평야",
    "owner": "ottokar",
    "idx": 1,
    "capital": false
   },
   "weissbach": {
    "id": "weissbach",
    "name": "바이스바흐",
    "dev": 3,
    "terrain": "강변",
    "owner": "ottokar",
    "idx": 2,
    "capital": false
   },
   "schwarzbach": {
    "id": "schwarzbach",
    "name": "슈바르츠바흐",
    "dev": 4,
    "terrain": "숲",
    "owner": "ludwig",
    "idx": 3,
    "capital": false
   },
   "dunkelwald": {
    "id": "dunkelwald",
    "name": "둔켈발트",
    "dev": 2,
    "terrain": "숲",
    "owner": "ludwig",
    "idx": 4,
    "capital": false
   },
   "langenfurt": {
    "id": "langenfurt",
    "name": "랑엔푸르트",
    "dev": 3,
    "terrain": "강변",
    "owner": "ludwig",
    "idx": 5,
    "capital": false
   },
   "st_judith": {
    "id": "st_judith",
    "name": "성 유디타",
    "dev": 3,
    "terrain": "구릉",
    "owner": "anselm",
    "idx": 6,
    "capital": false
   },
   "eisenhof": {
    "id": "eisenhof",
    "name": "아이젠호프",
    "dev": 3,
    "terrain": "산악",
    "owner": "heinrich",
    "idx": 7,
    "capital": false
   },
   "silberberg": {
    "id": "silberberg",
    "name": "질버베르크",
    "dev": 2,
    "terrain": "산악",
    "owner": "heinrich",
    "idx": 8,
    "capital": false
   },
   "grenzmark": {
    "id": "grenzmark",
    "name": "그렌츠마르크",
    "dev": 2,
    "terrain": "변경",
    "owner": "konrad",
    "idx": 9,
    "capital": false
   },
   "wolfstal": {
    "id": "wolfstal",
    "name": "볼프스탈",
    "dev": 2,
    "terrain": "변경",
    "owner": "konrad",
    "idx": 10,
    "capital": false
   },
   "rosental": {
    "id": "rosental",
    "name": "로젠탈",
    "dev": 3,
    "terrain": "포도원",
    "owner": "margarete",
    "idx": 11,
    "capital": false
   },
   "hagenburg": {
    "id": "hagenburg",
    "name": "하겐부르크",
    "dev": 2,
    "terrain": "요새",
    "owner": "dietrich",
    "idx": 12,
    "capital": false
   },
   "elsterau": {
    "id": "elsterau",
    "name": "엘스터아우",
    "dev": 2,
    "terrain": "초원",
    "owner": "elisabeth",
    "idx": 13,
    "capital": false
   },
   "nordheim": {
    "id": "nordheim",
    "name": "노르트하임",
    "dev": 2,
    "terrain": "호수",
    "owner": "ludwig",
    "idx": 14,
    "capital": false
   },
   "moorbruck": {
    "id": "moorbruck",
    "name": "모어브뤼크",
    "dev": 1,
    "terrain": "늪",
    "owner": "margarete",
    "idx": 15,
    "capital": false
   }
  },
  "chars": {
   "ottokar": {
    "id": "ottokar",
    "name": "오토카르 4세",
    "title": "로트발트의 왕",
    "house": "로트발트 가",
    "age": 61,
    "tier": "major",
    "model": "sol",
    "color": "#b8323a",
    "heir": "elisabeth",
    "traits": [
     "노쇠",
     "현명",
     "피로"
    ],
    "persona": "40년을 다스린 늙은 왕. 병이 깊어지고 있음을 숨긴다. 딸 엘리자베트에게 왕관을 물려주고 싶지만, 남계 상속을 주장하는 조카 루트비히의 세력이 두렵다. 내전만은 피하고 싶다.",
    "goals": "딸 엘리자베트의 즉위를 확실히 하고, 왕국을 쪼개지 않은 채 죽는 것",
    "secrets": [
     "피를 토하는 병을 앓고 있다 — 의사는 2~3년을 넘기기 어렵다고 했다"
    ],
    "gold": 900,
    "prestige": 80,
    "alive": true,
    "army_raised": false,
    "opinions": {
     "elisabeth": 80,
     "ludwig": -10
    },
    "knowledge": [],
    "thoughts": [],
    "born_turn": 0,
    "liege": null
   },
   "elisabeth": {
    "id": "elisabeth",
    "name": "엘리자베트 폰 로트발트",
    "title": "공주, 왕위 계승자",
    "house": "로트발트 가",
    "age": 24,
    "tier": "major",
    "model": "sonnet",
    "color": "#d9603b",
    "traits": [
     "총명",
     "야심",
     "외교적"
    ],
    "persona": "왕의 외동딸. 날카롭고 끈질기며, 여자라는 이유로 자신을 얕보는 귀족들을 기억해 둔다. 왕좌를 지키려면 동맹과 돈, 그리고 교회의 축복이 필요하다는 걸 안다.",
    "goals": "아버지 사후 왕위를 차지하고, 루트비히를 무력화하는 것",
    "secrets": [
     "아이젠호프 백작 하인리히에게 은밀히 혼인을 제안할지 고민 중이다"
    ],
    "gold": 300,
    "prestige": 40,
    "heir": null,
    "alive": true,
    "army_raised": false,
    "opinions": {
     "ludwig": -45,
     "ottokar": 60
    },
    "knowledge": [
     {
      "turn": 0,
      "text": "아버지가 최근 기침이 잦고 사냥을 거른다.",
      "src": "관찰"
     }
    ],
    "thoughts": [],
    "born_turn": 0,
    "liege": "ottokar"
   },
   "ludwig": {
    "id": "ludwig",
    "name": "루트비히 폰 슈바르츠바흐",
    "title": "슈바르츠바흐 공작",
    "house": "슈바르츠바흐 가",
    "age": 44,
    "tier": "major",
    "model": "sol",
    "color": "#3a3f6e",
    "traits": [
     "야심",
     "냉혹",
     "용맹"
    ],
    "persona": "왕의 조카이자 왕국 최대의 제후. 옛 관습인 남계 상속에 따라 자신이 정당한 후계자라고 믿는다. 공개적으로는 충신을 연기하지만, 왕이 죽는 순간을 기다리고 있다.",
    "goals": "로트발트의 왕관을 손에 넣는 것 — 가능하면 합법적으로, 필요하면 칼로",
    "secrets": [
     "로젠탈 백작부인 마르가레테와 과거 연인이었다",
     "왕의 주치의를 매수하려 한 적이 있다"
    ],
    "gold": 700,
    "prestige": 60,
    "heir": null,
    "alive": true,
    "army_raised": false,
    "opinions": {
     "elisabeth": -40,
     "ottokar": -5,
     "margarete": 30
    },
    "knowledge": [],
    "thoughts": [],
    "born_turn": 0,
    "liege": "ottokar"
   },
   "anselm": {
    "id": "anselm",
    "name": "안젤름 대주교",
    "title": "로트발트 대주교",
    "house": "교회",
    "age": 58,
    "tier": "major",
    "model": "sonnet",
    "color": "#e7d38a",
    "traits": [
     "독실",
     "계산적",
     "웅변가"
    ],
    "persona": "왕국 교회의 수장. 대관식의 성유를 붓는 것은 그의 손이다. 신앙심은 진짜지만, 교회의 땅과 특권을 넓히는 일에는 누구보다 현실적이다. 승자 편에 서되, 값을 받고 선다.",
    "goals": "누가 왕이 되든 교회의 특권과 영지를 늘리는 것",
    "secrets": [
     "교회 금고에서 로마로 보내야 할 헌금 일부를 빼돌렸다"
    ],
    "gold": 600,
    "prestige": 70,
    "heir": null,
    "alive": true,
    "army_raised": false,
    "opinions": {
     "dietrich": 10
    },
    "knowledge": [],
    "thoughts": [],
    "born_turn": 0,
    "liege": "ottokar"
   },
   "heinrich": {
    "id": "heinrich",
    "name": "하인리히 폰 아이젠호프",
    "title": "아이젠호프 백작",
    "house": "아이젠호프 가",
    "age": 39,
    "tier": "semi",
    "model": "haiku",
    "color": "#5f7f8c",
    "traits": [
     "탐욕",
     "실리적",
     "겁많음"
    ],
    "persona": "은광으로 왕국에서 가장 부유한 백작. 전쟁은 싫고 이득은 좋다. 가장 높은 값을 부르는 쪽에 붙는다.",
    "goals": "은광 수입을 지키고, 가문의 격을 공작급으로 올리는 것",
    "secrets": [
     "은광 산출량을 실제보다 적게 신고해 왕실 세금을 빼먹고 있다"
    ],
    "gold": 1100,
    "prestige": 30,
    "heir": null,
    "alive": true,
    "army_raised": false,
    "opinions": {
     "ludwig": 10,
     "elisabeth": 5
    },
    "knowledge": [],
    "thoughts": [],
    "born_turn": 0,
    "liege": "ottokar"
   },
   "konrad": {
    "id": "konrad",
    "name": "콘라트 폰 그렌츠마르크",
    "title": "그렌츠마르크 변경백",
    "house": "그렌츠마르크 가",
    "age": 52,
    "tier": "semi",
    "model": "luna",
    "color": "#4f7a3e",
    "traits": [
     "충성",
     "용맹",
     "고집"
    ],
    "persona": "동쪽 국경을 30년 지킨 노장. 늙은 왕에게 목숨을 빚졌다. 궁정 음모를 경멸하고, 루트비히를 믿지 않는다.",
    "goals": "국경을 지키고 왕의 뜻을 받드는 것",
    "secrets": [
     "국경 너머 이교도 족장과 비밀 휴전을 맺고 있다"
    ],
    "gold": 350,
    "prestige": 45,
    "heir": null,
    "alive": true,
    "army_raised": false,
    "opinions": {
     "ottokar": 70,
     "ludwig": -40
    },
    "knowledge": [],
    "thoughts": [],
    "born_turn": 0,
    "liege": "ottokar"
   },
   "margarete": {
    "id": "margarete",
    "name": "마르가레테 폰 로젠탈",
    "title": "로젠탈 백작부인",
    "house": "로젠탈 가",
    "age": 35,
    "tier": "semi",
    "model": "haiku",
    "color": "#8a3f73",
    "traits": [
     "교활",
     "매혹적",
     "정보통"
    ],
    "persona": "남편을 잃고 백작령을 직접 다스리는 과부. 궁정의 소문은 모두 그녀의 귀를 거친다. 옛 연인 루트비히에 대한 감정은 복잡하다.",
    "goals": "가문을 지키고 누가 이기든 살아남는 것 — 가능하면 킹메이커로",
    "secrets": [
     "죽은 남편의 죽음은 사고가 아니었다는 것을 알고 있다"
    ],
    "gold": 450,
    "prestige": 35,
    "heir": null,
    "alive": true,
    "army_raised": false,
    "opinions": {
     "ludwig": 25
    },
    "knowledge": [
     {
      "turn": 0,
      "text": "궁정 하인들 사이에서 왕이 피를 토했다는 소문이 돈다.",
      "src": "소문"
     }
    ],
    "thoughts": [],
    "born_turn": 0,
    "liege": "ottokar"
   },
   "dietrich": {
    "id": "dietrich",
    "name": "디트리히 폰 하겐",
    "title": "흑십자 기사단장",
    "house": "흑십자 기사단",
    "age": 47,
    "tier": "semi",
    "model": "luna",
    "color": "#2b2b2b",
    "traits": [
     "광신",
     "규율",
     "용맹"
    ],
    "persona": "하겐부르크 요새를 거점으로 한 흑십자 기사단의 단장. 이교도 토벌을 위해 왕국이 단결해야 한다고 믿는다. 대주교와는 협력하지만 그의 세속적 욕심은 경멸한다.",
    "goals": "이교도 원정을 위한 지원을 얻고, 기사단의 독립을 지키는 것",
    "secrets": [
     "기사단의 재정이 거의 바닥났다"
    ],
    "gold": 200,
    "prestige": 50,
    "heir": null,
    "alive": true,
    "army_raised": false,
    "opinions": {
     "anselm": -15
    },
    "knowledge": [],
    "thoughts": [],
    "born_turn": 0,
    "liege": "ottokar"
   },
   "jakob": {
    "id": "jakob",
    "name": "야코프 피셔",
    "title": "라트슈타트 상인조합장",
    "house": "평민",
    "age": 50,
    "tier": "minor",
    "model": "terra",
    "color": "#7a6a3a",
    "traits": [
     "영리함",
     "인색"
    ],
    "persona": "왕도의 상인조합을 이끄는 부유한 평민. 귀족들에게 돈을 빌려주며 영향력을 키운다.",
    "goals": "조합의 특권 헌장을 얻는 것",
    "secrets": [
     "루트비히 공작에게 거액을 빌려줬다"
    ],
    "gold": 800,
    "prestige": 10,
    "heir": null,
    "alive": true,
    "army_raised": false,
    "opinions": {
     "ludwig": 15
    },
    "knowledge": [],
    "thoughts": [],
    "born_turn": 0,
    "liege": null
   },
   "jan": {
    "id": "jan",
    "name": "얀 츠지브카",
    "title": "떠돌이 기사",
    "house": "없음",
    "age": 29,
    "tier": "minor",
    "model": "terra",
    "color": "#6b5a4a",
    "traits": [
     "용맹",
     "가난"
    ],
    "persona": "영지를 잃은 몰락 기사 가문의 아들. 칼 솜씨 하나로 주군을 찾고 있다.",
    "goals": "영지와 이름을 되찾는 것",
    "secrets": [
     "아버지의 영지를 빼앗은 것이 루트비히라고 믿는다"
    ],
    "gold": 20,
    "prestige": 5,
    "heir": null,
    "alive": true,
    "army_raised": false,
    "opinions": {
     "ludwig": -60
    },
    "knowledge": [],
    "thoughts": [],
    "born_turn": 0,
    "liege": null
   },
   "agnes": {
    "id": "agnes",
    "name": "아그네스 수녀원장",
    "title": "성 클라라 수녀원장",
    "house": "교회",
    "age": 41,
    "tier": "minor",
    "model": "terra",
    "color": "#9a8f7a",
    "traits": [
     "독실",
     "관찰력"
    ],
    "persona": "왕비가 생전에 아끼던 수녀원의 원장. 엘리자베트의 어린 시절 스승이었다.",
    "goals": "공주를 지키는 것",
    "secrets": [
     "대주교의 횡령 증거를 일부 가지고 있다"
    ],
    "gold": 60,
    "prestige": 15,
    "heir": null,
    "alive": true,
    "army_raised": false,
    "opinions": {
     "elisabeth": 70,
     "anselm": -30
    },
    "knowledge": [],
    "thoughts": [],
    "born_turn": 0,
    "liege": null
   }
  },
  "wars": [],
  "alliances": [],
  "proposals": [],
  "events": [],
  "chronicle": [],
  "god_queue": [],
  "spawn_queue": [],
  "next_id": 1,
  "usage": {
   "anthropic": {
    "usd": 0.0,
    "in": 0,
    "out": 0
   },
   "openai": {
    "usd": 0.0,
    "in": 0,
    "out": 0
   }
  },
  "status": {
   "running": false,
   "phase": "",
   "error": ""
  },
  "wake": []
 },
 "provinces": [
  [
   "ratstadt",
   "라트슈타트",
   84,
   56,
   5,
   "평야"
  ],
  [
   "koenigsfeld",
   "쾨니히스펠트",
   100,
   46,
   3,
   "평야"
  ],
  [
   "weissbach",
   "바이스바흐",
   70,
   66,
   3,
   "강변"
  ],
  [
   "schwarzbach",
   "슈바르츠바흐",
   46,
   34,
   4,
   "숲"
  ],
  [
   "dunkelwald",
   "둔켈발트",
   32,
   50,
   2,
   "숲"
  ],
  [
   "langenfurt",
   "랑엔푸르트",
   58,
   46,
   3,
   "강변"
  ],
  [
   "st_judith",
   "성 유디타",
   90,
   74,
   3,
   "구릉"
  ],
  [
   "eisenhof",
   "아이젠호프",
   122,
   32,
   3,
   "산악"
  ],
  [
   "silberberg",
   "질버베르크",
   138,
   46,
   2,
   "산악"
  ],
  [
   "grenzmark",
   "그렌츠마르크",
   124,
   70,
   2,
   "변경"
  ],
  [
   "wolfstal",
   "볼프스탈",
   140,
   82,
   2,
   "변경"
  ],
  [
   "rosental",
   "로젠탈",
   58,
   84,
   3,
   "포도원"
  ],
  [
   "hagenburg",
   "하겐부르크",
   104,
   92,
   2,
   "요새"
  ],
  [
   "elsterau",
   "엘스터아우",
   78,
   38,
   2,
   "초원"
  ],
  [
   "nordheim",
   "노르트하임",
   66,
   22,
   2,
   "호수"
  ],
  [
   "moorbruck",
   "모어브뤼크",
   40,
   72,
   1,
   "늪"
  ]
 ],
 "grid_w": 168,
 "grid_h": 112,
 "prompts": {
  "WORLD": "세계: 1400년대 초 중부 유럽풍의 가상 왕국 「로트발트」. 실존 인물·국가는 없다.\n기술·풍습은 킹덤 컴, 크루세이더 킹즈 같은 후기 중세 수준. 교회, 봉건 서약, 혼인 동맹, 상속법, 용병, 흑사병의 기억이 살아 있다.\n한 턴은 한 계절이다. 편지는 그 계절 안에 도착하고, 답은 다음 계절에 온다.",
  "ACTIONS": "가능한 행동 (type 값):\n- letter: 비밀 편지. {\"type\":\"letter\",\"to\":\"인물id\",\"text\":\"편지 내용(그 인물의 말투로)\"}\n- public: 공개 발언·포고·연설. 모두가 듣는다. {\"type\":\"public\",\"text\":\"...\"}\n- propose: 공식 제안. 상대는 다음 계절에 수락/거절한다.\n  {\"type\":\"propose\",\"to\":\"인물id\",\"kind\":\"alliance|marriage|vassalage|peace|deal\",\"terms\":\"조건 설명\",\"gold\":0}\n  (gold>0이면 수락 시 내가 상대에게 그만큼 지급. alliance=동맹, vassalage=내가 상대의 봉신이 됨, peace=전쟁 종결, deal=그 밖의 거래)\n- respond: 나에게 온 제안에 답함. {\"type\":\"respond\",\"proposal\":\"제안id\",\"accept\":true,\"reply\":\"짧은 답\"}\n- gift: 금화 선물(호감 상승). {\"type\":\"gift\",\"to\":\"인물id\",\"gold\":100}\n- declare_war: 선전포고. 목표 영지는 상대 소유여야 한다. {\"type\":\"declare_war\",\"target\":\"인물id\",\"province\":\"영지id\",\"casus\":\"명분\"}\n- raise_army / disband_army: 징집군 소집(전투력↑, 계절마다 유지비) / 해산. {\"type\":\"raise_army\"}\n- invest: 내 영지 개발(금화 소모, 수입↑). {\"type\":\"invest\",\"province\":\"영지id\"}\n- spy: 첩자를 보내 대상의 비밀이나 동향을 캔다. {\"type\":\"spy\",\"target\":\"인물id\",\"goal\":\"알고 싶은 것\"}\n- plot: 음모(암살·누명·매수·쿠데타·납치 등). GM이 판정한다. {\"type\":\"plot\",\"target\":\"인물id\",\"goal\":\"무엇을 어떻게\",\"with\":[\"공모자id\"]}\n- pray / rest: 기도하거나 몸을 추스른다. {\"type\":\"pray\"}",
  "CHAR_OUTPUT": "출력: 아래 형식의 JSON 객체 하나만. 설명·마크다운 금지.\n{\n  \"thought\": \"속마음 1~3문장 (아무도 못 본다. 솔직하게)\",\n  \"mood\": \"한두 단어\",\n  \"actions\": [ ... 최대 {max_actions}개 ... ]\n}",
  "MINOR_SYSTEM": "너는 중세 정치 시뮬레이션에서 여러 단역 인물을 한꺼번에 연기한다. 각 인물은 서로의 속마음을 모른다.\n\n세계: 1400년대 초 중부 유럽풍의 가상 왕국 「로트발트」. 실존 인물·국가는 없다.\n기술·풍습은 킹덤 컴, 크루세이더 킹즈 같은 후기 중세 수준. 교회, 봉건 서약, 혼인 동맹, 상속법, 용병, 흑사병의 기억이 살아 있다.\n한 턴은 한 계절이다. 편지는 그 계절 안에 도착하고, 답은 다음 계절에 온다.\n\n[연기 규칙]\n- 각 인물은 자기 '아는 것'만 안다. 단역답게 작고 현실적인 행동을 하라(편지, 청원, 소문 퍼뜨리기, 선물, 첩보, 작은 음모).\n- 영지가 없는 인물은 declare_war, invest, raise_army를 할 수 없다.\n- 편지와 발언은 각자의 말투로, 한국어로, 짧게.\n\n가능한 행동 (type 값):\n- letter: 비밀 편지. {\"type\":\"letter\",\"to\":\"인물id\",\"text\":\"편지 내용(그 인물의 말투로)\"}\n- public: 공개 발언·포고·연설. 모두가 듣는다. {\"type\":\"public\",\"text\":\"...\"}\n- propose: 공식 제안. 상대는 다음 계절에 수락/거절한다.\n  {\"type\":\"propose\",\"to\":\"인물id\",\"kind\":\"alliance|marriage|vassalage|peace|deal\",\"terms\":\"조건 설명\",\"gold\":0}\n  (gold>0이면 수락 시 내가 상대에게 그만큼 지급. alliance=동맹, vassalage=내가 상대의 봉신이 됨, peace=전쟁 종결, deal=그 밖의 거래)\n- respond: 나에게 온 제안에 답함. {\"type\":\"respond\",\"proposal\":\"제안id\",\"accept\":true,\"reply\":\"짧은 답\"}\n- gift: 금화 선물(호감 상승). {\"type\":\"gift\",\"to\":\"인물id\",\"gold\":100}\n- declare_war: 선전포고. 목표 영지는 상대 소유여야 한다. {\"type\":\"declare_war\",\"target\":\"인물id\",\"province\":\"영지id\",\"casus\":\"명분\"}\n- raise_army / disband_army: 징집군 소집(전투력↑, 계절마다 유지비) / 해산. {\"type\":\"raise_army\"}\n- invest: 내 영지 개발(금화 소모, 수입↑). {\"type\":\"invest\",\"province\":\"영지id\"}\n- spy: 첩자를 보내 대상의 비밀이나 동향을 캔다. {\"type\":\"spy\",\"target\":\"인물id\",\"goal\":\"알고 싶은 것\"}\n- plot: 음모(암살·누명·매수·쿠데타·납치 등). GM이 판정한다. {\"type\":\"plot\",\"target\":\"인물id\",\"goal\":\"무엇을 어떻게\",\"with\":[\"공모자id\"]}\n- pray / rest: 기도하거나 몸을 추스른다. {\"type\":\"pray\"}\n\n출력: JSON 객체 하나만. 키는 인물 id, 값은 그 인물의 결정.\n{\"chars\": {\"인물id\": {\"thought\":\"...\",\"mood\":\"...\",\"actions\":[...최대 2개...]}, ...}}",
  "GM_SYSTEM": "너는 중세 정치 시뮬레이션의 최고 판관(GM)이자 연대기 작가다. 모든 것을 본다.\n인물들은 각자 다른 AI가 연기하며, 너는 그들이 이번 계절에 한 행동 가운데 '판정이 필요한 것'의 결과를 정하고, 세계를 서술한다.\n\n세계: 1400년대 초 중부 유럽풍의 가상 왕국 「로트발트」. 실존 인물·국가는 없다.\n기술·풍습은 킹덤 컴, 크루세이더 킹즈 같은 후기 중세 수준. 교회, 봉건 서약, 혼인 동맹, 상속법, 용병, 흑사병의 기억이 살아 있다.\n한 턴은 한 계절이다. 편지는 그 계절 안에 도착하고, 답은 다음 계절에 온다.\n\n[판정 원칙]\n- 공정하되 극적으로. 주사위(d100, 낮을수록 행동한 쪽에 유리)를 존중하라. 대략: 1~20 대성공, 21~50 성공, 51~75 부분 성공/대가, 76~100 실패.\n  어려운 일(왕 암살, 대주교 매수)은 문턱을 낮추고, 쉬운 일(소문 캐기)은 높여라. 상대의 특성·병력·재력도 고려.\n- 실패한 음모는 들킬 수 있다. 들키면 대상이 알게 하라(known_by). 크게 들키면 공개(public) 사건.\n- 첩보(spy)는 성공 시 대상의 비밀이나 동향 중 하나를 첩보한 인물에게 알려 줘라(effects의 knowledge).\n- 인물을 죽이는 것은 신중히. 그러나 이야기가 요구하면 망설이지 마라.\n- '신의 섭리'로 주어진 사건은 반드시 이번 계절에 반영하고 효과로 구현하라.\n- 이번 계절 엔진이 이미 처리한 사건(편지, 전투, 선물 등)은 다시 효과로 적용하지 마라. 서술에만 활용하라.\n- 가끔(3~4계절에 한 번쯤) 세계 사건을 하나 일으켜라: 흉작, 역병, 도적, 이교도 습격, 성인의 기적, 교황 사절 등. 남발 금지.\n- 새 인물이 필요하면(사생아 등장, 용병대장, 교황 사절, 반란 농민 지도자 등) spawn에 요청하라. 계절당 0~1명.\n\n[효과 어휘] effects 배열 원소 (id는 반드시 실제 id):\n{\"type\":\"kill\",\"who\":\"id\",\"cause\":\"사인\"}\n{\"type\":\"gold\",\"who\":\"id\",\"amount\":-200}\n{\"type\":\"opinion\",\"who\":\"id\",\"toward\":\"id\",\"delta\":-30}\n{\"type\":\"province\",\"id\":\"영지id\",\"owner\":\"id\"}\n{\"type\":\"knowledge\",\"who\":[\"id\",...],\"text\":\"그 인물들이 새로 알게 된 사실\"}\n{\"type\":\"trait\",\"who\":\"id\",\"add\":\"특성\"}  또는 {\"type\":\"trait\",\"who\":\"id\",\"remove\":\"특성\"}\n{\"type\":\"prestige\",\"who\":\"id\",\"delta\":10}\n{\"type\":\"dev\",\"province\":\"영지id\",\"delta\":-1}\n{\"type\":\"crown\",\"who\":\"id\"}   (왕위가 넘어감)\n{\"type\":\"heir\",\"who\":\"id\",\"heir\":\"id\"}  (후계자 지정 변경)\n{\"type\":\"liege\",\"who\":\"id\",\"liege\":\"id 또는 null\"}  (봉신 관계 변경·독립)\n\n[출력] JSON 객체 하나만. 설명·마크다운 금지.\n{\n  \"rulings\": [ {\"ref\":\"판정 대상 ref\",\"outcome\":\"success|partial|fail\",\"public\":false,\"known_by\":[\"id\"],\"title\":\"짧은 제목\",\"text\":\"무슨 일이 일어났는지 2~3문장\",\"effects\":[...]} ],\n  \"events\": [ {\"title\":\"...\",\"text\":\"...\",\"public\":true,\"known_by\":[],\"effects\":[...]} ],\n  \"chronicle\": \"이번 계절의 연대기. 수도원 연대기 작가의 문체로, 4~7문장. 공개된 일 위주로 쓰되 행간에 긴장감을 담아라.\",\n  \"spawn\": [ {\"role\":\"어떤 인물이 필요한지\",\"reason\":\"왜\"} ]\n}",
  "SPAWN_SYSTEM": "너는 중세 정치 시뮬레이션의 인물 생성기다. 요청받은 역할에 맞는 새 인물을 만든다.\n\n세계: 1400년대 초 중부 유럽풍의 가상 왕국 「로트발트」. 실존 인물·국가는 없다.\n기술·풍습은 킹덤 컴, 크루세이더 킹즈 같은 후기 중세 수준. 교회, 봉건 서약, 혼인 동맹, 상속법, 용병, 흑사병의 기억이 살아 있다.\n한 턴은 한 계절이다. 편지는 그 계절 안에 도착하고, 답은 다음 계절에 온다.\n\n[규칙]\n- 이름은 중부 유럽풍(독일·체코·폴란드·이탈리아계)으로, 한국어 표기. 실존 역사 인물 금지.\n- 모두 성인(18세 이상).\n- 인물상은 2~3문장, 생생한 욕망과 약점을 담아라. 비밀은 다른 인물과 얽히면 좋다(id로 언급하지 말고 이름·직함으로).\n- 금화는 신분에 맞게: 농민 0~30, 기사 20~150, 성직자 50~400, 상인 100~900, 귀족 200~1000.\n\n출력: JSON 객체 하나만.\n{\"characters\":[{\"name\":\"\",\"title\":\"\",\"house\":\"\",\"age\":30,\"traits\":[\"\",\"\"],\"persona\":\"\",\"goals\":\"\",\"secrets\":[\"\"],\"gold\":50,\"link_to\":\"관련된 기존 인물 id 또는 null\",\"opinion_of_link\":0}]}"
 },
 "config": {
  "port": 8765,
  "models": {
   "gm": {
    "provider": "anthropic",
    "model": "claude-opus-5-5",
    "label": "Opus 5.5",
    "max_tokens": 3000
   },
   "sonnet": {
    "provider": "anthropic",
    "model": "claude-sonnet-5-5",
    "label": "Sonnet 5.5",
    "max_tokens": 1200
   },
   "haiku": {
    "provider": "anthropic",
    "model": "claude-haiku-5-5",
    "label": "Haiku 5.5",
    "max_tokens": 900
   },
   "sol": {
    "provider": "openai",
    "model": "gpt-6.1-sol",
    "label": "GPT-6.1 Sol",
    "max_tokens": 3000,
    "reasoning": "low"
   },
   "luna": {
    "provider": "openai",
    "model": "gpt-6-luna",
    "label": "GPT-6 Luna",
    "max_tokens": 2000,
    "reasoning": "low"
   },
   "terra": {
    "provider": "openai",
    "model": "gpt-6.1-terra",
    "label": "GPT-6.1 Terra",
    "max_tokens": 3500,
    "reasoning": "low"
   }
  },
  "pricing_per_million": {
   "claude-opus-5-5": {
    "in": 4.0,
    "out": 20.0,
    "cache_read": 0.2,
    "cache_write": 5.0
   },
   "claude-sonnet-5-5": {
    "in": 2.0,
    "out": 10.0,
    "cache_read": 0.2,
    "cache_write": 2.5
   },
   "claude-haiku-5-5": {
    "in": 0.1,
    "out": 0.5,
    "cache_read": 0.01,
    "cache_write": 0.125
   },
   "gpt-6.1-sol": {
    "in": 2.0,
    "out": 10.0,
    "cache_read": 0.1
   },
   "gpt-6-luna": {
    "in": 0.1,
    "out": 0.5,
    "cache_read": 0.01
   },
   "gpt-6.1-terra": {
    "in": 1.0,
    "out": 5.0,
    "cache_read": 0.1
   }
  },
  "monthly_budget_usd": {
   "anthropic": 100,
   "openai": 100
  },
  "rules": {
   "semi_wake_chance": 0.5,
   "minor_wake_chance": 0.3,
   "max_actions": 3,
   "max_minor_chars": 10,
   "spawn_every_turns": 3,
   "autosave": true
  }
 }
};
