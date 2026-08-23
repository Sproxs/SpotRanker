import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import { installDevConsole } from './services/devConsole';
import './assets/main.css';

// Before mount, so errors thrown during app creation are captured too.
installDevConsole();

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount('#app');
