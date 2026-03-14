let io = null;

const init = (socketIo) => {
  io = socketIo;

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

const broadcast = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = { init, broadcast };
