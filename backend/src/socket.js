let _io = null;

export function setIO(io) {
  _io = io;
}

export function emitStationUpdate(stationId, event, data) {
  if (_io) _io.to(`station:${stationId}`).emit(event, data);
}
