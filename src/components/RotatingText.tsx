import { useState, useEffect } from 'react';
import { Box, Typography, Fade } from '@mui/material';
import { styled } from '@mui/material/styles';

const CarouselText = styled(Typography)(({ theme }) => ({
  color: theme.palette.grey[300],
  fontWeight: 500,
  textAlign: 'center',
}));

const phrases = [
  'Personalized Picks',
  'Zero Guesswork',
  'Smart Searches',
  'Better Learning'
];

export const RotatingText = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % phrases.length);
        setIsVisible(true);
      }, 500); // Half of the interval for smooth transition
    }, 3000); // Change text every 3 seconds

    return () => clearInterval(intervalId);
  }, []);

  return (
    <Box sx={{ height: 40, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Fade in={isVisible} timeout={500}>
        <CarouselText variant="h5">
          {phrases[currentIndex]}
        </CarouselText>
      </Fade>
    </Box>
  );
};