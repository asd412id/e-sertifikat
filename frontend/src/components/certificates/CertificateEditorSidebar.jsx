import React from 'react';
import {
  Box,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';

const CertificateEditorSidebar = ({
  templateName,
  onTemplateNameChange,
  tabValue,
  onTabChange,
  leftPanelScrollRef,
  onLeftPanelScroll,
  children
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        width: 320,
        p: 3,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2
      }}
    >
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: 'background.paper',
          pb: 2
        }}
      >
        <TextField
          label="Nama Template"
          value={templateName}
          onChange={(e) => onTemplateNameChange?.(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Tabs
            value={tabValue}
            onChange={(e, v) => onTabChange?.(v)}
            sx={{
              minHeight: 36,
              '& .MuiTab-root': {
                fontWeight: 'bold',
                fontSize: '0.9rem',
                minHeight: 36
              }
            }}
          >
            <Tab label="Elemen" />
            <Tab label="Properti" />
          </Tabs>
        </Box>

        <Divider sx={{ mt: 2 }} />
      </Box>

      <Box
        ref={leftPanelScrollRef}
        onScroll={(e) => {
          onLeftPanelScroll?.(e);
        }}
        sx={{
          flex: 1,
          overflow: 'auto',
          pt: 2,
          pr: 1,
          pb: 6
        }}
      >
        {children}
      </Box>
    </Paper>
  );
};

export default CertificateEditorSidebar;
