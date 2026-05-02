const puppeteer = require('puppeteer');
const fs = require('fs');

async function captureScreenshots() {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Mobile Viewport (iPhone 12 Pro)
    const viewport = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
    
    const pages = [
        { name: 'app1_generator.png', url: 'https://scandalous-art-investigations.github.io/delaunay-tools/index.html' },
        { name: 'app2_decomposer.png', url: 'https://scandalous-art-investigations.github.io/delaunay-tools/decomposer.html' },
        { name: 'app3_hueshift.png', url: 'https://scandalous-art-investigations.github.io/delaunay-tools/hue_shift.html' }
    ];

    for (let p of pages) {
        console.log(`Navigating to ${p.url}...`);
        const page = await browser.newPage();
        await page.setViewport(viewport);
        await page.goto(p.url, { waitUntil: 'networkidle0' });
        
        // Wait for processing to finish (status should be hidden)
        try {
            await page.waitForFunction(() => {
                const status = document.getElementById('status');
                return status && (status.style.display === 'none' || status.style.display === '');
            }, { timeout: 15000 });
        } catch (e) {
            console.log("Status wait timeout, but proceeding.");
        }
        
        // Add a small delay to ensure canvas rendering is complete
        await new Promise(r => setTimeout(r, 2000));
        
        const path = '/Users/J.A.R.V.I.S./.openclaw/workspace/drafts/delaunay/' + p.name;
        await page.screenshot({ path: path });
        console.log(`Saved screenshot: ${path}`);
        await page.close();
    }
    
    await browser.close();
    console.log("Done.");
}

captureScreenshots().catch(console.error);