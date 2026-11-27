(() => {
  let preference = null;
  try {
    preference = window.localStorage.getItem('aditya-portfolio-theme');
  } catch (error) {
    console.warn('Theme preference could not be loaded.', error);
  }

  if (preference === 'day' || preference === 'night') {
    document.documentElement.dataset.theme = preference;
    return;
  }

  const prefersNight = typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const hour = new Date().getHours();
  document.documentElement.dataset.theme = prefersNight || hour < 6 || hour >= 18 ? 'night' : 'day';
})();
