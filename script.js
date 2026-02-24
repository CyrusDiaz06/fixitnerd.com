// Fix It Nerd - Main JavaScript File
// Add your JavaScript functionality here

document.addEventListener('DOMContentLoaded', function() {
    // Initialize any dynamic functionality here
    console.log('Fix It Nerd website loaded');

    const toggle = document.querySelector('.mobile-nav-toggle');
    const overlay = document.querySelector('.mobile-nav-overlay');
    const panel = document.querySelector('.mobile-nav-panel');

    if (toggle && overlay && panel) {
        const setMenuState = (isOpen) => {
            document.body.classList.toggle('mobile-nav-open', isOpen);
            toggle.setAttribute('aria-expanded', String(isOpen));
            panel.setAttribute('aria-hidden', String(!isOpen));
            toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
        };

        setMenuState(false);

        toggle.addEventListener('click', () => {
            const isOpen = document.body.classList.contains('mobile-nav-open');
            setMenuState(!isOpen);
        });

        overlay.addEventListener('click', () => {
            setMenuState(false);
        });

        panel.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                setMenuState(false);
            });
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                setMenuState(false);
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                setMenuState(false);
            }
        });
    }
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Handle contact form submission
const contactForm = document.querySelector('form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        // Add form submission logic here
        alert('Thank you for your inquiry! We will get back to you soon.');
        this.reset();
    });
}
