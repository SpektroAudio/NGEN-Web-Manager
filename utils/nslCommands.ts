/// NSL command catalog + pure-JS validation (no WASM needed).

export interface DataValue {
  kind: "number" | "buffer";
  value: number;
}
export interface DataSource {
  type: string;
  dv: DataValue;
}
export interface Command {
  id: number;
  cmd: string;
  x?: DataSource;
  y?: DataSource;
  offset?: number;
}

export const DATA_SOURCE_TYPES = [
  "Constant",
  "Random",
  "StepPitch",
  "StepVelocity",
  "StepLength",
  "StepDensity",
  "MemoryBuffer",
  "Params",
  "Scale",
  "FullScale",
  "RandomNote",
] as const;

/// Types available in a destination slot
export const DESTINATION_TYPES = [
  "StepPitch",
  "StepVelocity",
  "StepLength",
  "StepDensity",
  "MemoryBuffer",
] as const;

/// Per-type value labels
export const TYPE_VALUE_LABELS: Record<string, string> = {
  Constant: "Value",
  Random: "Max Value",
  StepPitch: "Step Index",
  StepVelocity: "Step Index",
  StepLength: "Step Index",
  StepDensity: "Step Index",
  MemoryBuffer: "Buffer Index",
  Params: "Param #",
  Scale: "Scale Index (0-6)",
  FullScale: "Scale Index (0-11)",
  RandomNote: "Value",
};

export interface SlotMeta {
  kind: "destination" | "value";
  label: string;
}

export interface CatalogEntry {
  cmd: string;
  group: string;
  label: string;
  /// Byte length in the command stream (5 = two sources, 3 = one source / Int16, 1 = none)
  length: 1 | 3 | 5;
  x?: SlotMeta;
  y?: SlotMeta;
  /// Label for the u16 offset editor (Jump only)
  offsetLabel?: string;
  defaults: () => Omit<Command, "id">;
}

const num = (value = 0): DataValue => ({ kind: "number", value });
const src = (type: string, value = 0): DataSource => ({ type, dv: num(value) });

const destSlot = (label = "Destination"): SlotMeta => ({
  kind: "destination",
  label,
});
const valueSlot = (label = "Value"): SlotMeta => ({ kind: "value", label });

interface CmdDef {
  cmd: string;
  group: string;
  label?: string;
  length: 1 | 3 | 5;
  x?: SlotMeta;
  y?: SlotMeta;
  offsetLabel?: string;
  defaults?: () => Omit<Command, "id">;
}

/// Builds a catalog entry
function entry(def: CmdDef): CatalogEntry {
  const defaults =
    def.defaults ??
    (() => {
      const c: Omit<Command, "id"> = { cmd: def.cmd };
      if (def.x)
        c.x =
          def.x.kind === "destination"
            ? src("StepPitch", 0)
            : src("Constant", 0);
      if (def.y) c.y = src("Constant", 0);
      if (def.offsetLabel !== undefined) c.offset = 0;
      return c;
    });
  const { cmd, group, label, length, x, y, offsetLabel } = def;
  return {
    cmd,
    group,
    label: label ?? cmd,
    length,
    x,
    y,
    offsetLabel,
    defaults,
  };
}

/// Command palette
export const CATALOG: CatalogEntry[] = [
  entry({
    cmd: "Set",
    group: "Data",
    length: 5,
    x: destSlot(),
    y: valueSlot(),
  }),
  entry({
    cmd: "Add",
    group: "Data",
    length: 5,
    x: destSlot(),
    y: valueSlot(),
  }),
  entry({
    cmd: "Subtract",
    group: "Data",
    length: 5,
    x: destSlot(),
    y: valueSlot(),
  }),
  entry({
    cmd: "Multiply",
    group: "Data",
    length: 5,
    x: destSlot(),
    y: valueSlot(),
  }),
  entry({
    cmd: "Divide",
    group: "Data",
    length: 5,
    x: destSlot(),
    y: valueSlot(),
  }),
  // Loops
  entry({
    cmd: "LoopSet",
    group: "Loops",
    label: "Loop Set",
    length: 3,
    x: valueSlot("Repetitions"),
  }),
  entry({ cmd: "LoopEnd", group: "Loops", label: "Loop End", length: 1 }),
  // Flow
  entry({ cmd: "Jump", group: "Flow", length: 3, offsetLabel: "Byte Offset" }),
  // Conditions
  entry({
    cmd: "CondE",
    group: "Conditions",
    label: "If Equal",
    length: 5,
    x: valueSlot("Value 1"),
    y: valueSlot("Value 2"),
  }),
  entry({
    cmd: "CondNE",
    group: "Conditions",
    label: "If Not Equal",
    length: 5,
    x: valueSlot("Value 1"),
    y: valueSlot("Value 2"),
  }),
  entry({
    cmd: "CondGT",
    group: "Conditions",
    label: "If Greater",
    length: 5,
    x: valueSlot("Value 1"),
    y: valueSlot("Value 2"),
  }),
  entry({
    cmd: "CondLT",
    group: "Conditions",
    label: "If Less",
    length: 5,
    x: valueSlot("Value 1"),
    y: valueSlot("Value 2"),
  }),
  entry({
    cmd: "CondGTE",
    group: "Conditions",
    label: "If Greater or Equal",
    length: 5,
    x: valueSlot("Value 1"),
    y: valueSlot("Value 2"),
  }),
  entry({
    cmd: "CondLTE",
    group: "Conditions",
    label: "If Less or Equal",
    length: 5,
    x: valueSlot("Value 1"),
    y: valueSlot("Value 2"),
  }),
  entry({
    cmd: "CondEnd",
    group: "Conditions",
    label: "End Condition",
    length: 1,
  }),
  // Generation
  entry({
    cmd: "GenerateEuclidean",
    group: "Generation",
    label: "Generate Euclidean",
    length: 5,
    x: valueSlot("Hits"),
    y: valueSlot("Offset"),
  }),
  entry({
    cmd: "QuantizePitch",
    group: "Generation",
    label: "Quantize Pitch",
    length: 1,
  }),
  entry({
    cmd: "GenerateProgression",
    group: "Generation",
    label: "Generate Progression",
    length: 1,
  }),
  // Clear
  entry({ cmd: "ClearTrack", group: "Clear", label: "Clear Track", length: 1 }),
  entry({
    cmd: "ClearMemory",
    group: "Clear",
    label: "Clear Memory",
    length: 1,
  }),
  entry({ cmd: "ClearAll", group: "Clear", label: "Clear All", length: 1 }),
  // End
  entry({ cmd: "End", group: "End", length: 1 }),
];

/// Lookup table by command name
export const CATALOG_BY_CMD: Record<string, CatalogEntry> = Object.fromEntries(
  CATALOG.map((e) => [e.cmd, e]),
);

/// Group names in menu order
export const CATALOG_GROUPS = [...new Set(CATALOG.map((e) => e.group))];

/// Init script
export function starterScript(): Command[] {
  return [
    { id: 1, cmd: "Set", x: src("StepPitch", 0), y: src("Constant", 36) },
    { id: 2, cmd: "Set", x: src("StepVelocity", 0), y: src("Constant", 100) },
    { id: 3, cmd: "End" },
  ];
}

/// Fresh id after decode / import (max existing id + 1)
export function nextId(commands: Command[]): number {
  return commands.reduce((max, c) => Math.max(max, c.id), 0) + 1;
}

/// Byte length of one command in the encoded stream
export function commandBytes(cmd: Command): number {
  return CATALOG_BY_CMD[cmd.cmd]?.length ?? 0;
}

/// Commands that open a nested block
const OPENERS = new Set([
  "LoopSet",
  "CondE",
  "CondNE",
  "CondGT",
  "CondLT",
  "CondGTE",
  "CondLTE",
]);
/// Block closers and the opener each one matches
const CLOSER_FOR: Record<string, string> = {
  LoopEnd: "LoopSet",
  CondEnd: "cond",
};

/// Adjusts the indentation level based on closers / openers
export function computeDepth(commands: Command[]): number[] {
  let level = 0;
  return commands.map((c) => {
    const depth = Math.max(0, level);
    if (OPENERS.has(c.cmd)) level += 1;
    else if (c.cmd in CLOSER_FOR) level -= 1;
    return depth;
  });
}

export const MAX_LOOP_DEPTH = 4;
export const MAX_COND_DEPTH = 4;

/// Check for loop / condition nesting
export function blockDepths(
  commands: Command[],
): Array<{ loop: number; cond: number }> {
  let loop = 0;
  let cond = 0;
  return commands.map((c) => {
    if (OPENERS.has(c.cmd)) c.cmd === "LoopSet" ? (loop += 1) : (cond += 1);
    else if (c.cmd in CLOSER_FOR)
      c.cmd === "LoopEnd" ? (loop -= 1) : (cond -= 1);
    return { loop: Math.max(0, loop), cond: Math.max(0, cond) };
  });
}

/// Max value per type
export function validationMessages(
  commands: Command[],
  maxFor?: (type: string, kind: string) => number,
): string[] {
  const messages: string[] = [];

  if (commands.length === 0) {
    return ["Script has no commands — add an End command or use Init."];
  }

  // Last command must be End
  if (commands[commands.length - 1].cmd !== "End") {
    messages.push(
      `Last command is ${commands[commands.length - 1].cmd} — script must end with End.`,
    );
  }

  // Check for open blocks and nesting depth
  const stack: Array<{ kind: string; line: number }> = [];
  let loopDepth = 0;
  let condDepth = 0;
  commands.forEach((c, i) => {
    const line = i + 1;
    if (OPENERS.has(c.cmd)) {
      if (c.cmd === "LoopSet") {
        loopDepth += 1;
        if (loopDepth > MAX_LOOP_DEPTH)
          messages.push(
            `LoopSet at line ${line} nests ${loopDepth} loops — max is ${MAX_LOOP_DEPTH}.`,
          );
      } else {
        condDepth += 1;
        if (condDepth > MAX_COND_DEPTH)
          messages.push(
            `${c.cmd} at line ${line} nests ${condDepth} conditions — max is ${MAX_COND_DEPTH}.`,
          );
      }
      stack.push({ kind: c.cmd === "LoopSet" ? "loop" : "condition", line });
    } else if (c.cmd in CLOSER_FOR) {
      if (c.cmd === "LoopEnd") loopDepth = Math.max(0, loopDepth - 1);
      else condDepth = Math.max(0, condDepth - 1);
      const expected = CLOSER_FOR[c.cmd] === "cond" ? "condition" : "loop";
      const top = stack[stack.length - 1];
      if (!top || top.kind !== expected) {
        messages.push(`Unmatched ${c.cmd} (command #${line}).`);
      } else {
        stack.pop();
      }
    }
  });
  for (const open of stack) {
    const what = open.kind === "loop" ? "Loop" : "Condition";
    messages.push(`${what} opened at line ${open.line} is not closed.`);
  }

  // Check Jump (must end at valid index)
  const starts = new Set<number>();
  let offset = 0;
  for (const c of commands) {
    starts.add(offset);
    offset += commandBytes(c);
  }
  commands.forEach((c, i) => {
    if (c.cmd === "Jump" && !starts.has(c.offset ?? -1)) {
      messages.push(
        `Jump at line ${i + 1} targets byte offset ${c.offset ?? "?"}, which is not a command start.`,
      );
    }
  });

  // Per-command value ranges (each source clipped to its type/kind max)
  if (maxFor) {
    commands.forEach((c, i) => {
      const entry = CATALOG_BY_CMD[c.cmd];
      (["x", "y"] as const).forEach((slot) => {
        const s = c[slot];
        if (!s) return;
        const max = maxFor(s.type, s.dv.kind);
        if (s.dv.value > max) {
          const label = (slot === "x" ? entry?.x : entry?.y)?.label ?? slot;
          messages.push(
            `Line ${i + 1} (${c.cmd}): ${label} is ${s.dv.value} — max for ${s.type} is ${max}.`,
          );
        }
      });
    });
  }

  return messages;
}
