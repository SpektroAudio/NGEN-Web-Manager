
<script setup>
import Select from 'primevue/select';
import { ref } from "vue";
import ScrollPanel from 'primevue/scrollpanel';
import { marked } from 'marked'; // Import marked library



const availableProjects = [
    "TestProject",
    "Tutorial_Polyform"
];
const selectedCity = ref();
const activeProject = ref({
    "name": "",
    "description": ""
});
const projectDescription = ref("");

const emit = defineEmits(['projectData', 'send']);
const loadProject = async () => {
    var filename = selectedCity.value;
    var path = `/projects/${filename}.json`;
    console.log("Loading JSON: " + path)
    $fetch(path, {
    headers: { 'Content-Type': 'application/json' }
    }).then(value => {
        console.log(value)

        activeProject.value = JSON.parse(JSON.stringify(value));
        var d = activeProject.value["description"].join("<br>");
        projectDescription.value = marked(d);
        console.log(activeProject.value["name"]);
        console.log(projectDescription.value);
        emit('projectData', activeProject.value);
    })

};

</script>


<template>
    <div class="flex-auto border items-center justify-center border-white/10 rounded-md p-8 w-3/4 lg:w-3/5 space-y-4  h-[460px]">
        <div class="flex flex-row space-y-2  justify-between m-2">
            <div class="flex flex-col space-y-4">
                <p>
                Example projects
                </p>
                <p class="text-xs font-thin font-mono text-white/60">
                    Load example projects directly into NGEN's memory.
                </p>
            </div>
            <p class="text-[11px] w-96 font-thin font-mono text-white/60 text-center p-2 bg-yellow-500/10 border border-white/20 rounded-md">
                <span class="pi pi-exclamation-triangle"/> WARNING: Example projects will replace the current project, causing unsaved changes to be lost.
            </p>
        </div>
        <div class="flex items-center justify-between">
            <Select v-model="selectedCity" :options="availableProjects" @value-change="loadProject" placeholder="Example Projects" class="w-1/3" />

            <Button type="button"  label="Send to NGEN" class="p-button-primary mr-2" @click="emit('send')"></Button>
        </div>
        <!-- <Divider /> -->
        <div>
            <ScrollPanel class="bg-black/30 rounded-lg p-6 border border-white/20" style="width: 100%; height: 260px">
                <div class="text-sm font-thin ">
                    <!-- <pre> -->
                        <p  v-html="projectDescription"/>
                    <!-- </pre> -->
                    <!-- <pre>
                        aaa -->
                    
                    <!-- </pre> -->
                </div>
            </ScrollPanel>
        </div>

    </div>
</template>

