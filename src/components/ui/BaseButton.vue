<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
  }>(),
  {
    variant: 'primary',
    type: 'button',
    disabled: false
  }
);
</script>

<template>
  <button
    :type="props.type"
    :disabled="props.disabled"
    class="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spotify-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    :class="[
      props.variant === 'primary'
        ? 'bg-spotify-500 text-zinc-950 hover:bg-spotify-400 disabled:bg-zinc-700 disabled:text-zinc-300'
        : 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:text-white disabled:border-zinc-800 disabled:text-zinc-500'
    ]"
  >
    <slot />
  </button>
</template>
