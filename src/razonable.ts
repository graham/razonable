function errorHandler(event: any) {
    console.log(event);
}

const DEFAULT_ITEM_PER_ITERATION = 2500;

class Database {
    db: IDBDatabase;
    name: string;
    ready: Promise<boolean>;

    constructor(db_name: string) {
        this.name = db_name;

        this.ready = new Promise((resolve, reject) => {
            const request = window.indexedDB.open(db_name, 1);

            request.onsuccess = (event) => {
                console.log("DB already exists... continuing");
                this.db = request.result;
                resolve(true);
            };

            request.onerror = (event) => {
                console.log(event);
            };

            request.onupgradeneeded = (event) => {
                console.log("Upgrading database...");
                this.db = request.result;

                const objectStore = this.db.createObjectStore("keys", { keyPath: "key" });
                objectStore.createIndex("key", "key", { unique: true });
                objectStore.createIndex("updated", "_updated", { unique: false });
                objectStore.createIndex("created", "_created", { unique: false });
                objectStore.transaction.oncomplete = (event) => {
                    resolve(false);
                }
            };
        });
    }

    count(): Promise<number> {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["keys"], "readonly");
            const store = tx.objectStore("keys");

            const request = store.count();
            request.onsuccess = (event) => {
                resolve(request.result);
            }
            request.onerror = (event) => {
                errorHandler(event);
                reject(event);
            }
        });

    }

    getItem(key: string): Promise<any | null> {
        return new Promise((resolve, reject) => {
            this.multiGetItems([key]).then((result) => {
                resolve(result[key]);
            });
        })
    }

    multiGetItems(keys: Array<string>): Promise<{ [id: string]: any | null }> {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["keys"], "readonly");
            const store = tx.objectStore("keys");

            let result: { [id: string]: any } = {};
            let promises: Array<Promise<any | null>> = [];

            keys.forEach((stringKey) => {
                result[stringKey] = null;

                promises.push(new Promise((res, rej) => {
                    const request = store.get(stringKey);
                    request.onsuccess = (event) => {
                        res(request.result);
                    }
                    request.onerror = (event) => {
                        errorHandler(event);
                        rej(event);
                    }
                }));
            });

            Promise.all(promises).then((results) => {
                results.forEach((value) => {
                    if (value) {
                        result[value.key] = value;
                    }
                });
                resolve(result);
            });
        });
    }

    setItem(key: string, value: any): Promise<any> {
        return new Promise((resolve, reject) => {
            let args: { [id: string]: any } = {};
            args[key] = value;
            this.multiSetItems(args).then((result) => {
                resolve(result[key]);
            });
        })
    }

    multiSetItems(keysToValueMap: { [id: string]: any }): Promise<{ [id: string]: any | null }> {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["keys"], "readwrite");
            const store = tx.objectStore("keys");

            let promises: Array<Promise<any | null>> = [];

            Object.keys(keysToValueMap).forEach((stringKey) => {
                const value = keysToValueMap[stringKey];

                promises.push(new Promise((res, rej) => {
                    const getRequest = store.get(stringKey);
                    getRequest.onsuccess = (event) => {
                        value.key = stringKey;
                        value._updated = (new Date().getTime());

                        if (getRequest.result) {
                            value._created = getRequest.result._created;
                            store.put(value);
                            res(value);
                        } else {
                            value._created = value._updated;

                            const request = store.add(value);

                            request.onsuccess = (event) => {
                                res(request.result);
                            }
                            request.onerror = (event) => {
                                errorHandler(event);
                                rej(event);
                            }
                        }
                    }

                    getRequest.onerror = (event) => {
                        errorHandler(event);
                        rej(event);
                    }
                }));
            });

            Promise.all(promises).then((results) => {
                resolve(results);
            });
        });
    }

    removeItem(key: string): Promise<any | null> {
        return new Promise((resolve, reject) => {
            this.multiRemoveItems([key]).then((result) => {
                resolve(result[key]);
            });
        })
    }

    multiRemoveItems(keys: Array<string>): Promise<any> {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["keys"], "readwrite");
            const store = tx.objectStore("keys");

            let promises: Array<Promise<any | null>> = [];

            keys.forEach((stringKey) => {
                promises.push(new Promise((res, rej) => {
                    const request = store.delete(stringKey);

                    request.onsuccess = (event) => {
                        res(request.result);
                    }
                    request.onerror = (event) => {
                        errorHandler(event);
                        rej(event);
                    }
                }));
            });

            Promise.all(promises).then((results) => {
                resolve(results);
            });
        });
    }

    keys(): Promise<Array<string>> {
        const tx = this.db.transaction(["keys"], "readonly");
        const store = tx.objectStore("keys");

        let results: Array<string> = [];

        return new Promise((resolve, reject) => {
            const request = store.openCursor();

            request.onsuccess = (event) => {
                let cursor = request.result;
                if (cursor) {
                    results.push(cursor.value.key);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            }
            request.onerror = (event) => {
                errorHandler(event);
                reject(event);
            }
        });
    }

    cursor(): Cursor {
        return new Cursor(this.db);
    }

    cursorWithIndex(indexName: string, direction?: string): Cursor {
        return new Cursor(this.db, indexName, direction);
    }

    clear(): Promise<any> {
        const tx = this.db.transaction(["keys"], "readwrite");
        const store = tx.objectStore("keys");

        return new Promise((resolve, reject) => {
            const request = store.clear();

            request.onsuccess = (event) => {
                resolve(request.result);
            }
            request.onerror = (event) => {
                errorHandler(event);
                reject(event);
            }
        });

    }

    destroy(): Promise<any> {
        return new Promise((resolve, reject) => {
            console.log("Attempting to destroy database");

            const request = indexedDB.deleteDatabase(this.name);
            request.onerror = (event) => {
                errorHandler(event);
                reject(event);
            }
            request.onsuccess = (event) => {
                errorHandler(event);
                resolve(event);
            }
        });
    }

    forEach(callback: (item: any) => void, cursor?: Cursor): Promise<Array<any>> {
        return new Promise((resolve, reject) => {
            let iterator = (cursor: Cursor) => {
                cursor.next().then((results) => {
                    results.forEach(callback);

                    if (cursor.hasMore == true) {
                        setTimeout(() => {
                            iterator(cursor);
                        }, 0);
                    } else {
                        resolve([]);
                    }
                });
            };

            let thecursor = cursor || this.cursor();
            iterator(thecursor);
        });
    }
}


class Cursor {
    db: IDBDatabase;
    table: string;
    index: string | null;
    lastKeyValue: string | null;
    direction: string;
    hasMore: boolean;

    constructor(db: IDBDatabase, index?: string, direction?: string) {
        this.db = db;
        this.table = "keys";
        this.index = index || null;
        this.lastKeyValue = null;
        this.direction = direction || "next";
        this.hasMore = true;
    }

    save(): string {
        return JSON.stringify({
            lastKeyValue: this.lastKeyValue,
            direction: this.direction
        });
    }

    load(value: string) {
        const obj = JSON.parse(value);
        this.lastKeyValue = obj['lastKeyValue'];
        this.direction = obj['direction'];
    }

    next(limit?: number): Promise<Array<any>> {
        const transaction = this.db.transaction([this.table], "readonly");
        const store = transaction.objectStore(this.table);

        let target: IDBIndex | IDBObjectStore;
        let keyPath: string;

        if (this.index != null) {
            target = store.index(this.index);
            keyPath = String(target.keyPath);
        } else {
            target = store;
            keyPath = 'key';
        }

        let hits = 0;
        let results: Array<any> = [];
        let request: IDBRequest;

        if (this.lastKeyValue === null) {
            request = target.openCursor(undefined, this.direction);
        } else {
            const keyRange = IDBKeyRange.lowerBound(this.lastKeyValue, true);
            request = target.openCursor(keyRange, this.direction);
        }

        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = request.result;
                if (cursor) {
                    results.push(cursor.value);
                    hits += 1;
                    if (hits >= (limit || DEFAULT_ITEM_PER_ITERATION)) {
                        this.lastKeyValue = cursor.value[keyPath];
                        this.hasMore = true;
                        resolve(results);
                    } else {
                        cursor.continue();
                    }
                } else {
                    if (results.length) {
                        this.lastKeyValue = results[results.length - 1][keyPath];
                    }
                    this.hasMore = false;
                    resolve(results);
                }
            }

            request.onerror = (event) => {
                this.hasMore = false;
                errorHandler(event);
                reject(event);
            }
        });
    }

    filter(callback: (item: any) => boolean): Promise<Array<any>> {
        return new Promise((resolve, reject) => {
            this.next().then((results) => {
                let final_results = [];
                for (let item of results) {
                    if (callback(item) == true) {
                        final_results.push(item);
                    }
                }
                resolve(final_results);
            });
        });
    }
}

