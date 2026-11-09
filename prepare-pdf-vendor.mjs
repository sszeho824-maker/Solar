import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(import.meta.url),src=path.dirname(require.resolve('pdfjs-dist/package.json')),dest=new URL('dist/vendor/pdfjs/',import.meta.url);fs.mkdirSync(dest,{recursive:true});
for(const name of ['pdf.mjs','pdf.worker.mjs'])fs.copyFileSync(path.join(src,'build',name),new URL(name,dest));
for(const folder of ['cmaps','standard_fonts','wasm'])fs.cpSync(path.join(src,folder),new URL(folder,dest),{recursive:true});
fs.copyFileSync(path.join(src,'LICENSE'),new URL('LICENSE',dest));
console.log('PDF.js assets prepared.');