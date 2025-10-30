import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

// Placeholder for Carbon Terminal icon
// You can replace this with a proper SVG or an icon from @mui/icons-material
export const CarbonTerminal: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props}>
      <path d="M2 4V20H22V4H2ZM20 18H4V6H20V18ZM6 10H8V12H6V10ZM10 10H12V12H10V10ZM14 10H16V12H14V10Z" />
    </SvgIcon>
  );
};
