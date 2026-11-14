import Logo from "@/../public/logo-original.svg";
import LogoWhite from "@/../public/logo-white.svg";
import Box from "@mui/material/Box";
import { Theme } from "@mui/material/styles";
import { SxProps, useTheme } from "@mui/system";
import Image from "next/image";
import Link from "next/link";

interface CCLogoProps {
  /**
   * The system prop that allows defining system overrides as well as additional CSS styles.
   */
  sx?: SxProps<Theme>;
}

export const CCLogo = ({ sx }: CCLogoProps) => {
  const theme = useTheme();
  const logoSrc = theme.palette.mode === "dark" ? LogoWhite : Logo;

  return (
    <Box component={Link} href="/" sx={sx}>
      <Image
        src={logoSrc}
        alt="CourseCorrect Logo"
        style={{ height: "100%", width: "auto" }}
        priority
      />
    </Box>
  );
};

export default CCLogo;
