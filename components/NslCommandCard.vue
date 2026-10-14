<script setup lang="ts">
import { computed, ref } from "vue";
import {
  CATALOG_BY_CMD,
  DATA_SOURCE_TYPES,
  DESTINATION_TYPES,
  TYPE_VALUE_LABELS,
  type CatalogEntry,
  type Command,
  type SlotMeta,
} from "../utils/nslCommands";

const props = defineProps<{
  cmd: Command;
  index: number;
  depth: number;
  description: string;
  /// Max per source type/kind (from the WASM engine)
  maxFor: (type: string, kind: string) => number;
}>();

const emit = defineEmits(["remove", "duplicate"]);

const expanded = ref(true);

const entry: CatalogEntry | undefined = computed(
  () => CATALOG_BY_CMD[props.cmd.cmd],
);

/// Background tint scaled by nesting depth
const tintStyle = computed(() => {
  if (props.depth === 0) return {};
  return {
    backgroundColor: `rgba(37, 99, 235, ${Math.min(0.06 * props.depth, 0.3)})`,
  };
});

const typesFor = (slot?: SlotMeta) =>
  slot?.kind === "destination" ? DESTINATION_TYPES : DATA_SOURCE_TYPES;

const valueLabel = (type: string): string => {
  const l = TYPE_VALUE_LABELS[type];
  return l && l !== "Value" ? l : "";
};

/// One column per data source slot of this command
const columns = computed(() => {
  const e = entry.value;
  if (!e) return [];
  const defs: Array<[name: "x" | "y", meta?: SlotMeta]> = [
    ["x", e.x],
    ["y", e.y],
  ];
  return defs
    .filter((d): d is ["x" | "y", SlotMeta] => !!d[1])
    .map(([name, meta]) => {
      const src = props.cmd[name]!;
      const max = props.maxFor(src.type, src.dv.kind);
      return {
        name,
        meta,
        src,
        vlabel: valueLabel(src.type),
        max,
        oob: src.dv.value > max,
      };
    });
});

/// Styling for commands dropdown and number boxes
const CTRL =
  "h-7 rounded border border-white/10 bg-black/40 px-1.5 text-xs text-white outline-none transition-colors hover:border-white/25 focus:border-white/50";
const NUM =
  "w-14 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/// Clamp value to type range after a change
const clampValue = (name: "x" | "y") => {
  const s = props.cmd[name];
  if (!s) return;
  if (typeof s.dv.value !== "number" || Number.isNaN(s.dv.value))
    s.dv.value = 0;
  s.dv.value = Math.min(
    Math.max(0, s.dv.value),
    props.maxFor(s.type, s.dv.kind),
  );
};
</script>

<template>
  <div :style="{ paddingLeft: depth * 14 + 'px' }">
    <div
      class="group rounded border border-white/10 px-2 py-1 mb-2 bg-white/[0.03] hover:border-white/25 transition-colors"
      :style="tintStyle"
    >
      <!-- Header row -->
      <div class="flex items-center gap-2">
        <span
          class="drag-handle cursor-move text-white/25 hover:text-white/60 pi pi-bars"
        />
        <button
          v-if="columns.length > 0"
          type="button"
          title="Expand / collapse"
          class="shrink-0 rounded p-0.5 text-white/40 transition-colors hover:text-white/80"
          @click="expanded = !expanded"
        >
          <span
            class="pi text-xs"
            :class="expanded ? 'pi-chevron-down' : 'pi-chevron-right'"
          />
        </button>
        <span
          class="w-4 shrink-0 text-right text-[11px] font-mono text-white/30"
        >{{ index + 1 }}</span>
        <span class="shrink-0 text-xs font-mono font-bold uppercase">{{
          entry?.label ?? cmd.cmd
        }}</span>
        <span
          class="min-w-0 flex-1 truncate text-[11px] font-thin font-mono text-white/50"
        >
          <template v-if="description">· {{ description }}</template>
        </span>
        <!-- Jump offset inline -->
        <div
          v-if="entry?.offsetLabel"
          class="flex shrink-0 items-center gap-1.5"
        >
          <span
            class="text-[10px] font-mono uppercase tracking-wide text-white/40"
          >{{ entry.offsetLabel }}:</span>
          <input
            v-model.number="cmd.offset"
            type="number"
            :min="0"
            :max="65535"
            :class="[CTRL, NUM]"
          >
        </div>
        <button
          type="button"
          title="Duplicate command"
          class="shrink-0 rounded p-1 text-white/40 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10 hover:text-white/80"
          @click="emit('duplicate', index)"
        >
          <span class="pi pi-copy text-xs" />
        </button>
        <button
          type="button"
          title="Remove command"
          class="shrink-0 rounded p-1 text-red-400/70 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10"
          @click="emit('remove', index)"
        >
          <span class="pi pi-trash text-xs" />
        </button>
      </div>

      <!-- Data source slots (hidden when collapsed) -->
      <div
        v-if="columns.length > 0"
        v-show="expanded"
        class="mt-1 flex items-start gap-3"
      >
        <template v-for="(col, ci) in columns" :key="ci">
          <!-- One column per slot: type row, then value row -->
          <div class="flex min-w-0 flex-col gap-1">
            <!-- Row 1: slot label + type dropdown -->
            <div class="flex items-center gap-1.5">
              <span
                class="shrink-0 text-[10px] font-mono uppercase tracking-wide text-white/40"
              >{{ col.meta.label }}:</span>
              <select
                v-model="col.src.type"
                :class="[CTRL, 'w-28']"
                @change="clampValue(col.name)"
              >
                <option v-for="t in typesFor(col.meta)" :key="t" :value="t">
                  {{ t }}
                </option>
              </select>
            </div>
            <!-- Row 2: value label + kind dropdown + number box -->
            <div class="flex items-center gap-1.5">
              <span
                v-if="col.vlabel"
                class="shrink-0 text-[10px] font-mono uppercase tracking-wide text-white/40"
              >
                {{ col.vlabel }}:
              </span>
              <select
                v-model="col.src.dv.kind"
                :class="[CTRL, 'w-20']"
                @change="clampValue(col.name)"
              >
                <option value="number">
                  Number
                </option>
                <option value="buffer">
                  Memory
                </option>
              </select>
              <input
                v-model.number="col.src.dv.value"
                type="number"
                :min="0"
                :max="col.max"
                :class="[
                  CTRL,
                  NUM,
                  col.oob && 'border-red-500/60 text-red-300',
                ]"
                @change="clampValue(col.name)"
              >
            </div>
          </div>
          <!-- Vertical divider -->
          <div
            v-if="ci < columns.length - 1"
            class="w-px shrink-0 self-stretch bg-white/10"
          />
        </template>
      </div>
    </div>
  </div>
</template>
