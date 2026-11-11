// Shared browser-local store. Existing workspace keys and database version are retained.
const DB='levellens-client',STORE='state';
async function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function read(key){try{const db=await database();return await new Promise((resolve,reject)=>{const t=db.transaction(STORE),r=t.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);t.oncomplete=()=>db.close();});}catch{return null;}}
export async function save(key,value){const db=await database();return new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(value,key);t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>{db.close();reject(t.error);};});}
export async function locked(name,fn){return globalThis.navigator?.locks?navigator.locks.request(name,fn):fn();}
