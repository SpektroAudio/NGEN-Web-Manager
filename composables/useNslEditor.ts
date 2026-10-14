import { ref, computed } from "vue";
import type { Command } from "../utils/nslCommands";

/// Build the serial message for a file upload
export const buildUploadMessage = (
  mode: number,
  filename: string,
  bytes: Uint8Array,
): number[] => [
  mode,
  filename.length,
  ...Array.from(filename).map((c) => c.charCodeAt(0)),
  ...new Uint8Array(new Uint32Array([bytes.length]).buffer),
  ...bytes,
  ...Array.from("--END--").map((c) => c.charCodeAt(0)),
];

type NslDeps = {
  state: {
    isConnected: boolean;
    compatibleFirmware: boolean;
    busy: boolean;
    uploading: boolean;
    files: unknown[];
    nslReceived: { name: string; data: Uint8Array };
    receiveMode: "download" | "buffer";
  };
  toast: { add: (msg: unknown) => void };
  folderNames: string[];
  sendMessage: (message: string) => Promise<void>;
  sendData: (data: Uint8Array) => Promise<void>;
  downloadFile: (folder: string, file: string) => Promise<void>;
};

export const useNslEditor = ({
  state,
  toast,
  folderNames,
  sendMessage,
  sendData,
  downloadFile,
}: NslDeps) => {
  const nslCommands = ref<Command[]>([]);
  const nslFilename = ref("script_1.nsl");
  const nslBaseline = ref<number[] | null>(null);

  /// Filenames in the device's NSL Scripts folder (for Load from device)
  const nslFileNames = computed(() => {
    const folderNum = folderNames.indexOf("NSL Scripts");
    const folders = state.files as unknown as Array<{
      folderNum: number;
      files: string[];
    }>;
    const folder = folders.find((f) => f.folderNum === folderNum);
    return folder ? folder.files : [];
  });

  /// Send an NSL script to NGEN (upload mode 4) — wait for response (similar to sendProject)
  const sendNslScript = async ({
    filename,
    bytes,
  }: {
    filename: string;
    bytes: Uint8Array;
  }): Promise<void> => {
    if (!state.isConnected || !state.compatibleFirmware) {
      toast.add({
        summary: "Please connect to a compatible NGEN",
        life: 5000,
        severity: "error",
      });
      return;
    }
    if (state.busy) {
      toast.add({
        summary: "Serial port is busy",
        life: 5000,
        severity: "error",
      });
      return;
    }

    console.log("NSL script size (bytes):", bytes.length);
    try {
      await sendMessage("R\r\n");
      state.uploading = true;
      await new Promise((r) => setTimeout(r, 1000));
      await sendData(new Uint8Array(buildUploadMessage(4, filename, bytes)));
      console.log("NSL script sent: " + filename);
      toast.add({
        summary: "Script sent to NGEN: " + filename,
        life: 3000,
        severity: "success",
      });
    } catch (error) {
      console.error("Error sending NSL script:", error);
      toast.add({
        summary: "Error sending NSL script: " + filename,
        life: 5000,
        severity: "error",
      });
    } finally {
      state.uploading = false;
      state.busy = false;
    }
  };

  /// Load an NSL script from the device into the editor (buffer receive mode)
  const handleLoadFromDevice = async ({ filename }: { filename: string }) => {
    const folderNum = folderNames.indexOf("NSL Scripts");
    const folders = state.files as unknown as Array<{
      folderNum: number;
      files: string[];
    }>;
    const folder = folders.find((f) => f.folderNum === folderNum);
    const fileIndex = folder ? folder.files.indexOf(filename) : -1;

    if (!folder || fileIndex === -1) {
      toast.add({
        summary: "File not found on device: " + filename,
        life: 3000,
        severity: "error",
      });
      return;
    }

    // Reset so the editor's watch re-fires even for the same file
    state.nslReceived = {} as { name: string; data: Uint8Array };
    state.receiveMode = "buffer";
    try {
      await downloadFile(String(folder.folderNum), String(fileIndex));
    } catch (err) {
      console.error(err);
      toast.add({
        summary: "Download failed: " + filename,
        life: 3000,
        severity: "error",
      });
    } finally {
      state.receiveMode = "download";
    }
  };

  return {
    nslCommands,
    nslFilename,
    nslBaseline,
    nslFileNames,
    sendNslScript,
    handleLoadFromDevice,
  };
};
