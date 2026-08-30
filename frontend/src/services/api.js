import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

export const api = {
  // Detect oil spill from SAR image
  detectSpill: async (imageId) => {
    const response = await axios.post(`${API_BASE_URL}/detection/`, {
      image_id: imageId
    });
    return response.data;
  },

  // Simulate backward drift trajectory
  simulateDrift: async (centroid, timestamp, hours = 12) => {
    const response = await axios.post(`${API_BASE_URL}/drift/`, {
      centroid: centroid,
      timestamp: timestamp,
      hours_backward: hours
    });
    return response.data;
  },

  // Get vessels in area
  getVessels: async (bbox, startTime, endTime) => {
    const response = await axios.post(`${API_BASE_URL}/vessels/`, {
      bbox: bbox,
      start_time: startTime,
      end_time: endTime
    });
    return response.data.vessels;
  }
};
