import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Violeta ITAPU (engranaje del logo, #422774).
// Modo claro: botones en el índice 7 (#422774), hover = índice 8.
// Modo oscuro: #422774 casi no se distingue del fondo gris, así que los botones usan
// el índice 5 (#7650B3), el mismo violeta pero más luminoso; hover = índice 6.
const itapu: MantineColorsTuple = [
  '#F1ECF8', '#E0D6F0', '#C9B8E4', '#AE95D4', '#9172C4',
  '#7650B3', '#5C3A96', '#422774', '#361F60', '#29184A',
];

export const theme = createTheme({
  fontFamily: 'Inter, sans-serif',
  primaryColor: 'itapu',
  primaryShade: { light: 7, dark: 5 },
  autoContrast: true, // texto blanco sobre ambos tonos
  colors: { itapu },
});