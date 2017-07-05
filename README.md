# Razonable
Just another indexeddb wrapper.

## Why another indexeddb wrapper?
For one, because indexeddb is really powerful, and most of the wrappers I've found so far don't make the tradeoffs I was looking for.

Primarily:

 - Prioritize responsiveness over benchmark speed.
 - Don't hide the power of indexes from the user.
 - Don't do too much.

Lets break those down,

1. Prioritize responsiveness

   When it comes to pure performance, LokiDB is great. However, while fast, it's difficult to be performant for a User Interface if you have a large number of records. Razonable prioritizes the ability to not block your UI. Razonable does this by using promises. This results in the total query time being higher, but never blocking your UI for very long (iteration size is determined by the developer).

   Additionally, a developer shouldn't have to wait for the entire query to finish before getting any results, Razonable prioritizes your ability to get results quicky.

2. IndexedDB has really good indexes

   Creating indexes is easy in indexeddb (surprising), there is no reason to recreate this or get in the way, so Razonable prioritizes your ability to use the native indexes. This means you can leverage the increasing speed of IndexedDB over time.

3. Don't do too much

   Provide a clear api, be fast, be responsive, get out of the way.

----

Some additional details.

1. Two tags are added to every record `_updated` and `_created`, these are primarily for the indexes that allow querying your records, but are also nice pieces of data to have.
2. Cursors are bounds based, so if you use the _updated index, it's easy to re-request and get all the objects that have been modified since your last request. (this can be helpful if other tabs or other promises are updating your data store).

Some examples:

### Open a database and search for some items:
```
     var d = new Database('test');

     d.ready.then(function() {
         return d.forEach(function(item) {
             if (item.value % 100 == 0 && item.step % 400 == 0) {
                 console.log(item);
             }
         }, d.cursorWithIndex('updated', 'next'));
     }).then(function() {
         console.log("Done");
     });
```

### Update multiple items at once

```javascript

     var d = new Database('test');

     d.ready.then(function() {
         var elements = {
           'firstKey': {
             'value': 200,
             'name': "Bob",
           },
           'secondKey': {
             'value': 5000,
             'name': "Katie",
           }
         };

         d.multiSetItems(elements).then(function() {
           console.log('Done');
         });

     });
```

## Methods Razonable provides:

 - [x] count();
 - [x] getItem(string);
 - [x] multiGetItems([string]);
 - [x] setItem(string, {});
 - [x] multiSetItems({ string: {} });
 - [x] removeItem(string);
 - [x] multiRemoveItem([string]);
 - [x] keys();
 - [x] cursor(); (By primary key)
 - [x] cursorWithIndex(indexName: string, direction?:string);
 - [x] clear();
 - [x] destroy();
 - [x] forEach( (item:any) => void, cursor? );

While forEach use Cursors internally, direct access is provided via `cursor` and `cursorWithIndex`.

Cursors are intended to be serializeable, and thus provide the following methods:

 - [x] save();
 - [x] load(string);

Cursors provide two other methods:

 - [x] next(number);
 - [x] filter( (item:any) => boolean );

`next` provides a promise that returns the next N rows from the database, in key order or index order. `filter` accepts a callback (which returns true or false) and then returns results by iterating through the database and returning the items where the callback evaluated to true.

In general, `Database.forEach` is a better interface for this, but for more complex uses, `filter` is available.

