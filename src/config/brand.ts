/**
 * Brand Assets Configuration
 * 
 * SimpleLabOS uses a "Hub & Spoke" brand architecture:
 * - Hub: SimpleLabOS (general) - used on simplelabos.com homepage
 * - Spokes: Industry-specific variants (dental, optical, repair, jewelry)
 * 
 * Usage:
 * import { getBrandAssets } from '@/config/brand';
 * const assets = getBrandAssets('dental');
 * <img src={assets.logo} alt={assets.name} />
 */

export type Industry = 'dental' | 'optical' | 'repair' | 'jewelry' | 'general';

export interface BrandAssets {
    name: string;
    tagline: string;
    logo: string;
    logoFull?: string;
    logoWhite?: string;
    favicon: string;
    ogImage: string;
    primaryColor: string;
    accentColor: string;
}

const brandAssets: Record<Industry, BrandAssets> = {
    general: {
        name: 'SimpleLabOS',
        tagline: 'The Operating System for Modern Laboratories',
        logo: '/brand/general/logo.png',
        logoWhite: '/brand/general/logo-white.png',
        favicon: '/brand/general/favicon.png',
        ogImage: '/brand/general/og-image.png',
        primaryColor: '#0D9488', // Teal
        accentColor: '#0284C7', // Blue
    },
    dental: {
        name: 'SimpleLabOS for Dental Labs',
        tagline: 'The Modern Dental Lab Management System',
        logo: '/brand/dental/logo.png',
        logoFull: '/brand/dental/logo-full.png',
        favicon: '/brand/dental/logo.png', // Use logo as favicon for now
        ogImage: '/brand/dental/logo-full.png',
        primaryColor: '#0D9488',
        accentColor: '#0284C7',
    },
    optical: {
        name: 'SimpleLabOS for Optical Labs',
        tagline: 'Streamline Your Optical Lab Operations',
        logo: '/brand/optical/logo.png',
        favicon: '/brand/optical/logo.png',
        ogImage: '/brand/optical/logo.png',
        primaryColor: '#7C3AED', // Purple for optical
        accentColor: '#4F46E5',
    },
    repair: {
        name: 'SimpleLabOS for Repair Shops',
        tagline: 'Manage Your Repair Business Efficiently',
        logo: '/brand/repair/logo.png',
        favicon: '/brand/repair/logo.png',
        ogImage: '/brand/repair/logo.png',
        primaryColor: '#EA580C', // Orange for repair
        accentColor: '#DC2626',
    },
    jewelry: {
        name: 'SimpleLabOS for Jewelry Shops',
        tagline: 'Craft Beautiful Customer Experiences',
        logo: '/brand/jewelry/logo.png',
        favicon: '/brand/jewelry/logo.png',
        ogImage: '/brand/jewelry/logo.png',
        primaryColor: '#CA8A04', // Gold for jewelry
        accentColor: '#A16207',
    },
};

/**
 * Get brand assets for a specific industry
 */
export function getBrandAssets(industry: Industry = 'general'): BrandAssets {
    return brandAssets[industry] || brandAssets.general;
}

/**
 * Get the logo path for an industry
 */
export function getLogoPath(industry: Industry = 'general'): string {
    return getBrandAssets(industry).logo;
}

/**
 * Get the brand name for an industry
 */
export function getBrandName(industry: Industry = 'general'): string {
    return getBrandAssets(industry).name;
}

export default brandAssets;
