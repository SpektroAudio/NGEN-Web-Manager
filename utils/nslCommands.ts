/// NSL command catalog + TS-only validation rules (checks come from WASM).

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

export interface NslExample {
  name: string;
  description?: string;
  commands: Array<Omit<Command, "id">>;
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
  "Params",
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

/// One preview line for examples
export interface ExamplePreviewLine {
  n: number;
  depth: number;
  text: string;
}

/// Sources of one command as short signatures ("Constant(4)", "@12")
function sourceSummaries(c: Omit<Command, "id">): string[] {
  const parts: string[] = [];
  (["x", "y"] as const).forEach((slot) => {
    const s = c[slot];
    if (s) parts.push(`${s.type}(${s.dv.value})`);
  });
  if (c.offset !== undefined) parts.push(`@${c.offset}`);
  return parts;
}

/// Label + sources of one command ("Loop Set — Constant(4)")
export function commandSummary(c: Omit<Command, "id">): string {
  const label = CATALOG_BY_CMD[c.cmd]?.label ?? c.cmd;
  const parts = sourceSummaries(c);
  return parts.length ? `${label} — ${parts.join(", ")}` : label;
}

/// Preview lines for a whole script
export function examplePreview(
  cmds: Array<Omit<Command, "id">>,
): ExamplePreviewLine[] {
  return computeDepth(cmds).map((depth, i) => ({
    n: i + 1,
    depth,
    text: commandSummary(cmds[i]),
  }));
}

/// Fresh id after decode / import (max existing id + 1)
export function nextId(commands: Command[]): number {
  return commands.reduce((max, c) => Math.max(max, c.id), 0) + 1;
}

/// Byte length of one command in the encoded stream
export function commandBytes(cmd: Pick<Command, "cmd">): number {
  return CATALOG_BY_CMD[cmd.cmd]?.length ?? 0;
}

/// Encoded size of a script (4-byte NSL header + every command)
export function scriptBytes(cmds: Array<Pick<Command, "cmd">>): number {
  return 4 + cmds.reduce((n, c) => n + commandBytes(c), 0);
}

/// NGEN file names (8 characters / fixed .nsl ext)
export const NSL_STEM_MAX = 8;
export const NSL_EXT = ".nsl";
const ILLEGAL_STEM_CHARS = /[^A-Za-z0-9_]/g;

export function stemOf(name: string): string {
  return name.toLowerCase().endsWith(NSL_EXT)
    ? name.slice(0, -NSL_EXT.length)
    : name;
}

export function sanitizeStem(raw: string): string {
  return stemOf(raw).replace(ILLEGAL_STEM_CHARS, "_").slice(0, NSL_STEM_MAX);
}

export function nslFileName(stem: string): string {
  return `${sanitizeStem(stem)}${NSL_EXT}`;
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
export function computeDepth(commands: Array<Pick<Command, "cmd">>): number[] {
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

/// Engine validation result from WASM validate()
export interface WasmValidation {
  valid: boolean;
  error?: { kind: string; pos: number };
}

/// Human text per engine error kind
const ERROR_TEXT: Record<string, string> = {
  BadJump: "jump target is not a command start",
  LoopOverflow: `loop nesting deeper than max depth (${MAX_LOOP_DEPTH})`,
  CondOverflow: `condition nesting deeper than max depth (${MAX_COND_DEPTH})`,
  InvalidProgram: "invalid program structure",
  Watchdog: "instruction limit reached",
};

/// Maps a program byte offset (after the header) to a 1-based command line
export function lineForOffset(commands: Command[], pos: number): number | null {
  let off = 0;
  for (let i = 0; i < commands.length; i++) {
    const len = commandBytes(commands[i]);
    if (pos >= off && pos < off + len) return i + 1;
    off += len;
  }
  // Offset past the end (unclosed block) points at the last command
  return commands.length > 0 ? commands.length : null;
}

/// TS-only rules the engine does not check
export function ruleMessages(commands: Command[]): string[] {
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
  return messages;
}

/// Combined issues: TS-only rules + engine error + value ranges
export function validationMessages(
  commands: Command[],
  wasm?: WasmValidation | null,
  maxFor?: (type: string, kind: string) => number,
  destMaxFor?: (type: string) => number,
): string[] {
  const messages = ruleMessages(commands);

  // Engine error (first one reported), mapped to a command line
  if (wasm && !wasm.valid && wasm.error) {
    const what = ERROR_TEXT[wasm.error.kind] ?? wasm.error.kind;
    const msg = what.charAt(0).toUpperCase() + what.slice(1);
    const line = lineForOffset(commands, wasm.error.pos);
    messages.push(line ? `${msg} (command #${line})` : msg);
  }

  // Check value ranges
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

  if (destMaxFor) {
    commands.forEach((c, i) => {
      if (c.cmd !== "Set" || !c.x || !c.y || c.y.dv.kind !== "number") return;
      const max = destMaxFor(c.x.type);
      if (max > 0 && c.y.dv.value > max) {
        messages.push(
          `Line ${i + 1} (Set): value ${c.y.dv.value} will be clipped to ${max} — max for ${c.x.type} is ${max}.`,
        );
      }
    });
  }

  return messages;
}
