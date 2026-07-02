/**
 * Performance Testing Script for PisoWiFi Portal
 * Tests loading speed and performance on simulated slow devices
 */

const fs = require('fs');
const path = require('path');

// Performance test configuration
const testConfig = {
  // Network throttling settings (simulate slow connections)
  networkProfiles: {
    '2G': { download: 250000, upload: 50000, latency: 600 }, // 250kbps down, 50kbps up, 600ms latency
    '3G': { download: 750000, upload: 250000, latency: 200 }, // 750kbps down, 250kbps up, 200ms latency
    '4G': { download: 4000000, upload: 3000000, latency: 50 }, // 4Mbps down, 3Mbps up, 50ms latency
  },
  
  // Device profiles (simulate old devices)
  deviceProfiles: {
    'low-end': {
      userAgent: 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.76 Mobile Safari/537.36',
      memory: 1, // 1GB RAM
      cores: 2, // 2 CPU cores
      screen: { width: 360, height: 640 }
    },
    'mid-range': {
      userAgent: 'Mozilla/5.0 (Linux; Android 8.0; SM-G930F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Mobile Safari/537.36',
      memory: 3, // 3GB RAM
      cores: 4, // 4 CPU cores
      screen: { width: 1080, height: 1920 }
    }
  }
};

// Generate performance test HTML
const generatePerformanceTestHTML = () => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PisoWiFi Portal Performance Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .test-container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .metric { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .metric.good { background: #d4edda; border-left: 4px solid #28a745; }
        .metric.warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .metric.bad { background: #f8d7da; border-left: 4px solid #dc3545; }
        .test-controls { margin: 20px 0; }
        button { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        .results { margin-top: 20px; }
        .loading { display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="test-container">
        <h1>🚀 PisoWiFi Portal Performance Test</h1>
        <p>Test loading speed and performance on simulated slow devices</p>
        
        <div class="test-controls">
            <button class="btn-primary" onclick="runPerformanceTest()">Run Full Performance Test</button>
            <button class="btn-secondary" onclick="runQuickTest()">Quick Test</button>
            <button class="btn-secondary" onclick="runLoadTest()">Load Test</button>
        </div>

        <div id="testResults" class="results"></div>
        
        <div id="loadingIndicator" class="hidden">
            <div class="loading"></div>
            <p>Running performance tests...</p>
        </div>
    </div>

    <script>
        class PerformanceTester {
            constructor() {
                this.results = [];
                this.networkProfiles = ${JSON.stringify(testConfig.networkProfiles)};
                this.deviceProfiles = ${JSON.stringify(testConfig.deviceProfiles)};
            }

            async measureLoadingTime(url, networkProfile = null, deviceProfile = null) {
                const startTime = performance.now();
                
                try {
                    // Create iframe to test loading
                    const iframe = document.createElement('iframe');
                    iframe.style.width = '1px';
                    iframe.style.height = '1px';
                    iframe.style.position = 'absolute';
                    iframe.style.left = '-9999px';
                    
                    return new Promise((resolve) => {
                        iframe.onload = () => {
                            const loadTime = performance.now() - startTime;
                            document.body.removeChild(iframe);
                            resolve({
                                url,
                                loadTime,
                                networkProfile,
                                deviceProfile,
                                success: true
                            });
                        };
                        
                        iframe.onerror = () => {
                            document.body.removeChild(iframe);
                            resolve({
                                url,
                                loadTime: performance.now() - startTime,
                                networkProfile,
                                deviceProfile,
                                success: false
                            });
                        };
                        
                        document.body.appendChild(iframe);
                        iframe.src = url;
                    });
                } catch (error) {
                    return {
                        url,
                        loadTime: performance.now() - startTime,
                        networkProfile,
                        deviceProfile,
                        success: false,
                        error: error.message
                    };
                }
            }

            async testBundleSize() {
                const bundles = [
                    { name: 'Original Bundle', url: '/dist/bundle.js', expectedSize: 500000 }, // 500KB
                    { name: 'Optimized Bundle', url: '/dist/bundle-optimized.js', expectedSize: 150000 } // 150KB
                ];

                const results = [];
                
                for (const bundle of bundles) {
                    try {
                        const response = await fetch(bundle.url);
                        const blob = await response.blob();
                        const size = blob.size;
                        
                        results.push({
                            name: bundle.name,
                            size: size,
                            expectedSize: bundle.expectedSize,
                            compressionRatio: ((bundle.expectedSize - size) / bundle.expectedSize * 100).toFixed(1),
                            isOptimized: size < bundle.expectedSize
                        });
                    } catch (error) {
                        results.push({
                            name: bundle.name,
                            size: 0,
                            error: error.message,
                            isOptimized: false
                        });
                    }
                }
                
                return results;
            }

            async testCriticalRenderingPath() {
                const tests = [
                    { name: 'First Paint', measure: () => this.measureFirstPaint() },
                    { name: 'First Contentful Paint', measure: () => this.measureFirstContentfulPaint() },
                    { name: 'Largest Contentful Paint', measure: () => this.measureLargestContentfulPaint() },
                    { name: 'Time to Interactive', measure: () => this.measureTimeToInteractive() }
                ];

                const results = [];
                
                for (const test of tests) {
                    try {
                        const result = await test.measure();
                        results.push({
                            name: test.name,
                            value: result,
                            status: result < 1000 ? 'good' : result < 3000 ? 'warning' : 'bad'
                        });
                    } catch (error) {
                        results.push({
                            name: test.name,
                            error: error.message,
                            status: 'bad'
                        });
                    }
                }
                
                return results;
            }

            measureFirstPaint() {
                return new Promise((resolve) => {
                    if ('performance' in window && 'getEntriesByType' in performance) {
                        const paintEntries = performance.getEntriesByType('paint');
                        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
                        resolve(firstPaint ? firstPaint.startTime : null);
                    } else {
                        resolve(null);
                    }
                });
            }

            measureFirstContentfulPaint() {
                return new Promise((resolve) => {
                    if ('performance' in window && 'getEntriesByType' in performance) {
                        const paintEntries = performance.getEntriesByType('paint');
                        const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
                        resolve(fcp ? fcp.startTime : null);
                    } else {
                        resolve(null);
                    }
                });
            }

            measureLargestContentfulPaint() {
                return new Promise((resolve) => {
                    if ('PerformanceObserver' in window) {
                        const observer = new PerformanceObserver((list) => {
                            const entries = list.getEntries();
                            const lastEntry = entries[entries.length - 1];
                            resolve(lastEntry.startTime);
                            observer.disconnect();
                        });
                        observer.observe({ entryTypes: ['largest-contentful-paint'] });
                        
                        // Timeout after 10 seconds
                        setTimeout(() => {
                            observer.disconnect();
                            resolve(null);
                        }, 10000);
                    } else {
                        resolve(null);
                    }
                });
            }

            measureTimeToInteractive() {
                return new Promise((resolve) => {
                    // Simple TTI measurement - when page becomes interactive
                    setTimeout(() => {
                        resolve(performance.now());
                    }, 100);
                });
            }
        }

        // Global functions for button clicks
        window.runPerformanceTest = async function() {
            const tester = new PerformanceTester();
            const resultsDiv = document.getElementById('testResults');
            const loadingDiv = document.getElementById('loadingIndicator');
            
            loadingDiv.classList.remove('hidden');
            resultsDiv.innerHTML = '';
            
            try {
                // Test bundle sizes
                const bundleResults = await tester.testBundleSize();
                displayResults('Bundle Size Test', bundleResults, 'size');
                
                // Test critical rendering path
                const crpResults = await tester.testCriticalRenderingPath();
                displayResults('Critical Rendering Path', crpResults, 'time');
                
                // Test loading times
                const loadingResults = [];
                for (const [network, profile] of Object.entries(tester.networkProfiles)) {
                    const result = await tester.measureLoadingTime('/index-optimized.html', network);
                    loadingResults.push(result);
                }
                displayResults('Loading Time Test', loadingResults, 'loading');
                
            } catch (error) {
                resultsDiv.innerHTML = \`<div class="metric bad">Error: \${error.message}</div>\`;
            } finally {
                loadingDiv.classList.add('hidden');
            }
        };

        window.runQuickTest = async function() {
            const tester = new PerformanceTester();
            const resultsDiv = document.getElementById('testResults');
            
            resultsDiv.innerHTML = '<div class="loading"></div><p>Running quick test...</p>';
            
            try {
                const bundleResults = await tester.testBundleSize();
                displayResults('Quick Bundle Test', bundleResults, 'size');
            } catch (error) {
                resultsDiv.innerHTML = \`<div class="metric bad">Error: \${error.message}</div>\`;
            }
        };

        window.runLoadTest = async function() {
            const resultsDiv = document.getElementById('testResults');
            resultsDiv.innerHTML = '<div class="loading"></div><p>Running load test...</p>';
            
            // Simulate multiple concurrent loads
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(fetch('/index-optimized.html').then(r => r.text()));
            }
            
            try {
                const startTime = performance.now();
                await Promise.all(promises);
                const loadTime = performance.now() - startTime;
                
                resultsDiv.innerHTML = \`
                    <div class="metric \${loadTime < 1000 ? 'good' : 'warning'}">
                        <h3>Load Test Results</h3>
                        <p>10 concurrent requests completed in <strong>\${loadTime.toFixed(2)}ms</strong></p>
                        <p>Average response time: <strong>\${(loadTime / 10).toFixed(2)}ms</strong></p>
                        <p>Status: \${loadTime < 1000 ? '✅ Excellent' : loadTime < 3000 ? '⚠️ Good' : '❌ Needs improvement'}</p>
                    </div>
                \`;
            } catch (error) {
                resultsDiv.innerHTML = \`<div class="metric bad">Load test failed: \${error.message}</div>\`;
            }
        };

        function displayResults(title, results, type) {
            const resultsDiv = document.getElementById('testResults');
            let html = \`<h2>\${title}</h2>\`;
            
            results.forEach(result => {
                if (type === 'size') {
                    html += \`
                        <div class="metric \${result.isOptimized ? 'good' : 'bad'}">
                            <strong>\${result.name}</strong><br>
                            Size: \${(result.size / 1024).toFixed(1)}KB\n                            \${result.compressionRatio ? \` (\${result.compressionRatio}% smaller than expected)\` : ''}\n                            \${result.error ? \`<br><small style="color: red;">\${result.error}</small>\` : ''}
                        </div>
                    \`;
                } else if (type === 'time') {
                    html += \`
                        <div class="metric \${result.status}">
                            <strong>\${result.name}</strong><br>
                            \${result.value ? \`Time: \${result.value.toFixed(1)}ms\` : 'Not available'}\n                            \${result.error ? \`<br><small style="color: red;">\${result.error}</small>\` : ''}
                        </div>
                    \`;
                } else if (type === 'loading') {
                    html += \`
                        <div class="metric \${result.success ? (result.loadTime < 3000 ? 'good' : 'warning') : 'bad'}">
                            <strong>\${result.networkProfile || 'Default Network'}</strong><br>
                            Load time: \${result.loadTime.toFixed(1)}ms\n                            \${result.success ? '✅ Success' : '❌ Failed'}\n                            \${result.error ? \`<br><small style="color: red;">\${result.error}</small>\` : ''}
                        </div>
                    \`;
                }
            });
            
            resultsDiv.innerHTML += html;
        }
    </script>
</body>
</html>
  `;
};

// Create performance test file
const performanceTestHTML = generatePerformanceTestHTML();
fs.writeFileSync('performance-test.html', performanceTestHTML);

console.log('🚀 Performance test file created: performance-test.html');
console.log('📊 Open this file in your browser to test the optimizations');
console.log('⚡ Test different network conditions using browser dev tools');

// Create a simple performance monitoring script
const monitoringScript = `
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
`;

fs.writeFileSync('lib/performance-monitor.js', monitoringScript);

console.log('📈 Performance monitoring script created: lib/performance-monitor.js');
console.log('🔍 Add this script to your HTML to monitor real-world performance');