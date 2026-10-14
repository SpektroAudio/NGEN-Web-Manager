<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  bytes: number[];
  steps: string[];
  hoverIndex: number | null;
  hoverRange: { start: number; end: number } | null;
}>();

/// Hex rows of up to 8 bytes each (hex preview)
const hexLines = computed(() => {
  const lines: Array<{
    offset: string;
    cells: Array<{ idx: number; hex: string }>;
  }> = [];
  for (let i = 0; i < props.bytes.length; i += 8) {
    lines.push({
      offset: i.toString(16).padStart(4, "0"),
      cells: props.bytes.slice(i, i + 8).map((b, j) => ({
        idx: i + j,
        hex: b.toString(16).padStart(2, "0").toUpperCase(),
      })),
    });
  }
  return lines;
});

/// Byte opacity (based on hovering state)
const byteClass = (idx: number): string => {
  if (!props.hoverRange) return "text-white/60";
  const inRange = idx >= props.hoverRange.start && idx < props.hoverRange.end;
  return inRange ? "text-white" : "text-white/20";
};
</script>

<template>
  <div class="flex flex-col gap-4 w-full">
    <div
      class="min-h-0 shrink overflow-y-auto bg-black/30 rounded-lg p-4 border border-white/20"
    >
      <p class="text-xs font-mono text-white/60 mb-2">
        Generation Steps
      </p>
      <ul v-if="steps.length > 0" class="m-0 p-0 list-none space-y-1">
        <li
          v-for="(step, i) in steps"
          :key="i"
          :class="[
            'text-xs font-thin font-mono transition-colors',
            hoverIndex === i
              ? '-mx-1 rounded bg-white/10 px-1 text-white'
              : hoverIndex !== null
                ? 'text-white/25'
                : 'text-white/80',
          ]"
        >
          - {{ step }}
        </li>
      </ul>
      <p v-else class="text-sm font-thin font-mono text-white/40">
        No commands
      </p>
    </div>

    <div
      class="min-h-0 shrink overflow-y-auto bg-black/30 rounded-lg p-4 border border-white/20"
    >
      <p class="text-xs font-mono text-white/60 mb-2">
        Code output
      </p>
      <div v-if="bytes.length > 0" class="font-mono text-xs leading-5">
        <div v-for="line in hexLines" :key="line.offset" class="flex">
          <span class="w-[7ch] shrink-0 text-white/40">{{ line.offset }} | </span><span
            v-for="cell in line.cells"
            :key="cell.idx"
            :class="[byteClass(cell.idx), 'w-[3ch] transition-colors']"
          >{{ cell.hex }}</span>
        </div>
      </div>
      <p v-else class="text-sm font-thin font-mono text-white/40">
        Waiting for script…
      </p>
    </div>
  </div>
</template>
