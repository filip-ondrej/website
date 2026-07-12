export type Collaborator = {
    name: string;
    logo?: string;
    href?: string;
    caption?: string;
    /**
     * Story behind the tile — the /content/collaborations/{storySlug}.md file.
     * ONLY tiles with a storySlug are clickable (same rule as the graph, where
     * only dots with an `article` open a modal). To light a tile up: copy
     * /public/content/collaborations/_template.md, fill it in, drop it next to
     * it, and set this field. No storySlug = plain logo tile, not interactive.
     */
    storySlug?: string;
};

/**
 * Filip's Collaboration Network
 *
 * Each story-backed collaboration links to: /public/content/collaborations/{storySlug}.md
 * The _template.md in that folder shows EVERY supported part (frontmatter fields,
 * story sections, picture + video embeds) — copy it and delete what a given
 * collaboration doesn't need.
 */
export const collaborators: Collaborator[] = [
    {
        name: 'Junior Akademia',
        logo: '/logos/juniorakademia.svg',
        href: 'https://juniorakademia.spse-po.sk/',
        caption: 'Tutoring',
    },
    {
        name: 'VALT',
        logo: '/logos/valt.svg',
        href: 'https://projekty.spse.cz/vamlte/output.html',
        caption: 'Erasmus+ Project',
    },
    {
        name: 'Education',
        logo: '/logos/education.svg',
        href: 'https://www.minedu.sk/',
        caption: 'Support',
    },
    {
        name: 'MTEC',
        logo: '/logos/mtec.svg',
        href: 'https://mtec.et8.tuhh.de/institute',
        caption: 'Research Assistant',
        storySlug: 'mtec',
    },
    {
        name: 'PSK',
        logo: '/logos/psk.svg',
        href: 'https://psk.sk/',
        caption: 'Support',
    },
    {
        name: 'IMEK',
        logo: '/logos/imek.svg',
        href: 'https://www.tuhh.de/imek/en/institute-for-mechatronics-in-mechanics-tuhh',
        caption: 'Tutoring',
    },
    {
        name: 'NPI',
        logo: '/logos/npi.svg',
        href: 'https://newproductioninstitute.de/en',
        caption: 'Innovation Partner',
    },
    {
        name: 'Economy',
        logo: '/logos/economy.svg',
        href: 'https://www.economy.gov.sk/',
        caption: 'Support',
    },
    {
        name: 'MakersHome',
        logo: '/logos/makershome.svg',
        href: 'https://makershome.de/',
        caption: 'Innovation Hub',
    },
    {
        name: 'IDAC',
        logo: '/logos/idaclong.svg',
        href: 'https://www.tuhh.de/idac/news',
        caption: 'Innovation Partner',
    },
    {
        name: 'SPSEPO',
        logo: '/logos/spsepo.svg',
        href: 'https://www.spse-po.sk/',
        caption: 'Support',
    },
    {
        name: 'Vectorealism',
        logo: '/logos/vectorealism.svg',
        href: 'https://www.vectorealism.com/en/',
        caption: 'Internship',
    },
    {
        name: 'Erasmus',
        logo: '/logos/erasmus.svg',
        href: 'https://erasmus.spse-po.sk/',
        caption: 'Mobility',
    },
    {
        name: 'Haniska',
        logo: '/logos/haniska.svg',
        href: 'https://www.obechaniska.sk/',
        caption: 'Project Collaboration',
    },
    {
        // TEMPLATE PREVIEW — Boyser temporarily shows the _template.md story so
        // the full modal (all parts: meta, outcomes, pictures, video) can be
        // reviewed in place. Replace with `storySlug: 'boyser'` + a real
        // boyser.md during the content pass.
        name: 'Boyser',
        logo: '/logos/boyser.svg',
        href: 'https://www.boyser.sk/englishindex.php?id=about-us',
        caption: 'Internship',
        storySlug: '_template',
    },
    {
        name: 'Startupport',
        logo: '/logos/startupport.svg',
        href: 'https://startupport.de/en/',
        caption: 'Innovation Hub',
    },
    {
        name: 'Cannaxy',
        logo: '/logos/cannaxy.svg',
        href: 'https://cannaxy.space/',
        caption: 'Innovation Partner',
    },
];
