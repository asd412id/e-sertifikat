import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import DownloadHub from './pages/DownloadHub';
import DownloadCertificate from './pages/DownloadCertificate';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Participants from './pages/Participants';
import Certificates from './pages/Certificates';
import Profile from './pages/Profile';
import IssuedCertificates from './pages/IssuedCertificates';
import { CircularProgress, Box } from '@mui/material';

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/download" element={<DownloadHub />} />
      <Route path="/download/:slug" element={<DownloadCertificate />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events"
        element={
          <ProtectedRoute>
            <Events />
          </ProtectedRoute>
        }
      />
      <Route
        path="/participants/:eventId"
        element={
          <ProtectedRoute>
            <Participants />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:eventId/certificates"
        element={
          <ProtectedRoute>
            <Certificates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/certificates/issued"
        element={
          <ProtectedRoute>
            <IssuedCertificates />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
} export default App;
