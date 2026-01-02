import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/AuthContext';
import { Toaster } from 'sonner';
import VidarQueueWidget from '@/components/VidarQueueWidget';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'RIS - Radiology Information System',
  description: 'Cloud-based Teleradiology RIS integrated with Orthanc PACS',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <VidarQueueWidget />
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
