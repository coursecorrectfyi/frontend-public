'use client';

import CustomModal from "@/layouts/CustomModal";
import { trackEvent } from "@/utils/analytics";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyboardArrowRightRounded from "@mui/icons-material/KeyboardArrowRightRounded";
import {
  alpha,
  Box,
  Button,
  Fade,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography
} from "@mui/material";
import { styled } from '@mui/material/styles';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Types
type ModalStep = 'intent' | 'email' | 'confirmation';

interface EarlyAccessModalProps {
  open: boolean;
  onClose: () => void;
}

// Intent options from the spec
const intentOptions = [
  { value: 'grow', label: 'Grow in my current role or get better at what I do' },
  { value: 'switch', label: 'Switch careers' },
  { value: 'start', label: 'Start something of my own (freelancer / founder)' },
  { value: 'explore', label: "Explore options (I'm not sure yet)" },
];

// Styled radio option card
const RadioOptionCard = styled(FormControlLabel)(({ theme }) => ({
  margin: 0,
  width: '100%',
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius * 1.5,
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
    borderColor: theme.palette.primary.light,
  },
  '&.Mui-checked, &:has(.Mui-checked)': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    borderColor: theme.palette.primary.main,
  },
  '& .MuiFormControlLabel-label': {
    fontSize: '0.95rem',
    fontWeight: 500,
    color: theme.palette.text.primary,
  },
  ...theme.applyStyles('dark', {
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
    },
    '&.Mui-checked, &:has(.Mui-checked)': {
      backgroundColor: alpha(theme.palette.primary.main, 0.15),
    },
  }),
}));

export default function EarlyAccessModal({ open, onClose }: EarlyAccessModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<ModalStep>('intent');
  const [selectedIntent, setSelectedIntent] = useState<string>('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // Track modal open
  useEffect(() => {
    if (open) {
      trackEvent('early_access_modal_open', {
        source: 'get-learning-path'
      });
    }
  }, [open]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Small delay to allow close animation
      const timer = setTimeout(() => {
        setStep('intent');
        setSelectedIntent('');
        setEmail('');
        setEmailError('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Auto-redirect after confirmation
  useEffect(() => {
    if (step === 'confirmation') {
      const timer = setTimeout(() => {
        onClose();
        router.push('/');
      }, 4000); // 4 seconds
      return () => clearTimeout(timer);
    }
  }, [step, onClose, router]);

  const handleIntentContinue = () => {
    if (selectedIntent) {
      trackEvent('early_access_intent_selected', {
        intent: selectedIntent
      });
      setStep('email');
    }
  };

  const handleEmailSubmit = async () => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('Please enter your email address');
      return;
    }
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Submit to Google Forms (configured via env; see .env.example)
    const GOOGLE_FORM_URL = process.env.NEXT_PUBLIC_EARLY_ACCESS_FORM_URL;
    const INTENT_ENTRY_ID = process.env.NEXT_PUBLIC_EARLY_ACCESS_INTENT_ENTRY_ID;
    const EMAIL_ENTRY_ID = process.env.NEXT_PUBLIC_EARLY_ACCESS_EMAIL_ENTRY_ID;

    if (!GOOGLE_FORM_URL || !INTENT_ENTRY_ID || !EMAIL_ENTRY_ID) {
      console.warn('[EarlyAccess] NEXT_PUBLIC_EARLY_ACCESS_* is not set; signup not submitted');
      setStep('confirmation');
      return;
    }

    const formData = new FormData();
    formData.append(INTENT_ENTRY_ID, selectedIntent);
    formData.append(EMAIL_ENTRY_ID, email);

    try {
      // Fire and forget - no-cors means we can't read the response
      await fetch(GOOGLE_FORM_URL, {
        method: 'POST',
        body: formData,
        mode: 'no-cors',
      });

      // Track successful signup
      trackEvent('early_access_signup', {
        intent: selectedIntent
      });

      // Only proceed to confirmation if fetch completed successfully
      setStep('confirmation');
    } catch (error) {
      // Only catches network failures (offline, DNS, etc.)
      console.error('Failed to submit early access signup:', error);
      setEmailError('Network error. Please check your connection and try again.');
    }
  };

  // Step 1: Intent Selection
  const IntentStep = (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          mb: 1,
          textAlign: 'center',
        }}
      >
        What best describes your next step?
      </Typography>
      <Typography
        variant="body2"
        sx={(theme) => ({
          color: theme.palette.text.secondary,
          mb: 3,
          textAlign: 'center',
        })}
      >
        This helps us understand what you're trying to achieve.
      </Typography>

      <FormControl fullWidth>
        <RadioGroup
          value={selectedIntent}
          onChange={(e) => setSelectedIntent(e.target.value)}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
        >
          {intentOptions.map((option) => (
            <RadioOptionCard
              key={option.value}
              value={option.value}
              control={<Radio sx={{ mr: 1 }} />}
              label={option.label}
              className={selectedIntent === option.value ? 'Mui-checked' : ''}
            />
          ))}
        </RadioGroup>
      </FormControl>

      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={handleIntentContinue}
        disabled={!selectedIntent}
        endIcon={<KeyboardArrowRightRounded />}
        sx={{
          mt: 3,
          py: 1.5,
          fontWeight: 600,
          textTransform: 'none',
        }}
      >
        Continue
      </Button>
    </Box>
  );

  // Step 2: Email Capture
  const EmailStep = (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          mb: 1,
          textAlign: 'center',
        }}
      >
        You're almost in.
      </Typography>
      <Typography
        variant="body2"
        sx={(theme) => ({
          color: theme.palette.text.secondary,
          mb: 3,
          textAlign: 'center',
        })}
      >
        Leave your email and we'll notify you as soon as we roll out this feature.
      </Typography>

      <TextField
        fullWidth
        type="email"
        label="Email address"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setEmailError('');
        }}
        error={!!emailError}
        helperText={emailError || "No spam. Only updates about this feature."}
        sx={{ mb: 3 }}
        slotProps={{
          formHelperText: {
            sx: (theme) => ({
              color: emailError ? theme.palette.error.main : theme.palette.text.secondary,
            }),
          },
        }}
      />

      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={handleEmailSubmit}
        endIcon={<KeyboardArrowRightRounded />}
        sx={{
          py: 1.5,
          fontWeight: 600,
          textTransform: 'none',
        }}
      >
        Join Early Access
      </Button>
    </Box>
  );

  // Step 3: Confirmation
  const ConfirmationStep = (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <CheckCircleIcon
        sx={(theme) => ({
          fontSize: 64,
          color: theme.palette.success.main,
          mb: 2,
        })}
      />
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          mb: 2,
        }}
      >
        Thanks for being part of this!
      </Typography>
      <Typography
        variant="body1"
        sx={(theme) => ({
          color: theme.palette.text.secondary,
          mb: 3,
          lineHeight: 1.6,
        })}
      >
        When early access opens, you'll be among the first to get it.
        In the meantime, you can <Link href="/">continue exploring courses</Link>.
      </Typography>
      <Typography
        variant="body2"
        sx={(theme) => ({
          color: theme.palette.text.disabled,
          fontSize: '0.8rem',
        })}
      >
        Redirecting to home page...
      </Typography>
    </Box>
  );

  // Render current step with fade transition
  const renderStep = () => {
    switch (step) {
      case 'intent':
        return IntentStep;
      case 'email':
        return EmailStep;
      case 'confirmation':
        return ConfirmationStep;
    }
  };

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      maxWidth={480}
    >
      <Fade in={open} timeout={200}>
        <Box>
          {renderStep()}
        </Box>
      </Fade>
    </CustomModal>
  );
}

