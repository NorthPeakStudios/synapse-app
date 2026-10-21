/* /me/: when the Synapse trial has ended and nothing is unlocked, the main app owns the paywall, so go there. */
try { if (localStorage.getItem('pro.locked') === '1') location.replace('/'); } catch (e) {}
