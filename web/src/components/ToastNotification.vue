<script setup>
defineProps({
  message: { type: String, required: true },
  type: { type: String, default: 'info' }
});

defineEmits(['dismiss']);
</script>

<template>
  <section class="toast" :class="`toast--${type}`" role="status">
    <p>{{ message }}</p>
    <button type="button" aria-label="Dismiss notification" @click="$emit('dismiss')">×</button>
  </section>
</template>
