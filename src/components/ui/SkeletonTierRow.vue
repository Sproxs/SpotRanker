<template>
  <div class="grid min-h-20 animate-pulse grid-cols-[4rem_1fr] items-stretch overflow-hidden rounded-xl border border-zinc-700/40 bg-zinc-900/70">
    <div class="bg-zinc-700" />
    <div class="flex flex-wrap items-start gap-2 p-2">
      <div v-for="n in 4" :key="n" class="h-[6.5rem] w-20 rounded-lg bg-zinc-800" />
    </div>
  </div>
</template>
