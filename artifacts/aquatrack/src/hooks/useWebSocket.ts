import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ConnectionStatus } from '@/types';

interface UseWebSocketOptions {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  onSensorData?: (data: any) => void;
  onAlert?: (alert: any) => void;
  onAlertResolved?: (data: any) => void;
  onDeviceRegistered?: (device: any) => void;
  onDeviceDeleted?: (data: { deviceId: string }) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    type: 'disconnected',
    message: 'Disconnected',
  });
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    const socket = io('', {
      path: '/socket.io',
      transports: ['polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
      setConnectionStatus({ type: 'websocket', message: 'Connected' });
      reconnectAttemptsRef.current = 0;
      optionsRef.current.onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      setConnectionStatus({ type: 'disconnected', message: `Disconnected: ${reason}` });
      optionsRef.current.onDisconnect?.(reason);
    });

    socket.on('connect_error', (error) => {
      reconnectAttemptsRef.current++;
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setConnectionStatus({ type: 'polling', message: 'Falling back to polling mode' });
        socket.disconnect();
      }
      optionsRef.current.onError?.(error);
    });

    socket.on('error', (error) => {
      optionsRef.current.onError?.(error);
    });

    socket.on('sensor-data', (data) => {
      optionsRef.current.onSensorData?.(data);
    });

    socket.on('alert', (alert) => {
      optionsRef.current.onAlert?.(alert);
    });

    socket.on('alert-resolved', (data) => {
      optionsRef.current.onAlertResolved?.(data);
    });

    socket.on('device-registered', (device) => {
      optionsRef.current.onDeviceRegistered?.(device);
    });

    socket.on('device-deleted', (data) => {
      optionsRef.current.onDeviceDeleted?.(data);
    });

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setConnectionStatus({ type: 'disconnected', message: 'Disconnected' });
    }
  }, []);

  const subscribeToDevice = useCallback((deviceId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe-device', deviceId);
    }
  }, []);

  const unsubscribeFromDevice = useCallback((deviceId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe-device', deviceId);
    }
  }, []);

  const sendPing = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('ping');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    const pingInterval = setInterval(() => {
      sendPing();
    }, 30000);
    return () => clearInterval(pingInterval);
  }, [isConnected, sendPing]);

  return {
    socket: socketRef.current,
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    subscribeToDevice,
    unsubscribeFromDevice,
    sendPing,
  };
}

export default useWebSocket;
