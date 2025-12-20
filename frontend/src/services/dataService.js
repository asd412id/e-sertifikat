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

  updatePublicDownloadSettings: async (id, settings) => {
    const response = await api.put(`/events/${id}/public-download-settings`, settings);
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

  // Public portal: get portal info (no auth)
  getPublicPortalInfo: async (slug) => {
    const response = await api.get(`/certificates/public/${slug}`);
    return response.data;
  },

  // Public portal: download PDF (no auth)
  publicDownloadPDF: async (slug, identifier) => {
    const response = await api.post(
      `/certificates/public/${slug}/download-pdf`,
      { identifier },
      {
        responseType: 'blob',
        timeout: 300000
      }
    );
    return response;
  },

  // Bulk download certificates as single PDF
  bulkDownloadCertificatesPDF: async (eventId, templateId) => {
    try {
      console.log('Requesting bulk PDF download for event:', eventId, 'template:', templateId);

      const response = await api.post(`/certificates/events/${eventId}/templates/${templateId}/bulk-download-pdf`, {}, {
        responseType: 'blob',
        timeout: 600000 // 10 minute timeout for large PDF generation
      });

      console.log('Bulk PDF download response received, size:', response.data.size, 'type:', response.data.type);
      console.log('Response headers:', response.headers);

      // Check if response is actually a PDF blob
      if (response.data && response.data.size > 0) {
        // Verify it's a PDF file by checking content type
        if (response.data.type === 'application/pdf' || response.headers['content-type'] === 'application/pdf') {
          return response.data;
        } else {
          console.warn('Response type mismatch, but proceeding with download');
          return response.data;
        }
      } else {
        throw new Error('File PDF kosong atau tidak valid');
      }
    } catch (error) {
      console.error('Bulk PDF download service error:', error);

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
  },

  // Generate and download individual certificate using the bulk PDF generation approach
  generateAndDownloadCertificate: async (templateId, participantId) => {
    try {
      console.log('Requesting individual certificate PDF download for participant:', participantId, 'template:', templateId);

      const response = await api.post(`/certificates/templates/${templateId}/participants/${participantId}/download-pdf`, {}, {
        responseType: 'blob',
        timeout: 300000 // 5 minute timeout for generation
      });

      console.log('Individual certificate PDF download response received, size:', response.data.size, 'type:', response.data.type);
      console.log('Response headers:', response.headers);

      // Check if response is actually a PDF blob
      if (response.data && response.data.size > 0) {
        // Verify it's a PDF file by checking content type
        if (response.data.type === 'application/pdf' || response.headers['content-type'] === 'application/pdf') {
          return response.data;
        } else {
          console.warn('Response type mismatch, but proceeding with download');
          return response.data;
        }
      } else {
        throw new Error('File sertifikat kosong atau tidak valid');
      }
    } catch (error) {
      console.error('Individual certificate PDF download service error:', error);

      if (error.response) {
        console.log('Error response status:', error.response.status);
        console.log('Error response headers:', error.response.headers);

        if (error.response.data instanceof Blob) {
          // Try to parse error from blob
          try {
            const text = await error.response.data.text();
            const errorData = JSON.parse(text);
            throw new Error(errorData.error || 'Server error');
          } catch (e) {
            console.error('Error parsing error response:', e);
            throw new Error('Terjadi kesalahan saat memproses sertifikat');
          }
        } else if (error.response.data && typeof error.response.data === 'string') {
          throw new Error(error.response.data);
        } else if (error.response.data && error.response.data.error) {
          throw new Error(error.response.data.error);
        }
      }

      throw error;
    }
  },
};
