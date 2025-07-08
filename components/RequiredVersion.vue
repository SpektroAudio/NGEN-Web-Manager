<template>
    <div class="text-[11px] font-mono font-light text-white/60 bg-white/5 py-2 px-4 rounded-xl">
        REQUIRES NGEN FIRMWARE {{version}}+
    </div>
</template>

<script>
export default {
    props: {
        version: {
            type: Number, 
            required: true
        }
    }
}
</script>