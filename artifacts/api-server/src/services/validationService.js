export const thresholds = {
  ph: {
    min: parseFloat(process.env.PH_MIN) || 6.0,
    max: parseFloat(process.env.PH_MAX) || 8.5
  },
  temperature: {
    min: parseFloat(process.env.TEMP_MIN) || 15.0,
    max: parseFloat(process.env.TEMP_MAX) || 35.0
  },
  turbidity: {
    max: parseFloat(process.env.TURBIDITY_MAX) || 5.0
  },
  conductivity: {
    min: parseFloat(process.env.CONDUCTIVITY_MIN) || 100.0,
    max: parseFloat(process.env.CONDUCTIVITY_MAX) || 300.0
  }
};

export const validateSensorData = ({ ph, temperature, turbidity, conductivity }) => {
  const errors = [];

  if (typeof ph !== 'number' || isNaN(ph) || ph < 0 || ph > 14) {
    errors.push('pH must be a number between 0 and 14');
  }

  if (typeof temperature !== 'number' || isNaN(temperature) || temperature < -50 || temperature > 100) {
    errors.push('Temperature must be a number between -50 and 100°C');
  }

  if (typeof turbidity !== 'number' || isNaN(turbidity) || turbidity < 0) {
    errors.push('Turbidity must be a non-negative number');
  }

  if (typeof conductivity !== 'number' || isNaN(conductivity) || conductivity < 0) {
    errors.push('Conductivity must be a non-negative number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const getThresholds = () => thresholds;
