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
    const expiresAt = Number(localStorage.getItem('sp_expires_at')) || 0;
    if (!token || Date.now() >= expiresAt) {
      return { name: 'home' };
    }
  }
});

export default router;
