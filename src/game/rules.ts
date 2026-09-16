/** Northeast / Changchun-style table rule toggles for a run. */

export type PayDiscardMode = "allThree" | "discarderOnly";
export type FanMode = "rolling" | "flat";

export interface TableRules {
  /** 点炮：三家付（放炮+1）vs 放炮者一家付 */
  payDiscard: PayDiscardMode;
  /** 滚番 stake×2^(fan-1) vs 平番 stake×fan */
  fanMode: FanMode;
  /** 蛋钱（杠即时结算） */
  eggMoney: boolean;
  /** 允许立胡（门清未开也可胡） */
  allowLiHu: boolean;
  /** 必须三门齐 */
  requireThreeSuits: boolean;
  /** 必须有刻（或中发白将） */
  requireKeOrDragonEyes: boolean;
  /** 必须有幺九/字 */
  requireYaojiu: boolean;
}

export const DEFAULT_RULES: TableRules = {
  payDiscard: "allThree",
  fanMode: "rolling",
  eggMoney: true,
  allowLiHu: true,
  requireThreeSuits: true,
  requireKeOrDragonEyes: true,
  requireYaojiu: true,
};

const KEY = "aa-mahjong-table-rules";

let active: TableRules = { ...DEFAULT_RULES };

function clampRules(r: Partial<TableRules> | null | undefined): TableRules {
  const d = DEFAULT_RULES;
  if (!r || typeof r !== "object") return { ...d };
  const pay = r.payDiscard === "discarderOnly" ? "discarderOnly" : "allThree";
  const fan = r.fanMode === "flat" ? "flat" : "rolling";
  return {
    payDiscard: pay,
    fanMode: fan,
    eggMoney: r.eggMoney !== false,
    allowLiHu: r.allowLiHu !== false,
    requireThreeSuits: r.requireThreeSuits !== false,
    requireKeOrDragonEyes: r.requireKeOrDragonEyes !== false,
    requireYaojiu: r.requireYaojiu !== false,
  };
}

export function loadRules(): TableRules {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      active = { ...DEFAULT_RULES };
      return active;
    }
    active = clampRules(JSON.parse(raw) as Partial<TableRules>);
    return active;
  } catch {
    active = { ...DEFAULT_RULES };
    return active;
  }
}

export function getRules(): TableRules {
  return active;
}

export function setRules(next: Partial<TableRules>): TableRules {
  active = clampRules({ ...active, ...next });
  try {
    localStorage.setItem(KEY, JSON.stringify(active));
  } catch {
    /* ignore */
  }
  return active;
}

export function resetRules(): TableRules {
  active = { ...DEFAULT_RULES };
  try {
    localStorage.setItem(KEY, JSON.stringify(active));
  } catch {
    /* ignore */
  }
  return active;
}

/** Cash for a given fan under current fan mode. */
export function payoutForFan(stake: number, fan: number, rules: TableRules = active): number {
  if (stake <= 0 || fan < 1) return 0;
  if (rules.fanMode === "flat") return stake * fan;
  return stake * 2 ** (fan - 1);
}
