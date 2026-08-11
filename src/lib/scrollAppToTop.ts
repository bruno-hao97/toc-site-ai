/** Scroll window + app shell main to top after route change. */
export function scrollAppToTop(): void {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  document.querySelectorAll('.app-main, .marketing-page-main').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.scrollTop = 0;
    }
  });
}
