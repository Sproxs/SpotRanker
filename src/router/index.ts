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
      path: '/callback',
      name: 'callback',
      component: () => import('@/views/CallbackView.vue')
    },
    {
      // Public: the dashboard works without a login via the scraper. Signed-in
      // users additionally see their own Spotify playlists ("Meine Playlists").
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
