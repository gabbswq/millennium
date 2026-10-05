import LocalStore from '@fastify/rate-limit/store/LocalStore.js';

// The pinned plugin's default store returns a mutable object shared by a burst.
export class SnapshotStore extends LocalStore {
  constructor(options) {
    super(options.continueExceeding, options.exponentialBackoff, 1);
  }

  incr(key, callback, timeWindow, max) {
    super.incr(key, (error, result) => callback(error, result && { ...result }), timeWindow, max);
  }

  child(options) {
    return new SnapshotStore(options);
  }
}
