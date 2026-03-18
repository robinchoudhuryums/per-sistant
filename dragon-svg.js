'use strict';

// Haku dragon SVG paths (pixel art style, converted from new reference)
// SVG stored as separate file, loaded at startup for template embedding
// Original viewBox: 0 0 706 1158

const fs = require('fs');
const path = require('path');

let _dragonSVG = '';

// Load SVG at module init, extract just the path elements (skip background and checkerboard)
try {
  const svgContent = fs.readFileSync(path.join(__dirname, 'haku-dragon.svg'), 'utf8');
  // Extract path elements, filtering out background rect and checkerboard tiles
  const pathRegex = /<path\s+d="([^"]+)"\s+fill="([^"]+)"\s*\/>/g;
  const greyFills = new Set([
    '#F2F2F2', '#EEE', '#FFF', '#FEFEFE', '#EDEDED', '#ECECEC', '#FCFCFC',
    '#FDFDFD', '#FBFBFB', '#F9F9F9', '#ECEDEC', '#EDECEC', '#EDECEB',
    '#EBECEC', '#EBEBEB', '#EBECED', '#ECEBEB', '#EAEBEB', '#E9EBEB',
    '#EBEDEC', '#F7F9F9', '#FEFDFD', '#FDFEFE', '#FCFDFD', '#FBFDFC',
    '#F0EFEF', '#EEEDED', '#EEECEC', '#EBECEB', '#EBEAEA', '#EAEBEA',
    '#FDFCFC', '#FDFDFC', '#FCFCFB', '#FEFEFE', '#EDEDED'
  ]);
  
  let match;
  const paths = [];
  while ((match = pathRegex.exec(svgContent)) !== null) {
    const [, d, fill] = match;
    // Skip background rectangle
    if (d.trim() === 'M0 0h706v1158H0V0Z') continue;
    // Skip checkerboard tiles (short simple rect paths with grey fills)
    if (d.length < 35 && greyFills.has(fill) && /^M\d+ \d+h\d+v\d+/.test(d.trim())) continue;
    paths.push(`<path d="${d}" fill="${fill}"/>`);
  }
  _dragonSVG = paths.join('\n');
} catch (e) {
  // Fallback: empty dragon if SVG file not found
  _dragonSVG = '<!-- haku-dragon.svg not found -->';
}

function getDragonSVG() {
  return _dragonSVG;
}

// No mask needed for pixel art version
function getDragonMask() {
  return '';
}

module.exports = { getDragonSVG, getDragonMask };
