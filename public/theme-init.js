(function() {
  try {
    const theme = localStorage.getItem('tabula-theme') || 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {
    // Fallback to dark if localStorage fails
    document.documentElement.classList.add('dark');
  }
})();

