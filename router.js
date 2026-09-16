import { renderCategoryView } from './categoryController.js';
import { renderPlaceView } from './placeController.js';

export function initRouter() {
  const landingView = document.getElementById('landing-view');
  const appView = document.getElementById('app-view');
  const categoryView = document.getElementById('category-view');

  const handleRoute = () => {
    const hash = window.location.hash;

    // Default route
    if (!hash || hash === '#' || hash === '#home' || hash.startsWith('#features') || hash.startsWith('#about') || hash.startsWith('#testimonials') || hash.startsWith('#faq') || hash.startsWith('#contact')) {
      // It's the landing page (including its anchor links)
      landingView.classList.remove('hidden');
      appView.classList.add('hidden');
      categoryView.classList.add('hidden');
      if (document.getElementById('place-view')) document.getElementById('place-view').classList.add('hidden');
      
      // If it's a specific anchor and we just loaded, the browser will likely scroll naturally.
    } 
    // App Route (previously used for pure map exploring)
    else if (hash === '#explore') {
      landingView.classList.add('hidden');
      appView.classList.remove('hidden');
      categoryView.classList.add('hidden');
      if (document.getElementById('place-view')) document.getElementById('place-view').classList.add('hidden');
      
      // Force Map Resize
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    }
    // Category Route (e.g. #category/nature)
    else if (hash.startsWith('#category/')) {
      const categoryName = hash.split('/')[1];
      
      landingView.classList.add('hidden');
      appView.classList.add('hidden');
      if (document.getElementById('place-view')) document.getElementById('place-view').classList.add('hidden');
      categoryView.classList.remove('hidden');
      
      renderCategoryView(categoryName);
      window.scrollTo(0, 0); // Reset scroll position
    }
    // Place Details Route (e.g. #place/n1)
    else if (hash.startsWith('#place/')) {
      const placeId = hash.split('/')[1];
      
      landingView.classList.add('hidden');
      appView.classList.add('hidden');
      categoryView.classList.add('hidden');
      
      const placeView = document.getElementById('place-view');
      if (placeView) {
        placeView.classList.remove('hidden');
        renderPlaceView(placeId);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  window.addEventListener('hashchange', handleRoute);
  
  // Call once on load to handle initial URL
  handleRoute();
}
