import {copyFileSync, existsSync} from "node:fs";
if(existsSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs")) copyFileSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs","public/pdf.worker.min.mjs");
