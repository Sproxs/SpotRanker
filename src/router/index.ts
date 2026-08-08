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
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/editor/:playlistId',
      name: 'editor',
      component: () => import('@/views/EditorView.vue'),
      props: true,
      meta: { requiresAuth: true }
    }
  ]
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('sp_access_token');
    const refreshToken = localStorage.getItem('sp_refresh_token');
    const expiresAt = Number(localStorage.getItem('sp_expires_at')) || 0;
    // An expired access token is fine as long as a refresh token exists –
    // the API layer refreshes silently on the first request.
    const hasValidSession = !!token && (Date.now() < expiresAt || !!refreshToken);
    if (!hasValidSession) {
      return { name: 'home' };
    }
  }
});

export default router;
