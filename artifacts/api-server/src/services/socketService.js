let io = null;

const init = (socketIo) => {
  io = socketIo;

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Client sends their userId after connecting so we can route events to them
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

// Broadcast to everyone (admin-style — use sparingly)
const broadcast = (event, data) => {
  if (io) io.emit(event, data);
};

// Broadcast only to a specific user's room
const broadcastToUser = (userId, event, data) => {
  if (io) io.to(`user-${userId}`).emit(event, data);
};

module.exports = { init, broadcast, broadcastToUser };
