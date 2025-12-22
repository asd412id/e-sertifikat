import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useState as useStateReact } from 'react';
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
  CircularProgress,
  Tooltip,
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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const TruncatedTooltip = ({ title, children }) => {
    const ref = useRef(null);
    const [isTruncated, setIsTruncated] = useStateReact(false);

    const evaluate = () => {
      const el = ref.current;
      if (!el) return;
      const next = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
      setIsTruncated(next);
    };

    useLayoutEffect(() => {
      evaluate();
    }, [title, children]);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;

      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => evaluate()) : null;
      if (ro) ro.observe(el);

      window.addEventListener('resize', evaluate);
      return () => {
        window.removeEventListener('resize', evaluate);
        if (ro) ro.disconnect();
      };
    }, [title, children]);

    return (
      <Tooltip title={isTruncated ? title : ''} disableHoverListener={!isTruncated}>
        <Box ref={ref} sx={{ minWidth: 0 }}>
          {children}
        </Box>
      </Tooltip>
    );
  };

  useEffect(() => {
    document.title = 'Dashboard - e-Sertifikat';
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const eventsResponse = await api.get('/events?limit=6&includeStats=1');
      const events = eventsResponse.data.data.events;
      const globalStats = eventsResponse.data.data.stats;

      setRecentEvents(events);

      // Calculate stats
      const totalEvents = (globalStats && Number.isFinite(Number(globalStats.totalEvents)))
        ? Number(globalStats.totalEvents)
        : eventsResponse.data.data.totalCount;
      const totalParticipants = (globalStats && Number.isFinite(Number(globalStats.totalParticipants)))
        ? Number(globalStats.totalParticipants)
        : events.reduce((sum, event) => sum + event.participantCount, 0);
      const totalVerifieds = (globalStats && Number.isFinite(Number(globalStats.totalTemplates)))
        ? Number(globalStats.totalTemplates)
        : events.reduce((sum, event) => sum + event.templateCount, 0);

      setStats({
        totalEvents,
        totalParticipants,
        totalVerifieds,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Data statistik dengan styling modern
  const statsData = [
    {
      title: 'Total Kegiatan',
      value: stats.totalEvents,
      icon: <Event sx={{ fontSize: 40 }} />,
      color: '#2196F3',
      bgColor: '#E3F2FD',
      gradient: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
      description: 'Jumlah kegiatan yang telah dibuat'
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

  const StatCard = ({ title, value, icon, color, bgColor, gradient, description, onClick }) => (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        transition: 'all 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
        }
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
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
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3 },
            mb: 4,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  background: 'rgba(102, 126, 234, 0.14)',
                  border: '1px solid rgba(102, 126, 234, 0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'primary.main',
                }}
              >
                <Analytics />
              </Box>
              <Box>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 0.25 }}>
                  Dashboard
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ringkasan kegiatan & sertifikat Anda
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => navigate('/events')}
              sx={{
                px: 3,
                py: 1.25,
                borderRadius: 2,
                fontWeight: 700,
              }}
            >
              Buat Kegiatan
            </Button>
          </Stack>
        </Paper>

        {/* Stats Cards */}
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress size={60} />
          </Box>
        ) : (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {statsData.map((stat, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <StatCard
                  {...stat}
                  onClick={() => navigate('/events')}
                />
              </Grid>
            ))}
          </Grid>
        )}

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
                background: 'rgba(102, 126, 234, 0.14)',
                border: '1px solid rgba(102, 126, 234, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.main',
              }}
            >
              <CalendarMonth />
            </Box>
            <Box>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                Kegiatan Terbaru
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Kegiatan yang baru saja dibuat atau diperbarui
              </Typography>
            </Box>
          </Stack>

          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress size={60} />
            </Box>
          ) : recentEvents.length > 0 ? (
            <Grid container spacing={3}>
              {recentEvents.slice(0, 6).map((event) => (
                <Grid item xs={12} md={6} lg={4} key={event.id}>
                  <Card
                    elevation={0}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 2,
                      }
                    }}
                    onClick={() => navigate(`/events/${event.uuid || event.id}/certificates`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/events/${event.uuid || event.id}/certificates`);
                      }
                    }}
                  >
                    <CardContent sx={{ p: 3, flex: 1 }}>
                      <Stack spacing={2}>
                        <Box>
                          <TruncatedTooltip title={event.title || ''}>
                            <Typography
                              variant="h6"
                              component="div"
                              sx={{
                                fontWeight: 700,
                                mb: 0.75,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                lineHeight: 1.25,
                                minHeight: '2.5em'
                              }}
                            >
                              {event.title}
                            </Typography>
                          </TruncatedTooltip>

                          <TruncatedTooltip title={event.description || ''}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mb: 1.25,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                minHeight: event.description ? '2.5em' : 0
                              }}
                            >
                              {event.description || ''}
                            </Typography>
                          </TruncatedTooltip>

                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
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
                Belum Ada Kegiatan
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Buat kegiatan pertama Anda untuk memulai mengelola sertifikat digital
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<Add />}
                onClick={() => navigate('/events')}
                sx={{ px: 4, py: 1.5, borderRadius: 2, fontWeight: 700 }}
              >
                Buat Kegiatan Pertama
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    </Layout>
  );
};

export default Dashboard;
