
// Performance monitoring for PisoWiFi Portal
(function() {
  // Monitor Core Web Vitals
  function monitorWebVitals() {
    // First Contentful Paint
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        console.log('FCP:', entry.startTime);
        sendMetric('FCP', entry.startTime);
      }
    }).observe({ entryTypes: ['paint'] });

    // Largest Contentful Paint
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        console.log('LCP:', entry.startTime);
        sendMetric('LCP', entry.startTime);
      }
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        console.log('FID:', entry.processingStart - entry.startTime);
        sendMetric('FID', entry.processingStart - entry.startTime);
      }
    }).observe({ entryTypes: ['first-input'] });
  }

  // Send metrics to server (optional)
  function sendMetric(name, value) {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/performance', JSON.stringify({
        name,
        value,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        connection: navigator.connection?.effectiveType
      }));
    }
  }

  // Monitor bundle loading
  function monitorBundleLoading() {
    const startTime = performance.now();
    
    window.addEventListener('load', () => {
      const loadTime = performance.now() - startTime;
      console.log('Total load time:', loadTime);
      sendMetric('TotalLoadTime', loadTime);
      
      // Check if bundle loaded successfully
      if (window.React && window.ReactDOM) {
        console.log('✅ Bundle loaded successfully');
      } else {
        console.log('❌ Bundle loading failed');
      }
    });
  }

  // Initialize monitoring
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      monitorWebVitals();
      monitorBundleLoading();
    });
  } else {
    monitorWebVitals();
    monitorBundleLoading();
  }
})();
