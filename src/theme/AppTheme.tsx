import defaultTheme from "./defaultTheme";
import customTheme from "./muiDocsTheme";
import { ThemeProvider } from "@mui/material";

interface AppThemeProps {
  children: React.ReactNode;
  /**
   * This is for the docs site. You can ignore it or remove it.
   */
  disableCustomTheme?: boolean;
}

export default function AppTheme(props: AppThemeProps) {
  const { children, disableCustomTheme } = props;

  const theme = disableCustomTheme ? defaultTheme : customTheme;

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
