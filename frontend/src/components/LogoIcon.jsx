import React from 'react';
import { Box } from '@mui/material';

const LogoIcon = ({ size = 32, showText = false, variant = 'gradient' }) => {
  const gradientColors = {
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    primary: '#667eea',
    white: '#ffffff'
  };

  const Logo = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        width="32"
        height="32"
        rx="8"
        fill={variant === 'gradient' ? 'url(#logoGradient)' : gradientColors[variant]}
      />
      {variant === 'gradient' && (
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#667eea' }} />
            <stop offset="100%" style={{ stopColor: '#764ba2' }} />
          </linearGradient>
        </defs>
      )}

      {/* Certificate Icon */}
      <rect x="6" y="8" width="20" height="16" rx="2" fill="white" fillOpacity="0.9" />
      <rect x="8" y="10" width="16" height="1" fill="#667eea" fillOpacity="0.7" />
      <rect x="8" y="12" width="12" height="1" fill="#667eea" fillOpacity="0.5" />
      <rect x="8" y="14" width="14" height="1" fill="#667eea" fillOpacity="0.5" />

      {/* Award Ribbon */}
      <polygon points="22,16 26,16 24,20 22,18" fill="#ffd700" />
      <polygon points="22,18 24,20 22,22 20,20" fill="#ffed4e" />

      {/* Verified Badge */}
      <circle cx="24" cy="10" r="3" fill="#4ade80" />
      <path
        d="M22.5 10L23.5 11L25.5 9"
        stroke="white"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (!showText) {
    return <Logo />;
  }

  return (
    <Box display="flex" alignItems="center" gap={1}>
      <Logo />
      <Box
        component="span"
        sx={{
          fontWeight: 'bold',
          fontSize: size > 24 ? '1.2rem' : '1rem',
          background: variant === 'gradient' ? gradientColors.gradient : gradientColors[variant],
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: variant === 'gradient' ? 'transparent' : 'inherit',
          color: variant !== 'gradient' ? gradientColors[variant] : 'inherit'
        }}
      >
        e-Sertifikat
      </Box>
    </Box>
  );
};

export default LogoIcon;
