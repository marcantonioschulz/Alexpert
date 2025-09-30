import './simple-style.css'
import { initializeAlexCoach } from './alex-coach-realtime.ts'

// Initialize Alex Coach when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeAlexCoach();
});

// Initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
  // DOM is still loading
} else {
  // DOM is ready
  initializeAlexCoach();
}
