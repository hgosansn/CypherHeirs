import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({base:'./',build:{rollupOptions:{input:{landing:fileURLToPath(new URL('./index.html',import.meta.url)),dashboard:fileURLToPath(new URL('./dashboard.html',import.meta.url))}}},publicDir:'.runtime-static',plugins:[react(),tailwindcss()],resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},server:{host:'127.0.0.1',port:8792,strictPort:true}});
