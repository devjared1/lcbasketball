import { createRouter, createWebHistory } from 'vue-router'
import PlaysView from '@/views/PlaysView.vue'
import StatsView from '@/views/StatsView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/plays' },
    { path: '/plays', name: 'plays', component: PlaysView },
    { path: '/stats', name: 'stats', component: StatsView },
  ],
})
