'use client';

import { CONTACT_EMAIL } from "@/config/content/contact";
import MainLayout from "@/layouts/MainLayout";
import { Container, Divider, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";

interface Section {
  heading: string;
  paragraphs?: string[];
  table?: { columns: string[]; rows: string[][] };
}

const sections: Section[] = [
  {
    heading: 'Information We Collect',
    paragraphs: [
      'We collect the following categories of information when you use CourseCorrect:',
    ],
    table: {
      columns: ['Data', 'How collected', 'Why', 'Retention'],
      rows: [
        ['Email address', 'Firebase Auth (sign-in)', 'Account management', 'Until account deletion'],
        ['Saved courses / programs', 'Saved by you in-app', 'Feature functionality', 'Until you remove or delete your account'],
        ['Search queries', 'Google Analytics (anonymised)', 'Product improvement', '90 days, then anonymised'],
        ['Cora chat messages', 'Browser localStorage only — never sent to our servers', 'Feature functionality', '3 days in your browser; automatically deleted after that'],
        ['Affiliate click events', 'Affiliate network (Impact, etc.)', 'Commission tracking', 'Per affiliate programme terms'],
        ['Browser & device data', 'Standard web analytics', 'Analytics', 'Per analytics provider policy'],
        ['Waitlist email', 'Submitted via waitlist form', 'CC 2.0 early access notifications', 'Until you unsubscribe'],
      ],
    },
  },
  {
    heading: 'Cora Chat Messages',
    paragraphs: [
      'Cora conversations are stored exclusively in your browser\'s localStorage. They are never transmitted to or stored on CourseCorrect\'s servers. Messages are automatically deleted from your browser after 3 days.',
      'When you send a message to Cora, it is transmitted to Google\'s Vertex AI service to generate a response. Google processes this data in accordance with their data processing terms. We do not use your Cora conversations to train AI models.',
    ],
  },
  {
    heading: 'How We Use Your Information',
    paragraphs: [
      'We use the information we collect to: provide, operate, and maintain our website and services; personalise your experience (e.g. saved courses, chat history); understand how users interact with our platform so we can improve it; send service-related communications (e.g. account notices); and for abuse prevention and rate limiting.',
    ],
  },
  {
    heading: 'Third-Party Data Sharing',
    paragraphs: [
      'We share data with third parties only as described below. We do not sell your personal information.',
    ],
    table: {
      columns: ['Third party', 'Data shared', 'Purpose'],
      rows: [
        ['Firebase (Google)', 'Email address, user ID', 'Authentication'],
        ['Google Analytics / GTM', 'Anonymised usage events', 'Analytics'],
        ['Affiliate networks (Impact, etc.)', 'Click events, enrolment conversions', 'Commission tracking'],
        ['Google Vertex AI / Gemini', 'Cora chat messages (in-flight only)', 'Generating AI responses'],
        ['O*NET / BLS', 'None — we query their public data', 'Career insights'],
      ],
    },
  },
  {
    heading: 'Cookies and Tracking',
    paragraphs: [
      'We use first-party cookies for authentication (Firebase) and session management. We use third-party cookies set by Google Analytics for anonymised usage analytics.',
      'You can disable cookies in your browser settings. Disabling authentication cookies will prevent you from signing in. Disabling analytics cookies has no effect on core functionality.',
      'For visitors in the EU, a cookie consent notice is displayed on first visit. You can decline non-essential (analytics) cookies at any time without loss of functionality.',
    ],
  },
  {
    heading: 'GDPR — Rights for Users in the European Union',
    paragraphs: [
      'If you are located in the European Union, you have the following rights regarding your personal data:',
      '\u2022 Right of access — request a copy of the data we hold about you.\n\u2022 Right to erasure — request deletion of your personal data ("right to be forgotten").\n\u2022 Right to rectification — request correction of inaccurate data.\n\u2022 Right to data portability — receive your data in a machine-readable format.\n\u2022 Right to object — object to processing based on legitimate interests.\n\u2022 Right to withdraw consent — where processing is based on consent, withdraw it at any time.',
      `To exercise any of these rights, email ${CONTACT_EMAIL} with the subject line "Data Request". We will respond within 30 days as required by GDPR.`,
      'CourseCorrect stores data on Google Cloud Platform infrastructure in the United States. International data transfers are covered by Google\'s Data Processing Agreement and the EU-US Data Privacy Framework.',
    ],
  },
  {
    heading: 'California Privacy Rights (CCPA)',
    paragraphs: [
      'If you are a California resident, you have the right to know what personal information we collect about you and how it is used, request deletion of your personal information, and opt out of the sale of personal information.',
      `We do not sell personal information. To submit a data request, email ${CONTACT_EMAIL} with the subject line "California Data Request".`,
    ],
  },
  {
    heading: 'Data Security',
    paragraphs: [
      'We take reasonable technical and organisational measures to protect your personal information. However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.',
    ],
  },
  {
    heading: 'Children\'s Privacy',
    paragraphs: [
      'Our Services are not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it.',
    ],
  },
  {
    heading: 'Changes to This Policy',
    paragraphs: [
      'We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated date. We encourage you to review this page periodically.',
    ],
  },
  {
    heading: 'Contact Us',
    paragraphs: [
      `If you have any questions or concerns about this Privacy Policy, please contact us at ${CONTACT_EMAIL}.`,
    ],
  },
];

export default function Privacy() {
  return (
    <MainLayout>
      <Container
        maxWidth="md"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 'calc(100vh - 60px)',
          gap: 6,
          py: 8,
        }}
      >
        <Container sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h4">Privacy Policy</Typography>
          <Typography variant="body2">
            At CourseCorrect, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit coursecorrect.fyi or use our services. By using our website or services, you agree to the terms of this Privacy Policy.
          </Typography>
        </Container>

        <Container sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sections.map((section, i) => (
            <Container
              key={i}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: '0 !important' }}
            >
              <Typography variant="h6">{section.heading}</Typography>

              {section.paragraphs?.map((p, j) => (
                <Typography key={j} variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {p}
                </Typography>
              ))}

              {section.table && (
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {section.table.columns.map((col) => (
                          <TableCell key={col} sx={{ fontWeight: 600 }}>{col}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {section.table.rows.map((row, r) => (
                        <TableRow key={r}>
                          {row.map((cell, c) => (
                            <TableCell key={c}>
                              <Typography variant="body2">{cell}</Typography>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Container>
          ))}
        </Container>

        <Divider />

        <Container>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Last updated: April 5, 2026
          </Typography>
        </Container>
      </Container>
    </MainLayout>
  );
}
