// Shared site JS for subpages (index.html has its own copy of these inline).
// Signups post to the Cloudflare Pages Function at /functions/api/subscribe.js,
// which adds the email to your Resend Audience (needs RESEND_API_KEY and
// RESEND_AUDIENCE_ID set in the Cloudflare Pages dashboard).

function toggleMenu() {
  var open = document.getElementById('mobileMenu').classList.toggle('open');
  var burger = document.querySelector('.hamburger');
  if (burger) burger.setAttribute('aria-expanded', open);
}

function closeMenu() {
  document.getElementById('mobileMenu').classList.remove('open');
  var burger = document.querySelector('.hamburger');
  if (burger) burger.setAttribute('aria-expanded', 'false');
}

var SIGNUP_ENDPOINT = "/api/subscribe";

function handleSignup(btn) {
  var input = btn.parentElement.querySelector('input[type=email]');
  var email = (input.value || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    input.style.borderColor = 'var(--red2)';
    input.focus();
    return;
  }
  input.style.borderColor = 'var(--bdr)';
  btn.disabled = true;
  btn.textContent = '...';
  fetch(SIGNUP_ENDPOINT, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email })
  }).then(function(r){
    if (!r.ok) throw new Error('bad response');
    btn.textContent = "You're in!";
    input.value = '';
  }).catch(function(){
    btn.textContent = 'Try again';
    btn.disabled = false;
  });
}
