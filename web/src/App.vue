<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import ToastNotification from './components/ToastNotification.vue';

const toasts = ref([]);
const seenNotificationIds = new Set();
const toastTimers = new Map();
let eventSource;

function dismissToast(id) {
  clearTimeout(toastTimers.get(id));
  toastTimers.delete(id);
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

onMounted(() => {
  eventSource = new EventSource('/api/events/stream');
  eventSource.addEventListener('notification', (event) => {
    if (!event.lastEventId || seenNotificationIds.has(event.lastEventId)) return;

    try {
      const notification = JSON.parse(event.data);
      if (!['event_created', 'registration'].includes(notification.type) || typeof notification.message !== 'string') return;
      seenNotificationIds.add(event.lastEventId);
      const toast = { id: event.lastEventId, message: notification.message, type: notification.type };
      toasts.value.push(toast);
      toastTimers.set(toast.id, setTimeout(() => dismissToast(toast.id), 5000));
    } catch {
      // Ignore malformed notifications and keep the stream open.
    }
  });
});

onUnmounted(() => {
  eventSource?.close();
  for (const timer of toastTimers.values()) clearTimeout(timer);
  toastTimers.clear();
});
</script>

<template>
  <header class="site-header">
    <RouterLink to="/" class="brand">Campus Events</RouterLink>
    <nav>
      <RouterLink to="/">Events</RouterLink>
      <RouterLink to="/stats">Occupancy</RouterLink>
      <RouterLink to="/events/new" class="button button--small">New event</RouterLink>
    </nav>
  </header>
  <main class="page">
    <RouterView />
  </main>
  <div class="toast-stack" aria-live="polite" aria-relevant="additions">
    <ToastNotification
      v-for="toast in toasts"
      :key="toast.id"
      :message="toast.message"
      :type="toast.type"
      @dismiss="dismissToast(toast.id)"
    />
  </div>
</template>
