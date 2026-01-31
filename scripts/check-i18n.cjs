const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, '../src/locales');
const srcPath = path.join(__dirname, '../src');

// Flatten nested JSON object to dotted keys
function flatten(obj, prefix = '') {
    let result = {};
    for (const key in obj) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            Object.assign(result, flatten(value, newKey));
        } else {
            result[newKey] = value;
        }
    }
    return result;
}

// Get all files in a directory recursively
function getFiles(dir, ext = ['.tsx', '.ts']) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(file, ext));
        } else {
            if (ext.includes(path.extname(file))) {
                results.push(file);
            }
        }
    });
    return results;
}

function checkI18n() {
    console.log('--- i18n Translation Quality Check ---');

    const zhPath = path.join(localesPath, 'zh/translation.json');
    const enPath = path.join(localesPath, 'en/translation.json');

    if (!fs.existsSync(zhPath) || !fs.existsSync(enPath)) {
        console.error('Translation files not found!');
        return;
    }

    const zh = flatten(JSON.parse(fs.readFileSync(zhPath, 'utf8')));
    const en = flatten(JSON.parse(fs.readFileSync(enPath, 'utf8')));

    const files = getFiles(srcPath);
    const foundKeys = new Set();
    const missingInCode = [];

    // Regex to match t('key') or t("key") or t(`key`)
    // Supports i18n.t, t(
    const tRegex = /[^\w]t\(\s*['"`]([^'"`]+)['"`]/g;

    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        let match;
        while ((match = tRegex.exec(content)) !== null) {
            const key = match[1];
            // Skip keys with template variables for now if they aren't literal enough
            if (key.includes('${')) continue;
            foundKeys.add(key);

            if (!zh[key] || !en[key]) {
                missingInCode.push({
                    key,
                    file: path.relative(path.join(__dirname, '..'), file),
                    zh: !!zh[key],
                    en: !!en[key]
                });
            }
        }
    });

    console.log(`\nChecked ${files.length} files.`);
    console.log(`Found ${foundKeys.size} unique translation keys.\n`);

    if (missingInCode.length === 0) {
        console.log('✅ All keys found in code have translations in both ZH and EN!');
    } else {
        console.log('❌ Missing Translations:');
        const table = missingInCode.reduce((acc, item) => {
            const status = (!item.zh ? '[Missing ZH]' : '') + (!item.en ? ' [Missing EN]' : '');
            acc[item.key] = acc[item.key] || { status, files: new Set() };
            acc[item.key].files.add(item.file);
            return acc;
        }, {});

        Object.keys(table).forEach(key => {
            console.log(`- ${key} ${table[key].status}`);
            console.log(`  Used in: ${Array.from(table[key].files).join(', ')}`);
        });
    }

    // Check for unused keys (Optional but helpful)
    const unusedZh = Object.keys(zh).filter(key => !foundKeys.has(key));
    if (unusedZh.length > 0) {
        console.log(`\n⚠️  Unused keys in translation files (${unusedZh.length}):`);
        // Uncomment to see list
        // unusedZh.forEach(k => console.log(`  - ${k}`));
    }
}

checkI18n();
