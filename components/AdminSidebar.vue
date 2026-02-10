<template>
  <div class="admin-sidebar">
    <div class="sidebar-header">
      <h2>🎨 Admin</h2>
    </div>

    <nav class="sidebar-nav">
      <NuxtLink to="/admin" class="nav-item" exact-active-class="active">
        <span class="nav-icon">📊</span>
        <span class="nav-label">Dashboard</span>
      </NuxtLink>

      <NuxtLink to="/admin/models" class="nav-item" active-class="active">
        <span class="nav-icon">🖼️</span>
        <span class="nav-label">Models</span>
      </NuxtLink>

      <div class="nav-divider"></div>

      <NuxtLink to="/" class="nav-item">
        <span class="nav-icon">🏠</span>
        <span class="nav-label">Back to Site</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.admin-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 250px;
  height: 100vh;
  background: var(--theme-card-bg, rgba(0, 0, 0, 0.3));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid var(--theme-card-border, rgba(255, 255, 255, 0.2));
  padding: 2rem 0;
  z-index: 100;
}

.sidebar-header {
  padding: 0 1.5rem;
  margin-bottom: 2rem;
}

.sidebar-header h2 {
  color: var(--theme-text, #333);
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  color: var(--theme-text-muted, #666);
  text-decoration: none;
  transition: all var(--theme-transition, 0.3s ease);
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: rgba(128, 128, 128, 0.1);
  color: var(--theme-text, #333);
}

.nav-item.active {
  background: rgba(128, 128, 128, 0.15);
  color: var(--theme-text, #333);
  border-left-color: var(--theme-accent, #667eea);
}

.nav-icon {
  font-size: 1.25rem;
}

.nav-label {
  font-size: 1rem;
  font-weight: 500;
}

.nav-divider {
  height: 1px;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.1));
  margin: 1rem 1.5rem;
}

@media (max-width: 768px) {
  .admin-sidebar {
    display: none;
  }
}
</style>
