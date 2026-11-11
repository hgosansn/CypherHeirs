import {prepareRuntime} from './runtime.mjs';
import {build} from 'vite';
await prepareRuntime();await build();
