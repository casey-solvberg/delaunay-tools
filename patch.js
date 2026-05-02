const fs = require('fs');

const cssReplacement = `.controls-bar { flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 20px; padding-top: 20px; position: relative;}
        
        .dropdown { position: relative; display: inline-block; }
        .dropdown-content { display: none; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background-color: #222; min-width: 180px; box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.5); z-index: 1; border-radius: 8px; border: 1px solid #444; margin-bottom: 15px; overflow: hidden; }
        .dropdown-content a { color: white; padding: 12px 16px; text-decoration: none; display: block; font-size: 0.9em; text-align: center; border-bottom: 1px solid #333;}
        .dropdown-content a:last-child { border-bottom: none; }
        .dropdown-content a:hover { background-color: #333; }
        .show { display: block; }

        .control-button { padding: 0; border-radius: 50%; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; }
        #uploadMenuBtn, #downloadSVGButton { width: 44px; height: 44px; background-color: #2a2a2a; border: 1px solid #444; color: #ccc; }
        #uploadMenuBtn:hover, #downloadSVGButton:hover:not(:disabled) { background-color: #444; color: #fff; }
        #downloadSVGButton:disabled { opacity: 0.3; cursor: not-allowed; }

        #processButton { width: 60px; height: 60px; background-color: #3b82f6; border: none; color: #fff; box-shadow: 0 0 15px rgba(59, 130, 246, 0.4); }
        #processButton:hover:not(:disabled) { background-color: #2563eb; transform: scale(1.05); }
        #processButton:active:not(:disabled) { transform: scale(0.95); }
        #processButton:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

        .control-group { display: flex; align-items: center; gap: 10px; background: #222; padding: 10px 15px; border-radius: 12px; border: 1px solid #444; }
        input[type="checkbox"]#colorTriangles { width: 18px; height: 18px; accent-color: #3b82f6; cursor: pointer; }
        label[for="colorTriangles"] { cursor: pointer; font-size: 0.95em; color: #ddd; user-select: none; }
        
        .slider-container { display: flex; flex-direction: column; align-items: center; gap: 5px; }
        .slider-container label { font-size: 0.85em; font-weight: bold; color: #aaa; }
        .slider-container span { font-size: 0.95em; color: #3b82f6; font-weight: bold; min-width: 40px; text-align: center; }
        input[type="range"] { width: 150px; cursor: pointer; accent-color: #3b82f6; }

        #status { display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 12px 24px; border-radius: 30px; font-weight: bold; z-index: 100; letter-spacing: 1px; pointer-events: none; }
        #imageFile { display: none; }`;

const files = ['index.html', 'decomposer.html', 'hue_shift.html'];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace the CSS block
    content = content.replace(/\.controls-bar \{[\s\S]*?#imageFile \{ display: none; \}/, cssReplacement);
    
    // Fix the broken JS
    content = content.replace(/viewToggle\.style\.display = 'flex';\n\s*btnDelaunay\.click\(\);/g, '');
    content = content.replace(/viewToggle\.style\.display = 'flex';\n\s*btnDecomposed\.click\(\);/g, '');
    content = content.replace(/viewToggle\.style\.display = 'flex';\n\s*btnMatrix\.click\(\);/g, '');
    content = content.replace(/viewToggle\.style\.display = 'none';/g, '');
    
    // Decomposer process button was hidden or missing logic
    // Ensure we don't have dangling btnDelaunay/btnDecomposed/btnMatrix references causing errors
    content = content.replace(/btnDelaunay\.click\(\);/g, '');
    content = content.replace(/btnDecomposed\.click\(\);/g, '');
    content = content.replace(/btnMatrix\.click\(\);/g, '');

    fs.writeFileSync(file, content);
    console.log('Patched ' + file);
}
