export const loadJoinScreen = () => import('../pages/JoinScreen.jsx')
export const loadRoundsPage = () => import('../pages/QueuePage.jsx')
export const loadPastRoundPage = () => import('../pages/PastRoundPage.jsx')
export const loadPlayerListPage = () => import('../pages/PlayerListPage.jsx')
export const loadPlayerPage = () => import('../pages/PlayerPage.jsx')
export const loadPastSongsPage = () => import('../pages/PastSongsPage.jsx')
export const loadAdminPage = () => import('../pages/SettingsPage.jsx')
export const loadHowToPlayPage = () => import('../pages/HowToPlayPage.jsx')

const loadersByPath = {
  '/how-to-play': loadHowToPlayPage,
  '/rounds': loadRoundsPage,
  '/players': loadPlayerListPage,
  '/songs': loadPastSongsPage,
  '/admin': loadAdminPage,
}

export function preloadRoute(path) {
  loadersByPath[path]?.().catch(() => {})
}

export function preloadPlayerPage() {
  loadPlayerPage().catch(() => {})
}

export function preloadPastRoundPage() {
  loadPastRoundPage().catch(() => {})
}
