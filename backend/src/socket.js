let _io = null;

/** stationId -> Map(userId -> { userId, username }) for logged-in listeners */
const stationListeners = new Map();
/** socket.id -> { stationId, userId, username } so we can remove on disconnect */
const socketToStation = new Map();

export function setIO(io) {
  _io = io;
}

export function emitStationUpdate(stationId, event, data) {
  if (_io) _io.to(`station:${stationId}`).emit(event, data);
}

/** Add a logged-in user as listener; returns current list for broadcast. */
export function addStationListener(stationId, userId, username, socketId) {
  if (!stationListeners.has(stationId)) stationListeners.set(stationId, new Map());
  const map = stationListeners.get(stationId);
  map.set(userId, { userId, username: username || 'Anonymous' });
  socketToStation.set(socketId, { stationId, userId, username });
  return getStationListenersList(stationId);
}

/** Remove one user from a station (on unsubscribe). */
export function removeStationListener(stationId, userId, socketId) {
  socketToStation.delete(socketId);
  const map = stationListeners.get(stationId);
  if (!map) return [];
  map.delete(userId);
  if (map.size === 0) stationListeners.delete(stationId);
  return getStationListenersList(stationId);
}

/** Remove socket on disconnect; returns [{ stationId, listeners }] for broadcasts. */
export function removeSocketFromStations(socketId) {
  const info = socketToStation.get(socketId);
  if (!info) return [];
  const { stationId, userId } = info;
  socketToStation.delete(socketId);
  const map = stationListeners.get(stationId);
  if (!map) return [];
  map.delete(userId);
  const list = getStationListenersList(stationId);
  if (map.size === 0) stationListeners.delete(stationId);
  return [{ stationId, listeners: list }];
}

export function getStationListenersList(stationId) {
  const map = stationListeners.get(stationId);
  if (!map) return [];
  return Array.from(map.values());
}

/** Current listener count for one station (from socket room size). */
export function getStationListenerCount(stationId) {
  if (!_io?.sockets?.adapter?.rooms) return 0;
  const room = _io.sockets.adapter.rooms.get(`station:${stationId}`);
  return room ? room.size : 0;
}

/** Map of stationId -> current listener count for all station rooms. */
export function getStationListenerCounts() {
  const counts = {};
  if (!_io?.sockets?.adapter?.rooms) return counts;
  const prefix = 'station:';
  for (const [roomName, sockets] of _io.sockets.adapter.rooms) {
    if (roomName.startsWith(prefix)) {
      const stationId = roomName.slice(prefix.length);
      counts[stationId] = sockets.size;
    }
  }
  return counts;
}
