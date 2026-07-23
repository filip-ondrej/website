import type { Metadata } from 'next';
import ProjectsMatrix from '@/components/ProjectsMatrix';

export const metadata: Metadata = {
    title: 'All Projects — Filip Ondrej',
    description: 'The full project index — every build, every year.',
};

export default function ProjectsPage() {
    return <ProjectsMatrix />;
}
