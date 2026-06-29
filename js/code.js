/* ============================================================
   WEVLO ADS LOADER (code.js)
   ------------------------------------------------------------
   সব পেজে এক জায়গা থেকে Ad load হবে — শুধু একটা
   <script src="js/code.js"></script> (অথবা pages/ এর ভেতর
   "../js/code.js") যোগ করলেই হবে, আলাদা করে কোনো HTML ফাইলে
   ad script বসানোর দরকার নেই।

   এখানে ৩ ধরনের Ad আছে:
   1) Social Bar          — body-তে একবার লোড হয়, network নিজেই
                             নিজের UI বসায়।
   2) Bottom Anchor Banner — 320x50, fixed bottom-center, mobile
                             bottom-nav-এর উপরে বসে (overlap করে
                             না), ছোট close (×) বাটন আছে।
   3) Native Banner        — পেজের আসল content-এর ভেতরে natural
                             জায়গায় বসে (card-এর মতো দেখতে),
                             কোনো full-screen tool পেজ (যেমন
                             preview.html) এ স্কিপ হয়ে যায়, যাতে
                             ভেঙে/হাইড হয়ে নষ্ট না হয়।
   ============================================================ */
(function () {
  'use strict';

  // একই পেজে দুইবার রান হওয়া আটকানো (double-include সেফটি)
  if (window.__wevloAdsLoaded) return;
  window.__wevloAdsLoaded = true;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function loadScript(src, attrs) {
    var s = document.createElement('script');
    s.src = src;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    }
    document.body.appendChild(s);
    return s;
  }

  /* ---------------- 1) Social Bar ---------------- */
  function loadSocialBar() {
    loadScript('https://pl29567715.effectivecpmnetwork.com/30/96/76/309676920e5be58d06f80dadc15e7ecb.js');
  }

  /* ---------------- 2) Bottom Anchor Banner (320x50) ---------------- */
  function loadBottomBanner() {
    // ইউজার আগে close করে থাকলে এই সেশনে আর দেখাবে না
    if (sessionStorage.getItem('wevloAdBannerClosed') === '1') return;

    var wrap = document.createElement('div');
    wrap.id = 'wevlo-ad-banner-wrap';

    var closeBtn = document.createElement('button');
    closeBtn.id = 'wevlo-ad-banner-close';
    closeBtn.setAttribute('aria-label', 'Close ad');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function () {
      wrap.style.display = 'none';
      sessionStorage.setItem('wevloAdBannerClosed', '1');
    };

    var slot = document.createElement('div');
    slot.id = 'wevlo-ad-banner-slot';

    wrap.appendChild(closeBtn);
    wrap.appendChild(slot);
    document.body.appendChild(wrap);

    window.atOptions = {
      key: '27b004e92550367b8253690a3014399a',
      format: 'iframe',
      height: 50,
      width: 320,
      params: {}
    };
    var bannerScript = document.createElement('script');
    bannerScript.src = 'https://www.highperformanceformat.com/27b004e92550367b8253690a3014399a/invoke.js';
    slot.appendChild(bannerScript);
  }

  /* ---------------- 3) Native Banner ---------------- */
  function loadNativeBanner() {
    // Full-screen tool পেজ (যেমন preview.html) এ native ad বসানো
    // হয় না — সেখানে fixed iframe-এর নিচে চাপা পড়ে invisible
    // হয়ে যেত, তাই এই flag দিয়ে স্কিপ করা হচ্ছে
    if (document.body.hasAttribute('data-skip-native-ad')) return;

    var host = document.querySelector('.main-content')
      || document.querySelector('main')
      || document.body;

    var wrap = document.createElement('div');
    wrap.className = 'wevlo-native-ad-wrap';

    var label = document.createElement('div');
    label.className = 'wevlo-native-ad-label';
    label.textContent = 'বিজ্ঞাপন';

    var slot = document.createElement('div');
    slot.id = 'container-e91c3488e3662ee84a2beb29ee8fa896';

    wrap.appendChild(label);
    wrap.appendChild(slot);
    host.appendChild(wrap);

    var nativeScript = document.createElement('script');
    nativeScript.async = true;
    nativeScript.setAttribute('data-cfasync', 'false');
    nativeScript.src = 'https://pl29809712.effectivecpmnetwork.com/e91c3488e3662ee84a2beb29ee8fa896/invoke.js';
    document.body.appendChild(nativeScript);
  }

  ready(function () {
    loadSocialBar();
    loadBottomBanner();
    loadNativeBanner();
  });
})();
