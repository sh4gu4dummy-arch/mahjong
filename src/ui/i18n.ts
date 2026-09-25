export type Lang = "zh" | "en";

const KEY = "aa-mahjong-lang";

const dict = {
  mute: { zh: "静音", en: "Mute" },
  unmute: { zh: "取消静音", en: "Unmute" },
  shop: { zh: "Shop", en: "Shop" },
  next: { zh: "下一局", en: "Next" },
  reset: { zh: "重置", en: "Reset" },
  deal: { zh: "开局", en: "Deal" },
  discard: { zh: "打", en: "Discard" },
  win: { zh: "胡", en: "Win" },
  selfWin: { zh: "自摸", en: "Self-draw" },
  pung: { zh: "碰", en: "Pung" },
  kong: { zh: "杠", en: "Kong" },
  chow: { zh: "吃", en: "Chow" },
  pass: { zh: "过", en: "Pass" },
  sort: { zh: "理牌", en: "Sort" },
  hand: { zh: "局", en: "Hand" },
  stake: { zh: "赌注", en: "Stake" },
  wall: { zh: "牌墙", en: "Wall" },
  you: { zh: "你", en: "You" },
  betting: { zh: "下注中", en: "Betting" },
  inWall: { zh: "张", en: "left" },
  lastDiscard: { zh: "刚打出", en: "Last discard" },
  dongbei: { zh: "东北麻将", en: "Northeast Mahjong" },
  chooseStake: { zh: "请选择本局赌注", en: "Choose a stake for this hand." },
  youHave: { zh: "余额", en: "You have" },
  prideNote: {
    zh: "余额为 $0 — 先打着玩，赢了再攒钱。",
    en: "You are at $0 — play on for pride. Win to rebuild the stack.",
  },
  refuelCash: { zh: "没钱了？补到 $10", en: "Out of cash? Top up to $10" },
  payNote: { zh: "", en: "" },
  rulesMini: {
    zh: "",
    en: "",
  },
  reqOpen: { zh: "开门", en: "Open" },
  reqKe: { zh: "有刻", en: "Pung" },
  reqDragonEyes: { zh: "中发白将", en: "Dragon eyes" },
  reqYao: { zh: "幺九", en: "1/9" },
  reqSuits: { zh: "三门齐", en: "3 suits" },
  drawGame: { zh: "荒庄 · 流局", en: "Draw game" },
  drawGameSub: { zh: "牌墙摸完，本局赌注不变。", en: "Wall exhausted — stakes stay." },
  nextRound: { zh: "下一局", en: "Next round" },
  closeResult: { zh: "关闭", en: "Close" },
  resetCash: { zh: "现金重置为 $100", en: "Reset cash to $100" },
  youWin: { zh: "你胡了", en: "You win" },
  youPaid: { zh: "你付了", en: "You paid" },
  youGot: { zh: "你收了", en: "You received" },
  noWalletChange: { zh: "本局你的钱包未变", en: "Your wallet unchanged this hand" },
  someoneWins: { zh: "胡牌", en: "wins" },
  selfDrawHow: { zh: "自摸", en: "Self-draw" },
  discardWinHow: { zh: "点炮", en: "Discard win" },
  shopTitle: { zh: "Shop", en: "Shop" },
  shopSub: { zh: "Shop · 钱包", en: "Shop · Wallet" },
  shopBoth: { zh: "四人短暂同持", en: "Everyone holds it briefly" },
  buy: { zh: "买", en: "Buy" },
  close: { zh: "关闭", en: "Close" },
  walletEmpty: {
    zh: "钱包空了，仍可逛逛。赢一把再充值。",
    en: "Wallet empty — you can still browse. Win a hand to refill.",
  },
  needMoney: { zh: "钱不够", en: "Need more cash" },
  forBoth: { zh: "给大家！", en: "for everyone!" },
  forAll: { zh: "给大家！", en: "for everyone!" },
  pickCharacter: { zh: "选择角色", en: "Choose character" },
  youAre: { zh: "你是", en: "You are" },
  hint: {
    zh: "只能吃上家 · 碰/杠/胡不限谁 · 可立胡 · 胡牌需有刻（或中发白将）/幺九/三门齐 · 长春滚番结算",
    en: "Chow only from left · pung/kong/win from anyone · closed hand OK · win needs a pung (or dragon eyes) / terminal / three suits · Changchun rolling fan",
  },
  dealing: { zh: "发牌中…", en: "Dealing…" },
  paySelf: { zh: "自摸：三家各按滚番付", en: "Self-draw: each of three pays rolling fan" },
  payDiscard: { zh: "点炮：三家都付（放炮者多一番）", en: "Discard win: all three pay (discarder +1 fan)" },
  noCashMoved: { zh: "无现金变动（破产或赌注为 $0）", en: "No cash moved (broke or $0 stake)" },
  seatYou: { zh: "A", en: "A" },
  seatOpp: { zh: "J", en: "J" },
  seatLeft: { zh: "C", en: "C" },
  seatRight: { zh: "L", en: "L" },
  tips: { zh: "提示", en: "Tips" },
  tipsOn: { zh: "开", en: "ON" },
  tipsOff: { zh: "关", en: "OFF" },
  auto: { zh: "自动", en: "Auto" },
  autoOn: { zh: "开", en: "ON" },
  autoOff: { zh: "关", en: "OFF" },
  paceFast: { zh: "快", en: "Fast" },
  paceSlow: { zh: "慢", en: "Slow" },
  paceAria: { zh: "自动速度", en: "Auto pace" },
  language: { zh: "语言", en: "Language" },
  tipsAria: { zh: "AI 提示", en: "AI tips" },
  tipAria: { zh: "AI 提示出牌", en: "AI tip" },
  brand: { zh: "AA Mahjong", en: "AA Mahjong" },
  menu: { zh: "菜单", en: "Menu" },
  more: { zh: "更多", en: "More" },
  fanUnit: { zh: "番", en: "fan" },
  stakeAmount: { zh: "赌注", en: "Stake" },
  rollingFan: { zh: "滚番", en: "Rolling fan" },
  eggMoney: { zh: "蛋钱", en: "Egg money" },
  beats: { zh: "击败", en: "Beats" },
  fangPao: { zh: "放炮 +1番", en: "Discarder +1 fan" },
  nextConfirmTitle: { zh: "结束本局？", en: "End this hand?" },
  nextConfirmBody: {
    zh: "当前这局还没打完。确定要结束并进入下一局吗？",
    en: "This hand is still in progress. End it and go to the next hand?",
  },
  nextConfirmYes: { zh: "结束并下一局", en: "End & next" },
  nextConfirmNo: { zh: "继续打", en: "Keep playing" },
  rulesHeading: { zh: "本局规则", en: "Table rules" },
} as const;

export type I18nKey = keyof typeof dict;

let lang: Lang = "zh";

export function loadLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "en" || v === "zh") lang = v;
  } catch {
    /* ignore */
  }
  return lang;
}

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
}

export function t(key: I18nKey): string {
  return dict[key][lang];
}

/** Bilingual button label: prefer current lang, keep short counterpart optional. */
export function tb(zhKey: I18nKey, enKey?: I18nKey): string {
  const a = t(zhKey);
  if (lang === "zh") return a;
  return t(enKey ?? zhKey);
}

const TIPS_KEY = "aa-mahjong-tips";
let tipsOn = false;

export function loadTips(): boolean {
  try {
    const v = localStorage.getItem(TIPS_KEY);
    if (v === "1" || v === "true" || v === "on") tipsOn = true;
    else if (v === "0" || v === "false" || v === "off") tipsOn = false;
  } catch {
    /* ignore */
  }
  return tipsOn;
}

export function getTips(): boolean {
  return tipsOn;
}

export function setTips(next: boolean): void {
  tipsOn = next;
  try {
    localStorage.setItem(TIPS_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const AUTO_TIPS_KEY = "aa-mahjong-auto-tips";
let autoTipsOn = false;

export function loadAutoTips(): boolean {
  try {
    const v = localStorage.getItem(AUTO_TIPS_KEY);
    if (v === "1" || v === "true" || v === "on") autoTipsOn = true;
    else if (v === "0" || v === "false" || v === "off") autoTipsOn = false;
  } catch {
    /* ignore */
  }
  return autoTipsOn;
}

export function getAutoTips(): boolean {
  return autoTipsOn;
}

export function setAutoTips(next: boolean): void {
  autoTipsOn = next;
  try {
    localStorage.setItem(AUTO_TIPS_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const AUTO_PACE_KEY = "aa-mahjong-auto-pace";
export type AutoPace = "fast" | "slow";
let autoPace: AutoPace = "fast";

export function loadAutoPace(): AutoPace {
  try {
    const v = localStorage.getItem(AUTO_PACE_KEY);
    if (v === "slow" || v === "fast") autoPace = v;
  } catch {
    /* ignore */
  }
  return autoPace;
}

export function getAutoPace(): AutoPace {
  return autoPace;
}

export function setAutoPace(next: AutoPace): void {
  autoPace = next === "slow" ? "slow" : "fast";
  try {
    localStorage.setItem(AUTO_PACE_KEY, autoPace);
  } catch {
    /* ignore */
  }
}

/** Multiply Auto play delays: Fast is snappy, Slow is clearly watchable. */
export function paceFactor(): number {
  return autoPace === "slow" ? 5 : 0.65;
}

