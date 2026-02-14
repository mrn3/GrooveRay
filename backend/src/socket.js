let _io = null;

export function setIO(io) {
  _io = io;
}

export function emitStationUpdate(stationId, event, data) {
  if (_io) _io.to(`station:${stationId}`).emit(event, data);
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
