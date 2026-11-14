import * as React from 'react';
import RootSvg, { RootSvgProps } from '@/icons/RootSvg';
import { useTheme } from '@mui/material/styles';

export default function SvgHamburgerMenu(props: RootSvgProps) {
  const theme = useTheme();
  const fillColor = theme.palette.primary.main;

  return (
    <RootSvg
      xmlns="http://www.w3.org/2000/svg"
      width={18}
      height={18}
      viewBox="0 0 16 16"
      fill="none"
      {...props}
    >
      <rect x={1} y={5} width={14} height={1.5} rx={1} fill={fillColor} />
      <rect x={1} y={9} width={14} height={1.5} rx={1} fill={fillColor} />
    </RootSvg>
  );
}
