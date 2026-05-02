const fs = require('fs');

function fixFile(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Convert back to async/await instead of nested setTimeout
    // and fix the display toggle
    content = content.replace(/setTimeout\(\(\) => \{([\s\S]*?)        \}, 100\);\n    \}/g, (match, body) => {
        return `await new Promise(r => setTimeout(r, 50));\n` + body + `    }`;
    });
    
    // Ensure the function is marked async
    content = content.replace(/function processImage\(\) {/g, 'async function processImage() {');
    content = content.replace(/function generateGridAndProcess\(\) {/g, 'async function generateGridAndProcess() {');
    
    fs.writeFileSync(file, content);
    console.log('Fixed async/await in ' + file);
}

['index.html', 'decomposer.html', 'hue_shift.html'].forEach(fixFile);
