const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../src');

function getFiles(dir, ext = ['.tsx', '.ts', '.js']) {
    let results = [];
    try {
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                if (file !== 'locales' && file !== 'node_modules') {
                    results = results.concat(getFiles(fullPath, ext));
                }
            } else {
                if (ext.includes(path.extname(fullPath))) {
                    results.push(fullPath);
                }
            }
        });
    } catch (e) { }
    return results;
}

function findChinese() {
    console.log('--- Finding Hardcoded Chinese Strings ---');
    const files = getFiles(srcPath);
    const chineseRegex = /[\u4e00-\u9fa5]/;
    let count = 0;

    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        let fileHasChinese = false;

        lines.forEach((line, index) => {
            // Ignore comments
            const cleanLine = line.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//, '');
            if (chineseRegex.test(cleanLine)) {
                if (!fileHasChinese) {
                    console.log(`\n📄 File: ${path.relative(path.join(__dirname, '..'), file)}`);
                    fileHasChinese = true;
                }
                console.log(`  Line ${index + 1}: ${line.trim()}`);
                count++;
            }
        });
    });

    console.log(`\nFound ${count} lines with potential hardcoded Chinese.`);
}

findChinese();
