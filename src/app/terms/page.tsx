'use client';

import MainLayout from "@/layouts/MainLayout";
import { Container, Divider, Typography } from "@mui/material";

const terms = [
  {
    heading: 'Acceptance of Terms',
    text: 'By using our Services, you confirm that you are at least 18 years old or have the permission of a legal guardian. You agree to abide by these Terms, all applicable laws, and any additional terms and conditions or policies referenced herein or available by hyperlink.'
  },
  {
    heading: 'Changes to These Terms',
    text: 'We reserve the right to modify these Terms at any time. Any changes will be effective immediately upon posting on this page. Your continued use of the Services after any changes constitutes acceptance of the new Terms. We encourage you to periodically review these Terms for any updates.'
  },
  {
    heading: 'Use of Our Services',
    text: 'You agree to use our Services only for lawful purposes and in a manner that does not infringe the rights of, restrict, or inhibit anyone else\'s use and enjoyment of the Services. Prohibited behaviour includes, but is not limited to: harassing or causing distress to any person; transmitting obscene or offensive content; disrupting the normal flow of dialogue within our Services; automated or non-human access to our Services (including scraping, bots, or crawlers) without our prior written consent; and attempting to circumvent any usage limits applied to Cora or other features of the platform.'
  },
  {
    heading: 'AI-Generated Content',
    text: 'CourseCorrect uses artificial intelligence to generate course summaries, skill analyses, career insights, and responses through our AI assistant Cora (collectively, "AI Content"). AI Content is provided for informational purposes only. We do not warrant its accuracy, completeness, or fitness for any particular purpose. AI Content may contain errors, reflect outdated information, or produce different results across sessions.\n\nYou should not rely on AI Content as a substitute for professional advice of any kind, including career, financial, legal, or medical advice. CourseCorrect is not liable for any decisions made in reliance on AI Content.\n\nCora is subject to usage limits on the free tier. CourseCorrect reserves the right to modify these limits at any time without notice. Creating multiple accounts or using other means to circumvent usage limits is a violation of these Terms.'
  },
  {
    heading: 'Affiliate Relationships',
    text: 'CourseCorrect participates in affiliate marketing programmes with certain course providers. When you enrol in a course, program, or certification through a link on our platform, we may earn a commission from the provider. This commission comes at no additional cost to you.\n\nAffiliate relationships do not influence how content is ranked or recommended on CourseCorrect. Rankings are based on relevance and quality signals, not compensation. We are committed to surfacing the most relevant options for your goals regardless of whether an affiliate relationship exists.'
  },
  {
    heading: 'Third-Party Courses and Providers',
    text: 'CourseCorrect aggregates information about courses, programs, certifications, and other learning content offered by third-party providers. We are not affiliated with, endorsed by, or responsible for the content, quality, pricing, availability, or policies of any third-party provider. All enrolment and payment are governed solely by the respective provider\'s terms of service.\n\nWe periodically refresh our catalogue to reflect current provider information, but course details — including pricing, curriculum, and availability — may be outdated or inaccurate. We recommend verifying current details directly with the provider before enrolling.\n\nOur Services may also contain links to third-party websites. We do not endorse or assume responsibility for any third-party sites, and your access to them is at your own risk.'
  },
  {
    heading: 'User Accounts',
    text: 'To access certain features of our Services, you may be required to create an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.'
  },
  {
    heading: 'Intellectual Property',
    text: 'All content provided on our Services, including but not limited to text, graphics, logos, images, and software, is the property of CourseCorrect or its licensors and is protected by applicable intellectual property laws. You may not use, reproduce, distribute, or create derivative works from our content without our express written permission.\n\nCourse content and materials belong to their respective third-party providers. AI-generated content is not guaranteed to be unique and may produce similar outputs for different users.\n\nThis site incorporates information from O*NET OnLine, by agreement with the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). O*NET\u00ae is a trademark of USDOL/ETA.'
  },
  {
    heading: 'Disclaimer of Warranties',
    text: 'Your use of our Services is at your sole risk. Our Services are provided "as is" and "as available" without any warranty of any kind, either express or implied, including but not limited to the implied warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that our Services will be uninterrupted, error-free, secure, or free from viruses or other harmful components. We make no warranty regarding the accuracy of AI-generated content, the quality of any course or programme, or the availability of affiliate commission rates.'
  },
  {
    heading: 'Limitation of Liability',
    text: 'To the maximum extent permitted by applicable law, in no event will CourseCorrect, its affiliates, officers, directors, employees, agents, or licensors be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, goodwill, or other intangible losses, arising from: (i) your access to or use of, or inability to access or use, our Services; (ii) any conduct or content of any third party on our Services; (iii) any content obtained from our Services, including AI-generated content; (iv) unauthorized access, use, or alteration of your transmissions or content; (v) any career, financial, employment, or other decisions made in reliance on AI-generated content; (vi) enrolment decisions, course outcomes, or experiences with third-party providers; or (vii) affiliate link redirects or transactions with third-party providers.'
  },
  {
    heading: 'Indemnification',
    text: 'You agree to indemnify, defend, and hold harmless CourseCorrect, its affiliates, officers, directors, employees, agents, and licensors from and against any and all claims, damages, obligations, losses, liabilities, costs, or debt and expenses (including but not limited to attorney\'s fees) arising from your use of our Services or your violation of these Terms.'
  },
  {
    heading: 'Termination',
    text: 'We reserve the right to terminate or suspend your access to our Services immediately, without prior notice or liability, for any reason whatsoever, including but not limited to your breach of these Terms.'
  },
  {
    heading: 'Governing Law',
    text: 'These Terms are governed by and construed in accordance with the laws of the Canadian Province of Ontario, without regard to its conflict of law principles. Any dispute arising from these Terms shall be resolved in the courts of Ontario.'
  },
  {
    heading: 'Contact Us',
    text: 'If you have any questions or concerns regarding these Terms, please contact us at contact@example.com'
  },
  {
    heading: 'Entire Agreement',
    text: 'These Terms constitute the entire agreement between you and CourseCorrect regarding the use of our Services and supersede any prior or contemporaneous understandings or agreements, whether written or oral.'
  },
]

export default function Terms() {
  return (
    <MainLayout>
      <Container
        maxWidth="md"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: "calc(100vh - 60px)",
          gap: 6, py: 8,
        }}
      >

        <Container sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h4">Terms of Use</Typography>
          <Typography variant="body2">
            Welcome to CourseCorrect! These Terms and Conditions ("Terms") govern your use of our website, services, and any related content (collectively referred to as the "Services"). By accessing or using our Services, you agree to comply with these Terms. If you do not agree with any part of these Terms, you must not use our Services.
          </Typography>
        </Container>

        <Container sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {terms.map((item, index) =>
            <Container
              key={`terms-${index}`}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                px: '0 !important'
              }}
            >
              <Typography variant="h6">{item.heading}</Typography>
              {item.text.split('\n\n').map((paragraph, i) => (
                <Typography key={i} variant="body2">{paragraph}</Typography>
              ))}
            </Container>
          )}
        </Container>

        <Divider />

        <Container>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Last updated: April 4, 2026
          </Typography>
        </Container>

      </Container>
    </MainLayout>
  );
}
