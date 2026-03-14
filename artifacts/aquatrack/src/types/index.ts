export interface SensorReading {
  id: string;
  deviceId: string;
  ph: number;
  temperature: number;
  turbidity: number;
  conductivity: number;
  timestamp: Date | string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Device {
  deviceId: string;
  name?: string;
  status: 'connected' | 'disconnected';
  lastSeen: Date | string | null;
  latitude: number | null;
  longitude: number | null;
  latestReading: SensorReading | null;
  registeredAt?: Date | string;
}

export interface DeviceWithLocation extends Device {
  location: {
    latitude: number | null;
    longitude: number | null;
  };
  readings: SensorReading | null;
}

export interface Alert {
  id: string;
  deviceId: string;
  deviceName?: string;
  parameter: 'ph' | 'temperature' | 'turbidity' | 'conductivity';
  type: 'low' | 'high';
  value: number;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date | string;
  resolved: boolean;
  resolvedAt?: Date | string;
}

export interface Thresholds {
  ph: { min: number; max: number; unit: string };
  temperature: { min: number; max: number; unit: string };
  turbidity: { min: number; max: number; unit: string };
  conductivity: { min: number; max: number; unit: string };
}

export interface SensorStatus {
  status: 'safe' | 'warning' | 'danger';
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export interface ConnectionStatus {
  type: 'websocket' | 'polling' | 'disconnected';
  message: string;
}

export type TimeRange = '1H' | '24H' | '7D' | '30D';
export type Theme = 'light' | 'dark';
export type WeatherCondition = 'partly-cloudy' | 'rainy' | 'sunny';

export type TicketStatus = 'open' | 'pending_close' | 'escalated' | 'closed' | 'archived';

export interface Ticket {
  id: number;
  user_id: number;
  subject: string;
  description: string;
  status: TicketStatus;
  assigned_to: number | null;
  closure_proposed_at: string | null;
  closure_proposed_by: number | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  user_email: string;
  assigned_email: string | null;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  sender_id: number;
  sender_email: string;
  sender_role: string;
  message: string;
  created_at: string;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
}

export interface UserRecord {
  id: number;
  email: string;
  role: 'owner' | 'admin' | 'user';
  status: 'active' | 'suspended' | 'banned';
  created_at: string;
}
