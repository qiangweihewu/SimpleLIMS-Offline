import png2icons from 'png2icons';
import fs from 'fs';

const input = fs.readFileSync('public/logo_real.png');

// Create ICO
const ico = png2icons.createICO(input, png2icons.BICUBIC, 0, false);
if (ico) {
    fs.writeFileSync('public/icon.ico', ico);
    console.log('Created icon.ico');
} else {
    console.error('Failed to create icon.ico');
}

// Create ICNS (using this library as fallback or verification, though shell script handles it)
// const icns = png2icons.createICNS(input, png2icons.BICUBIC, 0);
// if (icns) {
//     fs.writeFileSync('public/icon_js.icns', icns);
//     console.log('Created icon_js.icns');
// }
