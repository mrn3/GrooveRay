import React, { createContext, useContext, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const ListUpdatesContext = createContext(null);

/** Payload from server: { type, id, community_avg_rating?, community_rating_count?, total_listen_count? } */
export function ListUpdatesProvider({ children }) {
  const socketRef = useRef(null);
  const callbacksRef = useRef({ songs: new Set(), stations: new Set(), playlists: new Set() });
  const subscribedRef = useRef(new Set());

  const ensureSocket = useCallback(() => {
    if (socketRef.current?.connected) return socketRef.current;
    if (socketRef.current) return socketRef.current;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('grooveray_token') : null;
    const socket = io(undefined, { path: '/socket.io', auth: { token } });
    socketRef.current = socket;
    socket.on('list:update', (data) => {
      const type = data?.type;
      const sets = callbacksRef.current[type];
      if (!sets?.size) return;
      const payload = { id: data.id, ...data };
      delete payload.type;
      sets.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.warn('ListUpdates callback error', e);
        }
      });
    });
    return socket;
  }, []);

  const subscribe = useCallback(
    (type, callback) => {
      if (!['songs', 'stations', 'playlists'].includes(type)) return () => {};
      const socket = ensureSocket();
      callbacksRef.current[type].add(callback);
      if (!subscribedRef.current.has(type)) {
        subscribedRef.current.add(type);
        socket.emit('list:subscribe', type);
      }
      return () => {
        callbacksRef.current[type].delete(callback);
        if (callbacksRef.current[type].size === 0 && subscribedRef.current.has(type)) {
          subscribedRef.current.delete(type);
          socket.emit('list:unsubscribe', type);
        }
      };
    },
    [ensureSocket]
  );

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners('list:update');
        subscribedRef.current.forEach((type) => socketRef.current.emit('list:unsubscribe', type));
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  const value = { subscribe };
  return <ListUpdatesContext.Provider value={value}>{children}</ListUpdatesContext.Provider>;
}

export function useListUpdates(type, onUpdate) {
  const ctx = useContext(ListUpdatesContext);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!ctx) return () => {};
    return ctx.subscribe(type, (payload) => {
      onUpdateRef.current(payload);
    });
  }, [ctx, type]);
}
