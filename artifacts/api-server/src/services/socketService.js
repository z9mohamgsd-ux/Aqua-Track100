let io = null;

export const init = (socketIo) => {
  io = socketIo;

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join-user-room', (userId) => {
      if (userId) {
        socket.join(`user-${userId}`);
        console.log(`Socket ${socket.id} joined room user-${userId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

export const broadcast = (event, data) => {
  if (io) io.emit(event, data);
};

export const broadcastToUser = (userId, event, data) => {
  if (io) io.to(`user-${userId}`).emit(event, data);
};
