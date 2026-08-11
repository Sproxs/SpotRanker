import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue')
    },
    {
      // Public: scraped playlists open here without a login.
      path: '/editor/:playlistId',
      name: 'editor',
      component: () => import('@/views/EditorView.vue'),
      props: true
    }
  ]
});

export default router;
