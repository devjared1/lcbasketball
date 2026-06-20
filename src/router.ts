import { createRouter, createWebHashHistory } from 'vue-router'
import PlaysView from '@/views/PlaysView.vue'
import StatsView from '@/views/StatsView.vue'
import PlayEditorView from '@/views/PlayEditorView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/plays' },
    { path: '/plays', name: 'plays', component: PlaysView },
    { path: '/plays/new', name: 'play-new', component: PlayEditorView },
    { path: '/plays/:id', name: 'play-edit', component: PlayEditorView },
    { path: '/stats', name: 'stats', component: StatsView },
  ],
})
