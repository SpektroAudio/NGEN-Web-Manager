<template>
    <div class="text-[11px] font-mono font-light text-white/60 bg-white/5 py-2 px-4 rounded-xl">
        REQUIRES NGEN FIRMWARE {{version}}+
    </div>
</template>

<script>
export default {
    props: {
        version: {
            type: Number, // You can change the type based on your needs
            required: true // Make it required if you want to enforce passing this prop
        }
    }
}
</script>