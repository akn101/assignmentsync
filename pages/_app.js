import React from 'react';
import { ChakraProvider, extendTheme, ColorModeScript, Box } from "@chakra-ui/react";
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '../styles/globals.css';

const theme = extendTheme({
  fonts: {
    heading: "Inter",
    body: "Inter",
  },
  overflow: 'auto',
  config: {
    initialColorMode: "system",
    useSystemColorMode: true,
  },
  styles: {
    global: (props) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
      },
    }),
  },
});

function MyApp({ Component, pageProps }) {
  return (
    <ChakraProvider theme={theme}>
      {/* Global background blobs */}
      <Box position="fixed" top={0} left={0} w="100vw" h="100vh" overflow="hidden" pointerEvents="none" zIndex={-1} style={{ maxWidth: '100vw' }}>
        <div className="gradient-blob blob-purple-pink"></div>
        <div className="gradient-blob blob-pink-orange"></div>
      </Box>

      <Component {...pageProps} />
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    </ChakraProvider>
  )
}

export default MyApp;
