import {prepareRuntime} from './runtime.mjs';
import {createServer} from 'vite';
await prepareRuntime();const server=await createServer();await server.listen();server.printUrls();
