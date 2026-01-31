#!/bin/bash
ICONSET="public/icon.iconset"
mkdir -p $ICONSET

# Standard resize
sips -z 16 16     -s format png public/logo_real.png --out $ICONSET/icon_16x16.png
sips -z 32 32     -s format png public/logo_real.png --out $ICONSET/icon_16x16@2x.png
sips -z 32 32     -s format png public/logo_real.png --out $ICONSET/icon_32x32.png
sips -z 64 64     -s format png public/logo_real.png --out $ICONSET/icon_32x32@2x.png
sips -z 128 128   -s format png public/logo_real.png --out $ICONSET/icon_128x128.png
sips -z 256 256   -s format png public/logo_real.png --out $ICONSET/icon_128x128@2x.png
sips -z 256 256   -s format png public/logo_real.png --out $ICONSET/icon_256x256.png
sips -z 512 512   -s format png public/logo_real.png --out $ICONSET/icon_256x256@2x.png
sips -z 512 512   -s format png public/logo_real.png --out $ICONSET/icon_512x512.png
sips -z 1024 1024 -s format png public/logo_real.png --out $ICONSET/icon_512x512@2x.png

iconutil -c icns $ICONSET -o public/icon.icns
rm -rf $ICONSET
echo "Created icon.icns"
