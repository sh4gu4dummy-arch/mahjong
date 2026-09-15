export type Lang = "zh" | "en";

const KEY = "aa-mahjong-lang";

const dict = {
  mute: { zh: "静音", en: "Mute" },
  unmute: { zh: "取消静音", en: "Unmute" },
  shop: { zh: "小卖部", en: "Shop" },
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
  inWall: { zh: "张", en: "in wall" },
  lastDiscard: { zh: "上家打出", en: "Last discard" },
  dongbei: { zh: "东北麻将", en: "Northeast Mahjong" },
  chooseStake: { zh: "请选择本局赌注。", en: "Choose a stake for this hand." },
  youHave: { zh: "你有", en: "You have" },
  prideNote: {
    zh: "你是 $0 — 继续打为面子。赢了再攒钱。",
    en: "You are at $0 — play on for pride. Win to rebuild the stack.",
  },
  payNote: {
    zh: "点炮由放炮者付；自摸其余三家各付。只有你的钱包会变。",
    en: "Only the discarder pays on a discard win; on self-draw the other three pay. Only your wallet changes.",
  },
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
  drawGameSub: { zh: "牌墙摸完，本局赌注不动。", en: "Wall exhausted — stakes stay." },
  nextRound: { zh: "下一局", en: "Next round" },
  resetCash: { zh: "现金恢复到 $100", en: "Reset cash to $100" },
  youWin: { zh: "你胡了", en: "You win" },
  youPaid: { zh: "你付了", en: "You paid" },
  youGot: { zh: "你收了", en: "You received" },
  noWalletChange: { zh: "你的钱包未变（不是你放炮/也不是自摸付家）", en: "Your wallet unchanged (you didn't pay or get paid this hand)" },
  someoneWins: { zh: "胡牌", en: "wins" },
  selfDrawHow: { zh: "自摸", en: "Self-draw" },
  discardWinHow: { zh: "点炮", en: "Discard win" },
  shopTitle: { zh: "小卖部", en: "Shop" },
  shopSub: { zh: "共享小卖部 · 钱包", en: "Shared shop · Wallet" },
  shopBoth: { zh: "两人短暂同持", en: "both of you hold it briefly" },
  buy: { zh: "买", en: "Buy" },
  close: { zh: "关闭", en: "Close" },
  walletEmpty: {
    zh: "钱包空了 — 仍可浏览。赢一把再充值。",
    en: "Wallet empty — you can still browse. Win a hand to refill.",
  },
  needMoney: { zh: "钱不够啦", en: "Need more cash" },
  forBoth: { zh: "给你俩！", en: "for both of you!" },
  hint: {
    zh: "吃上家 · 碰杠胡任意家 · 暗杠不算开门 · 胡牌需开门/有刻或中发白将/幺九/三门齐",
    en: "Chow only from left · pung/kong/win from anyone · concealed kong does not open · win needs open / pung or dragon eyes / terminal / 3 suits",
  },
  dealing: { zh: "发牌中…", en: "Dealing…" },
  paySelf: { zh: "自摸：三家各付赌注", en: "Self-draw: each of three pays the stake" },
  payDiscard: { zh: "点炮：放炮者付赌注", en: "Discard win: discarder pays the stake" },
  noCashMoved: { zh: "无现金变动（破产或 $0 赌注）", en: "no cash moved (broke or $0 bet)" },
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
  language: { zh: "语言", en: "Language" },
  tipsAria: { zh: "AI 提示", en: "AI tips" },
  tipAria: { zh: "AI 提示出牌", en: "AI tip" },
  brand: { zh: "AA 麻将", en: "AA Mahjong" },
  fanUnit: { zh: "番", en: "fan" },
  stakeAmount: { zh: "赌注", en: "Stake" },
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
