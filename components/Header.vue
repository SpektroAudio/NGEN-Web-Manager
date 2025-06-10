<template>
    <div class="flex space-x-4 items-center">
        <div>
          <a href="http://spektroaudio.com/ngen" target="_blank">
          <img src="/img/NGENLogo.png" class="transition duration-150 ease-in-out w-[128px] hover:scale-110 opacity-30 hover:opacity-80">
          </a>
        </div>
        <div class="flex flex-col items-start justify-right">
          <div class="text-3xl"> NGEN Web Manager <span class="text-xs text-white/60">v{{ version }}</span></div>
          <div class="font-light font-mono text-white/30 text-center space-y-4"> 
            Web File Manager for  NGEN<br>
          </div>
        </div>

        
      </div>
</template>

<script>
export default {
    props: {
        version: {
            type: Number, // You can change the type based on your needs
            required: true // Make it required if you want to enforce passing this prop
        },
        ngen_logo: {
          type: String,
          required: true
        }
    }
}
</script>