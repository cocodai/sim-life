import { useMemo, useState } from "react";

const ASSET_BASE = import.meta.env.BASE_URL || "/";
const asset = (name) => `${ASSET_BASE}${name.replace(/^\/+/, "")}`;

const STORAGE_KEY = "simlife.players.v1";

function loadPlayers() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePlayers(players) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  } catch {
    /* ignore quota or privacy errors */
  }
}

function newPlayer(name) {
  const id = `p_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  return {
    id,
    name: name.trim() || "玩家",
    year: 1,
    carryOver: null,
    pastSummaries: [],
    createdAt: Date.now(),
    lastPlayed: Date.now(),
  };
}

const MONTHS_PER_YEAR = 12;
const MIN_FOOD = 3000;
const FOOD_MIN = 8000;
const FOOD_MAX = 14000;
const RENT_COST = 18000;
const HOME_COST = 3000;
const TRANSPORT_COST = 1200;

const INFLATION_RATE = 0.02;
const inflationMult = (year) => Math.pow(1 + INFLATION_RATE, Math.max(0, year - 1));
const inflated = (base, year) => Math.round(base * inflationMult(year));

const CAR_PRICE = 1_300_000;
const CAR_TAX_INSURANCE = 50_000;
const CAR_TAX_MONTH = 8;
const CAR_GAS = 3_000;
const CAR_PARKING = 5_000;
const CAR_ENERGY_BONUS = 10;
const CAR_HAPPINESS_BONUS = 10;

const WEEKEND_ENERGY = 10;
const WEEKEND_HAPPINESS = 14;
const LEAVE_ENERGY_PER_DAY = WEEKEND_ENERGY / 2;
const LEAVE_HAPPINESS_PER_DAY = 5;

const BASE_MONTHLY_ENERGY = 6;
const BASE_MONTHLY_HAPPINESS = 6;
const OVERTIME_HAPPINESS_PER_HOUR = 3;
const DEFICIT_HAPPINESS_PENALTY = 12;
const BROKE_HAPPINESS_PENALTY = 30;

const STATUS_TIERS = [
  { id: "start", min: 0, image: asset("start.png"), title: "新 手 上 路" },
  { id: "t30", min: 300_000, image: asset("30.png"), title: "小 有 積 蓄" },
  { id: "t50", min: 500_000, image: asset("50.png"), title: "穩 定 小 資" },
  { id: "t100", min: 1_000_000, image: asset("100.png"), title: "百 萬 俱 樂 部" },
];

function getTierIdx(savings) {
  let idx = 0;
  for (let i = 0; i < STATUS_TIERS.length; i++) {
    if (savings >= STATUS_TIERS[i].min) idx = i;
  }
  return idx;
}

const ENTERTAINMENT_OPTIONS = [
  { id: "small", name: "小確幸", cost: 1500, happinessDelta: 6, energyDelta: 2, cap: 5, desc: "外食 + 咖啡廳小旅行" },
  { id: "weekend", name: "週末出遊", cost: 4000, happinessDelta: WEEKEND_HAPPINESS, energyDelta: WEEKEND_ENERGY, cap: 4, desc: "北海岸 / 陽明山走走" },
  { id: "splurge", name: "月底血拼", cost: 8000, happinessDelta: 22, energyDelta: 4, cap: 2, desc: "購物 + 聚餐 + KTV" },
];

const EVENT_POOL = [
  { label: "機車被開罰單", delta: -600, tag: "意外" },
  { label: "租屋處漏水", delta: -2000, tag: "居住" },
  { label: "統一發票中獎", delta: 200, tag: "好運" },
  { label: "朋友結婚紅包", delta: -2000, tag: "社交" },
  { label: "公司年終小獎金", delta: 3000, tag: "好運" },
  { label: "生病就醫", delta: -1200, tag: "意外", energyDelta: -10 },
  { label: "在捷運撿到 500 元", delta: 500, tag: "好運" },
  { label: "手機螢幕摔破", delta: -3500, tag: "意外" },
  { label: "被同事揪團吃居酒屋", delta: -1500, tag: "社交", happinessDelta: 15, inflatable: true },
  { label: "追劇熬夜到早上", delta: 0, tag: "日常", energyDelta: -15, happinessDelta: 8 },
  { label: "颱風假睡到飽", delta: 0, tag: "日常", energyDelta: 12 },
];

const ACHIEVEMENTS = [
  { id: "master", name: "生存大師", requirement: "綜合評分 ≥ 80", test: (s) => s.score >= 80 },
  { id: "balanced", name: "斜槓平衡人", requirement: "能量、快樂都 ≥ 70", test: (s) => s.avgEnergy >= 70 && s.avgHappiness >= 70 },
  { id: "saver", name: "存股小資族", requirement: "年底存款 ≥ 100,000", test: (s) => s.savings >= 100000 },
  { id: "slave", name: "台北社畜", requirement: "平均能量 < 40", test: (s) => s.avgEnergy < 40 },
  { id: "broke", name: "月光戰士", requirement: "全年 ≥ 3 個月進入極簡模式", test: (s) => s.brokeMonths >= 3 },
  { id: "lucky", name: "小確幸人生", requirement: "平均快樂 ≥ 75", test: (s) => s.avgHappiness >= 75 },
];

const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const nt = (n) => `NT$ ${Math.round(n).toLocaleString()}`;
const pickEvent = () => EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

function generateUpcoming(year) {
  const mult = inflationMult(year);
  return {
    baseFood: Math.round(randInt(FOOD_MIN, FOOD_MAX) * mult),
    entertainment: { small: 0, weekend: 0, splurge: 0 },
    leaveDays: 0,
  };
}

function StatBar({ label, value, color, suffix = "" }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex-1 min-w-[180px]">
      <div className="flex justify-between text-xs mb-1 text-slate-300">
        <span>{label}</span>
        <span>{Math.round(value)}{suffix}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-700/70 overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function MoneyPill({ savings }) {
  const positive = savings >= 0;
  return (
    <div className={`px-4 py-2 rounded-xl border ${positive ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300" : "border-rose-400/50 bg-rose-500/10 text-rose-300"} font-mono text-sm`}>
      存款 {nt(savings)}
    </div>
  );
}

function RadarChart({ data }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 95;
  const axes = data.length;
  const angleFor = (i) => (Math.PI * 2 * i) / axes - Math.PI / 2;

  const pointFor = (i, ratio) => {
    const a = angleFor(i);
    return [cx + Math.cos(a) * radius * ratio, cy + Math.sin(a) * radius * ratio];
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];

  const polygon = data.map((d, i) => pointFor(i, clamp(d.value, 0, 100) / 100).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size + 40}`} className="w-full max-w-[320px]">
      {gridLevels.map((lvl, i) => (
        <polygon
          key={i}
          points={data.map((_, j) => pointFor(j, lvl).join(",")).join(" ")}
          fill="none"
          stroke="rgba(148,163,184,0.3)"
          strokeDasharray={i === gridLevels.length - 1 ? "0" : "2 3"}
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = pointFor(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(148,163,184,0.25)" />;
      })}
      <polygon points={polygon} fill="rgba(129,140,248,0.35)" stroke="#818cf8" strokeWidth="2" />
      {data.map((d, i) => {
        const [x, y] = pointFor(i, 1.2);
        return (
          <text key={d.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#cbd5e1">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

function FireworkBurst({ x, y, delay = 0, count = 28, size = 180 }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        const dist = size * (0.65 + Math.random() * 0.6);
        const hue = Math.floor(Math.random() * 360);
        return {
          fx: Math.cos(angle) * dist,
          fy: Math.sin(angle) * dist,
          hue,
          particleDelay: Math.random() * 0.2,
        };
      }),
    [count, size]
  );

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {particles.map((p, i) => (
        <span
          key={i}
          className="firework-particle absolute w-2 h-2 rounded-full"
          style={{
            left: 0,
            top: 0,
            background: `hsl(${p.hue}, 100%, 65%)`,
            boxShadow: `0 0 12px hsl(${p.hue}, 100%, 75%), 0 0 24px hsl(${p.hue}, 100%, 60%)`,
            animationDelay: `${delay + p.particleDelay}s`,
            "--fx": `${p.fx}px`,
            "--fy": `${p.fy}px`,
          }}
        />
      ))}
    </div>
  );
}

function CelebrationOverlay({
  imageSrc,
  title,
  emoji = "🎉",
  multiply = false,
  whiteFrame = true,
  withFireworks = true,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden pointer-events-none car-overlay-fadein">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {withFireworks && (
        <>
          <FireworkBurst x={25} y={28} delay={0} />
          <FireworkBurst x={75} y={28} delay={0.3} />
          <FireworkBurst x={15} y={55} delay={0.6} size={140} />
          <FireworkBurst x={85} y={55} delay={0.9} size={140} />
          <FireworkBurst x={50} y={20} delay={1.2} size={220} count={36} />
          <FireworkBurst x={30} y={75} delay={1.5} />
          <FireworkBurst x={70} y={75} delay={1.8} />
        </>
      )}

      <div className="relative z-10 flex flex-col items-center car-reveal-anim">
        <div className="relative">
          <div className="absolute -inset-4 bg-amber-300/30 rounded-3xl blur-2xl" />
          <div
            className={`relative rounded-3xl p-3 shadow-[0_0_80px_rgba(251,191,36,0.9),0_0_160px_rgba(239,68,68,0.4)] border-4 border-amber-300 ${
              whiteFrame ? "bg-white" : "bg-transparent"
            }`}
          >
            <img
              src={imageSrc}
              alt={title}
              className="block w-[320px] md:w-[460px] object-contain"
              style={multiply ? { mixBlendMode: "multiply" } : undefined}
            />
          </div>
        </div>
        <div
          className="mt-6 text-amber-300 font-black text-3xl md:text-4xl tracking-[0.4em] text-center"
          style={{
            textShadow:
              "0 2px 0 #7f1d1d, 0 -1px 0 #fbbf24, 3px 3px 0 rgba(0,0,0,0.7), 0 0 20px rgba(251,191,36,0.6)",
          }}
        >
          {emoji} {title} {emoji}
        </div>
      </div>
    </div>
  );
}

function PlayerSelectScreen({ players, onSelect, onCreate, onDelete }) {
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName("");
  };

  const sorted = [...players].sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="text-center mb-6">
        <div className="text-xs tracking-[0.4em] text-amber-300 font-mono">SELECT PLAYER</div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mt-1">選 擇 玩 家</h1>
        <p className="text-slate-400 text-sm mt-2">每位玩家的年數、存款、歷年紀錄都會分開保存。</p>
      </div>

      <div className="space-y-3 mb-6">
        {sorted.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-600 text-center text-slate-500">
            還沒有任何玩家檔案，先建立一個吧 👇
          </div>
        ) : (
          sorted.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700 hover:border-amber-300/60 transition"
            >
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className="flex-1 flex items-center justify-between gap-3 text-left"
              >
                <div>
                  <div className="text-white font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-400 font-mono">
                    Year {p.year} · 已完成 {p.pastSummaries?.length ?? 0} 年
                    {p.carryOver?.savings != null && (
                      <span className="ml-2 text-emerald-300">
                        💰 {nt(p.carryOver.savings)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-amber-300 text-xl">▶</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`刪除玩家「${p.name}」？此操作無法復原。`)) onDelete(p.id);
                }}
                className="text-xs text-rose-400 hover:text-rose-200 px-2"
                title="刪除"
              >
                🗑
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700">
        <div className="text-sm text-slate-300 mb-2">建立新玩家</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            maxLength={16}
            placeholder="輸入玩家名稱"
            className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold"
          >
            ＋ 新增
          </button>
        </div>
      </div>
    </div>
  );
}

function LandingScreen({ onEnter }) {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-black">
      <img
        src={asset("cover.jpg")}
        alt="雙北生存戰"
        className="absolute inset-0 w-full h-full object-contain"
      />
      <div className="absolute inset-0 pointer-events-none crt-overlay opacity-30" />

      <div className="relative z-10 flex flex-col items-center pb-8 px-6 mt-auto">
        <div className="mb-4 text-center">
          <div className="text-xs tracking-[0.4em] text-amber-300 font-mono arcade-blink drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
            ▶ INSERT COIN ◀
          </div>
        </div>

        <button
          type="button"
          onClick={onEnter}
          className="arcade-btn group relative px-10 py-4 rounded-md bg-gradient-to-b from-red-500 via-red-600 to-red-800 border-2 border-amber-200 text-white font-black tracking-[0.3em] text-xl md:text-2xl transition hover:scale-105"
          style={{
            textShadow:
              "0 2px 0 #7f1d1d, 0 -1px 0 #fbbf24, 2px 2px 0 rgba(0,0,0,0.6)",
          }}
        >
          <span className="relative z-10">進 入 遊 戲</span>
          <span className="absolute inset-0 rounded-md bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
        </button>

        <div className="mt-4 text-[11px] font-mono text-amber-100 tracking-widest text-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          © 1993 SEGA · PRESS START TO PLAY
        </div>
      </div>
    </div>
  );
}

function PlayerBadge({ playerName, onSwitchPlayer, className = "" }) {
  if (!playerName) return null;
  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <span className="px-2 py-1 rounded-md bg-slate-800 border border-slate-600 text-amber-200 font-mono">
        👤 {playerName}
      </span>
      {onSwitchPlayer && (
        <button
          type="button"
          onClick={onSwitchPlayer}
          className="text-slate-400 hover:text-white underline underline-offset-2"
        >
          切換玩家
        </button>
      )}
    </div>
  );
}

function SetupScreen({ onStart, carryOver, previousYear, playerName, onSwitchPlayer }) {
  const [salary, setSalary] = useState(carryOver?.nextSalaryHint ?? 42000);
  const [workHours, setWorkHours] = useState(9);
  const [housing, setHousing] = useState("rent");
  const [annualLeave, setAnnualLeave] = useState(7);

  const bonusPct = carryOver?.salaryBonusPct ?? 0;
  const adjustedSalary = Math.round(salary * (1 + bonusPct / 100));

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
        <h1 className="text-4xl font-bold text-white">雙北生存戰</h1>
        <PlayerBadge playerName={playerName} onSwitchPlayer={onSwitchPlayer} />
      </div>
      <p className="text-slate-400 mb-8">
        12 個月的模擬市民式生活挑戰：在高物價與低能量之間找到平衡。
      </p>

      {carryOver && (
        <div className="mb-6 p-4 rounded-xl border border-amber-400/40 bg-amber-500/10 text-amber-200 text-sm">
          <div className="font-semibold">第 {previousYear + 1} 年開始</div>
          <div>上一年度保留存款：{nt(carryOver.savings)}</div>
          {bonusPct > 0 && (
            <div className="mt-1">🎯 上一年能量維持優秀 → 本年薪資隱藏加成 +{bonusPct}%</div>
          )}
        </div>
      )}

      <div className="space-y-5 bg-slate-800/70 border border-slate-700 rounded-2xl p-6">
        <label className="block">
          <span className="text-sm text-slate-300">月薪 (NT$)</span>
          <input
            type="number"
            value={salary}
            min={20000}
            step={1000}
            onChange={(e) => setSalary(Number(e.target.value) || 0)}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
          />
          {bonusPct > 0 && (
            <div className="text-xs text-emerald-300 mt-1">
              實際到手（含成長加成）：{nt(adjustedSalary)}
            </div>
          )}
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">平均每日工時 (小時)</span>
          <input
            type="number"
            value={workHours}
            min={6}
            max={16}
            step={0.5}
            onChange={(e) => setWorkHours(Number(e.target.value) || 0)}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
          />
          <div className="text-xs text-slate-500 mt-1">
            每超過 8 小時，每月身心能量額外多扣 10%（每小時）。
          </div>
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">今年度年資假天數</span>
          <input
            type="number"
            value={annualLeave}
            min={0}
            max={30}
            step={1}
            onChange={(e) => setAnnualLeave(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
          />
          <div className="text-xs text-slate-500 mt-1">
            每月可指定請假天數，1 天年假 = +{LEAVE_ENERGY_PER_DAY}% 能量 / +{LEAVE_HAPPINESS_PER_DAY}% 快樂；超過年假改計事假，每天扣月薪 1/30。
          </div>
        </label>

        <div>
          <span className="text-sm text-slate-300">居住狀態</span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[
              { v: "rent", title: "租屋", sub: `-${nt(RENT_COST)} / 月` },
              { v: "home", title: "住家裡", sub: `-${nt(HOME_COST)} / 月` },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setHousing(opt.v)}
                className={`p-3 rounded-xl border text-left transition ${
                  housing === opt.v
                    ? "border-indigo-400 bg-indigo-500/15 text-white"
                    : "border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-500"
                }`}
              >
                <div className="font-medium">{opt.title}</div>
                <div className="text-xs text-slate-400">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onStart({ salary: adjustedSalary, workHours, housing, annualLeaveTotal: annualLeave })}
        className="mt-6 w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold shadow-lg shadow-indigo-900/40 transition"
      >
        開始第 {(previousYear ?? 0) + 1} 年生活
      </button>
    </div>
  );
}

function simulateMonth(state, upcoming, year) {
  const { salary, workHours, housing, energy, happiness, savings, hasCar, annualLeaveRemaining, month } = state;
  const { baseFood, entertainment, leaveDays } = upcoming;

  const mult = inflationMult(year);

  const paidLeave = Math.min(leaveDays, annualLeaveRemaining);
  const unpaidLeave = Math.max(0, leaveDays - annualLeaveRemaining);
  const unpaidLeaveCost = Math.round((salary / 30) * unpaidLeave);

  const housingCost = Math.round((housing === "rent" ? RENT_COST : HOME_COST) * mult);
  const transport = hasCar ? 0 : Math.round(TRANSPORT_COST * mult);
  let food = baseFood;

  const entertainmentLines = ENTERTAINMENT_OPTIONS.map((o) => {
    const count = entertainment[o.id] ?? 0;
    const unitCost = Math.round(o.cost * mult);
    return {
      option: o,
      count,
      unitCost,
      totalCost: unitCost * count,
      totalHappiness: o.happinessDelta * count,
      totalEnergy: o.energyDelta * count,
    };
  }).filter((l) => l.count > 0);
  const entertainmentCost = entertainmentLines.reduce((a, l) => a + l.totalCost, 0);

  const carFixed = hasCar ? CAR_GAS + CAR_PARKING : 0;
  const carTax = hasCar && month === CAR_TAX_MONTH ? CAR_TAX_INSURANCE : 0;

  const provisionalBalance =
    salary -
    housingCost -
    transport -
    food -
    entertainmentCost -
    unpaidLeaveCost -
    carFixed -
    carTax;

  let broke = false;
  if (savings + provisionalBalance < 0) {
    food = MIN_FOOD;
    broke = true;
  }

  const event = pickEvent();
  const eventDelta = event.inflatable ? Math.round(event.delta * mult) : event.delta;

  const overtimeHours = Math.max(0, workHours - 8);
  const overtimeEnergyPenalty = overtimeHours * 10;
  const overtimeHappinessPenalty = overtimeHours * OVERTIME_HAPPINESS_PER_HOUR;

  const breakdown = [];

  breakdown.push({ label: "月薪", money: salary });

  if (unpaidLeave > 0) {
    breakdown.push({
      label: `事假扣薪（${unpaidLeave} 天 × 1/30）`,
      money: -unpaidLeaveCost,
    });
  }

  breakdown.push({
    label: housing === "rent" ? "租屋 (含水電)" : "住家裡",
    money: -housingCost,
  });
  if (!hasCar) {
    breakdown.push({ label: "交通 TPASS", money: -transport });
  }

  breakdown.push({
    label: broke
      ? `伙食（極簡，原預算 ${baseFood.toLocaleString()}）`
      : `伙食（浮動 ${baseFood.toLocaleString()}）`,
    money: -food,
    energy: food === MIN_FOOD ? -8 : 0,
  });

  entertainmentLines.forEach((l) => {
    breakdown.push({
      label: `娛樂：${l.option.name} × ${l.count}`,
      money: -l.totalCost,
      happiness: l.totalHappiness,
      energy: l.totalEnergy,
    });
  });

  if (leaveDays > 0) {
    breakdown.push({
      label: `請假休息（${paidLeave} 年假${unpaidLeave > 0 ? ` + ${unpaidLeave} 事假` : ""}）`,
      energy: leaveDays * LEAVE_ENERGY_PER_DAY,
      happiness: leaveDays * LEAVE_HAPPINESS_PER_DAY,
    });
  }

  if (overtimeHours > 0) {
    breakdown.push({
      label: `每日加班 ${overtimeHours} 小時`,
      energy: -overtimeEnergyPenalty,
      happiness: -overtimeHappinessPenalty,
    });
  }

  if (hasCar) {
    breakdown.push({
      label: "有車加成（自由移動）",
      energy: CAR_ENERGY_BONUS,
      happiness: CAR_HAPPINESS_BONUS,
    });
    breakdown.push({ label: "汽車：油錢", money: -CAR_GAS });
    breakdown.push({ label: "汽車：停車費", money: -CAR_PARKING });
    if (carTax > 0) {
      breakdown.push({ label: "汽車：牌照稅 + 保險費（8月）", money: -carTax });
    }
  }

  breakdown.push({
    label: `事件：${event.label}${event.inflatable ? "（隨通膨）" : ""}`,
    money: eventDelta,
    energy: event.energyDelta ?? 0,
    happiness: event.happinessDelta ?? 0,
  });

  const monthlyNet = breakdown.reduce((a, b) => a + (b.money ?? 0), 0);
  const deficit = monthlyNet < 0;

  if (broke) {
    breakdown.push({
      label: "極簡模式生活壓力",
      happiness: -BROKE_HAPPINESS_PENALTY,
    });
  } else if (deficit) {
    breakdown.push({
      label: "赤字壓力",
      happiness: -DEFICIT_HAPPINESS_PENALTY,
    });
  }

  const energyDelta = breakdown.reduce((a, b) => a + (b.energy ?? 0), 0) + BASE_MONTHLY_ENERGY;
  const happinessDelta = breakdown.reduce((a, b) => a + (b.happiness ?? 0), 0) + BASE_MONTHLY_HAPPINESS;

  const newSavings = savings + monthlyNet;
  const newEnergy = clamp(energy + energyDelta);
  const newHappiness = clamp(happiness + happinessDelta);

  return {
    broke,
    event,
    food,
    baseFood,
    housingCost,
    transport,
    entertainmentLines,
    entertainmentCost,
    paidLeave,
    unpaidLeave,
    unpaidLeaveCost,
    leaveDays,
    monthlyNet,
    newSavings,
    newEnergy,
    newHappiness,
    energyDelta,
    happinessDelta,
    deficit,
    breakdown,
  };
}

function GameScreen({ config, onFinishYear, carryOver, year, playerName, onSwitchPlayer }) {
  const [state, setState] = useState(() => {
    const initEnergy = 80;
    const initSavings = carryOver?.savings ?? 0;
    return {
      ...config,
      energy: initEnergy,
      happiness: 70,
      savings: initSavings,
      month: 1,
      history: [],
      lastResult: null,
      upcoming: generateUpcoming(year),
      annualLeaveRemaining: config.annualLeaveTotal ?? 0,
      hasCar: carryOver?.hasCar ?? false,
      celebratedTierIdx: getTierIdx(initSavings),
    };
  });

  const [celebration, setCelebration] = useState(null);

  const triggerCelebration = (payload) => {
    setCelebration(payload);
    setTimeout(() => setCelebration(null), 3400);
  };

  const checkTierUp = (prevIdx, newSavings) => {
    const newIdx = getTierIdx(newSavings);
    if (newIdx > prevIdx) {
      const tier = STATUS_TIERS[newIdx];
      triggerCelebration({ imageSrc: tier.image, title: tier.title, emoji: "💎" });
      return newIdx;
    }
    return prevIdx;
  };

  const advance = () => {
    if (state.month > MONTHS_PER_YEAR) return;

    const result = simulateMonth(state, state.upcoming, year);

    const nextHistory = [
      ...state.history,
      {
        month: state.month,
        broke: result.broke,
        deficit: result.deficit,
        event: result.event,
        breakdown: result.breakdown,
        net: result.monthlyNet,
        savings: result.newSavings,
        energy: result.newEnergy,
        happiness: result.newHappiness,
        paidLeave: result.paidLeave,
        unpaidLeave: result.unpaidLeave,
      },
    ];

    const nextMonth = state.month + 1;
    const nextUpcoming = nextMonth <= MONTHS_PER_YEAR ? generateUpcoming(year) : null;

    const nextTierIdx = checkTierUp(state.celebratedTierIdx, result.newSavings);

    if (nextTierIdx === state.celebratedTierIdx && result.deficit) {
      triggerCelebration({
        imageSrc: asset("zero.png"),
        title: "當 月 赤 字",
        emoji: "💸",
        withFireworks: false,
      });
    }

    const nextState = {
      ...state,
      savings: result.newSavings,
      energy: result.newEnergy,
      happiness: result.newHappiness,
      month: nextMonth,
      history: nextHistory,
      lastResult: result,
      upcoming: nextUpcoming,
      annualLeaveRemaining: state.annualLeaveRemaining - result.paidLeave,
      celebratedTierIdx: nextTierIdx,
    };

    setState(nextState);

    if (nextState.month > MONTHS_PER_YEAR) {
      onFinishYear(nextState);
    }
  };

  const buyCar = () => {
    if (state.hasCar) return;
    setState((s) => ({ ...s, hasCar: true, savings: s.savings - CAR_PRICE }));
    triggerCelebration({ imageSrc: asset("x6.jpg"), title: "恭 喜 購 車", emoji: "🚗", multiply: true });
  };

  const setLeaveDays = (days) => {
    setState((s) => (s.upcoming ? { ...s, upcoming: { ...s.upcoming, leaveDays: Math.max(0, days) } } : s));
  };

  const setEntertainmentCount = (id, delta) => {
    setState((s) => {
      if (!s.upcoming) return s;
      const opt = ENTERTAINMENT_OPTIONS.find((o) => o.id === id);
      if (!opt) return s;
      const current = s.upcoming.entertainment[id] ?? 0;
      const next = Math.max(0, Math.min(opt.cap, current + delta));
      return {
        ...s,
        upcoming: { ...s.upcoming, entertainment: { ...s.upcoming.entertainment, [id]: next } },
      };
    });
  };

  const { month, energy, happiness, savings, lastResult, history, upcoming, annualLeaveRemaining, hasCar, salary } = state;
  const displayMonth = Math.min(month, MONTHS_PER_YEAR);

  const leaveDays = upcoming?.leaveDays ?? 0;
  const previewPaidLeave = Math.min(leaveDays, annualLeaveRemaining);
  const previewUnpaidLeave = Math.max(0, leaveDays - annualLeaveRemaining);
  const previewLeaveCost = Math.round((salary / 30) * previewUnpaidLeave);

  const tierIdx = getTierIdx(savings);
  const currentTier = STATUS_TIERS[tierIdx];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {celebration && <CelebrationOverlay {...celebration} />}
      <div className="flex justify-end mb-2">
        <PlayerBadge playerName={playerName} onSwitchPlayer={onSwitchPlayer} />
      </div>
      <header className="flex items-center gap-4 mb-4">
        <div className="shrink-0">
          <div className="rounded-xl overflow-hidden border-2 border-amber-300/70 bg-slate-900 shadow-[0_0_20px_rgba(251,191,36,0.35)] w-20 md:w-24 aspect-[2/3]">
            <img
              key={currentTier.id}
              src={currentTier.image}
              alt={currentTier.title}
              className="block w-full h-full object-cover"
              style={{
                transform: "scale(1.55)",
                transformOrigin: "50% 48%",
              }}
            />
          </div>
          <div className="mt-1 text-center text-[10px] md:text-xs font-bold tracking-widest text-amber-200">
            {currentTier.title}
          </div>
        </div>
        <div className="flex-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400">Year {year}</div>
            <h2 className="text-2xl font-bold text-white">第 {displayMonth} 個月 / 12</h2>
          </div>
          <MoneyPill savings={savings} />
        </div>
      </header>

      <div className="flex flex-wrap gap-4 p-4 rounded-2xl bg-slate-800/70 border border-slate-700 mb-4">
        <StatBar label="身心能量" value={energy} color="bg-sky-400" suffix="%" />
        <StatBar label="快樂值" value={happiness} color="bg-pink-400" suffix="%" />
      </div>

      <section className="p-5 rounded-2xl bg-slate-900/80 border border-slate-700 mb-4 min-h-[220px]">
        {!lastResult ? (
          <div className="text-slate-300">
            <div className="text-lg font-semibold text-white mb-2">準備好了嗎？</div>
            <p>
              月薪 {nt(state.salary)}，每日工時 {state.workHours} 小時，居住：
              {state.housing === "rent" ? "租屋" : "住家裡"}。
            </p>
            <p className="mt-2 text-sm text-slate-400">
              按下方按鈕進入第 1 個月。每月支出包含：房租、TPASS、伙食，外加隨機事件。
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-md text-xs bg-indigo-500/20 text-indigo-200 border border-indigo-400/40">
                事件 / {lastResult.event.tag}
              </span>
              {lastResult.broke && (
                <span className="px-2 py-0.5 rounded-md text-xs bg-rose-500/20 text-rose-200 border border-rose-400/40">
                  極簡模式觸發
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">
              {lastResult.event.label}
              <span className={`ml-2 font-mono text-sm ${lastResult.event.delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {lastResult.event.delta >= 0 ? "+" : ""}{lastResult.event.delta}
              </span>
            </h3>

            <div className="text-sm">
              {lastResult.breakdown.map((line, i) => {
                const m = line.money ?? 0;
                const e = line.energy ?? 0;
                const h = line.happiness ?? 0;
                return (
                  <div key={`${i}-${line.label}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b border-slate-700/60">
                    <span className="text-slate-300">{line.label}</span>
                    <span className="flex items-center gap-2 font-mono text-xs">
                      {m !== 0 && (
                        <span className={m > 0 ? "text-emerald-300" : "text-rose-300"}>
                          {m > 0 ? "+" : ""}{Math.round(m).toLocaleString()}
                        </span>
                      )}
                      {e !== 0 && (
                        <span className={`px-1.5 py-0.5 rounded ${e > 0 ? "bg-sky-500/15 text-sky-300" : "bg-sky-900/40 text-sky-400"}`}>
                          {e > 0 ? "+" : ""}{Math.round(e * 10) / 10}⚡
                        </span>
                      )}
                      {h !== 0 && (
                        <span className={`px-1.5 py-0.5 rounded ${h > 0 ? "bg-pink-500/15 text-pink-300" : "bg-pink-900/40 text-pink-400"}`}>
                          {h > 0 ? "+" : ""}{Math.round(h * 10) / 10}♥
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 font-semibold">
                <span className="text-slate-200">本月小計</span>
                <span className="flex items-center gap-2 font-mono text-xs">
                  <span className={lastResult.monthlyNet >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {lastResult.monthlyNet >= 0 ? "+" : ""}{Math.round(lastResult.monthlyNet).toLocaleString()}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">
                    {lastResult.energyDelta >= 0 ? "+" : ""}{Math.round(lastResult.energyDelta)}⚡
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-300">
                    {lastResult.happinessDelta >= 0 ? "+" : ""}{Math.round(lastResult.happinessDelta)}♥
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {upcoming && (
        <section className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">下個月預算（第 {displayMonth} 個月）</h3>
            <span className="text-xs text-amber-300">
              通膨係數 ×{inflationMult(year).toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
              <div className="text-slate-400 text-xs">本月伙食預算（隨通膨）</div>
              <div className="text-white font-mono text-lg">{nt(upcoming.baseFood)}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
              <div className="text-slate-400 text-xs">
                本月{hasCar ? "房租（含通膨）" : "房租 + 交通（含通膨）"}
              </div>
              <div className="text-white font-mono text-lg">
                {nt(
                  inflated(state.housing === "rent" ? RENT_COST : HOME_COST, year) +
                    (hasCar ? 0 : inflated(TRANSPORT_COST, year))
                )}
              </div>
            </div>
          </div>

          <div className="mb-4 p-3 rounded-lg bg-slate-900/60 border border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="text-sm text-slate-300">本月請假天數</div>
              <div className="text-xs text-slate-400">
                剩餘年資假 <span className="text-white font-mono">{annualLeaveRemaining}</span> 天
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLeaveDays(leaveDays - 1)}
                disabled={leaveDays <= 0}
                className="w-9 h-9 rounded-lg bg-slate-700 text-white disabled:opacity-30"
              >
                −
              </button>
              <input
                type="number"
                value={leaveDays}
                min={0}
                max={22}
                onChange={(e) => setLeaveDays(Number(e.target.value) || 0)}
                className="w-20 text-center px-2 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white font-mono"
              />
              <button
                type="button"
                onClick={() => setLeaveDays(leaveDays + 1)}
                disabled={leaveDays >= 22}
                className="w-9 h-9 rounded-lg bg-slate-700 text-white disabled:opacity-30"
              >
                +
              </button>
              <span className="ml-1 text-xs text-slate-400">天</span>
            </div>
            {leaveDays > 0 && (
              <div className="mt-2 text-xs">
                <span className="text-sky-300">年假 {previewPaidLeave} 天</span>
                {previewUnpaidLeave > 0 && (
                  <span className="ml-2 text-rose-300">
                    事假 {previewUnpaidLeave} 天 · 扣薪 {nt(previewLeaveCost)}
                  </span>
                )}
                <span className="ml-2 text-slate-400">
                  → 能量 +{leaveDays * LEAVE_ENERGY_PER_DAY}⚡ / 快樂 +{leaveDays * LEAVE_HAPPINESS_PER_DAY}♥
                </span>
              </div>
            )}
          </div>

          <div className="mb-4 p-3 rounded-lg border border-slate-700 bg-slate-900/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {hasCar && (
                <div className="bg-white rounded-lg p-1.5 shrink-0 shadow-[0_0_18px_rgba(251,191,36,0.35)] border border-amber-300/60">
                  <img
                    src={asset("x6.jpg")}
                    alt="My BMW X6"
                    className="block w-28 h-16 object-contain"
                    style={{ mixBlendMode: "multiply" }}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-300">
                  {hasCar ? "我的愛車 · BMW X6" : "汽車"}
                </div>
                <div className="text-xs text-slate-500">
                  {hasCar
                    ? `每月 -${nt(CAR_GAS + CAR_PARKING)}（油+停車，免 TPASS），+${CAR_ENERGY_BONUS}⚡ / +${CAR_HAPPINESS_BONUS}♥；8月牌照稅+保險 -${nt(CAR_TAX_INSURANCE)}`
                    : `NT$ ${CAR_PRICE.toLocaleString()}（可預支，購車後獲得每月身心加成）`}
                </div>
              </div>
              <button
                type="button"
                onClick={buyCar}
                disabled={hasCar}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  hasCar
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 cursor-default"
                    : "bg-amber-500 hover:bg-amber-400 text-slate-900"
                }`}
              >
                {hasCar ? "✓ 已購車" : `購車 -${nt(CAR_PRICE)}`}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-300">本月娛樂費用（可累加，全 0 視為躺平）</div>
            <button
              type="button"
              onClick={() => setState((s) => (s.upcoming ? { ...s, upcoming: { ...s.upcoming, entertainment: { small: 0, weekend: 0, splurge: 0 } } } : s))}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              重置
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {ENTERTAINMENT_OPTIONS.map((opt) => {
              const count = upcoming.entertainment[opt.id] ?? 0;
              const unitCost = inflated(opt.cost, year);
              return (
                <div
                  key={opt.id}
                  className={`p-3 rounded-lg border transition ${
                    count > 0
                      ? "border-indigo-400 bg-indigo-500/10"
                      : "border-slate-600 bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm text-white">{opt.name}</div>
                      <div className="font-mono text-xs text-slate-400 mt-0.5">
                        單次 -{nt(unitCost)}
                        <span className="ml-1 text-pink-300">+{opt.happinessDelta}♥</span>
                        {opt.energyDelta > 0 && (
                          <span className="ml-1 text-sky-300">+{opt.energyDelta}⚡</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {opt.desc}（上限 {opt.cap} 次）
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEntertainmentCount(opt.id, -1)}
                      disabled={count <= 0}
                      className="w-8 h-8 rounded-lg bg-slate-700 text-white disabled:opacity-30"
                    >
                      −
                    </button>
                    <div className="flex-1 text-center font-mono text-white">{count} / {opt.cap}</div>
                    <button
                      type="button"
                      onClick={() => setEntertainmentCount(opt.id, +1)}
                      disabled={count >= opt.cap}
                      className="w-8 h-8 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:bg-slate-700 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  {count > 0 && (
                    <div className="mt-2 text-[11px] font-mono text-slate-400">
                      小計 -{nt(unitCost * count)} · +{opt.happinessDelta * count}♥
                      {opt.energyDelta > 0 && ` · +${opt.energyDelta * count}⚡`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={advance}
        disabled={month > MONTHS_PER_YEAR}
        className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold transition"
      >
        {month > MONTHS_PER_YEAR ? "年度結算中…" : `確認並進入第 ${displayMonth} 個月 ➜`}
      </button>

      {history.length > 0 && (
        <details className="mt-6 rounded-xl bg-slate-800/50 border border-slate-700">
          <summary className="px-4 py-2 cursor-pointer text-slate-300 text-sm">
            已經過的月份 ({history.length})
          </summary>
          <ul className="px-4 pb-3 text-xs text-slate-400 space-y-1">
            {history.map((h) => (
              <li key={h.month} className="flex justify-between">
                <span>M{h.month} · {h.event.label}{h.broke ? "（極簡）" : h.deficit ? "（赤字）" : ""}</span>
                <span className={`font-mono ${h.net >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {h.net >= 0 ? "+" : ""}{h.net.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function computeYearSummary(state) {
  const { history, savings, salary, annualLeaveRemaining } = state;
  const avgEnergy = history.reduce((a, h) => a + h.energy, 0) / history.length;
  const avgHappiness = history.reduce((a, h) => a + h.happiness, 0) / history.length;
  const brokeMonths = history.filter((h) => h.broke).length;

  const unusedLeave = Math.max(0, annualLeaveRemaining ?? 0);
  const leaveRefund = Math.round((salary / 30) * unusedLeave);
  const finalSavings = savings + leaveRefund;

  const savingsScore = clamp((finalSavings / 200000) * 100, 0, 100);
  const stabilityScore = clamp(100 - brokeMonths * 18, 0, 100);

  const score = Math.round(
    avgEnergy * 0.3 + avgHappiness * 0.3 + savingsScore * 0.25 + stabilityScore * 0.15
  );

  const summary = { savings: finalSavings, avgEnergy, avgHappiness, brokeMonths, score };
  const unlocked = ACHIEVEMENTS.filter((a) => a.test(summary));
  const salaryBonusPct = avgEnergy >= 70 ? 5 : 0;

  return {
    ...summary,
    unlocked,
    salaryBonusPct,
    hasCar: state.hasCar,
    unusedLeave,
    leaveRefund,
  };
}

function toRadarData(s) {
  return [
    { label: "存款", value: clamp((s.savings / 200000) * 100, 0, 100) },
    { label: "能量", value: s.avgEnergy },
    { label: "快樂", value: s.avgHappiness },
    { label: "穩定", value: clamp(100 - s.brokeMonths * 18) },
    { label: "綜合", value: s.score },
  ];
}

function PastYearRow({ entry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/60 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-amber-300">Y{entry.year}</span>
          <span className="text-white font-semibold">{entry.score} 分</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>💰 {nt(entry.savings)}</span>
          <span>⚡ {Math.round(entry.avgEnergy)}</span>
          <span>♥ {Math.round(entry.avgHappiness)}</span>
          <span className="text-slate-500">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex justify-center">
            <RadarChart data={toRadarData(entry)} />
          </div>
          <div className="space-y-1.5 text-slate-300">
            <div className="flex justify-between"><span className="text-slate-500">綜合評分</span><span className="font-mono">{entry.score}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">年度存款</span><span className="font-mono">{nt(entry.savings)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">平均能量</span><span className="font-mono">{Math.round(entry.avgEnergy)}%</span></div>
            <div className="flex justify-between"><span className="text-slate-500">平均快樂</span><span className="font-mono">{Math.round(entry.avgHappiness)}%</span></div>
            <div className="flex justify-between"><span className="text-slate-500">極簡月數</span><span className="font-mono">{entry.brokeMonths} / 12</span></div>
            <div className="flex justify-between"><span className="text-slate-500">汽車</span><span className="font-mono">{entry.hasCar ? "🚗" : "—"}</span></div>
            {entry.unlocked?.length > 0 && (
              <div className="pt-1.5 border-t border-slate-700/60">
                <div className="text-slate-500 mb-1">成就</div>
                <div className="flex flex-wrap gap-1">
                  {entry.unlocked.map((a) => (
                    <span key={a.id} className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-400/30 text-amber-200">
                      🏆 {a.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryScreen({ summary, onNextYear, year, pastSummaries, playerName, onSwitchPlayer }) {
  const radarData = useMemo(() => toRadarData(summary), [summary]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex justify-end mb-2">
        <PlayerBadge playerName={playerName} onSwitchPlayer={onSwitchPlayer} />
      </div>
      <div className="text-center mb-6">
        <div className="text-xs uppercase tracking-widest text-slate-400">Year {year} · 年度總結</div>
        <h2 className="text-4xl font-bold text-white mt-1">
          綜合評分 <span className="text-indigo-300">{summary.score}</span>
        </h2>
        <p className="text-slate-400 mt-1">身心受損程度：{Math.round(100 - summary.avgEnergy)}%</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700">
          <div className="flex flex-col items-center">
            <RadarChart data={radarData} />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">年度總存款</span>
            <span className="font-mono text-white">{nt(summary.savings)}</span>
          </div>
          {summary.leaveRefund > 0 && (
            <div className="flex justify-between text-emerald-300">
              <span>└ 含未用年假折薪（{summary.unusedLeave} 天）</span>
              <span className="font-mono">+{nt(summary.leaveRefund)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400">平均能量</span>
            <span className="font-mono text-white">{Math.round(summary.avgEnergy)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">平均快樂</span>
            <span className="font-mono text-white">{Math.round(summary.avgHappiness)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">極簡模式月數</span>
            <span className="font-mono text-white">{summary.brokeMonths} / 12</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">汽車</span>
            <span className="font-mono text-white">{summary.hasCar ? "🚗 持有（保留至下年）" : "無"}</span>
          </div>

          <div className="pt-3 border-t border-slate-700">
            <div className="text-slate-400 mb-2">解鎖成就</div>
            {summary.unlocked.length === 0 ? (
              <div className="text-slate-500">這一年沒有特別的成就…撐著也是一種成就。</div>
            ) : (
              <ul className="space-y-1">
                {summary.unlocked.map((a) => (
                  <li key={a.id} className="flex justify-between text-white">
                    <span>🏆 {a.name}</span>
                    <span className="text-slate-500 text-xs">{a.requirement}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {summary.salaryBonusPct > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-400/40 text-emerald-200 text-sm">
              💡 平均能量 ≥ 70 → 下一年基本薪資可獲得 +{summary.salaryBonusPct}% 隱藏加成。
            </div>
          )}
        </div>
      </div>

      {pastSummaries && pastSummaries.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold">歷年紀錄</h3>
            <span className="text-xs text-slate-400">共 {pastSummaries.length} 年</span>
          </div>
          <div className="space-y-2">
            {pastSummaries.slice().reverse().map((entry) => (
              <PastYearRow key={entry.year} entry={entry} />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onNextYear}
        className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold transition"
      >
        進入下一年度 ➜
      </button>
    </div>
  );
}

export default function Game() {
  const [phase, setPhase] = useState("landing");
  const [players, setPlayers] = useState(loadPlayers);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [year, setYear] = useState(1);
  const [config, setConfig] = useState(null);
  const [carryOver, setCarryOver] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pastSummaries, setPastSummaries] = useState([]);

  const currentPlayer = players.find((p) => p.id === currentPlayerId) || null;

  const persistPlayers = (next) => {
    setPlayers(next);
    savePlayers(next);
  };

  const enterGame = () => setPhase("playerSelect");

  const selectPlayer = (id) => {
    const p = players.find((x) => x.id === id);
    if (!p) return;
    setCurrentPlayerId(id);
    setYear(p.year ?? 1);
    setCarryOver(p.carryOver ?? null);
    setPastSummaries(p.pastSummaries ?? []);
    setSummary(null);
    setConfig(null);
    setPhase("setup");
    persistPlayers(
      players.map((x) => (x.id === id ? { ...x, lastPlayed: Date.now() } : x))
    );
  };

  const createPlayer = (name) => {
    const p = newPlayer(name);
    const next = [...players, p];
    persistPlayers(next);
    setCurrentPlayerId(p.id);
    setYear(1);
    setCarryOver(null);
    setPastSummaries([]);
    setSummary(null);
    setConfig(null);
    setPhase("setup");
  };

  const deletePlayer = (id) => {
    persistPlayers(players.filter((p) => p.id !== id));
    if (currentPlayerId === id) {
      setCurrentPlayerId(null);
    }
  };

  const switchPlayer = () => {
    setCurrentPlayerId(null);
    setYear(1);
    setCarryOver(null);
    setPastSummaries([]);
    setSummary(null);
    setConfig(null);
    setPhase("playerSelect");
  };

  const start = (cfg) => {
    setConfig(cfg);
    setPhase("play");
  };

  const finishYear = (state) => {
    const s = computeYearSummary(state);
    setSummary(s);
    setPhase("summary");
  };

  const nextYear = () => {
    const newPast = [...pastSummaries, { year, ...summary }];
    const newCarry = {
      savings: summary.savings,
      salaryBonusPct: summary.salaryBonusPct,
      nextSalaryHint: config?.salary ?? 42000,
      hasCar: summary.hasCar,
    };
    const newYear = year + 1;

    setPastSummaries(newPast);
    setCarryOver(newCarry);
    setYear(newYear);
    setConfig(null);
    setSummary(null);
    setPhase("setup");

    if (currentPlayerId) {
      persistPlayers(
        players.map((p) =>
          p.id === currentPlayerId
            ? {
                ...p,
                year: newYear,
                carryOver: newCarry,
                pastSummaries: newPast,
                lastPlayed: Date.now(),
              }
            : p
        )
      );
    }
  };

  return (
    <div className="min-h-screen">
      {phase === "landing" && <LandingScreen onEnter={enterGame} />}
      {phase === "playerSelect" && (
        <PlayerSelectScreen
          players={players}
          onSelect={selectPlayer}
          onCreate={createPlayer}
          onDelete={deletePlayer}
        />
      )}
      {phase === "setup" && (
        <SetupScreen
          onStart={start}
          carryOver={carryOver}
          previousYear={year - 1}
          playerName={currentPlayer?.name}
          onSwitchPlayer={switchPlayer}
        />
      )}
      {phase === "play" && config && (
        <GameScreen
          config={config}
          onFinishYear={finishYear}
          carryOver={carryOver}
          year={year}
          playerName={currentPlayer?.name}
          onSwitchPlayer={switchPlayer}
        />
      )}
      {phase === "summary" && summary && (
        <SummaryScreen
          summary={summary}
          onNextYear={nextYear}
          year={year}
          pastSummaries={pastSummaries}
          playerName={currentPlayer?.name}
          onSwitchPlayer={switchPlayer}
        />
      )}
    </div>
  );
}
