/**
 * Default landing-page content. Themes get this through DefaultLanding
 * and may use, reword, or ignore it entirely.
 */
export interface SocialItem {
  type: 'linkedin' | 'bluesky' | 'github' | 'google' | 'miles' | 'kreftforeningen'
  href: string
  cssClass?: string
}

export interface LandingContent {
  name: string
  blurbs: string[]
  location: string
  socials: SocialItem[]
}

export const profile: LandingContent = {
  name: 'petter hareim',
  blurbs: [
    'father, husband, geek, aspiring good guy.',
    'help folks. write code. build things.',
  ],
  location: "54°26'51 S 3°19'15 E",
  socials: [
    { type: 'linkedin', href: 'https://www.linkedin.com/in/phareim', cssClass: 'linkedIn' },
    { type: 'bluesky', href: 'https://bsky.app/profile/phareim.no', cssClass: 'bluesky' },
    { type: 'github', href: 'https://github.com/phareim', cssClass: 'github' },
    { type: 'google', href: 'https://partner.cloudskillsboost.google/public_profiles/e7dcea7a-372a-4671-b56e-7daec9d97f47' },
    { type: 'miles', href: 'https://www.miles.no/kontakt-oss', cssClass: 'miles' },
  ],
}
