/**
 * Landing Page Module
 */
import { showToast } from './ui.js';

export function initLanding() {
  const landingView = document.getElementById('landing-view');
  const appView = document.getElementById('app-view');
  
  if (!landingView || !appView) return;

  // Navigation from Landing to App
  const launchBtns = [
    document.getElementById('nav-launch-btn'),
    document.getElementById('hero-launch-btn')
  ];

  launchBtns.forEach(btn => {
    if(btn) {
      btn.addEventListener('click', () => {
        window.location.hash = '#explore';
      });
    }
  });

  // Navigation from App back to Landing
  const backBtn = document.getElementById('app-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.hash = '#';
    });
  }

  // FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question');
    btn.addEventListener('click', () => {
      // close others
      faqItems.forEach(i => {
        if(i !== item) i.classList.remove('active');
      });
      // toggle current
      item.classList.toggle('active');
    });
  });

  // Contact Form Submission (Mock)
  const contactForm = document.getElementById('landing-contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const btn = contactForm.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.textContent = "Sending...";
      btn.disabled = true;

      // simulate network request
      setTimeout(() => {
        showToast("Message sent! We'll get back to you soon.", "success");
        contactForm.reset();
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
    });
  }
}
