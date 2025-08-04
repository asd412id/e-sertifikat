import api from './api';

export const eventService = {
  // Get all events
  getEvents: async (page = 1, limit = 10) => {
    const response = await api.get(`/events?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Get event by ID
  getEvent: async (id) => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },

  // Create new event
  createEvent: async (eventData) => {
    const response = await api.post('/events', eventData);
    return response.data;
  },

  // Update event
  updateEvent: async (id, eventData) => {
    const response = await api.put(`/events/${id}`, eventData);
    return response.data;
  },

  // Delete event
  deleteEvent: async (id) => {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  },

  // Get event participant fields
  getParticipantFields: async (id) => {
    const response = await api.get(`/events/${id}/participant-fields`);
    return response.data;
  }
};

export const participantService = {
  // Get participants for an event
  getParticipants: async (eventId, page = 1, limit = 10, search = '') => {
    const response = await api.get(`/events/${eventId}/participants?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
    return response.data;
  },

  // Get participant by ID
  getParticipant: async (id) => {
    const response = await api.get(`/participants/${id}`);
    return response.data;
  },

  // Add new participant
  addParticipant: async (eventId, participantData) => {
    const response = await api.post(`/events/${eventId}/participants`, participantData);
    return response.data;
  },

  // Update participant
  updateParticipant: async (id, participantData) => {
    const response = await api.put(`/participants/${id}`, participantData);
    return response.data;
  },

  // Delete participant
  deleteParticipant: async (id) => {
    const response = await api.delete(`/participants/${id}`);
    return response.data;
  },

  // Import participants from Excel
  importParticipants: async (eventId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/events/${eventId}/participants/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Export participants to Excel
  exportParticipants: async (eventId) => {
    const response = await api.get(`/events/${eventId}/participants/export`);
    return response.data;
  }
};

export const certificateService = {
  // Get templates for an event
  getTemplates: async (eventId, page = 1, limit = 10) => {
    const response = await api.get(`/certificates/events/${eventId}/templates?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Get template by ID
  getTemplate: async (id) => {
    const response = await api.get(`/certificates/templates/${id}`);
    return response.data;
  },

  // Create new template
  createTemplate: async (templateData) => {
    const response = await api.post('/certificates/templates', templateData);
    return response.data;
  },

  // Update template
  updateTemplate: async (id, templateData) => {
    const response = await api.put(`/certificates/templates/${id}`, templateData);
    return response.data;
  },

  // Delete template
  deleteTemplate: async (id) => {
    const response = await api.delete(`/certificates/templates/${id}`);
    return response.data;
  },

  // Generate certificate for one participant
  generateCertificate: async (templateId, participantId) => {
    const response = await api.post(`/certificates/templates/${templateId}/participants/${participantId}/generate`);
    return response.data;
  },

  // Generate certificates for all participants
  generateAllCertificates: async (templateId) => {
    const response = await api.post(`/certificates/templates/${templateId}/generate-all`, {}, {
      timeout: 600000 // 10 minute timeout for certificate generation
    });
    return response.data;
  },

  // Upload background image
  uploadBackground: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/certificates/upload-background', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Download certificate
  downloadCertificate: async (filename) => {
    const response = await api.get(`/certificates/download/${filename}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Bulk download certificates
  bulkDownloadCertificates: async (eventId) => {
    try {
      console.log('Requesting bulk download for event:', eventId);

      const response = await api.post(`/certificates/events/${eventId}/bulk-download`, {}, {
        responseType: 'blob',
        timeout: 300000 // 5 minute timeout for large downloads
      });

      console.log('Bulk download response received, size:', response.data.size, 'type:', response.data.type);
      console.log('Response headers:', response.headers);

      // Check if response is actually a zip blob
      if (response.data && response.data.size > 0) {
        // Verify it's a zip file by checking content type or size
        if (response.data.type === 'application/zip' || response.headers['content-type'] === 'application/zip') {
          return response.data;
        } else {
          console.warn('Response type mismatch, but proceeding with download');
          return response.data;
        }
      } else {
        throw new Error('File kosong atau tidak valid');
      }
    } catch (error) {
      console.error('Bulk download service error:', error);

      if (error.response) {
        console.log('Error response status:', error.response.status);
        console.log('Error response headers:', error.response.headers);

        if (error.response.data instanceof Blob) {
          // Try to parse error from blob
          const text = await error.response.data.text();
          try {
            const errorData = JSON.parse(text);
            throw new Error(errorData.error || 'Server error');
          } catch {
            throw new Error('Server returned an error');
          }
        }
      }
      throw error;
    }
  }
};
