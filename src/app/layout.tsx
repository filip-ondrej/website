import {ProgressLine} from '@/components/00_ProgressLine';
import LoadingWrapper from '@/components/00_LoadingAnimation';
import Navbar from '@/components/01_NavigationBar';
import ContactFooter from '@/components/09_ContactFooter';
import './globals.css';
import type {Metadata} from 'next';
import {Rajdhani} from 'next/font/google';

const rajdhani = Rajdhani({subsets: ['latin'], weight: ['400', '600', '700']});

export const metadata: Metadata = {
    title: 'Filip Ondrej',
    description: 'Filip Ondrej — 10 Years of Robotics Portfolio',
};

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <body className={`${rajdhani.className}`}>
        <LoadingWrapper>
            <ProgressLine/>
            {/* Navbar renders its own <header> — don't nest another one. */}
            <Navbar />

            {children}

            <footer>
                <ContactFooter />
            </footer>
        </LoadingWrapper>
        </body>
        </html>
    );
}
