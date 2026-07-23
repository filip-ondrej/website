import Hero from '@/components/01_Hero';
import TitleReveal from '@/components/02_TitleReveal';
import PromoVideo from '@/components/02_PromoVideo';
import TimelineTitle from "@/components/03_TimelineTitle";
import ProgressTimeline from '@/components/03_ProgressTimeline';
import ProjectTitle from "@/components/04_ProjectTitle";
import Projects from '@/components/04_Projects';
import CollaborationTitle from "@/components/05_CollaborationTitle";
import Collaborations from '@/components/05_Collaborations';
import PressRecognitionTitle from "@/components/08_PressRecognitionTitle";
import Recognition from '@/components/08_PressRecognition';
import CircuitBoard from '@/components/08_CircuitBoard';
import ContactTitle from "@/components/09_ContactTitle";

//import { LineAnchor } from '@/components/00_LineAnchor';

export default function Home() {
    return (
        <main>
            <Hero />
            <TitleReveal />
            {/* Unstyled wrapper divs = nav scroll-spy anchors. Layout-neutral
                (no styles), so the spine's mount-time anchor measurements and
                every section's geometry are untouched. */}
            <div id="film">
                <PromoVideo />
            </div>
            <div id="journey">
                {/* reserveBelowPx must stay 0: the title's own --tt-trail is computed so
                    title-bottom → graph-crossing equals the crossing → title-top gap. */}
                <TimelineTitle reserveBelowPx={0} />
                <ProgressTimeline />
            </div>
            <div id="projects">
                <ProjectTitle />
                <Projects />
            </div>
            <div id="collaborate">
                <CollaborationTitle />
                <Collaborations />
            </div>
            <div id="press">
                <PressRecognitionTitle />
                <Recognition />
            </div>
            {/*<CircuitBoard />*/}
            <div id="contact">
                <ContactTitle />
            </div>
        </main>
    );
}
