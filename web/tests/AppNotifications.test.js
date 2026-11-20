import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import App from '../src/App.vue';

describe('App realtime notifications', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses one EventSource, shows each notification once, and closes it on unmount', async () => {
    const sources = [];
    class MockEventSource {
      constructor(url) {
        this.url = url;
        this.listeners = {};
        sources.push(this);
      }
      addEventListener(name, callback) { this.listeners[name] = callback; }
      close() { this.closed = true; }
      send(id, data) { this.listeners.notification({ lastEventId: id, data: JSON.stringify(data) }); }
    }
    vi.stubGlobal('EventSource', MockEventSource);

    const wrapper = mount(App, { global: { stubs: { RouterLink: true, RouterView: true } } });
    expect(sources).toHaveLength(1);
    expect(sources[0].url).toBe('/api/events/stream');

    sources[0].send('7', { type: 'registration', message: 'Someone registered for Workshop' });
    sources[0].send('7', { type: 'registration', message: 'Someone registered for Workshop' });
    await nextTick();
    expect(wrapper.findAll('.toast')).toHaveLength(1);
    expect(wrapper.text()).toContain('Someone registered for Workshop');

    wrapper.unmount();
    expect(sources[0].closed).toBe(true);
  });
});
