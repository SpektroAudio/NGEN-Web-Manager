<template>

    <div class="flex justify-center items-center space-x-8">
      <Button as="a"  href="https://spektroaudio.com/ngen" icon="pi pi-link" target="_blank" class="text-xs px-6" label="NGEN WEBPAGE" size="small" severity="secondary" rounded  />
      <Button as="a"  href="https://ngen.spektroaudio.com" icon="pi pi-book" target="_blank" class="text-xs px-6" label="NGEN USER MANUAL" size="small" severity="secondary" rounded  />
      <Button as="a"  href="https://spektroaudio.com" icon="pi pi-globe" target="_blank" class="text-xs px-6" label="SPEKTROAUDIO.COM" size="small" severity="secondary" rounded  />
      <Button as="a"  href="https://spektroaudio.com" icon="pi pi-github" target="_blank" class="text-xs px-6 rounded-xl" label="REPOSITORY"  size="small" severity="secondary"   />

    </div>

    <div class="text-[9px] font-mono opacity-20">
        VERSION {{version}} - {{lastCommitDate}}
    </div>

  <!-- <Button type="button" label="Print" class="p-button-danger" @click="console.log(projectData)"></Button> -->
</template>
<script>
export default {
    props: {
        version: {
            type: Number,
            required: true
        }
    },
    data() {
        return {
            lastCommitDate: '', // Initialize the lastCommitDate property
        };
    },
    mounted() {
        this.fetchLastCommitDate();
    },
    methods: {
        async fetchLastCommitDate() {
            try {
                const response = await fetch('https://api.github.com/repos/SpektroAudio/DrumGenTemplateEditor/releases?per_page=1');
                const data = await response.json();
                this.lastCommitDate = new Date(data[0].published_at).toLocaleString(); // Format the date
            } catch (error) {
                console.error('Error fetching last commit date:', error);
            }
        },
    }
}
</script>