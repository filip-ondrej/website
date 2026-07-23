import type { ProjectModalData } from '@/components/ProjectModal';

/* ---------- Shared project data ----------
   One source of truth for the home-page Projects section AND the /projects
   matrix page. ProjectItem is the modal's data shape: id/title/year/blurb/
   images/tags drive the card + matrix row, plus the OPTIONAL rich fields
   (hook, overview, challenge, outcome, metrics, story, takeaway, videos,
   documents) that light up the detail modal as they're filled in. */
export type ProjectItem = ProjectModalData;

export const PROJECTS: ProjectItem[] = [
    {
        id: 'thailand-2022',
        title: 'RoboCup Thailand 2022 – Best Hardware Award',
        year: 2022,
        blurb:
            'Custom-designed autonomous rescue robot with hand-soldered PCBs, 3D-printed chassis, and advanced sensor arrays. Competed against 20+ countries and won Best Hardware Award for engineering excellence.',
        images: [
            '/images/projects/thailand.jpg',
            '/images/projects/thailand2.jpg',
        ],
        tags: ['world-class', 'pcb-design', 'embedded'],
    },
    {
        id: 'sydney-2019',
        title: 'RoboCup Sydney 2019 – 4th Place Worldwide',
        year: 2019,
        blurb:
            'Led team to 4th place finish at age 15 in virtual rescue simulation category. Programmed multi-agent coordination, A* pathfinding, and triage algorithms.',
        images: [
            '/images/projects/sydney.jpg',
            '/images/projects/sydney2.jpg',
            '/images/projects/sydney3.jpg',
            '/images/projects/sydney4.jpg',
        ],
        tags: ['multi-agent', 'pathfinding', 'world-class'],
    },
    {
        id: 'robocup-line',
        title: 'RoboCup – Rescue Line Robot',
        year: 2023,
        blurb:
            'Autonomous line-following with debris avoidance, ramp climbing and victim detection. Custom PCB design, PID control loops. Won 5 of 6 categories at nationals.',
        images: [
            '/images/projects/robocup-line.jpg',
            '/images/projects/robocup-line2.jpg',
            '/images/projects/robocup-line3.jpg',
        ],
        tags: ['robotics', 'embedded', 'pid'],
    },
    {
        id: 'heat-pump',
        title: 'Industrial Heat Pump – Diagnostic Model',
        year: 2022,
        blurb:
            'Reverse-engineered a 20-ton commercial heat pump from technical drawings. Built functional 1:200 scale model to resolve €50K+ project dispute.',
        images: [
            '/images/projects/heat-pump.png',
            '/images/projects/heat-pump-cad.png',
            '/images/projects/heat-pump-print.png',
        ],
        tags: ['mechanical', 'reverse-engineering', '3d-printing'],
    },
];
