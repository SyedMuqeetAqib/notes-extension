const fs = require("fs");
const path = require("path");

function extractInlineScripts() {
  const outDir = path.join(__dirname, "out");
  const scriptsDir = path.join(outDir, "scripts");

  // Create scripts directory if it doesn't exist
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }

  // Process all HTML files
  const htmlFiles = fs
    .readdirSync(outDir)
    .filter((file) => file.endsWith(".html"));

  htmlFiles.forEach((htmlFile) => {
    const htmlPath = path.join(outDir, htmlFile);
    let htmlContent = fs.readFileSync(htmlPath, "utf8");

    let scriptCount = 0;
    let modified = false;

    // First, handle empty script tags by removing them
    htmlContent = htmlContent.replace(/<script>\s*<\/script>/g, "");

    // Use a more aggressive approach to find all script tags
    const scriptMatches = [];
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let match;

    // Collect all matches first
    while ((match = scriptRegex.exec(htmlContent)) !== null) {
      scriptMatches.push({
        full: match[0],
        content: match[1].trim(),
        index: match.index,
      });
    }

    // Process matches in reverse order to avoid index issues
    scriptMatches.reverse().forEach((scriptMatch, index) => {
      const { full, content } = scriptMatch;

      // Skip if it's already an external script reference
      if (full.includes("src=")) {
        return;
      }

      if (content) {
        scriptCount++;
        // Create external script file
        const scriptFileName = `inline-script-${scriptCount}.js`;
        const scriptFilePath = path.join(scriptsDir, scriptFileName);

        fs.writeFileSync(scriptFilePath, content);

        // Replace inline script with external reference
        const replacement = `<script src="./scripts/${scriptFileName}"></script>`;
        htmlContent = htmlContent.replace(full, replacement);
        modified = true;
      }
    });

    // Write updated HTML content
    if (modified) {
      fs.writeFileSync(htmlPath, htmlContent);
      console.log(`Extracted ${scriptCount} inline scripts from ${htmlFile}`);
    }
  });

  console.log("Inline script extraction completed!");
}

extractInlineScripts();
