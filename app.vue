<script setup lang="ts">
import { ref, watch, reactive } from "vue";
import Button from "primevue/button";
import Tree from "primevue/tree";
import Divider from "primevue/divider";
import SelectButton from "primevue/selectbutton";
import Dialog from "primevue/dialog";
import ScrollPanel from "primevue/scrollpanel";
import { useToast } from "primevue/usetoast";
import ProgressSpinner from "primevue/progressspinner";
import "primeicons/primeicons.css";

useHead({
  title: "NGEN Web Manager",
  meta: [
    {
      name: "description",
      content:
        "Web manager tool for the Spektro Audio NGEN - Algorithmic MIDI Workstation",
    },
  ],
  link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
});

const toast = useToast();

const minFirmwareVersion = 1.4;
const maxFileSize = 50000;
const isWebSerialSupported =
  typeof navigator !== "undefined" && "serial" in navigator;
const appVersion = 0.1;
const storageOptions = [
  { name: "Internal Memory", value: 0 },
  { name: "microSD", value: 1 },
];
const availableViews = [
  { name: "Browser", value: 0 },
  { name: "Example Projects", value: 1 },
];

const folderNames = [
  "Projects",
  "MIDI Files",
  "DrumGen Templates",
  "NSL Scripts",
];
const checked = ref([]); // Define the checked property
const items = ref({}); // Items for the UTree
const state = reactive({
  isConnected: false,
  receivedMessages: [] as string[],
  port: null as SerialPort | null,
  files: [] as string[],
  firmwareVersion: "",
  storageLocation: 0,
  compatibleFirmware: true,
  busy: false,
  waiting: false,
  receivingFile: false,
  saveDialog: false,
  deleteDialog: false,
  infoSpinner: false,
  memoryInfo: "",
  projectData: {} as {
    name: "";
    description: "";
    data: [];
  },
  view: 0,
});

/// Connect to serial port via web serial
const connect = async () => {
  try {
    // state.port = await navigator.serial.requestPort();
    // await state.port.open({ baudRate: 9600 });
    const portRequest = navigator.serial.requestPort();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Port selection timeout")), 10000),
    );

    state.port = (await Promise.race([
      portRequest,
      timeoutPromise,
    ])) as SerialPort;

    // Add connection timeout
    await Promise.race([
      state.port.open({ baudRate: 9600 }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout")), 5000),
      ),
    ]);
    state.isConnected = true;
    state.waiting = true;
    console.log("Requesting initial files...");
    readData();
    console.log("Requesting NGEN version...");
    await getVersion();
    if (state.compatibleFirmware) {
      await requestFiles();
      await getValue("s").then((value) => {
        // console.log(value);
        state.storageLocation = parseInt(value);
      });
      console.log("Storage location: " + state.storageLocation);

      if (state.compatibleFirmware) {
        await sendCommand("i");
      }
    }
  } catch (error) {
    console.error("Error connecting:", error);
    state.isConnected = false;
  }
};

// Disconnect from serial port
const disconnect = async () => {
  // Cancel if not connected
  if (!state.port || !state.isConnected) return;
  state.busy = true;
  state.isConnected = false;
  // const reader = state.port.readable?.getReader();
  // reader.releaseLock();
  // setTimeout(function () {
  //   if (state.port) {
  //     state.port.close();
  //     state.port = null;
  //   }
  // }, 4000);
  try {
    // Cancel any ongoing reads
    if (state.port.readable?.locked) {
      const reader = state.port.readable.getReader();
      await reader.cancel();
      await reader.releaseLock();
    }

    // Close the port
    await state.port.close();
    state.port = null;

    toast.add({
      summary: "Disconnected successfully",
      severity: "info",
      life: 2000,
    });
  } catch (error) {
    console.error("Error during disconnect:", error);
    // Force cleanup even if error occurs
    state.port = null;
  } finally {
    state.busy = false;
  }
};

// Returns if any files are selected on the tree component
const hasFileSelected = () => {
  return Object.keys(checked.value).length > 0;
};

// Returns a dictionary containing the folder name and files selected
const selectedFiles = () => {
  var files = {};
  // console.log(items.value);
  for (let key in checked.value) {
    if (checked.value[key]["checked"] == true && key.includes("_")) {
      var file_info = key.split("_");
      var folder = parseInt(file_info[0]);
      var file = parseInt(file_info[1]);
      // console.log("Folder: ", folder, "/ File: ", file);
      var foldername = items.value[folder]["label"].replace(/\(\d+\)/g, "");
      var filename = items.value[folder]["children"][file]["label"];
      if (foldername in files) {
        files[foldername].push(filename);
      } else {
        files[foldername] = [filename];
      }
    }
  }
  return files;
};

// Clears the buffer for received messages via serial
const clearReceivedBuffer = () => {
  state.receivedMessages = [] as string[];
};

// Read data from serial port
const readData = async () => {
  if (!state.port || !state.port.readable) return;
  const decoder = new TextDecoder();
  const reader = state.port.readable?.getReader();
  try {
    while (state.isConnected && reader) {
      try {
        if (state.busy == false) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            const text = decoder.decode(value);
            state.receivedMessages.push(text);

            // console.log(text);

            // Finish file downloads
            if (state.receivingFile && text.includes("TX_END")) {
              console.log("Saving file");
              state.receivingFile = false;
              await saveFile();
              clearReceivedBuffer();
            }
          }
        }
      } catch (error) {
        console.error("Read error:", error);
        break;
      }
    }
  } catch (error) {
    console.error("Error receiving data from serial port.");
  } finally {
    console.log("Releasing serial port lock");
    await reader.releaseLock();
  }
};

// Change NGEN's storage location
const setStorageLocation = async (location: number) => {
  checked.value = [];
  await sendMessage("S\r\n" + state.storageLocation + "\r\n");
  setTimeout(() => {
    requestFiles();
  }, 100);
};

// Upload file to NGEN via serial
const uploadFile = (file_mode: number) => {
  if (state.busy) {
    toast.add({
      summary: "Serial port is busy",
      life: 5000,
      severity: "error",
    });

    return;
  }

  console.log("Upload mode:", file_mode);
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "*.hex"; // Accept all file types

  state.busy = true;
  fileInput.onchange = (event) => {
    const file = event.target?.files?.[0];
    if (file) {
      // Convert file to a u8 buffer array
      file
        .arrayBuffer()
        .then((content: { byteLength: any }) => {
          // Retrieve file info
          state.saveDialog = false;
          const filename = file.name;
          const filename_len = filename.length;
          const file_size = content.byteLength;
          console.log("File size (bytes):", file_size);
          if (file_size > maxFileSize) {
            toast.add({
              summary: "Error: File too large (>50kb)",
              life: 5000,
              severity: "error",
            });

            return;
          }
          const file_size_arr = new Uint8Array(
            new Uint32Array([file_size]).buffer,
          );

          // Create serial message
          const msg = [
            file_mode,
            filename_len,
            ...Array.from(filename).map((c) => c.charCodeAt(0)),
            ...file_size_arr,
            ...new Uint8Array(content),
            ...Array.from("--END--").map((c) => c.charCodeAt(0)),
          ];

          // console.log(msg);

          // Send serial message
          sendMessage("R\r\n"); // Start the transmission
          setTimeout(function () {
            sendData(new Uint8Array(msg)); // Send the message
            console.log("File sent");
            toast.add({
              summary:
                "File uploaded to " +
                folderNames[file_mode - 1] +
                ": " +
                filename,
              life: 5000,
              severity: "success",
            });
            state.busy = false;
          }, 1000);
        })
        .catch((error: string) => {
          console.error("Error:", error);
          toast.add({
            summary: "Error: " + error,
            life: 5000,
            severity: "danger",
          });
          state.busy = false;
        });
    }
  };

  fileInput.click(); // Open file picker
};

// Send an example project to NGEN via serial (loads directly into memory)
const sendProject = () => {
  if (!state.isConnected) {
    toast.add({
      summary: "Please connect to NGEN",
      life: 5000,
      severity: "error",
    });
  } else if (state.busy) {
    toast.add({
      summary: "Serial port is busy",
      life: 5000,
      severity: "error",
    });

    return;
  } else {
    const filename = state.projectData["name"];
    const filename_len = filename.length;
    const file_size = state.projectData["data"].length;

    console.log("File size (bytes):", file_size);

    const file_size_arr = new Uint8Array(new Uint32Array([file_size]).buffer);
    const msg = [
      5,
      filename_len,
      ...Array.from(filename).map((c) => c.charCodeAt(0)),
      ...file_size_arr,
      ...new Uint8Array(state.projectData["data"]),
      ...Array.from("--END--").map((c) => c.charCodeAt(0)),
    ];

    // console.log(msg);

    sendMessage("R\r\n"); // Start the transmission
    setTimeout(function () {
      sendData(new Uint8Array(msg)); // Send the message
      console.log("File sent");
      toast.add({
        summary: "Loaded project into memory: " + filename,
        life: 5000,
        severity: "success",
      });
    }, 1000);
  }
};

// Request NGEN firmware version
const getVersion = async () => {
  console.log("Checking firmware version");
  sendMessage("v\r\n");
  await new Promise((resolve) => {
    var timeout = setTimeout(function () {
      state.firmwareVersion = state.receivedMessages.join("");
      state.compatibleFirmware =
        parseFloat(state.firmwareVersion) >= minFirmwareVersion;
      clearReceivedBuffer();
      resolve();
    }, 1000);
  });
};

// Sends a message to the serial port, wait for a response and return the value
const getValue = async (msg: string): Promise<any> => {
  sendMessage(msg + "\r\n");
  clearReceivedBuffer();
  let value = await new Promise((resolve) => {
    let timeout = setTimeout(function () {
      let received_value = state.receivedMessages.join("");
      console.log("Received: " + received_value);
      clearReceivedBuffer();
      resolve(received_value);
      // Finish async here
    }, 1000);
  });
  return value;
};

// Request file list
const requestFiles = async () => {
  toast.add({
    summary: "Requesting files from NGEN hardware..",
    life: 1000,
    severity: "secondary",
  });
  state.waiting = true;
  items.value = {};
  sendMessage("f\r\n");
  await new Promise((resolve) => {
    var timeout = setTimeout(function () {
      const input_msg = state.receivedMessages.join("").split("\r\n");
      clearReceivedBuffer();

      let folderData: any[] = [];
      let currentFolder: {
        fileCount: any;
        files: any;
        folderNum?: number;
      } | null = null;

      let separator = state.compatibleFirmware ? " " : " - ";
      input_msg.forEach((line) => {
        if (line.startsWith("FOLDER")) {
          if (currentFolder) {
            folderData.push(currentFolder);
          }
          currentFolder = {
            folderNum: parseInt(line.split(separator)[1]),
            fileCount: 0,
            files: [],
          };
        } else if (line.startsWith("FILES")) {
          if (currentFolder) {
            currentFolder.fileCount = parseInt(line.split(separator)[1]);
          }
        } else if (line.includes(" ")) {
          if (currentFolder) {
            const filename = line.split(separator)[1];
            currentFolder.files.push(filename);
          }
        }
      });

      if (currentFolder) {
        folderData.push(currentFolder); // Add the last folder
      }

      // console.log(folderData);
      state.files = folderData;
      state.receivedMessages = [];
      resolve();
    }, 1000);
  });
};

// Function to transform folderData into PriveVue Tree compatible items
const transformToTreeItems = (folderData: any[]) => {
  return folderData.map((folder) => ({
    label: `${folderNames[folder.folderNum]} (${folder.files.length})`,
    key: `${folder.folderNum}`,
    icon: "pi pi-folder",
    children: folder.files.map((file: string, index: string) => ({
      label: file, // Use an appropriate icon or remove if not needed
      key: folder.folderNum + "_" + index,
    })),
  }));
};

watch(
  () => state.files,
  (newFiles) => {
    items.value = transformToTreeItems(newFiles);
    state.waiting = false;
  },
  { immediate: true },
);

// Send message via serial port
const sendMessage = async (message: string) => {
  if (!state.port) return;
  state.busy = true;
  state.receivedMessages = [];
  const writer = state.port.writable?.getWriter();
  if (writer) {
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(message));
    writer.releaseLock();
  }
  state.busy = false;
};

// Send data (U8 array) to serial port
const sendData = async (data: Uint8Array) => {
  if (!state.port) return;
  state.busy = true;
  const writer = state.port.writable?.getWriter();
  if (writer) {
    for (const value of data) {
      await writer.write(new Uint8Array([value]));
    }
    writer.releaseLock();
  }
  state.busy = false;
};

// Request file content
const downloadFile = async (folder: string, file: string) => {
  const message = `F\r\n${folder}\r\n${file}\r\n`;
  state.receivingFile = true;
  sendMessage(message);
};

// Iterate through the selected files and download each item individually
const downloadSelected = async () => {
  for (let key in checked.value) {
    if (checked.value[key]["checked"] == true && key.includes("_")) {
      var file_info = key.split("_");
      var folder = file_info[0];
      var file = file_info[1];
      console.log("Downloading file " + folder + " / " + file);
      await downloadFile(folder, file);

      // Wait until file is received
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (!state.receivingFile) {
            clearInterval(interval);
            resolve();
          } else {
            console.log("Waiting...");
          }
        }, 100); // Check every 100ms
      });
    }
  }
  checked.value = [];
};

const updateProjectData = async (data: any) => {
  state.projectData = data;
};

// Send delete file request to NGEN
const deleteFile = async (folder: string, file: string) => {
  const message = `d\r\n${folder}\r\n${file}\r\n`;
  sendMessage(message);
};

// Iterate through the selected files and delete items individually
const deleteSelected = async () => {
  let count: number = 0;
  state.deleteDialog = false;
  for (let key in checked.value) {
    if (checked.value[key]["checked"] == true) {
      var file_info = key.split("_");
      var folder = file_info[0];
      var file = file_info[1];
      count += 1;
      console.log("Deleting file " + folder + " / " + file);
      await deleteFile(folder, file);
    }
  }
  if (count > 0) {
    checked.value = [];
    console.log("Updating files");
    await new Promise((resolve) => {
      setTimeout(() => {
        toast.add({
          summary: "Deleted " + count + " files",
          life: 5000,
          severity: "success",
        });
        requestFiles();
      }, 1000);
    });
  }
  // ;
};

// Parse received U8 arrays and download received files (as U8 arrays)
const saveFile = async () => {
  // Clean received messages
  const input_msg = state.receivedMessages.join("").split("\r\n");

  // Set up file info
  var file_size_expected = 0;
  var file_body = [];
  var body_content = false;
  var transfer_start = 0;
  var filename = "";

  // Iterate through received messages
  for (var i = 0; i < input_msg.length; i++) {
    if (input_msg[i] === "NGEN_FILE_TX_START") {
      transfer_start = i;
      filename = input_msg[transfer_start + 1];
      console.log("Filename: " + filename);
    } else if (input_msg[i] === "-START BODY-") {
      file_size_expected = parseInt(input_msg[i - 1]);
      body_content = true;
    } else if (input_msg[i] === "-END BODY-") {
      body_content = false;
    } else if (body_content) {
      file_body.push(parseInt(input_msg[i]));
    }
  }

  if (file_size_expected == 0 || filename.length == 0) {
    toast.add({
      summary: "Error downloading file: " + filename,
      life: 1000,
      severity: "error",
    });
    return;
  }

  // Set up file content
  let file_body_array: Uint8Array = new Uint8Array(file_body);
  console.log("Expected size: " + file_size_expected);

  if (file_body.length != file_size_expected) {
    toast.add({
      summary: "Error saving file: " + filename + " (failed filesize check)",
      life: 1000,
      severity: "error",
    });
    return;
  }

  toast.add({
    summary: "Saving file: " + filename + " (" + file_size_expected + " bytes)",
    life: 1000,
    severity: "success",
  });

  // Download file
  const blob = new Blob([file_body_array], {
    type: "application/octet-stream",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Send command to serial followed by a line break
const sendCommand = async (cmd: string) => {
  state.memoryInfo = "";
  state.infoSpinner = true;
  clearReceivedBuffer();
  sendMessage(cmd + "\r\n");
  await new Promise((resolve) => {
    setTimeout(function () {
      state.infoSpinner = false;
      state.memoryInfo = state.receivedMessages.join("");
      // console.log("Memory info:", state.memoryInfo);
      resolve();
    }, 1000);
  });
};
</script>

<template>
  <div class="flex flex-col space-y-4 items-center my-8">
    <Toast />

    <div class="flex flex-col items-center w-full space-y-6">
      <div class="flex flex-row items-end justify-between w-3/4">
        <Header :version="appVersion" ngen_logo="/img/NGENLogo.png" />
        <RequiredVersion :version="minFirmwareVersion" />
      </div>

      <Divider class="w-3/4" />

      <div
        v-if="!isWebSerialSupported"
        class="flex items-center justify-center py-2 text-red-500 border border-red-500 rounded-lg w-3/4 space-x-4"
      >
        <span class="animate-pulse pi pi-exclamation-triangle" />
        <p>
          Web Serial API is not supported in your browser. Use Chromium-based
          browsers.
        </p>
      </div>

      <div
        class="flex flex-row justify-between items-center w-3/4 py-2 bg-black/10 px-6 py-4 rounded-l border border-white/10"
      >
        <SelectButton
          v-model="state.view"
          class="opacity-80"
          size="large"
          :options="availableViews"
          optionLabel="name"
          optionValue="value"
          :allowEmpty="false"
        />
        <div class="flex space-x-4 justify-center items-center">
          <span
            class="pi pi-angle-double-right opacity-20 animate-pulse"
            v-if="!state.isConnected"
            style="font-size: 24px"
          ></span>
          <Button
            :label="state.isConnected ? 'Disconnect' : 'Connect to NGEN'"
            :class="state.isConnected ? 'p-button-danger' : 'p-button-success'"
            @click="state.isConnected ? disconnect() : connect()"
          />
        </div>
      </div>
    </div>

    <div
      class="grid grid-cols-2 justify-center gap-4"
      :class="state.isConnected ? 'blur-none' : 'blur-[4px] opacity-20'"
      v-if="state.view == 0"
    >
      <div
        class="flex-auto border items-center justify-center border-white/10 rounded-md p-8 w-full space-y-4 h-[460px]"
      >
        <div class="flex items-center">
          <h2 class="text-white/80">FILE MANAGER</h2>
          <SelectButton
            v-if="
              state.isConnected &&
              state.compatibleFirmware &&
              state.storageLocation < 2
            "
            :disabled="state.waiting"
            v-model="state.storageLocation"
            class="ml-auto text-xs opacity-80"
            size="small"
            :options="storageOptions"
            optionValue="value"
            optionLabel="name"
            @value-change="setStorageLocation"
            :allowEmpty="false"
          />
        </div>
        <div class="grid grid-cols-4 gap-4">
          <Button
            label="Refresh"
            class="p-button-primary"
            icon="pi pi-refresh"
            size="small"
            variant="outlined"
            :disabled="!state.isConnected || !state.compatibleFirmware"
            @click="requestFiles"
          />
          <Button
            label="Download"
            class="p-button-primary"
            icon="pi pi-arrow-circle-down"
            size="small"
            :disabled="!hasFileSelected()"
            @click="downloadSelected"
          />

          <Button
            label="Delete"
            class="p-button-danger"
            icon="pi pi-trash"
            size="small"
            :disabled="!hasFileSelected()"
            @click="state.deleteDialog = true"
          />

          <Button
            label="Upload"
            class="p-button-primary"
            icon="pi pi-upload"
            size="small"
            :disabled="!state.isConnected || !state.compatibleFirmware"
            @click="state.saveDialog = true"
          />
        </div>
        <ScrollPanel style="width: 100%; height: 300px">
          <Tree
            :loading="state.waiting"
            :filter="true"
            filterMode="lenient"
            :value="items"
            v-model:selectionKeys="checked"
            selectionMode="checkbox"
            class="w-full md:w-[30rem] rounded-l bg-transparent"
          />
        </ScrollPanel>
      </div>

      <div
        class="font-mono flex flex-col w-full items-center space-y-4 space-x-4 bg-black/40 p-4 rounded-lg h-[460px]"
      >
        <div
          class="text-center my-1"
          :class="state.compatibleFirmware ? 'text-green-400' : 'text-white/20'"
          v-if="state.firmwareVersion.length > 0"
        >
          Device Firmware Version: {{ state.firmwareVersion }}
          <span
            class="pi pi-check-circle"
            v-if="state.compatibleFirmware"
          ></span>
        </div>
        <div
          v-if="!state.compatibleFirmware"
          class="flex flex-col space-y-4 items-center text-center justify-center py-4 text-red-500 border border-red-500 rounded-lg w-full"
        >
          <p>
            Incompatible Firmware Version<br />
            Please update NGEN to Firmware v{{ minFirmwareVersion }}
          </p>
          <Button
            as="a"
            href="https://ngen.spektroaudio.com/firmwareupdate/"
            icon="pi pi-link"
            target="_blank"
            class="text-xs px-6"
            label="Firmware Update - NGEN User Manual"
            size="small"
            severity="secondary"
            rounded
          />
        </div>
        <div
          v-show="state.compatibleFirmware && state.firmwareVersion.length > 0"
        >
          <div class="grid grid-cols-3 space-x-4">
            <Button
              class="text-xs px-6"
              label="Device Info"
              size="small"
              severity="secondary"
              rounded
              @click="sendCommand('i')"
            />
            <Button
              class="text-xs px-6"
              label="Track Info"
              size="small"
              severity="secondary"
              rounded
              @click="sendCommand('t')"
            />
            <Button
              class="text-xs px-6"
              label="Project Info"
              size="small"
              severity="secondary"
              rounded
              @click="sendCommand('p')"
            />
          </div>
          <ScrollPanel class="w-full h-[400px]">
            <!-- <p> -->

            <div class="flex justify-center mt-8" v-show="state.infoSpinner">
              <ProgressSpinner
                style="width: 50px; height: 50px"
                strokeWidth="8"
                fill="transparent"
                animationDuration=".5s"
              />
            </div>

            <pre
              class="p-4 rounded-md min-h-[200px] text-white/60 font-mono text-sm"
              >{{ state.memoryInfo }}</pre
            >
            <!-- </p> -->
          </ScrollPanel>
        </div>
      </div>
    </div>

    <Projects
      @projectData="updateProjectData"
      @send="sendProject"
      v-if="state.view == 1"
    />

    <!-- <div>{{ checked }}</div> -->

    <Footer :version="appVersion" />
  </div>

  <Dialog
    v-model:visible="state.saveDialog"
    modal
    header="Upload File"
    class="w-80"
  >
    <div
      class="text-center text-surface-500 text-white/50 font-mono font-thin text-sm dark:text-surface-400 block mb-8"
    >
      Select File Type to Upload
    </div>

    <div class="grid grid-cols-1 gap-2">
      <Button type="button" label="Project" @click="uploadFile(1)"></Button>
      <Button
        type="button"
        variant="outlined"
        label="MIDI File"
        @click="uploadFile(2)"
      ></Button>
      <Button
        type="button"
        variant="outlined"
        label="DrumGen Template"
        @click="uploadFile(3)"
      ></Button>
      <Button
        type="button"
        variant="outlined"
        label="NSL Script"
        @click="uploadFile(4)"
      ></Button>
      <Button
        type="button"
        variant="outlined"
        label="Load Project"
        @click="uploadFile(5)"
      ></Button>
    </div>
  </Dialog>

  <Dialog
    v-model:visible="state.deleteDialog"
    modal
    header="Delete Files?"
    class="w-80"
  >
    <div
      class="text-center text-surface-500 text-white/50 font-mono font-thin text-sm dark:text-surface-400 block mb-8"
    >
      <ScrollPanel style="width: 100%; max-height: 300px">
        <div
          v-for="(value, key) in selectedFiles()"
          :key="key"
          class="text-white/40 m-2"
        >
          - {{ key }} -
          <div v-for="item in value" class="text-white/100 m-2">
            {{ item }}
          </div>
        </div>
      </ScrollPanel>
    </div>

    <div class="flex items-center justify-center gap-2">
      <Button
        type="button"
        variant="outlined"
        class="p-button-secondary"
        label="Cancel"
        @click="state.deleteDialog = false"
      ></Button>

      <Button
        type="button"
        label="Delete"
        class="p-button-danger"
        @click="deleteSelected"
      ></Button>
    </div>
  </Dialog>

  <Dialog
    v-model:visible="state.receivingFile"
    modal
    header="Downloading file"
    class="w-80"
  >
    <div
      class="text-center text-surface-500 text-white/50 font-mono font-thin text-sm dark:text-surface-400 block mb-8"
    >
      <!-- <div class="mb-6">The file is being downloaded...</div> -->
      <ProgressBar
        class="mt-4"
        mode="indeterminate"
        style="height: 6px"
      ></ProgressBar>
    </div>
  </Dialog>
</template>

<style></style>
