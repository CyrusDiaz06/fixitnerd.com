// Fix It Nerd - Main JavaScript File
// Add your JavaScript functionality here

document.addEventListener('DOMContentLoaded', function() {
    // Initialize any dynamic functionality here
    console.log('Fix It Nerd website loaded');
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