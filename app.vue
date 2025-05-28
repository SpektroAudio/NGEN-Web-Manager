<script setup lang="ts">
import { ref,watch, reactive } from 'vue'
import Button from "primevue/button"
import Tree from "primevue/tree"
// import Card from "primevue/Card"
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';

import Panel from 'primevue/panel';

import ScrollPanel from 'primevue/scrollpanel';
import { useToast } from 'primevue/usetoast';

const toast = useToast();


// Check if Web Serial API is available

const isWebSerialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;

const state = reactive({
  isConnected: false,
  receivedMessages: [] as string[],
  port: null as SerialPort | null,
  files: [],
  busy: false,
  receivingFile: false
})

const checked = ref([]); // Define the checked property

const items = ref({}); // Items for the UTree


// Connect to serial port
const connect = async () => {
  try {
    state.port = await navigator.serial.requestPort()
    await state.port.open({ baudRate: 9600 });
    state.isConnected = true;
    readData();

    requestFiles();
  } catch (error) {
    console.error('Error connecting:', error)
    state.isConnected = false
  }
}

// Disconnect from serial port
const disconnect = async () => {
  state.isConnected = false;
  setTimeout(function() {
    if (state.port) {
      state.port.close()
      state.port = null
    }
  }, 1000);
}

// Read data from serial port
const readData = async () => {
  if (!state.port) return
  var decoder = new TextDecoder();
  const reader = state.port.readable?.getReader()
  while (state.isConnected && reader) {
    try {
      if (state.busy == false) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) {
          const text = decoder.decode(value)
          state.receivedMessages.push(text)
          console.log(text);
          if (state.receivingFile && text.includes("NGEN_FILE_TX_END")) {
            console.log("Saving file")
            state.receivingFile = false;
            saveFile();
          }

        }
      }
    } catch (error) {
      console.error('Read error:', error)
      break
    }
  }
  reader.releaseLock()
}

const uploadFile = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '*.hex'; // Accept all file types
    
    fileInput.onchange = (event) => {
      const file = event.target?.files?.[0];
      if (file) {
        file.arrayBuffer().then(content => {
          const filename = file.name;
          const filename_len = filename.length;
          const file_size = content.byteLength;
          const msg = [1, filename_len, ...Array.from(filename).map(c => c.charCodeAt(0)), ...new Uint8Array(new Uint32Array([file_size]).buffer), ...new Uint8Array(content), ...Array.from("--END--").map(c => c.charCodeAt(0))];

          console.log("File size (bytes):", file_size);
          console.log("Serial message length:", msg.length);

          console.log(msg);
          
          sendMessage("T\n"); // Start the transmission
          setTimeout(function() {
            sendData(new Uint8Array(msg)); // Send the message
            console.log("File sent");
          }, 1000);

        }).catch(error => {
          console.error('Error:', error);
        });
        


      }
    };

    fileInput.click(); // Open file picker
  };

const loadTestMessages = () => {
  state.receivedMessages = [
    "FOLDER 0",
    "FILES 29",
    "0 - CYCLES1.HEX",
    "1 - FILE_01.HEX",
    "2 - FILE_02.HEX",
    "3 - FILE_03.HEX",
    "4 - FILE_04.HEX",
    "5 - FILE_05.HEX",
    "6 - FILE_06.HEX",
    "7 - FILE_07.HEX",
    "8 - FILE_08.HEX",
    "9 - FILE_09.HEX",
    "10 - FILE_10.HEX",
    "11 - FILE_11.HEX",
    "12 - FILE_12.HEX",
    "13 - FILE_13.HEX",
    "14 - FILE_14.HEX",
    "15 - FILE_15.HEX",
    "16 - FILE_16.HEX",
    "17 - FILE_17.HEX",
    "18 - FILE_18.HEX",
    "19 - FILE_19.HEX",
    "20 - FILE_20.HEX",
    "21 - FILE_21.HEX",
    "22 - FILE_22.HEX",
    "23 - FILE_23.HEX",
    "24 - FILE_24.HEX",
    "25 - FILE_25.HEX",
    "26 - FILE_26.HEX",
    "27 - FILE_27.HEX",
    "28 - FILE_28.HEX",
    "FOLDER 1",
    "FILES 1",
    "0 - CHORDS.mid",
    "FOLDER 2",
    "FILES 11",
    "0 - BOOMBAP.HEX",
    "1 - BOSSA.HEX",
    "2 - BREAKS.hex",
    "3 - DNB.hex",
    "4 - ELECTRO.hex",
    "5 - FUNK_BR.hex",
    "6 - GARAGE.HEX",
    "7 - HOUSE.hex",
    "8 - JUNGLE.HEX",
    "9 - MEMPHIS.HEX",
    "10 - TECHNO.hex",
    "FOLDER 3",
    "FILES 1",
    "0 - EBASS.NSL"
  ];
}

const requestFiles = async () => {
  toast.add({
    summary:"Requesting files from NGEN hardware..",
    life: 1000,
    severity: "info"
  });
  items.value = {};
  sendMessage('f\n');
  var timeout = setTimeout(function(){

    const input_msg = state.receivedMessages.join("").split("\r\n");
    // loadTestMessages();
    // const input_msg = state.receivedMessages;

    const folderData = [];
    let currentFolder = null;
    
    input_msg.forEach(line => {
      if (line.startsWith("FOLDER")) {
        if (currentFolder) {
          folderData.push(currentFolder);
        }
        currentFolder = { 
          folderNum: parseInt(line.split(" ")[1]), 
          fileCount: 0, 
          files: [] 
        };
      } else if (line.startsWith("FILES")) {
        if (currentFolder) {
          currentFolder.fileCount = parseInt(line.split(" ")[1]);
        }
      } else if (line.includes(" ")) {
        if (currentFolder) {
          const filename = line.split(" ")[1];
          currentFolder.files.push(filename);
        }
      }
    });
    
    if (currentFolder) {
      folderData.push(currentFolder); // Add the last folder
    }
    
    console.log(folderData);
    state.files = folderData;
    state.receivedMessages = [];
  }, 1000);
}



// Function to transform folderData into PriveVue Tree compatible items
const transformToTreeItems = (folderData) => {
  const folderNames = ["[ / ] Projects", "[ /MIDI ] MIDI Files", "[ /DRUMGEN ] DrumGen Templates", "[ /NSL ] NSL Scripts"];

  return folderData.map(folder => ({
    label: `${folderNames[folder.folderNum]}`,
    key: `${folder.folderNum}`,
    icon: "pi pi-folder",
    children: folder.files.map((file, index) => ({
      label: file, // Use an appropriate icon or remove if not needed
      key: folder.folderNum + "_" + index
    }))
  }));
};


watch(() => state.files, (newFiles) => {
  items.value = transformToTreeItems(newFiles);
  console.log("Items: " + items.value[0]);
}, { immediate: true });


// Send data to serial port
const sendMessage = async (message) => {
  if (!state.port) return
  state.busy = true;
  state.receivedMessages = [];

  const writer = state.port.writable?.getWriter()
  if (writer) {
    const encoder = new TextEncoder()
    await writer.write(encoder.encode(message))
    writer.releaseLock()
  }

  state.busy = false;
}

const sendData = async (data) => {
  if (!state.port) return
  state.busy = true;

  const writer = state.port.writable?.getWriter()
  if (writer) {
    await writer.write(data)
    writer.releaseLock()
  }

  state.busy = false;
}

// Send data to serial port
const downloadFile = async (folder, file) => {
  const message = `F\n${folder}\n${file}\n`;
  state.receivingFile = true;
  sendMessage(message);
}

const downloadSelected = async () => {
  for (let key in checked.value) {
    if (checked.value[key]["checked"] == true) {
      var file_info = key.split("_");
      var folder = file_info[0];
      var file = file_info[1];
      console.log("Downloading file " + folder + " / " + file);
      await downloadFile(folder, file);

      // Wait until file is received
      await new Promise(resolve => {
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
}


const saveFile = async() => {
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
      file_size_expected = parseInt(input_msg[i-1]);
      body_content = true;
    } else if (input_msg[i] === "-END BODY-") {
      body_content = false;
    } else if (body_content) {
      file_body.push(parseInt(input_msg[i]));
    }
  }

  if (file_size_expected == 0 || filename.length == 0) {
    toast.add({
      summary:"Error downloading file: " + filename,
      life: 1000,
      severity: "error"
    });
    return
  }

  // Set up file content
  file_body = new Uint8Array(file_body);
  console.log("Expected size: " + file_size_expected)
  console.log(file_body)

  if (file_body.length != file_size_expected) {
    toast.add({
      summary:"Error saving file: " + filename + " (failed filesize check)",
      life: 1000,
      severity: "error"
    });
    return
  }


  toast.add({
    summary:"Saving file: " + filename + " (" + file_size_expected + " bytes)",
    life: 1000,
    severity: "info"
  });


  // Download file
  const blob = new Blob([file_body], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

</script>
<template>
  <div class="flex flex-col space-y-8 items-center  justify-center mt-8">
    <Toast />

    <div class="flex flex-col items-center justify-center w-full space-y-4">
      <!-- <div class="border border-white rounded-lg w-3/4 p-3 space-y-2 flex flex-col items-center justify-evenly "> -->
        <div class="text-3xl"> NGEN File Management</div>
        <div class="font-light font-mono text-white/30"> 
          This is a web-app for managing NGEN's memory.
        </div>

          <div v-if="!isWebSerialSupported" class="flex items-center justify-center text-red-500 border border-red-500 rounded-lg w-3/4 ">
            Web Serial API is not supported in your browser. Use Chromium-based browsers.
          </div>
          <!-- <p class="m-0"> -->
            <div class="flex items-center justify-evenly space-x-8">
              <Button
                :label="state.isConnected ? 'Disconnect' : 'Connect to Serial Port'"
                :class="state.isConnected ? 'p-button-danger' : 'p-button-success'"
                @click="state.isConnected ? disconnect() : connect()"
              />

              <Button
                label="Retrieve Files"
                class="p-button-primary"
                @click="requestFiles"
              />
            </div>
          <!-- </p> -->
    <!-- </div> -->
  </div>

    <!-- <Card> -->
      <!-- <template #header>
        <div class="h-8">
          Files on NGEN
        </div>
      </template> -->

    <!-- <div class="card"> -->

      <div class="grid grid-cols-2 justify-center gap-4">
        <div class="flex-auto">
          <h2>Files on NGEN</h2>
          
          <Tree :value="items" v-model:selectionKeys="checked" selectionMode="checkbox" class="w-full md:w-[30rem]" />
          <div class="grid grid-cols-4 gap-4">
            <Button
              label="Download Selected"
              class="p-button-primary"
              size="small"
              :disabled="checked.length > 0"
              @click="downloadSelected"
            />

            <Button
              label="Upload File"
              class="p-button-secondary"
              size="small"
              @click="uploadFile"
            />
          <!-- </div> -->

          </div>
        </div>
        <div class="font-mono flex-auto">
              <ScrollPanel  style="width: 100%; height: 200px">
                    <!-- <p> -->
                    <pre class="p-4 rounded-md min-h-[200px]">{{ state.receivedMessages.length }}</pre>
                    <!-- </p> -->
                    
                </ScrollPanel>
          </div>
          
          

      </div>
        <!-- <Splitter style="height: 500px">
            <SplitterPanel class="flex items-center justify-center" :size="25" :minSize="10">
              <ScrollPanel style="width: 100%; height: 100%">
                
                {{ checked }}
              </ScrollPanel>
            </SplitterPanel>
            <SplitterPanel class="flex items-center justify-center" :size="75">
                <Panel header="Serial Output" style="width: 600px;">
                      
              </Panel>
              
            </SplitterPanel>
        </Splitter> -->
    <!-- </div> -->
  </div>
</template>