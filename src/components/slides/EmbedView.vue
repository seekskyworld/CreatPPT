<script setup lang="ts">
import { ref } from 'vue'
import type { EmbedSpec } from '@/domain/types'

const props = withDefaults(defineProps<{
  embed: EmbedSpec
  editable?: boolean
}>(), {
  editable: false,
})

const hasError = ref(false)

function handleError() {
  hasError.value = true
}
</script>

<template>
  <div class="embed-view-container">
    <iframe
      v-if="embed.url && !hasError"
      :src="embed.url"
      class="embed-iframe"
      :sandbox="typeof embed.sandbox === 'string' ? embed.sandbox : 'allow-scripts allow-same-origin'"
      loading="lazy"
      @error="handleError"
    ></iframe>
    <div v-else class="embed-fallback">
      <img v-if="embed.fallbackImage" :src="embed.fallbackImage" alt="Embedded content fallback" class="fallback-img" />
      <div v-else class="fallback-placeholder">
        <span class="fallback-icon">🔗</span>
        <a :href="embed.url" target="_blank" rel="noopener noreferrer" class="fallback-link">
          {{ embed.url || 'Embedded Web Resource' }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.embed-view-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background: var(--slide-surface, #f9f9f9);
}

.embed-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.embed-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fallback-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fallback-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  text-align: center;
}

.fallback-icon {
  font-size: 28px;
}

.fallback-link {
  color: var(--slide-accent, #0066ff);
  font-size: 13px;
  text-decoration: underline;
  word-break: break-all;
}
</style>
