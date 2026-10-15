<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import Button from "primevue/button";
import TieredMenu from "primevue/tieredmenu";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import { useToast } from "primevue/usetoast";
import draggable from "vuedraggable";
import NslCommandCard from "./NslCommandCard.vue";
import NslHexView from "./NslHexView.vue";
import {
  CATALOG,
  CATALOG_GROUPS,
  CATALOG_BY_CMD,
  starterScript,
  nextId,
  commandBytes,
  computeDepth,
  validationMessages,
  examplePreview,
  scriptBytes,
  type Command,
  type NslExample,
} from "../utils/nslCommands";

const props = defineProps<{
  commands: Command[];
  filename: string;
  baseline: number[] | null;
  isConnected: boolean;
  nslFiles: string[];
  nslReceived: { name: string; data: Uint8Array };
}>();

const emit = defineEmits([
  "send-to-ngen",
  "load-from-device",
  "update:filename",
  "update:baseline",
]);
const toast = useToast();

/// Toolbar filename
const filename = computed({
  get: () => props.filename,
  set: (v: string) => emit("update:filename", v),
});

// WASM (lazy init)
type WasmApi = {
  decode: (bytes: Uint8Array | number[]) => string | undefined;
  encode: (json: string) => Uint8Array | undefined;
  validate: (json: string) => boolean;
  command_description: (json: string) => string | undefined;
  data_source_max: (type: string, kind: string) => number | undefined;
};

const wasmReady = ref(false);
let wasm: WasmApi | null = null;

onMounted(async () => {
  // built at runtime
  const mod = await import(
    /* @vite-ignore */ ["/wasm/nsl_wasm", "nsl_wasm.js"].join("/")
  );
  // wasm-bindgen >= 0.2.9x exposes the init function as the module's default export
  await mod.default();
  wasm = {
    decode: mod.decode,
    encode: mod.encode,
    validate: mod.validate,
    command_description: mod.command_description,
    data_source_max: mod.data_source_max,
  };
  wasmReady.value = true;
  // Start with init preset
  if (props.commands.length === 0) {
    props.commands.splice(0, 0, ...starterScript());
    setBaseline();
  }
  reencode();
  loadExampleList();
});

// DTO conversion
const toDto = (c: Command) => {
  const d: Record<string, unknown> = { cmd: c.cmd };
  if (c.x) d.x = { type: c.x.type, kind: c.x.dv.kind, value: c.x.dv.value };
  if (c.y) d.y = { type: c.y.type, kind: c.y.dv.kind, value: c.y.dv.value };
  if (c.offset !== undefined) d.offset = c.offset;
  return d;
};

const fromDto = (dtos: Array<Record<string, any>>): Command[] =>
  dtos.map((d, i) => ({
    id: i + 1,
    cmd: d.cmd,
    x: d.x
      ? { type: d.x.type, dv: { kind: d.x.kind, value: d.x.value } }
      : undefined,
    y: d.y
      ? { type: d.y.type, dv: { kind: d.y.kind, value: d.y.value } }
      : undefined,
    offset: d.offset,
  }));

// Reencode loop
const bytes = ref<number[]>([]);
const steps = ref<string[]>([]);
const wasmValid = ref(false);

/// max per source type/kind (from the WASM engine, 127 before ready)
const maxFor = (type: string, kind: string): number =>
  wasm?.data_source_max(type, kind) ?? 127;

const ruleMessages = computed(() => validationMessages(props.commands, maxFor));
const isValid = computed(
  () => wasmReady.value && wasmValid.value && ruleMessages.value.length === 0,
);
const depths = computed(() => computeDepth(props.commands));

// Hover highlight
const hoverIndex = ref<number | null>(null);

/// Index of the card being dragged (null when not dragging)
const dragIndex = ref<number | null>(null);

/// Byte range of each command in the encoded stream (4-byte NSL header first)
const byteRanges = computed(() => {
  let off = 4;
  return props.commands.map((c) => {
    const r = { start: off, end: off + commandBytes(c) };
    off = r.end;
    return r;
  });
});
const hoverRange = computed(() =>
  hoverIndex.value !== null
    ? (byteRanges.value[hoverIndex.value] ?? null)
    : null,
);

let timer: ReturnType<typeof setTimeout> | undefined;
const scheduleReencode = () => {
  clearTimeout(timer);
  timer = setTimeout(reencode, 150);
};
watch(
  () => props.commands,
  () => {
    hoverIndex.value = null; // stale index after reorder / replace
    scheduleReencode();
  },
  { deep: true },
);

/// Encodes the current list synchronous (null when WASM is not ready)
const encodeNow = (): number[] | null => {
  if (!wasm) return null;
  const enc = wasm.encode(JSON.stringify(props.commands.map(toDto)));
  return enc ? Array.from(enc) : null;
};

const reencode = () => {
  if (!wasm) return;
  const json = JSON.stringify(props.commands.map(toDto));
  const enc = wasm.encode(json);
  bytes.value = enc ? Array.from(enc) : [];
  steps.value = props.commands.map(
    (c) => wasm!.command_description(JSON.stringify(toDto(c))) ?? "",
  );
  wasmValid.value = wasm.validate(json);
};

// Dirty check + replace confirm
const isDirty = computed(() => {
  if (!wasmReady.value || !props.baseline) return false;
  const b = props.baseline;
  return (
    bytes.value.length !== b.length || bytes.value.some((v, i) => v !== b[i])
  );
});

const replaceDialog = ref(false);
let pendingReplace: (() => void) | null = null;

/// Applies `apply` directly when clean, after confirm when dirty
const requestReplace = (apply: () => void) => {
  if (isDirty.value) {
    pendingReplace = apply;
    replaceDialog.value = true;
  } else {
    apply();
  }
};

const confirmReplace = () => {
  replaceDialog.value = false;
  const fn = pendingReplace;
  pendingReplace = null;
  fn?.();
};

/// Re-encodes and pushes the current bytes to the lifted baseline
const setBaseline = () => {
  const b = encodeNow();
  if (b) emit("update:baseline", b);
};

// Toolbar
const addMenu = ref<InstanceType<typeof TieredMenu> | null>(null);

/// Grouped command list for the Add Command menu
const addMenuItems = CATALOG_GROUPS.map((g) => ({
  label: g,
  items: CATALOG.filter((c) => c.group === g).map((c) => ({
    label: c.label,
    command: () => addCommand(c.cmd),
  })),
}));

/// Toggles the popup menu from the Add Command button
const toggleAddMenu = (e: Event) => addMenu.value?.toggle(e);

const addCommand = (cmd: string) => {
  const entry = CATALOG_BY_CMD[cmd];
  props.commands.push({ id: nextId(props.commands), ...entry.defaults() });
};

/// Reset to the starter script (subject to the replace confirm)
const doInit = () =>
  requestReplace(() => {
    props.commands.splice(0, props.commands.length, ...starterScript());
    setBaseline();
  });

const removeAt = (index: number) => props.commands.splice(index, 1);

/// Duplicate with new ID
const duplicateAt = (index: number) => {
  const src = props.commands[index];
  const copy = JSON.parse(JSON.stringify(src)) as Command;
  copy.id = nextId(props.commands);
  props.commands.splice(index + 1, 0, copy);
};

// Examples (public/nsl_examples.json)
const exampleDialog = ref(false);
const examples = ref<NslExample[]>([]);
const selectedExample = ref(0);

const loadExampleList = async () => {
  try {
    const file = await $fetch<{ examples?: NslExample[] }>(
      "/nsl_examples.json",
    );
    examples.value = file.examples ?? [];
  } catch {
    toast.add({
      summary: "Examples unavailable",
      detail: "Could not load /nsl_examples.json.",
      life: 3000,
      severity: "error",
    });
  }
};

const activeExample = computed(
  () => examples.value[selectedExample.value] ?? null,
);
const previewLines = computed(() =>
  activeExample.value ? examplePreview(activeExample.value.commands) : [],
);

/// Opens the examples modal (list on the left, detail on the right)
const openExampleDialog = () => {
  if (selectedExample.value >= examples.value.length) selectedExample.value = 0;
  exampleDialog.value = true;
};

const loadExample = (ex: NslExample) => {
  exampleDialog.value = false;
  requestReplace(() => {
    props.commands.splice(
      0,
      props.commands.length,
      ...ex.commands.map((c, i) => ({ id: i + 1, ...c })),
    );
    filename.value = `${ex.name}.nsl`;
    setBaseline();
  });
};

const loadActiveExample = () => {
  if (activeExample.value) loadExample(activeExample.value);
};

// Import
const importInput = ref<HTMLInputElement | null>(null);

const onImportFile = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || !wasm) return;
  const data = new Uint8Array(await file.arrayBuffer());
  const json = wasm.decode(data);
  if (json == null) {
    toast.add({
      summary: "Import failed",
      detail: `"${file.name}" is not a valid NSL script.`,
      life: 3000,
      severity: "error",
    });
    return;
  }
  requestReplace(() => applyDecoded(json));
};

/// Replaces the list with decoded commands (fresh ids) and resets the baseline
const applyDecoded = (json: string) => {
  props.commands.splice(0, props.commands.length, ...fromDto(JSON.parse(json)));
  setBaseline();
};

const doExport = () => {
  const b = encodeNow();
  if (!b) return;
  const blob = new Blob([new Uint8Array(b)], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.value;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(link);
  emit("update:baseline", b);
};

// Send to NGEN (upload mode 4)
const doSend = () => {
  if (!props.isConnected || !isValid.value) return;
  const b = encodeNow();
  if (!b) return;
  emit("send-to-ngen", { filename: filename.value, bytes: new Uint8Array(b) });
  emit("update:baseline", b);
};

// Load from Device
const loadDialog = ref(false);
const pickDeviceFile = (name: string) => {
  loadDialog.value = false;
  emit("load-from-device", { filename: name });
};

watch(
  () => props.nslReceived,
  (recv) => {
    if (!recv || !recv.data || recv.data.length === 0 || !wasm) return;
    const json = wasm.decode(recv.data);
    if (json == null) {
      toast.add({
        summary: "Load failed",
        detail: `Could not decode "${recv.name}" from the device.`,
        life: 3000,
        severity: "error",
      });
      return;
    }
    requestReplace(() => {
      applyDecoded(json);
      filename.value = recv.name; // Replace script name with existing name
    });
  },
);
</script>

<template>
  <div class="flex flex-col gap-4 w-3/4">
    <!-- Toolbar -->
    <div
      class="flex flex-col gap-2 border border-white/10 rounded-md p-3 bg-black/10"
    >
      <!-- Row 1: identity, status, device read -->
      <div class="flex flex-wrap items-center gap-2">
        <p class="font-mono text-sm text-white/60">Script Name</p>
        <InputText
          v-model="filename"
          class="w-48 font-mono text-sm"
          placeholder="script_1.nsl"
        />
        <span
          v-if="!wasmReady"
          class="flex items-center gap-1.5 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs font-mono text-white/50"
        >
          Loading NSL engine…
        </span>
        <span
          v-else-if="isValid"
          class="flex items-center gap-1.5 rounded border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-mono text-green-300"
        >
          <span class="pi pi-check" /> Script is valid
        </span>
        <span
          v-else
          class="flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-mono text-red-300"
        >
          <span class="pi pi-exclamation-triangle" />
          {{
            ruleMessages.length
              ? `${ruleMessages.length} issue${ruleMessages.length === 1 ? "" : "s"}`
              : "Invalid script"
          }}
        </span>
        <div class="flex-1" />
        <Button
          label="Load from device"
          icon="pi pi-arrow-circle-down"
          variant="outlined"
          size="small"
          :disabled="!isConnected || nslFiles.length === 0"
          @click="loadDialog = true"
        />
      </div>

      <!-- Row 2: script actions, deploy -->
      <div class="flex flex-wrap items-center gap-2">
        <Button
          label="Add Command"
          icon="pi pi-plus"
          variant="outlined"
          size="small"
          @click="toggleAddMenu"
        />
        <TieredMenu
          ref="addMenu"
          class="text-sm"
          :model="addMenuItems"
          :popup="true"
        />
        <Button
          label="Init"
          icon="pi pi-refresh"
          variant="outlined"
          size="small"
          @click="doInit"
        />
        <Button
          label="Load Example"
          icon="pi pi-book"
          variant="outlined"
          size="small"
          :disabled="examples.length === 0"
          @click="openExampleDialog"
        />
        <Dialog
          v-model:visible="exampleDialog"
          modal
          header="NSL Examples"
          class="w-[42rem]"
        >
          <div class="flex gap-4">
            <!-- Example list -->
            <div class="flex w-52 shrink-0 flex-col gap-1">
              <p
                class="m-0 text-[10px] font-mono uppercase tracking-wide text-white/40"
              >
                Examples
              </p>
              <div
                class="flex max-h-[26rem] min-h-0 flex-col gap-1 overflow-y-auto pr-1"
              >
                <button
                  v-for="(ex, i) in examples"
                  :key="ex.name"
                  type="button"
                  :class="[
                    'w-full rounded border px-2 py-1.5 text-left transition-colors',
                    selectedExample === i
                      ? 'border-white/30 bg-white/10'
                      : 'border-transparent hover:border-white/15 hover:bg-white/5',
                  ]"
                  @click="selectedExample = i"
                  @dblclick="loadExample(ex)"
                >
                  <span
                    class="block truncate font-mono text-xs text-white/80"
                    >{{ ex.name }}</span
                  >
                  <span class="block text-[10px] font-mono text-white/35">
                    {{ ex.commands.length }} commands
                  </span>
                </button>
              </div>
            </div>
            <!-- Selected example: name, description, command preview -->
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <div>
                <p class="m-0 font-mono text-sm font-bold text-white/85">
                  {{ activeExample?.name ?? "No example" }}
                </p>
                <p
                  v-if="activeExample"
                  class="m-0 mt-0.5 text-[11px] font-mono text-white/40"
                >
                  {{ activeExample.commands.length }} commands ·
                  {{ scriptBytes(activeExample.commands) }} bytes
                </p>
              </div>
              <div
                class="max-h-24 min-h-0 overflow-y-auto rounded border border-white/10 bg-black/30 px-3 py-2"
              >
                <p class="m-0 text-xs font-thin text-white/60">
                  {{ activeExample?.description || "No description." }}
                </p>
              </div>
              <div
                class="h-[19rem] min-h-0 overflow-y-auto rounded border border-white/10 bg-black/30 px-3 py-2"
              >
                <ul
                  v-if="previewLines.length"
                  class="m-0 p-0 list-none space-y-1"
                >
                  <li
                    v-for="line in previewLines"
                    :key="line.n"
                    class="flex gap-2 font-mono text-[11px]"
                    :style="{ paddingLeft: line.depth * 12 + 'px' }"
                  >
                    <span class="w-5 shrink-0 text-right text-white/30">{{
                      line.n
                    }}</span>
                    <span class="min-w-0 flex-1 truncate text-white/70">{{
                      line.text
                    }}</span>
                  </li>
                </ul>
                <p v-else class="m-0 text-xs font-thin font-mono text-white/40">
                  No commands
                </p>
              </div>
            </div>
          </div>
          <template #footer>
            <Button
              label="Cancel"
              variant="text"
              size="small"
              @click="exampleDialog = false"
            />
            <Button
              label="Load Example"
              icon="pi pi-book"
              size="small"
              :disabled="!activeExample"
              @click="loadActiveExample"
            />
          </template>
        </Dialog>
        <Button
          label="Import"
          icon="pi pi-file"
          variant="outlined"
          size="small"
          @click="importInput?.click()"
        />
        <Button
          label="Export"
          icon="pi pi-download"
          variant="outlined"
          size="small"
          @click="doExport"
        />
        <div class="flex-1" />
        <Button
          label="Send to NGEN"
          icon="pi pi-send"
          size="small"
          :disabled="!isConnected || !isValid"
          @click="doSend"
        />
      </div>
    </div>

    <!-- Error details (auto-hide) -->
    <div
      v-if="wasmReady && !isValid"
      class="border border-white/10 rounded-md p-4 bg-red-500/10 text-xs font-mono text-red-300 space-y-1"
    >
      <div class="pb-2">Issues Found:</div>
      <p
        v-for="(msg, i) in ruleMessages"
        :key="i"
        class="m-0 flex items-center gap-2"
      >
        <span class="pi pi-exclamation-triangle" /> {{ msg }}
      </p>
      <p
        v-if="!wasmValid && ruleMessages.length === 0"
        class="m-0 flex items-center gap-2"
      >
        <span class="pi pi-exclamation-triangle" /> Script failed binary
        validation.
      </p>
    </div>

    <!-- Command list + hex/steps panels (shared min/max height, equal bottoms) -->
    <div
      class="flex flex-col gap-4 md:min-h-[420px] md:max-h-[640px] md:flex-row"
    >
      <div
        class="flex flex-1 min-h-0 flex-col border border-white/10 rounded-md p-4 bg-black/10"
      >
        <div class="min-h-0 w-full flex-1 overflow-y-auto">
          <draggable
            :list="commands"
            item-key="id"
            handle=".drag-handle"
            @start="dragIndex = $event.oldIndex"
            @end="dragIndex = null"
          >
            <template #item="{ element, index }">
              <NslCommandCard
                :cmd="element"
                :index="index"
                :depth="depths[index]"
                :dragging="dragIndex === index"
                :description="steps[index] ?? ''"
                :max-for="maxFor"
                @remove="removeAt(index)"
                @duplicate="duplicateAt(index)"
                @mouseenter="hoverIndex = index"
                @mouseleave="hoverIndex = null"
              />
            </template>
          </draggable>
        </div>
      </div>
      <NslHexView
        :bytes="bytes"
        :steps="steps"
        :hover-index="hoverIndex"
        :hover-range="hoverRange"
        class="w-full min-h-0 md:w-96"
      />
    </div>

    <!-- Unsaved changes confirm -->
    <Dialog
      v-model:visible="replaceDialog"
      modal
      header="Unsaved changes"
      class="w-96"
    >
      <p class="text-sm font-thin text-white/70 m-0">
        Replace current script? Unsaved changes will be lost.
      </p>
      <template #footer>
        <Button label="Cancel" variant="text" @click="replaceDialog = false" />
        <Button label="Replace" severity="danger" @click="confirmReplace" />
      </template>
    </Dialog>

    <!-- Device file picker -->
    <Dialog
      v-model:visible="loadDialog"
      modal
      header="Load from device"
      class="w-96"
    >
      <p
        v-if="nslFiles.length === 0"
        class="text-sm font-thin font-mono text-white/50 m-0"
      >
        No NSL scripts on the device.
      </p>
      <div v-else class="space-y-2 max-h-64 overflow-auto">
        <Button
          v-for="f in nslFiles"
          :key="f"
          :label="f"
          icon="pi pi-file"
          class="w-full justify-start font-mono text-sm"
          @click="pickDeviceFile(f)"
        />
      </div>
    </Dialog>

    <input
      ref="importInput"
      type="file"
      accept=".nsl"
      class="hidden"
      @change="onImportFile"
    />
  </div>
</template>
