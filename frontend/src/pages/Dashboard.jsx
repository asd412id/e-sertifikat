import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  IconButton,
  Button,
  Avatar,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import {
  Event,
  People,
  Verified,
  Add,
  TrendingUp,
  CalendarMonth,
  Analytics,
  EmojiEvents,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import api from '../services/api';
import Layout from '../components/Layout';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalParticipants: 0,
    totalVerifieds: 0,
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Dashboard - e-Sertifikat';
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const eventsResponse = await api.get('/events?limit=5');
      const events = eventsResponse.data.data.events;

      setRecentEvents(events);

      // Calculate stats
      const totalEvents = eventsResponse.data.data.totalCount;
      const totalParticipants = events.reduce((sum, event) => sum + event.participantCount, 0);
      const totalVerifieds = events.reduce((sum, event) => sum + event.templateCount, 0);

      setStats({
        totalEvents,
        totalParticipants,
        totalVerifieds,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  // Data statistik dengan styling modern
  const statsData = [
    {
      title: 'Total Acara',
      value: stats.totalEvents,
      icon: <Event sx={{ fontSize: 40 }} />,
      color: '#2196F3',
      bgColor: '#E3F2FD',
      gradient: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
      description: 'Jumlah acara yang telah dibuat'
    },
    {
      title: 'Total Peserta',
      value: stats.totalParticipants,
      icon: <People sx={{ fontSize: 40 }} />,
      color: '#FF9800',
      bgColor: '#FFF3E0',
      gradient: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
      description: 'Jumlah peserta yang terdaftar'
    },
    {
      title: 'Template Terverifikasi',
      value: stats.totalVerifieds,
      icon: <Verified sx={{ fontSize: 40 }} />,
      color: '#4CAF50',
      bgColor: '#E8F5E8',
      gradient: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)',
      description: 'Template sertifikat yang telah diverifikasi'
    },
  ];

  const StatCard = ({ title, value, icon, color, bgColor, gradient, description }) => (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 2,
                background: gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              {icon}
            </Box>
            <Box textAlign="right">
              <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', color }}>
                {value}
              </Typography>
            </Box>
          </Box>
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <Box>
        {/* Header Section */}
        <Paper
          elevation={0}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            p: 4,
            borderRadius: 3,
            mb: 4,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Dashboard
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                Kelola acara dan sertifikat Anda dengan mudah
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => navigate('/events')}
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                fontWeight: 600,
                px: 3,
                py: 1.5,
                borderRadius: 2,
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.3)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              Buat Acara Baru
            </Button>
          </Stack>
        </Paper>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {statsData.map((stat, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <StatCard {...stat} />
            </Grid>
          ))}
        </Grid>

        {/* Recent Events */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <CalendarMonth />
            </Box>
            <Box>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                Acara Terbaru
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Acara yang baru saja dibuat atau diperbarui
              </Typography>
            </Box>
          </Stack>

          {recentEvents.length > 0 ? (
            <Grid container spacing={3}>
              {recentEvents.map((event) => (
                <Grid item xs={12} md={6} lg={4} key={event.id}>
                  <Card
                    elevation={0}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 2,
                      }
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="h6" component="div" sx={{ fontWeight: 600, mb: 1 }}>
                            {event.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {format(new Date(event.startDate), 'dd MMMM yyyy', { locale: id })} - {format(new Date(event.endDate), 'dd MMMM yyyy', { locale: id })}
                          </Typography>
                        </Box>

                        <Divider />

                        <Stack direction="row" justifyContent="space-between">
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <People sx={{ fontSize: 18, color: 'primary.main' }} />
                            <Typography variant="body2" color="text.secondary">
                              {event.participantCount} Peserta
                            </Typography>
                          </Stack>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Verified sx={{ fontSize: 18, color: 'success.main' }} />
                            <Typography variant="body2" color="text.secondary">
                              {event.templateCount} Template
                            </Typography>
                          </Stack>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box textAlign="center" py={6}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  mx: 'auto',
                  mb: 3,
                  bgcolor: 'grey.100',
                  color: 'grey.400',
                }}
              >
                <EmojiEvents sx={{ fontSize: 40 }} />
              </Avatar>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                Belum Ada Acara
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Buat acara pertama Anda untuk memulai mengelola sertifikat digital
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<Add />}
                onClick={() => navigate('/events')}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                Buat Acara Pertama
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    </Layout>
  );
};

export default Dashboard;
